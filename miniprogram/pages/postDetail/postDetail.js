// pages/postDetail/postDetail.js
const app = getApp()

Page({
  data: {
    post: null,
    postId: '',
    comments: [],
    commentText: '',
    formattedTime: '',
    loading: true,
    currentUserId: ''        // 新增：当前用户ID
  },

  onLoad(options) {
    // 从全局获取当前用户 openid
    this.setData({ currentUserId: app.globalData.openid || '' })

    if (options.id) {
      this.setData({ postId: options.id })
      this.loadPostDetail()
      this.loadComments()
    }
  },

  // 格式化时间显示
  formatTime(createTime) {
    if (!createTime) return ''
    const date = new Date(createTime)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}`
  },

  // 加载帖子详情
  // 加载帖子详情
  loadPostDetail() {
    this.setData({ loading: true })

    wx.cloud.callFunction({
      name: 'youquan',
      data: {
        action: 'getDetail',
        postId: this.data.postId
      }
    }).then(res => {
      const post = res.result.data
      if (!post) {
        wx.showToast({ title: '帖子不存在', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 1500)
        return
      }

      // 处理图片临时链接
      const fileIDs = (post.images || []).concat(post.userAvatar || [])
      if (fileIDs.length > 0) {
        wx.cloud.callFunction({
          name: 'getYouquanImages',
          data: { fileIDs }
        }).then(urlRes => {
          const urlMap = {}
          if (urlRes.result && urlRes.result.success) {
            (urlRes.result.fileList || []).forEach(item => {
              // 只保存有效的临时链接
              if (item.fileID && item.tempFileURL) {
                urlMap[item.fileID] = item.tempFileURL
              }
            })
          }

          // 安全替换图片：获取失败则使用本地默认占位图
          this.setData({
            post: {
              ...post,
              userAvatar: urlMap[post.userAvatar] || '/images/icons/default-avatar.png',
              images: (post.images || []).map(fid => urlMap[fid] || '/images/icons/default.png')
            },
            formattedTime: this.formatTime(post.createTime),
            loading: false
          })
        }).catch(err => {
          console.error('获取图片链接失败', err)
          // 即使全部失败，也使用默认图
          this.setData({
            post: {
              ...post,
              userAvatar: '/images/icons/default-avatar.png',
              images: (post.images || []).map(() => '/images/icons/default.png')
            },
            formattedTime: this.formatTime(post.createTime),
            loading: false
          })
        })
      } else {
        // 没有图片和头像的场景
        this.setData({
          post: {
            ...post,
            userAvatar: '/images/icons/default-avatar.png',
            images: []
          },
          formattedTime: this.formatTime(post.createTime),
          loading: false
        })
      }
    }).catch(err => {
      console.error('加载帖子详情失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    })
  },

  // 加载评论列表
  loadComments() {
    wx.cloud.callFunction({
      name: 'youquan',
      data: {
        action: 'listComments',
        postId: this.data.postId
      }
    }).then(res => {
      const comments = (res.result.data || []).map(comment => ({
        ...comment,
        formattedTime: this.formatTime(comment.createTime),
        // 防御性处理 likedBy，避免 undefined 调用 includes
        isLiked: (comment.likedBy || []).includes(this.data.currentUserId)
      }))
      this.setData({ comments })
    }).catch(err => {
      console.error('加载评论失败:', err)
      wx.showToast({ title: '评论加载失败', icon: 'none' })
    })
  },

  // 评论输入
  onCommentInput(e) {
    this.setData({ commentText: e.detail.value })
  },

  // 发送评论
  onSendComment() {
    if (!this.data.commentText.trim()) {
      wx.showToast({ title: '请输入评论内容', icon: 'none' })
      return
    }

    wx.cloud.callFunction({
      name: 'youquan',
      data: {
        action: 'addComment',
        postId: this.data.postId,
        content: this.data.commentText
      }
    }).then(res => {
      wx.showToast({ title: '评论成功', icon: 'success' })
      this.setData({ commentText: '' })
      this.loadComments()
    }).catch(err => {
      console.error('发送评论失败:', err)
      wx.showToast({ title: '评论失败', icon: 'none' })
    })
  },

  // 预览图片
  onImagePreview(e) {
    const { urls, current } = e.currentTarget.dataset
    wx.previewImage({ urls, current })
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadPostDetail()
    this.loadComments()
    wx.stopPullDownRefresh()
  },

  // 帖子点赞
  onTogglePostLike() {
    const post = this.data.post
    if (!post) return

    const newLikeStatus = !post.isLiked
    const newLikeCount = Math.max(0, (post.likeCount || 0) + (newLikeStatus ? 1 : -1))

    // 乐观更新
    this.setData({
      'post.isLiked': newLikeStatus,
      'post.likeCount': newLikeCount
    })

    wx.cloud.callFunction({
      name: 'youquan',
      data: {
        action: 'togglePostLike',
        postId: this.data.postId
      }
    }).catch(err => {
      console.error('点赞失败，回滚状态:', err)
      // 失败回滚
      this.setData({
        'post.isLiked': !newLikeStatus,
        'post.likeCount': post.likeCount
      })
      wx.showToast({ title: '操作失败', icon: 'none' })
    })
  },

  // 评论点赞
  onToggleCommentLike(e) {
    const index = e.currentTarget.dataset.index
    const comments = this.data.comments
    if (!comments[index]) return

    const comment = comments[index]
    const newLikeStatus = !comment.isLiked
    const newLikeCount = Math.max(0, (comment.likeCount || 0) + (newLikeStatus ? 1 : -1))

    // 乐观更新
    const updatedComments = [...comments]
    updatedComments[index] = {
      ...comment,
      isLiked: newLikeStatus,
      likeCount: newLikeCount
    }
    this.setData({ comments: updatedComments })

    wx.cloud.callFunction({
      name: 'youquan',
      data: {
        action: 'toggleCommentLike',
        commentId: comment._id
      }
    }).catch(err => {
      console.error('评论点赞失败，回滚状态:', err)
      // 失败回滚
      const reverted = [...comments]
      reverted[index] = comment
      this.setData({ comments: reverted })
      wx.showToast({ title: '操作失败', icon: 'none' })
    })
  }
})