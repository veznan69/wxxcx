// pages/coupon/coupon.js
Page({
  data: {
    currentTab: 0, // 0=商品券，1=文旅券
    couponList: [],
    currentList: []
  },

  onShow() {
    this.loadCoupons();
  },

  // 加载优惠券（完全兼容你原有存储逻辑）
  loadCoupons() {
    // 从本地存储读取，完全不改动你原有数据结构
    const allCoupons = wx.getStorageSync('user_coupons') || [];
    
    // 处理有效期，自动计算过期时间
    const processedCoupons = allCoupons.map(item => {
      const expireTime = new Date(item.createTime + item.validDays * 24 * 60 * 60 * 1000);
      return {
        ...item,
        id: item.createTime, // 用创建时间做唯一ID
        expireTime: expireTime.toLocaleDateString()
      };
    });

    this.setData({
      couponList: processedCoupons
    });
    this.filterCoupons();
  },

  // 按标签筛选优惠券
  filterCoupons() {
    const { currentTab, couponList } = this.data;
    const type = currentTab === 0 ? 'goods' : 'travel';
    const currentList = couponList.filter(item => item.type === type);
    this.setData({ currentList });
  },

  // 切换标签
  switchTab(e) {
    const tab = parseInt(e.currentTarget.dataset.tab);
    this.setData({
      currentTab: tab
    }, () => {
      this.filterCoupons();
    });
  }
})