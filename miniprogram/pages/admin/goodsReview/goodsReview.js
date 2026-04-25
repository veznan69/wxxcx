Page({
  data: {
    list: [],
    loading: false
  },

  onShow() {
    this.loadPendingGoods();
  },

  async callGoodsCenter(action, data) {
    const res = await wx.cloud.callFunction({
      name: 'goodsCenter',
      data: { action, data: data || {} }
    });
    const result = (res && res.result) || {};
    if (!result.success) {
      throw new Error(result.error || '操作失败');
    }
    return result;
  },

  normalize(item) {
    return {
      ...item,
      priceText: `¥${Number(item.price || 0)}`,
      createdText: item.createdAt ? this.formatTime(item.createdAt) : ''
    };
  },

  formatTime(dateLike) {
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const d2 = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d2} ${hh}:${mm}`;
  },

  async loadPendingGoods() {
    this.setData({ loading: true });
    try {
      const res = await this.callGoodsCenter('listPendingGoods');
      const list = (res.data || []).map(item => this.normalize(item));
      this.setData({ list });
    } catch (err) {
      console.error('load pending goods failed', err);
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      this.setData({ list: [] });
    } finally {
      this.setData({ loading: false });
    }
  },

  async onApprove(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    wx.showLoading({ title: '处理中...' });
    try {
      await this.callGoodsCenter('reviewGoods', { id, approved: true });
      wx.showToast({ title: '审核通过', icon: 'success' });
      this.loadPendingGoods();
    } catch (err) {
      console.error('approve failed', err);
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async onReject(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    const ok = await new Promise((resolve) => {
      wx.showModal({
        title: '确认驳回',
        content: '确定驳回该商品上架申请吗？',
        success: (res) => resolve(!!res.confirm)
      });
    });
    if (!ok) return;

    wx.showLoading({ title: '处理中...' });
    try {
      await this.callGoodsCenter('reviewGoods', { id, approved: false, rejectReason: '' });
      wx.showToast({ title: '已驳回', icon: 'success' });
      this.loadPendingGoods();
    } catch (err) {
      console.error('reject failed', err);
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  }
});
