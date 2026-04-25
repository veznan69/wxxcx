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
  const { content, contact } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!content || content.trim() === '') {
    return { success: false, error: '建议内容不能为空' };
  }

  try {
    let nickName = '匿名用户';
    try {
      const userRes = await db.collection('users').where({ _openid: openid }).get();
      if (userRes.data.length > 0 && userRes.data[0].nickName) {
        nickName = userRes.data[0].nickName;
      }
    } catch (err) {
      console.warn('获取用户昵称失败，使用默认值', err);
    }

    const addRes = await db.collection('feedbacks').add({
      data: {
        _openid: openid,
        nickName,
        content: content.trim(),
        contact: contact || '',
        createTime: db.serverDate(),
        status: '未处理'
      }
    });

    // 6) 管理员收到新的投诉建议
    try {
      const admins = await getAdminOpenids();
      for (const adminOpenid of admins) {
        await createMessage(
          adminOpenid,
          '新的投诉建议',
          `用户 ${nickName} 提交了新的投诉建议，请及时处理。`,
          'feedback_new',
          addRes._id
        );
      }
    } catch (err) {
      console.error('notify admin feedback failed', err);
    }

    return { success: true };
  } catch (err) {
    console.error('提交反馈失败', err);
    return { success: false, error: err.message };
  }
};
