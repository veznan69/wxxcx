const { getImageUrl } = require('../../utils/imageMap.js');

Page({
  data: {
    adoptId: '',
    videoUrl: '',
    placeholderImage: '',
    treeInfo: {
      treeNo: '',
      adoptTime: '',
      growthStatus: '正常生长'
    }
  },

  onLoad(options) {
    this.setData({
      adoptId: options.adoptId || '',
      placeholderImage: getImageUrl('avatar.png')
    });
    this.loadMonitorInfo();
  },

  // 加载监控信息（后端预留）
  loadMonitorInfo() {
    // 这里保留模拟数据，后续替换成真实视频地址即可
    setTimeout(() => {
      this.setData({
        videoUrl: '',
        treeInfo: {
          treeNo: 'GZ20250412001',
          adoptTime: '2025-04-12',
          growthStatus: '正常生长'
        }
      });
    }, 1000);
  },

  takeScreenshot() {
    wx.showToast({
      title: '截图成功',
      icon: 'success'
    });
  },

  switchCamera() {
    wx.showToast({
      title: '切换中...',
      icon: 'loading'
    });
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '已切换到果树摄像头',
        icon: 'success'
      });
    }, 1000);
  }
});
