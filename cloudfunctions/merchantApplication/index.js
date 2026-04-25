const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function createMessage(toOpenid, title, content, type, bizId) {
  if (!toOpenid) return;
  await db.collection('user_messages').add({
    data: {
      toOpenid,
      title,
      content,
      type,
      bizId: bizId || '',
      read: false,
      createTime: db.serverDate()
    }
  });
}

async function getAdminOpenids() {
  const res = await db.collection('users').where({ role: 'admin' }).get();
  return (res.data || []).map(item => item._openid).filter(Boolean);
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { action, data } = event;

  if (!openid) {
    return { success: false, error: '未登录' };
  }

  try {
    switch (action) {
      case 'submit':
        return await submitApplication(openid, data);
      case 'getMyApplication':
        return await getMyApplication(openid);
      case 'list':
        return await listApplications(openid);
      case 'review':
        return await reviewApplication(openid, data);
      default:
        return { success: false, error: '未知操作' };
    }
  } catch (err) {
    console.error('merchantApplication error', err);
    return { success: false, error: err.message };
  }
};

async function submitApplication(openid, formData) {
  const { shopName, contactName, contactPhone, shopAddress, licenseImages, remark } = formData || {};

  if (!shopName || !contactName || !contactPhone || !shopAddress) {
    return { success: false, error: '请填写完整信息' };
  }
  if (!/^1[3-9]\d{9}$/.test(contactPhone)) {
    return { success: false, error: '手机号格式错误' };
  }

  const existRes = await db.collection('merchant_applications')
    .where({ _openid: openid, status: 'pending' })
    .get();
  if (existRes.data.length > 0) {
    return { success: false, error: '您已有待审核申请，请耐心等待' };
  }

  const addRes = await db.collection('merchant_applications').add({
    data: {
      _openid: openid,
      status: 'pending',
      shopName,
      contactName,
      contactPhone,
      shopAddress,
      licenseImages: licenseImages || [],
      remark: remark || '',
      createTime: db.serverDate()
    }
  });

  // 5) 管理员收到新的商家审核
  try {
    const admins = await getAdminOpenids();
    for (const adminOpenid of admins) {
      await createMessage(
        adminOpenid,
        '新的商家入驻申请',
        `用户提交了商家申请：${shopName}，请尽快审核。`,
        'merchant_apply_new',
        addRes._id
      );
    }
  } catch (err) {
    console.error('notify admin merchant apply failed', err);
  }

  return { success: true, data: { _id: addRes._id }, message: '申请已提交，请等待审核' };
}

async function getMyApplication(openid) {
  const res = await db.collection('merchant_applications')
    .where({ _openid: openid })
    .orderBy('createTime', 'desc')
    .limit(1)
    .get();
  return { success: true, data: res.data[0] || null };
}

async function listApplications(operatorOpenid) {
  const userRes = await db.collection('users').where({ _openid: operatorOpenid }).get();
  if (userRes.data.length === 0 || !['admin', 'merchant'].includes(userRes.data[0].role)) {
    return { success: false, error: '无权限查看' };
  }

  const res = await db.collection('merchant_applications')
    .orderBy('createTime', 'desc')
    .get();
  return { success: true, data: res.data };
}

async function reviewApplication(operatorOpenid, reviewData) {
  const { applicationId, approved, rejectReason } = reviewData || {};

  const userRes = await db.collection('users').where({ _openid: operatorOpenid }).get();
  if (userRes.data.length === 0 || !['admin'].includes(userRes.data[0].role)) {
    return { success: false, error: '无审核权限' };
  }

  const appRes = await db.collection('merchant_applications').doc(applicationId).get();
  if (!appRes.data) {
    return { success: false, error: '申请不存在' };
  }
  if (appRes.data.status !== 'pending') {
    return { success: false, error: '申请已处理过' };
  }

  const newStatus = approved ? 'approved' : 'rejected';
  const updateData = {
    status: newStatus,
    reviewTime: db.serverDate(),
    reviewerOpenid: operatorOpenid
  };
  if (!approved && rejectReason) {
    updateData.rejectReason = rejectReason;
  }

  await db.collection('merchant_applications').doc(applicationId).update({ data: updateData });

  if (approved) {
    const targetOpenid = appRes.data._openid;
    const targetUserRes = await db.collection('users').where({ _openid: targetOpenid }).get();
    if (targetUserRes.data.length > 0) {
      const currentRole = targetUserRes.data[0].role;
      if (currentRole === 'user') {
        await db.collection('users').doc(targetUserRes.data[0]._id).update({
          data: {
            role: 'merchant',
            updateTime: db.serverDate()
          }
        });
      }
    }
  }

  // 3) 用户申请成为商家审核通过/驳回时发送消息
  try {
    await createMessage(
      appRes.data._openid,
      approved ? '商家申请已通过' : '商家申请被驳回',
      approved
        ? '恭喜您，商家申请已审核通过，您现在可以进行商品管理。'
        : `您的商家申请未通过。${rejectReason ? `原因：${rejectReason}` : ''}`,
      'merchant_apply_result',
      applicationId
    );
  } catch (err) {
    console.error('notify apply result failed', err);
  }

  return { success: true, message: approved ? '已通过审核' : '已驳回' };
}
