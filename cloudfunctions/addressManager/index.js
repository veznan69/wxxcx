// 云函数入口文件
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { action, data } = event;

  // 所有操作都需要 openid
  if (!openid) {
    return { success: false, error: '未获取到用户身份' };
  }

  try {
    switch (action) {
      case 'list':
        return await listAddresses(openid);
      case 'add':
        return await addAddress(openid, data);
      case 'update':
        return await updateAddress(openid, data);
      case 'delete':
        return await deleteAddress(openid, data.id);
      case 'setDefault':
        return await setDefaultAddress(openid, data.id);
      default:
        return { success: false, error: '未知操作' };
    }
  } catch (err) {
    console.error('云函数执行错误:', err);
    return { success: false, error: err.message };
  }
};

// 1. 获取地址列表
async function listAddresses(openid) {
  const res = await db.collection('addresses')
    .where({ _openid: openid })
    .orderBy('isDefault', 'desc')
    .orderBy('createTime', 'desc')
    .get();
  return { success: true, data: res.data };
}

// 2. 新增地址
async function addAddress(openid, addressData) {
  const { name, phone, province, city, district, detail, isDefault } = addressData;
  
  // 基本校验
  if (!name || !phone || !province || !detail) {
    return { success: false, error: '请填写完整信息' };
  }
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return { success: false, error: '手机号格式错误' };
  }

  const data = {
    name,
    phone,
    province,
    city: city || '',
    district: district || '',
    detail,
    isDefault: !!isDefault,
    _openid: openid,
    createTime: db.serverDate(),
    updateTime: db.serverDate()
  };

  const addRes = await db.collection('addresses').add({ data });
  const newId = addRes._id;

  // 如果设为默认，则取消其他默认
  if (isDefault) {
    await clearOtherDefault(openid, newId);
  }

  return { success: true, data: { _id: newId } };
}

// 3. 更新地址
async function updateAddress(openid, addressData) {
  const { _id, name, phone, province, city, district, detail, isDefault } = addressData;
  if (!_id) {
    return { success: false, error: '缺少地址ID' };
  }

  // 校验地址是否属于当前用户
  const addrRes = await db.collection('addresses').doc(_id).get();
  if (!addrRes.data || addrRes.data._openid !== openid) {
    return { success: false, error: '地址不存在或无权限' };
  }

  const updateData = {
    name,
    phone,
    province,
    city: city || '',
    district: district || '',
    detail,
    isDefault: !!isDefault,
    updateTime: db.serverDate()
  };

  await db.collection('addresses').doc(_id).update({ data: updateData });

  if (isDefault) {
    await clearOtherDefault(openid, _id);
  }

  return { success: true };
}

// 4. 删除地址
async function deleteAddress(openid, id) {
  if (!id) {
    return { success: false, error: '缺少地址ID' };
  }

  // 校验权限
  const addrRes = await db.collection('addresses').doc(id).get();
  if (!addrRes.data || addrRes.data._openid !== openid) {
    return { success: false, error: '地址不存在或无权限' };
  }

  await db.collection('addresses').doc(id).remove();
  return { success: true };
}

// 5. 设为默认地址
async function setDefaultAddress(openid, id) {
  if (!id) {
    return { success: false, error: '缺少地址ID' };
  }

  // 先取消所有默认
  await db.collection('addresses')
    .where({ _openid: openid })
    .update({ data: { isDefault: false } });

  // 再设置当前为默认
  await db.collection('addresses').doc(id).update({ data: { isDefault: true } });

  return { success: true };
}

// 辅助函数：清除其他默认地址（除指定ID外）
async function clearOtherDefault(openid, excludeId) {
  await db.collection('addresses')
    .where({
      _openid: openid,
      _id: _.neq(excludeId)
    })
    .update({ data: { isDefault: false } });
}