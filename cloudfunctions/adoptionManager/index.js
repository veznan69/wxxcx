const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { action, data } = event;

  if (!openid) {
    return { success: false, error: '未登录' };
  }

  try {
    switch (action) {
      case 'create':
        return await createAdoption(openid, data);
      case 'list':
        return await listAdoptions(openid);
      case 'verify':
        return await verifyAdoption(data.verifyCode, openid); // openid作为核销员
      case 'getDetail':
        return await getAdoptionDetail(openid, data.adoptId);
      default:
        return { success: false, error: '未知操作' };
    }
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
};

// 创建认养
async function createAdoption(openid, data = {}) {
  const { benefitChoice = 1, status = 'pending' } = data;  // 新增status参数

  // 生成认养编号
  const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3,'0');
  const treeNo = `GZ${dateStr}${random}`;

  // 根据 benefitChoice 生成权益包（之前已实现generateBenefits）
  const benefits = generateBenefits(benefitChoice, treeNo);

  const addRes = await db.collection('adoptions').add({
    data: {
      _openid: openid,
      treeNo,
      status: status,               // 动态状态
      benefitChoice,
      benefits,
      createTime: db.serverDate(),
      expireTime: db.serverDate({ offset: 365 * 24 * 60 * 60 * 1000 })
    }
  });

  const verifyCode = addRes._id.slice(-6).toUpperCase();
  await db.collection('adoptions').doc(addRes._id).update({
    data: { verifyCode }
  });

  return { success: true, data: { _id: addRes._id, treeNo, verifyCode, status } };
}

// 辅助函数：根据选择生成权益
function generateBenefits(choice, treeNo) {
  const baseBenefits = [
    { 
      name: '脐橙权益', 
      desc: '保底70斤脐橙，包邮到家', 
      code: `ADV${treeNo}01`, 
      status: 'unused',
      validTime: new Date(Date.now() + 365*24*60*60*1000)
    }
  ];

  if (choice === 1) {
    // 景区套餐
    return baseBenefits.concat([
      { name: '酒店住宿', desc: '大余丫山酒店2天1晚（含双早）', code: `ADV${treeNo}02`, status: 'unused', validTime: new Date(Date.now() + 365*24*60*60*1000) },
      { name: '景区门票', desc: '景区门票2张', code: `ADV${treeNo}03`, status: 'unused', validTime: new Date(Date.now() + 365*24*60*60*1000) }
    ]);
  } else {
    // 农产品套餐
    return baseBenefits.concat([
      { name: '土鸡土鸡蛋', desc: '6只土鸡+30枚土鸡蛋', code: `ADV${treeNo}02`, status: 'unused', validTime: new Date(Date.now() + 365*24*60*60*1000) }
    ]);
  }
}

// 获取用户的认养列表
async function listAdoptions(openid) {
  const res = await db.collection('adoptions')
    .where({ _openid: openid })
    .orderBy('createTime', 'desc')
    .get();
  return { success: true, data: res.data };
}

// 核销（商家端调用）
async function verifyAdoption(verifyCode, verifierOpenid) {
  // 查找待核销的记录
  const res = await db.collection('adoptions')
    .where({
      verifyCode: verifyCode,
      status: 'pending'
    })
    .get();

  if (res.data.length === 0) {
    return { success: false, error: '核销码无效或已核销' };
  }

  const record = res.data[0];
  await db.collection('adoptions').doc(record._id).update({
    data: {
      status: 'verified',
      verifyTime: db.serverDate(),
      verifyOpenid: verifierOpenid
    }
  });

  return { success: true, message: '核销成功' };

  // 新增函数
  async function getAdoptionDetail(openid, adoptId) {
    if (!adoptId) {
      return { success: false, error: '缺少认养ID' };
    }
    const res = await db.collection('adoptions').doc(adoptId).get();
    if (!res.data) {
      return { success: false, error: '认养记录不存在' };
    }
    // 校验权限：只能查看自己的认养
    if (res.data._openid !== openid) {
      return { success: false, error: '无权查看' };
    }
    return { success: true, data: res.data };
  }
}