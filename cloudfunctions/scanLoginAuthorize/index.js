// cloudfunctions/scanLoginAuthorize/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { sessionId } = event;
  const { OPENID } = cloud.getWXContext();

  if (!sessionId) return { success: false, error: '缺少 sessionId' };

  // 1. 查询用户角色
  const userRes = await db.collection('users').where({ _openid: OPENID }).get();
  if (userRes.data.length === 0) {
    return { success: false, error: '用户不存在' };
  }
  const user = userRes.data[0];
  if (user.role !== 'admin') {
    return { success: false, error: '非管理员，无权登录后台' };
  }

  // 2. 更新临时会话记录
  const sessionRes = await db.collection('qrcode_sessions')
    .where({ sessionId })
    .get();

  if (sessionRes.data.length === 0) {
    // 如果不存在则创建（防止并发问题）
    await db.collection('qrcode_sessions').add({
      data: {
        sessionId,
        openid: OPENID,
        role: user.role,
        status: 'authorized',
        createTime: db.serverDate()
      }
    });
  } else {
    await db.collection('qrcode_sessions').doc(sessionRes.data[0]._id).update({
      data: {
        openid: OPENID,
        role: user.role,
        status: 'authorized',
        updateTime: db.serverDate()
      }
    });
  }

  return { success: true };
};