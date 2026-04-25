// pages/admin/merchantReview/merchantReview.js
Page({
  data: {
    applications: [],           // 全部申请
    filteredApplications: [],   // 筛选后的申请
    currentStatus: 'all',
    hasPermission: false,
    permissionMsg: '',
    showRejectModal: false,
    rejectReason: '',
    currentRejectId: null,
    pendingCount: 0
  },

  onLoad() {
    this.checkPermission();
  },

  onShow() {
    if (this.data.hasPermission) {
      this.loadApplications();
    }
  },

  // 权限校验：仅 admin 可访问
  async checkPermission() {
    const app = getApp();
    if (!app.globalData.openid) {
      this.setData({ hasPermission: false, permissionMsg: '请先登录' });
      return;
    }

    let role = app.globalData.userInfo?.role;
    if (!role) {
      try {
        const db = wx.cloud.database();
        const res = await db.collection('users').where({ _openid: app.globalData.openid }).get();
        if (res.data.length > 0) {
          role = res.data[0].role;
          if (app.globalData.userInfo) app.globalData.userInfo.role = role;
        }
      } catch (err) {
        console.error('获取角色失败', err);
      }
    }

    if (role !== 'admin') {
      this.setData({
        hasPermission: false,
        permissionMsg: '您不是管理员，无权限访问此页面'
      });
    } else {
      this.setData({ hasPermission: true });
      this.loadApplications();
    }
  },

  async loadApplications() {
    wx.showLoading({ title: '加载中' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'merchantApplication',
        data: { action: 'list' }
      });
      wx.hideLoading();
      if (res.result.success) {
        const apps = res.result.data.map(item => ({
          ...item,
          createTimeStr: this.formatTime(item.createTime),
          reviewTimeStr: item.reviewTime ? this.formatTime(item.reviewTime) : ''
        }));
        const pendingCount = apps.filter(a => a.status === 'pending').length;
        this.setData({ applications: apps, pendingCount });
        this.filterApplications();
      } else {
        wx.showToast({ title: res.result.error || '加载失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('加载申请失败', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  filterByStatus(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({ currentStatus: status });
    this.filterApplications();
  },

  filterApplications() {
    const { applications, currentStatus } = this.data;
    let filtered = applications;
    if (currentStatus !== 'all') {
      filtered = applications.filter(item => item.status === currentStatus);
    }
    this.setData({ filteredApplications: filtered });
  },

  formatTime(date) {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    const list = e.currentTarget.dataset.list;
    wx.previewImage({ current: url, urls: list });
  },

  // 审核通过
  async approve(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认通过',
      content: '确定通过该商家的申请吗？',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中' });
        try {
          const cloudRes = await wx.cloud.callFunction({
            name: 'merchantApplication',
            data: {
              action: 'review',
              data: { applicationId: id, approved: true }
            }
          });
          wx.hideLoading();
          if (cloudRes.result.success) {
            wx.showToast({ title: '已通过', icon: 'success' });
            this.loadApplications();
          } else {
            wx.showToast({ title: cloudRes.result.error, icon: 'none' });
          }
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      }
    });
  },

  showRejectModal(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ showRejectModal: true, currentRejectId: id, rejectReason: '' });
  },

  hideRejectModal() {
    this.setData({ showRejectModal: false, currentRejectId: null, rejectReason: '' });
  },

  onRejectReasonInput(e) {
    this.setData({ rejectReason: e.detail.value });
  },

  async confirmReject() {
    const id = this.data.currentRejectId;
    if (!id) return;
    wx.showLoading({ title: '处理中' });
    try {
      const cloudRes = await wx.cloud.callFunction({
        name: 'merchantApplication',
        data: {
          action: 'review',
          data: {
            applicationId: id,
            approved: false,
            rejectReason: this.data.rejectReason
          }
        }
      });
      wx.hideLoading();
      if (cloudRes.result.success) {
        wx.showToast({ title: '已拒绝', icon: 'success' });
        this.hideRejectModal();
        this.loadApplications();
      } else {
        wx.showToast({ title: cloudRes.result.error, icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  goBack() {
    wx.navigateBack({ delta: 1 });
  },

  onPullDownRefresh() {
    this.loadApplications().finally(() => wx.stopPullDownRefresh());
  }
});