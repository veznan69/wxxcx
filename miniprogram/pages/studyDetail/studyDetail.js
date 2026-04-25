// pages/studyDetail/studyDetail.js
Page({
  data: {
    course: null
  },

  onLoad(options) {
    if (options.course) {
      const course = JSON.parse(decodeURIComponent(options.course));
      this.setData({ course });
      wx.setNavigationBarTitle({ title: course.name });
    }
  },

  signup() {
    const app = getApp();

    // 检查登录状态
    if (!app.globalData.openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/user/user' });
      }, 1500);
      return;
    }

    const course = this.data.course;

    // 跳转到预约表单页面
    wx.navigateTo({
      url: `/pages/courseReservation/courseReservation?course=${encodeURIComponent(JSON.stringify(course))}`
    });
  },

  // 预览海报大图
  previewPoster(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      urls: [url],          // 需要预览的图片链接数组
      current: url          // 当前显示图片的链接
    });
  }
});