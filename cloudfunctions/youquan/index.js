// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const { action } = event

  try {
    switch (action) {
      case 'list':
        return await getPosts(event)
      case 'publish':
        return await publishPost(event)
      case 'getDetail':
        return await getPostDetail(event)
      case 'listComments':
        return await listComments(event)
      case 'addComment':
        return await addComment(event)
      case 'togglePostLike':
        return await togglePostLike(event)
      case 'toggleCommentLike':
        return await toggleCommentLike(event)
      default:
        return { success: false, message: '未知的操作' }
    }
  } catch (err) {
    console.error('云函数执行错误:', err)
    return { success: false, message: err.message }
  }
}

// 获取帖子列表
async function getPosts(event) {
  const { page = 1, pageSize = 10 } = event

  const result = await db.collection('youquan_posts')
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  return {
    success: true,
    data: result.data
  }
}

// 发布帖子
async function publishPost(event) {
  const wxContext = cloud.getWXContext()
  const { content, images = [], title = '' } = event

  // 获取用户信息
  const userResult = await db.collection('users').where({
    _openid: wxContext.OPENID
  }).get()

  const userName = userResult.data.length > 0 ? userResult.data[0].nickName : '橙友'
  const userAvatar = userResult.data.length > 0 ? userResult.data[0].avatarUrl : ''

  // 创建帖子
  const result = await db.collection('youquan_posts').add({
    data: {
      fromOpenid: wxContext.OPENID,
      userName: userName,
      userAvatar: userAvatar,
      title: title,
      content: content,
      images: images,
      likeCount: 0,
      commentCount: 0,
      createTime: new Date(),
      read: false
    }
  })

  return {
    success: true,
    data: result
  }
}

// 帖子点赞/取消点赞
async function togglePostLike(event) {
  const wxContext = cloud.getWXContext()
  const { postId } = event

  // 获取帖子信息
  const postResult = await db.collection('youquan_posts').doc(postId).get()
  if (!postResult.data) {
    return { success: false, message: '帖子不存在' }
  }

  const post = postResult.data
  const likedBy = post.likedBy || []
  const userIndex = likedBy.indexOf(wxContext.OPENID)

  let newLikeCount
  if (userIndex >= 0) {
    // 已点赞，取消点赞
    likedBy.splice(userIndex, 1)
    newLikeCount = Math.max(0, (post.likeCount || 0) - 1)
  } else {
    // 未点赞，添加点赞
    likedBy.push(wxContext.OPENID)
    newLikeCount = (post.likeCount || 0) + 1
  }

  // 更新帖子
  await db.collection('youquan_posts').doc(postId).update({
    data: {
      likedBy: likedBy,
      likeCount: newLikeCount
    }
  })

  return {
    success: true,
    isLiked: userIndex < 0
  }
}

// 评论点赞/取消点赞
async function toggleCommentLike(event) {
  const wxContext = cloud.getWXContext()
  const { commentId } = event

  // 获取评论信息
  const commentResult = await db.collection('youquan_comments').doc(commentId).get()
  if (!commentResult.data) {
    return { success: false, message: '评论不存在' }
  }

  const comment = commentResult.data
  const likedBy = comment.likedBy || []
  const userIndex = likedBy.indexOf(wxContext.OPENID)

  let newLikeCount
  if (userIndex >= 0) {
    // 已点赞，取消点赞
    likedBy.splice(userIndex, 1)
    newLikeCount = Math.max(0, (comment.likeCount || 0) - 1)
  } else {
    // 未点赞，添加点赞
    likedBy.push(wxContext.OPENID)
    newLikeCount = (comment.likeCount || 0) + 1
  }

  // 更新评论
  await db.collection('youquan_comments').doc(commentId).update({
    data: {
      likedBy: likedBy,
      likeCount: newLikeCount
    }
  })

  return {
    success: true,
    isLiked: userIndex < 0
  }
}

// 获取帖子详情
async function getPostDetail(event) {
  const { postId } = event

  const result = await db.collection('youquan_posts')
    .doc(postId)
    .get()

  return {
    success: true,
    data: result.data
  }
}

// 获取评论列表
async function listComments(event) {
  const { postId } = event

  const result = await db.collection('youquan_comments')
    .where({
      postId: postId
    })
    .orderBy('createTime', 'desc')
    .get()

  return {
    success: true,
    data: result.data
  }
}

// 添加评论
async function addComment(event) {
  const wxContext = cloud.getWXContext()
  const { postId, content } = event

  // 获取用户信息
  const userResult = await db.collection('users').where({
    _openid: wxContext.OPENID
  }).get()

  const userName = userResult.data.length > 0 ? userResult.data[0].nickName : '橙友'
  const userAvatar = userResult.data.length > 0 ? userResult.data[0].avatarUrl : ''

  // 创建评论
  const result = await db.collection('youquan_comments').add({
    data: {
      postId: postId,
      fromOpenid: wxContext.OPENID,
      userName: userName,
      userAvatar: userAvatar,
      content: content,
      createTime: new Date(),
      likedBy: [],      // 点赞用户列表
      likeCount: 0     // 点赞数
    }
  })

  // 更新帖子评论数
  await db.collection('youquan_posts').doc(postId).update({
    data: {
      commentCount: _.inc(1)
    }
  })

  return {
    success: true,
    data: result
  }
}
