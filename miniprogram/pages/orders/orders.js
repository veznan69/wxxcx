const { getImageUrl } = require('../../utils/imageMap.js');

Page({
  data: {
    activeTab: 0,
    orders: [],
    allOrders: [],
    searchKeyword: ''
  },

  onShow() {
    this.loadOrders();
  },

  normalizeStatus(status) {
    const s = String(status || '');
    if (s === '待发货' || s === '已发货' || s === '已完成') return s;
    if (s === '待付款' || s === '已付款') return '待发货';
    return s || '待发货';
  },

  async loadOrders() {
    const app = getApp();
    if (!app.globalData.openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '加载中...' });
    try {
      const db = wx.cloud.database();
      const _ = db.command;
      const res = await db.collection('orders')
        .where({ _openid: app.globalData.openid, orderType: _.neq('course') })
        .orderBy('createTime', 'desc')
        .get();

      const allOrders = (res.data || []).map(order => ({
        ...order,
        status: this.normalizeStatus(order.status),
        createTimeStr: this.formatTime(order.createTime),
        totalPriceFixed: Number(order.totalPrice || 0).toFixed(2),
        items: (order.items || []).map(item => ({
          ...item,
          image: this.fixImageUrl(item.image)
        }))
      }));

      this.setData({ allOrders }, () => this.filterOrders());
    } catch (err) {
      console.error('加载订单失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
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

  onTabChange(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({ activeTab: index }, () => this.filterOrders());
  },

  filterOrders() {
    const { activeTab, allOrders, searchKeyword } = this.data;
    let filtered = [...allOrders];

    if (activeTab === 1) filtered = filtered.filter(order => order.status === '待发货');
    if (activeTab === 2) filtered = filtered.filter(order => order.status === '已发货');
    if (activeTab === 3) filtered = filtered.filter(order => order.status === '已完成');

    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      filtered = filtered.filter(order => {
        const matchId = String(order._id || '').toLowerCase().includes(kw);
        const matchItem = (order.items || []).some(item =>
          String(item.name || '').toLowerCase().includes(kw)
        );
        return matchId || matchItem;
      });
    }

    this.setData({ orders: filtered });
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: String(e.detail.value || '').trim().toLowerCase() }, () => {
      this.filterOrders();
    });
  },

  clearSearch() {
    this.setData({ searchKeyword: '' }, () => this.filterOrders());
  },

  viewDetail(e) {
    const order = e.currentTarget.dataset.order;
    wx.showModal({
      title: '订单详情',
      content: `商品：${(order.items || []).map(i => i.name).join('、')}\n总金额：¥${order.totalPriceFixed}`,
      showCancel: false
    });
  },

  async confirmReceived(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '确认收货',
        content: '确认已收到该订单商品吗？',
        confirmText: '确认',
        cancelText: '取消',
        success: res => resolve(!!res.confirm)
      });
    });
    if (!confirmed) return;

    wx.showLoading({ title: '提交中...' });
    try {
      const db = wx.cloud.database();
      await db.collection('orders').doc(id).update({
        data: {
          status: '已完成',
          finishTime: db.serverDate()
        }
      });

      wx.showToast({ title: '已确认收货', icon: 'success' });
      await this.loadOrders();
    } catch (err) {
      console.error('confirm received failed', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  gotoLogistics(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({
      url: `/pages/logisticsTrace/logisticsTrace?id=${id}`
    });
  },

  fixImageUrl(img) {
    if (!img) return getImageUrl('orange1.png');
    if (img.startsWith('http') || img.startsWith('https') || img.startsWith('cloud://')) return img;
    const fileName = img.split('/').pop();
    return getImageUrl(fileName);
  }
});
