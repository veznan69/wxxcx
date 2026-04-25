// pages/publishPost/publishPost.js
const app = getApp()

Page({
  data: {
    images: [],
    title: '',
    content: '',
    submitting: false
  },

  onLoad() {
    // 获取用户信息
    this.getUserInfo()
  },

  // 获取用户信息
  getUserInfo() {
    if (app.globalData.userInfo) {
      this.setData({
        userName: app.globalData.userInfo.nickName,
        userAvatar: app.globalData.userInfo.avatarUrl
      })
    }
  },

  // 选择图片
  onChooseImage() {
    const remaining = 9 - this.data.images.length
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFiles = res.tempFiles.map(file => file.tempFilePath)
        this.uploadImages(tempFiles)
      }
    })
  },

  // 上传图片
  uploadImages(tempFiles) {
    wx.showLoading({ title: '上传中...' })

    const uploadPromises = tempFiles.map(filePath => {
      return new Promise((resolve, reject) => {
        const cloudPath = `youquan/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`
        wx.cloud.uploadFile({
          cloudPath,
          filePath,
          success: (res) => {
            resolve(res.fileID)
          },
          fail: reject
        })
      })
    })

    Promise.all(uploadPromises).then(fileIDs => {
      this.setData({
        images: [...this.data.images, ...fileIDs]
      })
      wx.hideLoading()
    }).catch(err => {
      console.error('上传图片失败:', err)
      wx.hideLoading()
      wx.showToast({
        title: '上传失败',
        icon: 'none'
      })
    })
  },

  // 删除图片
  onDeleteImage(e) {
    const index = e.currentTarget.dataset.index
    const images = this.data.images.filter((_, i) => i !== index)
    this.setData({ images })
  },

  // 输入标题
  onTitleInput(e) {
    this.setData({ title: e.detail.value })
  },

  // 输入内容
  onContentInput(e) {
    this.setData({ content: e.detail.value })
  },

  // 提交发布
  onSubmit() {
    const { content, images, title } = this.data

    // 验证
    if (!content.trim()) {
      wx.showToast({
        title: '请填写内容',
        icon: 'none'
      })
      return
    }

    if (this.data.submitting) return

    this.setData({ submitting: true })

    wx.cloud.callFunction({
      name: 'youquan',
      data: {
        action: 'publish',
        content: content.trim(),
        images: images,
        title: title.trim()
      }
    }).then(res => {
      wx.showToast({
        title: '发布成功',
        icon: 'success'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }).catch(err => {
      console.error('发布失败:', err)
      wx.showToast({
        title: '发布失败',
        icon: 'none'
      })
    }).finally(() => {
      this.setData({ submitting: false })
    })
  }
})
