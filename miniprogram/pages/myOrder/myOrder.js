// pages/myOrder/myOrder.js
Page({
  data: {
    tabActive: 0,      // 0 采摘 1 研学
    orderList: []      // 预约列表
  },

  onShow() {
    this.getMyReservationList();
  },

  // ================================
  // 获取我的预约列表
  // 1. 先读本地存储
  // 2. 后端上线后替换云函数
  // ================================
  getMyReservationList() {
    const { tabActive } = this.data;

    // ======================
    // 【后端预留位】
    // 上线后打开下方注释，删除本地逻辑
    // ======================
    /*
    wx.cloud.callFunction({
      name: 'getMyOrders',
      data: { type: tabActive }
    }).then(res => {
      this.setData({ orderList: res.result.data || [] })
    })
    return;
    */

    // ======================
    // 本地存储逻辑（当前使用）
    // ======================
    let list = wx.getStorageSync('reservation_list') || [];
    let filterList = list.filter(item => item.type === tabActive);
    this.setData({
      orderList: filterList
    });
  },

  // 切换标签
  changeTab(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    this.setData({ tabActive: index }, () => {
      this.getMyReservationList();
    });
  }
});