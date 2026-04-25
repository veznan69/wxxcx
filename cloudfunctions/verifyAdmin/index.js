const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { openid } = event;
  if (!openid) return { success: false, error: '缺少 openid' };

  try {
    const res = await db.collection('users').where({ _openid: openid }).get();
    if (res.data.length === 0) {
      return { success: false, error: '用户不存在' };
    }

    const user = res.data[0];
    const role = user.role || 'user';
    const isAdmin = role === 'admin';

    return {
      success: true,
      isAdmin,
      role,
      userInfo: {
        openid: user._openid,
        nickName: user.nickName,
        avatarUrl: user.avatarUrl
      }
    };
  } catch (err) {
    console.error('verifyAdmin error:', err);
    return { success: false, error: err.message };
  }
};