// 权益核销页
Page({
  data: {
    adoptId: '',
    currentTab: 0,
    benefitList: [
      { name: '脐橙权益', status: 'unused', code: 'ADV20250412001', desc: '保底70斤脐橙，包邮到家', validTime: '2026-04-12' },
      { name: '酒店住宿', status: 'unused', code: 'ADV20250412002', desc: '大余丫山酒店2天1晚（含双早）', validTime: '2026-04-12' },
      { name: '景区门票', status: 'unused', code: 'ADV20250412003', desc: '景区门票2张', validTime: '2026-04-12' },
      { name: '土鸡土鸡蛋', status: 'unused', code: 'ADV20250412004', desc: '6只土鸡+30枚土鸡蛋', validTime: '2026-04-12' }
    ],
    currentBenefit: null
  },

  onLoad(options) {
    this.setData({ adoptId: options.adoptId });
    this.loadBenefits();
  },

  // 从云数据库加载认养详情及权益列表
  async loadBenefits() {
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
      
      if (res.result.success) {
        const benefits = res.result.data.benefits || [];
        this.setData({ benefitList: benefits });
        this.updateCurrentBenefit();
      } else {
        wx.showToast({ title: res.result.error, icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('加载权益失败', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  // 切换权益标签
  switchTab(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ currentTab: index });
    this.updateCurrentBenefit();
  },

  // 更新当前选中的权益
  updateCurrentBenefit() {
    const { benefitList, currentTab } = this.data;
    if (benefitList.length > 0) {
      this.setData({ currentBenefit: benefitList[currentTab] });
    }
  }
});