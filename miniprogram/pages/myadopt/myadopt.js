const { getImageUrl } = require('../../utils/imageMap.js');
Page({
  data: {
    adoptList: [],
    loading: true
  },

  onShow() {
    this.loadAdoptList();
  },

  // 从云函数加载认养列表
  async loadAdoptList() {
    const app = getApp();
    if (!app.globalData.openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      this.setData({ loading: false });
      return;
    }

    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'adoptionManager',
        data: { action: 'list' }
      });

      if (res.result && res.result.success) {
        const adoptList = res.result.data.map(item => {
          let statusText = '';
          if (item.status === 'pending') statusText = '待核销';
          else if (item.status === 'paid') statusText = '已认养';
          else if (item.status === 'verified') statusText = '已完成';
          else statusText = item.status;
        
          return {
            id: item._id,
            treeNo: item.treeNo,
            createTime: this.formatDate(item.createTime),
            expireTime: this.calcExpireTime(item.createTime),
            rawStatus: item.status,          // 原始状态，用于样式
            statusText: statusText,          // 中文状态
            verifyCode: item.verifyCode,
            image: getImageUrl('banner1.png')  // 或新增 'orchard_tree.jpg' 映射
          };
        });
        this.setData({ adoptList });
      } else {
        wx.showToast({ title: res.result.error || '加载失败', icon: 'none' });
      }
    } catch (err) {
      console.error('加载认养列表失败', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 格式化时间
  formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  },

  // 计算到期时间（一年后）
  calcExpireTime(createTime) {
    if (!createTime) return '';
    const d = new Date(createTime);
    d.setFullYear(d.getFullYear() + 1);
    return this.formatDate(d);
  },

  // 跳转到认养介绍页
  goToOrchard() {
    wx.navigateTo({ url: '/pages/orchard/orchard' });
  },

  // 跳转到远程监控页
  goToMonitor(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/monitor/monitor?adoptId=${id}`
    });
  },

  // 跳转到权益核销页
  goToBenefits(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/verify/verify?adoptId=${id}`
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadAdoptList().finally(() => wx.stopPullDownRefresh());
  }
});