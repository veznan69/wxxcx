const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const action = event && event.action;

  if (!OPENID) return { success: false, error: 'not login' };

  try {
    if (action === 'list') {
      const limit = Math.min(Number((event && event.limit) || 100), 200);
      const res = await db.collection('user_messages')
        .where({ toOpenid: OPENID })
        .orderBy('createTime', 'desc')
        .limit(limit)
        .get();
      return { success: true, list: res.data || [] };
    }

    if (action === 'markRead') {
      const id = String((event && event.id) || '');
      if (!id) return { success: false, error: 'missing id' };
      const detail = await db.collection('user_messages').doc(id).get();
      if (!detail.data || detail.data.toOpenid !== OPENID) {
        return { success: false, error: 'no permission' };
      }
      await db.collection('user_messages').doc(id).update({
        data: {
          read: true,
          readTime: db.serverDate()
        }
      });
      return { success: true };
    }

    if (action === 'markAllRead') {
      const res = await db.collection('user_messages')
        .where({ toOpenid: OPENID, read: false })
        .get();
      const rows = res.data || [];
      for (const row of rows) {
        await db.collection('user_messages').doc(row._id).update({
          data: {
            read: true,
            readTime: db.serverDate()
          }
        });
      }
      return { success: true, updated: rows.length };
    }

    return { success: false, error: 'unknown action' };
  } catch (err) {
    console.error('messageCenter error', err);
    return { success: false, error: err.message || 'internal error' };
  }
};
