// pages/youquan/youquan.js
const app = getApp()

Page({
  data: {
    posts: [],
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 10,
    currentUserOpenid: ''      // 新增：当前用户 openid
  },

  onLoad() {
    // 获取当前用户的 openid
    this.setData({
      currentUserOpenid: app.globalData.openid || ''
    })
    this.loadPosts()
  },

  onShow() {
    if (app && app.checkUnreadMessages) {
      app.checkUnreadMessages()
    }
  },

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

  truncateText(text, maxLength = 50) {
    if (!text || text.length <= maxLength) return text || ''
    return text.substring(0, maxLength) + '...'
  },

  // 提取公共处理逻辑：格式化时间、截断文本、计算 isLiked
  processPostBase(post) {
    const likedBy = post.likedBy || []
    return {
      ...post,
      formattedTime: this.formatTime(post.createTime),
      truncatedContent: this.truncateText(post.content, 50),
      isLiked: likedBy.includes(this.data.currentUserOpenid),
      imageCount: post.images ? post.images.length : 0
    }
  },

  loadPosts() {
    if (this.data.loading || !this.data.hasMore) {
      return Promise.resolve()
    }

    this.setData({ loading: true })

    return wx.cloud.callFunction({
      name: 'youquan',
      data: {
        action: 'list',
        page: this.data.page,
        pageSize: this.data.pageSize
      }
    }).then(res => {
      const newPosts = res.result.data || []

      if (newPosts.length === 0) {
        this.setData({
          hasMore: false,
          loading: false
        })
        return
      }

      // 第一步：处理基础数据（时间、截断、点赞状态）
      const basePosts = newPosts.map(post => this.processPostBase(post))

      // 第二步：收集所有需要转换的云存储 fileID
      let allFileIDs = []
      basePosts.forEach(post => {
        if (post.userAvatar) allFileIDs.push(post.userAvatar)
        if (post.images && Array.isArray(post.images)) {
          allFileIDs = allFileIDs.concat(post.images)
        }
      })

      const finalizePosts = (urlMap) => {
        const postsWithUrls = basePosts.map(post => ({
          ...post,
          userAvatar: urlMap[post.userAvatar] || post.userAvatar || '',
          images: (post.images || []).slice(0, 3).map(fileID => urlMap[fileID] || fileID)
        }))

        const mergedPosts = this.data.page === 1 ? postsWithUrls : [...this.data.posts, ...postsWithUrls]
        this.setData({
          posts: mergedPosts,
          loading: false,
          hasMore: newPosts.length >= this.data.pageSize
        })
      }

      if (allFileIDs.length === 0) {
        // 无图片，直接显示
        finalizePosts({})
      } else {
        // 获取临时 URL
        wx.cloud.callFunction({
          name: 'getYouquanImages',
          data: { fileIDs: allFileIDs }
        }).then(urlRes => {
          const urlMap = {}
          if (urlRes.result && urlRes.result.success) {
            (urlRes.result.fileList || []).forEach(item => {
              if (item.fileID) {
                urlMap[item.fileID] = item.tempFileURL || item.fileID
              }
            })
          }
          finalizePosts(urlMap)
        }).catch(err => {
          console.error('获取图片临时URL失败', err)
          finalizePosts({})  // 降级处理，仍可显示文字
        })
      }
    }).catch(err => {
      console.error('加载帖子失败:', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  // 点赞 / 取消点赞
  async onLikePost(e) {
    const { id, liked } = e.currentTarget.dataset
    const newLiked = !liked
    const currentPosts = this.data.posts

    // 1. 乐观更新 UI
    const updatedPosts = currentPosts.map(post => {
      if (post._id === id) {
        return {
          ...post,
          isLiked: newLiked,
          likeCount: Math.max(0, (post.likeCount || 0) + (newLiked ? 1 : -1))
        }
      }
      return post
    })
    this.setData({ posts: updatedPosts })

    // 2. 调用云函数
    try {
      await wx.cloud.callFunction({
        name: 'youquan',
        data: {
          action: 'togglePostLike',
          postId: id
        }
      })
    } catch (err) {
      console.error('点赞操作失败', err)
      // 失败回滚
      this.setData({ posts: currentPosts })
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  onPublish() {
    wx.navigateTo({ url: '/pages/publishPost/publishPost' })
  },

  onPostDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/postDetail/postDetail?id=${id}` })
  },

  onImagePreview(e) {
    const { urls, current } = e.currentTarget.dataset
    wx.previewImage({ urls, current })
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true })
    this.loadPosts().then(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (this.data.hasMore) {
      this.setData({ page: this.data.page + 1 })
      this.loadPosts()
    }
  }
})