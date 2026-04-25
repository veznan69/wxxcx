Page({
  data: {
    id: '',
    loading: false,
    order: null,
    hasLogistics: false,
    company: '',
    trackingNo: '',
    traces: []
  },

  onLoad(options) {
    const id = options && options.id;
    if (!id) {
      wx.showToast({ title: '缺少订单ID', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.setData({ id }, () => this.loadOrder());
  },

  async loadOrder() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'refreshLogisticsTrace',
        data: {
          orderId: this.data.id
        }
      });

      const result = (res && res.result) || {};
      if (!result.success) {
        throw new Error(result.error || '加载物流信息失败');
      }

      this.setData({
        order: result.order || null,
        hasLogistics: !!result.hasLogistics,
        company: result.company || '',
        trackingNo: result.trackingNo || '',
        traces: Array.isArray(result.traces) ? result.traces : []
      });
    } catch (err) {
      console.error('load logistics trace failed', err);
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
    } finally {
      this.setData({ loading: false });
    }
  }
});
