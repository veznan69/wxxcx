// cloudfunctions/userLogin/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  console.log('收到的event:', event);  // 新增
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  // 前端传来的用户信息（通过 getUserProfile 获取）
  const { nickName, avatarUrl } = event
  
  // 查询用户是否已存在
  const userCollection = db.collection('users')
  let userRes = await userCollection.where({
    _openid: openid
  }).get()
  
  const now = db.serverDate()
  
  if (userRes.data.length === 0) {
    // 新用户：创建记录
    const newUser = {
      _openid: openid,   // 实际上可以不写，系统自动注入，但写上也没问题
      nickName: nickName || '微信用户',
      avatarUrl: avatarUrl || '',
      phone: '',
      memberLevel: '普通会员',
      points: 0,
      role: 'user',               // ✅ 新增：默认角色为普通用户
      createTime: now,
      lastLoginTime: now
    }
    const addRes = await userCollection.add({ data: newUser })
    return {
      success: true,
      userInfo: {
        _id: addRes._id,
        nickName: newUser.nickName,
        avatarUrl: newUser.avatarUrl,
        memberLevel: newUser.memberLevel,
        points: newUser.points,
        role: newUser.role          // ✅ 新增返回角色字段
      },
      openid: openid
    }
  } else {
    // 老用户：更新最后登录时间，并更新昵称/头像（如果前端传了新值）
    const userId = userRes.data[0]._id;
    const existing = userRes.data[0];
    const updateData = {
      lastLoginTime: now
    };
    
    // 如果老用户没有 role 字段，则补充默认值 'user'
    if (!existing.role) {
      updateData.role = 'user';
    }
    
    if (nickName && nickName.trim() !== '') updateData.nickName = nickName;
    if (avatarUrl && avatarUrl.trim() !== '') updateData.avatarUrl = avatarUrl;
  
    await userCollection.doc(userId).update({ data: updateData });
  
    return {
      success: true,
      userInfo: {
        _id: userId,
        nickName: nickName || existing.nickName,
        avatarUrl: avatarUrl || existing.avatarUrl,
        memberLevel: existing.memberLevel,
        points: existing.points,
        role: existing.role || updateData.role || 'user'   // 优先取已有或刚补充的
      },
      openid: openid
    };
  }
}