// 权益核销页
Page({
  data: {
    adoptId: '',
    currentTab: 0,
    benefitList: [],
    currentBenefit: null
  },

  onLoad(options) {
    this.setData({ adoptId: options.adoptId || '' });
    this.loadBenefits();
  },

  async loadBenefits() {
    if (!this.data.adoptId) {
      wx.showToast({ title: '缺少认养ID', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '加载中' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'adoptionManager',
        data: {
          action: 'getDetail',
          data: { adoptId: this.data.adoptId }
        }
      });
      wx.hideLoading();

      if (!(res.result && res.result.success)) {
        wx.showToast({ title: (res.result && res.result.error) || '加载失败', icon: 'none' });
        this.setData({ benefitList: [], currentBenefit: null });
        return;
      }

      const benefits = Array.isArray(res.result.data && res.result.data.benefits) ? res.result.data.benefits : [];
      this.setData({ benefitList: benefits, currentTab: 0 }, () => this.updateCurrentBenefit());
    } catch (err) {
      wx.hideLoading();
      console.error('加载权益失败', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
      this.setData({ benefitList: [], currentBenefit: null });
    }
  },

  switchTab(e) {
    const index = Number(e.currentTarget.dataset.index || 0);
    this.setData({ currentTab: index }, () => this.updateCurrentBenefit());
  },

  updateCurrentBenefit() {
    const { benefitList, currentTab } = this.data;
    if (!Array.isArray(benefitList) || benefitList.length === 0) {
      this.setData({ currentBenefit: null });
      return;
    }
    const safeIndex = Math.min(Math.max(currentTab, 0), benefitList.length - 1);
    this.setData({ currentTab: safeIndex, currentBenefit: benefitList[safeIndex] });
  }
});
