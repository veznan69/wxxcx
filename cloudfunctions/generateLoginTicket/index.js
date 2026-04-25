// cloudfunctions/generateLoginTicket/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 自定义登录私钥（从云开发控制台 - 身份认证 - 登录方式 - 自定义登录 下载）
const PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
...（此处粘贴你下载的私钥内容）...
-----END RSA PRIVATE KEY-----`;

// 生成 CloudBase 自定义登录凭证
function createTicket(uid, customInfo = {}) {
  const jwt = require('jsonwebtoken');
  const payload = {
    uid,
    exp: Math.floor(Date.now() / 1000) + 3600 * 24 * 7, // 7天有效
    ...customInfo
  };
  return jwt.sign(payload, PRIVATE_KEY, { algorithm: 'RS256' });
}

exports.main = async (event) => {
  const { sessionId } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!sessionId) return { success: false, error: '缺少 sessionId' };

  // 1. 校验是否为管理员
  const userRes = await db.collection('users').where({ _openid: openid }).get();
  const user = userRes.data[0];
  if (!user || user.role !== 'admin') {
    return { success: false, error: '非管理员用户' };
  }

  // 2. 生成 ticket，携带用户信息
  const ticket = createTicket(openid, {
    role: user.role,
    nickName: user.nickName || '',
    avatarUrl: user.avatarUrl || ''
  });

  // 3. 更新 login_sessions 集合
  const sessionsCol = db.collection('login_sessions');
  const existRes = await sessionsCol.where({ sessionId }).get();
  if (existRes.data.length > 0) {
    await sessionsCol.doc(existRes.data[0]._id).update({
      data: {
        status: 'confirmed',
        ticket,
        openid,
        updateTime: db.serverDate()
      }
    });
  } else {
    await sessionsCol.add({
      data: {
        sessionId,
        status: 'confirmed',
        ticket,
        openid,
        createTime: db.serverDate()
      }
    });
  }

  return { success: true };
};