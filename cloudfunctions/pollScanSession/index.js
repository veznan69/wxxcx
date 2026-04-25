// cloudfunctions/pollScanSession/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { sessionId } = event;
  if (!sessionId) return { success: false, error: '缺少 sessionId' };

  const res = await db.collection('qrcode_sessions')
    .where({ sessionId, status: 'authorized' })
    .get();

  if (res.data.length === 0) {
    return { success: true, authorized: false };
  }

  const record = res.data[0];
  return {
    success: true,
    authorized: true,
    openid: record.openid,
    role: record.role
  };
};