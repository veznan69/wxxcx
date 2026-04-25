// pages/scanLogin/scanLogin.js
Page({
  data: {
    sessionId: ''
  },

  onLoad(options) {
    // 小程序码的 scene 参数会放在 options.scene 中
    const sessionId = options.scene || options.sessionId;
    if (!sessionId) {
      wx.showToast({ title: '无效的二维码', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.setData({ sessionId });
    this.authorizeAndLogin();
  },

  async authorizeAndLogin() {
    wx.showLoading({ title: '授权中...' });
    try {
      // 调用云函数完成扫码授权
      const res = await wx.cloud.callFunction({
        name: 'scanLoginAuthorize',
        data: { sessionId: this.data.sessionId }
      });

      wx.hideLoading();
      if (res.result.success) {
        wx.showToast({ title: '登录成功', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 1500);
      } else {
        wx.showModal({
          title: '登录失败',
          content: res.result.error || '您没有管理员权限',
          showCancel: false
        });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  }
});