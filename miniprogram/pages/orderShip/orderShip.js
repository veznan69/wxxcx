const { getImageUrl } = require('../../utils/imageMap.js');

Page({
  data: {
    id: '',
    role: 'user',
    loading: false,
    submitting: false,
    logisticsCompany: '',
    order: null
  },

  onLoad(options) {
    const id = options && options.id;
    if (!id) {
      wx.showToast({ title: '缺少订单ID', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }

    const app = getApp();
    const role = app.globalData.userInfo && app.globalData.userInfo.role
      ? app.globalData.userInfo.role
      : 'user';

    if (role !== 'merchant' && role !== 'admin') {
      wx.showToast({ title: '无权限访问', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }

    this.setData({ id, role }, () => this.loadDetail());
  },

  fixImageUrl(img) {
    if (!img) return getImageUrl('orange1.png');
    if (img.startsWith('http') || img.startsWith('https') || img.startsWith('cloud://')) return img;
    const fileName = img.split('/').pop();
    return getImageUrl(fileName);
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

  normalizeStatus(status) {
    const s = String(status || '');
    if (s === '待发货' || s === '已发货' || s === '已完成') return s;
    if (s === '待付款' || s === '已付款') return '待发货';
    return '待发货';
  },

  async loadDetail() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'orderManageCenter',
        data: {
          action: 'getOrderDetail',
          orderId: this.data.id
        }
      });
      const result = (res && res.result) || {};
      if (!result.success) {
        throw new Error(result.error || '加载订单失败');
      }

      const order = result.order;
      if (!order) throw new Error('订单不存在');

      const items = order.items || [];
      const normalized = this.normalizeStatus(order.status);
      if (normalized !== '待发货') {
        throw new Error('当前订单不是待发货状态');
      }

      const total = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.num || 0), 0);
      this.setData({
        order: {
          ...order,
          status: normalized,
          createTimeStr: this.formatTime(order.createTime),
          totalPriceFixed: Number(total || order.totalPrice || 0).toFixed(2),
          items: items.map(item => ({ ...item, image: this.fixImageUrl(item.image) }))
        }
      });
    } catch (err) {
      console.error('load ship detail failed', err);
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
    } finally {
      this.setData({ loading: false });
    }
  },

  onCompanyInput(e) {
    this.setData({ logisticsCompany: String(e.detail.value || '') });
  },

  async onSubmitShip() {
    if (this.data.submitting) return;
    const logisticsCompany = String(this.data.logisticsCompany || '').trim();
    if (!logisticsCompany) {
      wx.showToast({ title: '请输入物流公司', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '发货中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'shipOrder',
        data: {
          orderId: this.data.id,
          logisticsCompany
        }
      });
      const result = (res && res.result) || {};
      if (!result.success) {
        throw new Error(result.error || '发货失败');
      }

      wx.showModal({
        title: '发货成功',
        content: `运单号：${result.shipmentOrderNo}`,
        showCancel: false,
        success: () => wx.navigateBack()
      });
    } catch (err) {
      console.error('ship failed', err);
      wx.showToast({ title: err.message || '发货失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ submitting: false });
    }
  }
});
