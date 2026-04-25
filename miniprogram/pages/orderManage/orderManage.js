const { getImageUrl } = require('../../utils/imageMap.js');

Page({
  data: {
    role: 'user',
    activeTab: 'pending', // pending | shipped | completed
    allOrders: [],
    list: [],
    loading: false
  },

  onShow() {
    const app = getApp();
    const role = app.globalData.userInfo && app.globalData.userInfo.role
      ? app.globalData.userInfo.role
      : 'user';

    if (role !== 'merchant' && role !== 'admin') {
      wx.showToast({ title: '无权限访问', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }

    this.setData({ role }, () => this.loadOrders());
  },

  normalizeStatus(status) {
    const s = String(status || '');
    if (s === '待发货' || s === '已发货' || s === '已完成') return s;
    if (s === '待付款' || s === '已付款') return '待发货';
    return '待发货';
  },

  toTabStatus(status) {
    if (status === '已发货') return 'shipped';
    if (status === '已完成') return 'completed';
    return 'pending';
  },

  formatTime(dateLike) {
    if (!dateLike) return '';
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  },

  fixImageUrl(img) {
    if (!img) return getImageUrl('orange1.png');
    if (img.startsWith('http') || img.startsWith('https') || img.startsWith('cloud://')) return img;
    const fileName = img.split('/').pop();
    return getImageUrl(fileName);
  },

  async loadOrders() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'orderManageCenter',
        data: { action: 'listOrders' }
      });
      const result = (res && res.result) || {};
      if (!result.success) {
        throw new Error(result.error || '加载订单失败');
      }
      const orders = result.list || [];

      const allOrders = orders.map(order => {
        const status = this.normalizeStatus(order.status);
        return {
          ...order,
          status,
          normalizedStatus: this.toTabStatus(status),
          createTimeStr: this.formatTime(order.createTime),
          totalPriceFixed: Number(order.totalPrice || 0).toFixed(2),
          items: (order.items || []).map(item => ({
            ...item,
            image: this.fixImageUrl(item.image)
          }))
        };
      });

      this.setData({ allOrders }, () => this.filterList());
    } catch (err) {
      console.error('load order manage failed', err);
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      this.setData({ allOrders: [], list: [] });
    } finally {
      this.setData({ loading: false });
    }
  },

  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.activeTab) return;
    this.setData({ activeTab: tab }, () => this.filterList());
  },

  filterList() {
    const list = this.data.allOrders.filter(item => item.normalizedStatus === this.data.activeTab);
    this.setData({ list });
  },

  goShip(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({
      url: `/pages/orderShip/orderShip?id=${id}`
    });
  }
});
