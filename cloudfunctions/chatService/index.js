// cloudfunctions/chatService/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 管理员的 openid（与前端保持一致）
const ADMIN_OPENID = 'ojWd418mR3Z_TqtUeq5wJo4BisdQ';

// ========== 权限校验 ==========
async function isAdmin(openid) {
  const res = await db.collection('users').where({ _openid: openid }).get();
  return res.data.length > 0 && res.data[0].role === 'admin';
}

// ========== 用户端操作 ==========

// 发送消息（用户端只能发给管理员）
async function sendMessage(openid, data) {
  const { toOpenid, content } = data;
  if (!toOpenid || !content) {
    return { success: false, error: '缺少接收方或消息内容' };
  }
  // 用户只能向管理员发送消息
  if (toOpenid !== ADMIN_OPENID) {
    return { success: false, error: '只能向客服发送消息' };
  }

  const addRes = await db.collection('chat_messages').add({
    data: {
      fromOpenid: openid,
      toOpenid,
      content,
      createTime: db.serverDate(),
      read: false
    }
  });
  return { success: true, messageId: addRes._id };
}

// 获取当前用户与管理员的所有对话记录
async function listMessages(openid) {
  const res = await db.collection('chat_messages')
    .where(_.or([
      { fromOpenid: openid, toOpenid: ADMIN_OPENID },
      { fromOpenid: ADMIN_OPENID, toOpenid: openid }
    ]))
    .orderBy('createTime', 'asc')
    .get();
  return { success: true, list: res.data || [] };
}

// 标记单条消息为已读（仅接收方可标记）
async function markRead(openid, messageId) {
  if (!messageId) return { success: false, error: '缺少消息ID' };

  const msgRes = await db.collection('chat_messages').doc(messageId).get();
  if (!msgRes.data) return { success: false, error: '消息不存在' };
  if (msgRes.data.toOpenid !== openid) {
    return { success: false, error: '无权操作' };
  }

  await db.collection('chat_messages').doc(messageId).update({
    data: { read: true, readTime: db.serverDate() }
  });
  return { success: true };
}

// 标记当前用户所有未读消息为已读
async function markAllRead(openid) {
  const res = await db.collection('chat_messages')
    .where({ toOpenid: openid, read: false })
    .get();

  const tasks = (res.data || []).map(msg =>
    db.collection('chat_messages').doc(msg._id).update({
      data: { read: true, readTime: db.serverDate() }
    })
  );
  await Promise.all(tasks);
  return { success: true, updated: tasks.length };
}

// 获取未读消息数量
async function getUnreadCount(openid) {
  const res = await db.collection('chat_messages')
    .where({ toOpenid: openid, read: false })
    .count();
  return { success: true, count: res.total };
}

// ========== 管理员端操作 ==========

// 获取所有用户会话列表（每个用户取最后一条发给管理员的消息）
async function listSessions(openid) {
  if (!await isAdmin(openid)) return { success: false, error: '无权限' };

  // 1. 获取所有发给管理员的消息，按时间倒序
  const res = await db.collection('chat_messages')
    .where({ toOpenid: ADMIN_OPENID })
    .orderBy('createTime', 'desc')
    .get();

  // 2. 按 fromOpenid 去重，保留每个用户最新一条消息
  const sessionsMap = new Map();
  (res.data || []).forEach(msg => {
    if (!sessionsMap.has(msg.fromOpenid)) {
      sessionsMap.set(msg.fromOpenid, {
        openid: msg.fromOpenid,
        lastContent: msg.content,
        lastTime: msg.createTime,
        unread: !msg.read
      });
    }
  });

  const sessions = Array.from(sessionsMap.values());

  // ========== 新增：批量查询用户信息 ==========
  // 提取所有 openid
  const openids = sessions.map(s => s.openid);
  
  if (openids.length > 0) {
    // 使用 _.in 查询 users 集合中匹配的 openid 列表
    const usersRes = await db.collection('users')
      .where({
        _openid: _.in(openids)
      })
      .get();

    // 构建 openid -> 用户信息 的映射表
    const userMap = {};
    (usersRes.data || []).forEach(user => {
      userMap[user._openid] = {
        nickName: user.nickName || '微信用户',
        avatar: user.avatarUrl || ''
      };
    });

    // 将用户信息合并到每个会话对象中
    sessions.forEach(session => {
      const user = userMap[session.openid];
      if (user) {
        session.nickName = user.nickName;
        session.avatar = user.avatar;
      } else {
        // 如果 users 集合中没有该用户（例如新用户未登录过），给默认值
        session.nickName = '微信用户';
        session.avatar = '';
      }
    });
  }

  return { success: true, sessions };
}

// 获取管理员与指定用户的完整对话记录
async function getSessionMessages(openid, targetOpenid) {
  if (!await isAdmin(openid)) {
    return { success: false, error: '无权限' };
  }
  if (!targetOpenid) {
    return { success: false, error: '缺少用户 openid' };
  }

  const res = await db.collection('chat_messages')
    .where(_.or([
      { fromOpenid: targetOpenid, toOpenid: ADMIN_OPENID },
      { fromOpenid: ADMIN_OPENID, toOpenid: targetOpenid }
    ]))
    .orderBy('createTime', 'asc')
    .get();

  return { success: true, messages: res.data || [] };
}

// 管理员回复用户
async function adminReply(openid, data) {
  if (!await isAdmin(openid)) {
    return { success: false, error: '无权限' };
  }
  const { toOpenid, content } = data;
  if (!toOpenid || !content) {
    return { success: false, error: '缺少参数' };
  }

  await db.collection('chat_messages').add({
    data: {
      fromOpenid: ADMIN_OPENID,
      toOpenid,
      content,
      createTime: db.serverDate(),
      read: false
    }
  });
  return { success: true };
}

// ========== 云函数入口 ==========
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { success: false, error: '未登录' };

  const { action, data } = event;

  try {
    switch (action) {
      // 用户端
      case 'send':
        return await sendMessage(OPENID, data);
      case 'list':
        return await listMessages(OPENID);
      case 'markRead':
        return await markRead(OPENID, data && data.messageId);
      case 'markAllRead':
        return await markAllRead(OPENID);
      case 'getUnreadCount':
        return await getUnreadCount(OPENID);

      // 管理员端
      case 'listSessions':
        return await listSessions(OPENID);
      case 'getSessionMessages':
        return await getSessionMessages(OPENID, data && data.targetOpenid);
      case 'adminReply':
        return await adminReply(OPENID, data);

      default:
        return { success: false, error: '未知操作' };
    }
  } catch (err) {
    console.error('chatService error:', err);
    return { success: false, error: err.message || '服务内部错误' };
  }
};