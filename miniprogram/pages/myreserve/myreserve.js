// pages/myreserve/myreserve.js
Page({
  data: {
    activeTab: 'course',
    reserveList: [],
    displayList: []
  },

  onLoad() {
    this.loadReservations();
  },

  onShow() {
    this.loadReservations();
  },

  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.activeTab) return;

    this.setData({ activeTab: tab }, () => {
      this.updateDisplayList();
    });
  },

  normalizeStatus(item) {
    const raw = item && item.status ? String(item.status).toLowerCase() : '';

    if (['paid', 'completed', 'cancelled', 'unpaid', 'pending'].includes(raw)) {
      return raw;
    }

    return item && item.type === 'course' ? 'unpaid' : 'pending';
  },

  toViewItem(item) {
    const createTime = item.createTime ? new Date(item.createTime) : null;
    const formattedTime = createTime && !Number.isNaN(createTime.getTime())
      ? `${createTime.getFullYear()}-${String(createTime.getMonth() + 1).padStart(2, '0')}-${String(createTime.getDate()).padStart(2, '0')} ${String(createTime.getHours()).padStart(2, '0')}:${String(createTime.getMinutes()).padStart(2, '0')}`
      : (item.createTime || '');

    return {
      ...item,
      viewId: item._id || item.id,
      createTime: formattedTime,
      normalizedStatus: this.normalizeStatus(item)
    };
  },

  updateDisplayList() {
    const { reserveList, activeTab } = this.data;
    const isCourse = activeTab === 'course';

    const displayList = reserveList.filter(item => {
      return isCourse ? item.type === 'course' : item.type !== 'course';
    });

    this.setData({ displayList });
  },

  loadReservations() {
    const app = getApp();

    if (!app.globalData.openid) {
      this.setData({ reserveList: [], displayList: [] });
      return;
    }

    wx.showLoading({ title: '加载中...' });

    wx.cloud.database()
      .collection('reservations')
      .orderBy('createTime', 'desc')
      .get()
      .then(res => {
        wx.hideLoading();
        const list = (res.data || []).map(item => this.toViewItem(item));
        this.setData({ reserveList: list }, () => {
          this.updateDisplayList();
        });
      })
      .catch(err => {
        wx.hideLoading();
        console.error('加载预约记录失败', err);

        if (err.errCode === -502005) {
          wx.showModal({
            title: '系统提示',
            content: '数据库未初始化，请联系管理员配置数据库',
            showCancel: false
          });
          return;
        }

        const localReservations = wx.getStorageSync('reservation_list') || [];
        const filtered = localReservations
          .filter(item => !app.globalData.openid || !item.openid || item.openid === app.globalData.openid)
          .map(item => this.toViewItem(item));

        this.setData({ reserveList: filtered }, () => {
          this.updateDisplayList();
        });
      });
  },

  cancelReserve(e) {
    const id = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认取消',
      content: '确定要取消这个预约吗？',
      success: (res) => {
        if (res.confirm) this.doCancel(id);
      }
    });
  },

  doCancel(id) {
    wx.showLoading({ title: '取消中...' });

    wx.cloud.database()
      .collection('reservations')
      .doc(id)
      .update({ data: { status: 'cancelled' } })
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: '已取消预约', icon: 'success' });
        this.loadReservations();
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '取消失败，请重试', icon: 'none' });
      });
  },

  gotoPick() {
    wx.navigateTo({ url: '/pages/pick/pick' });
  },

  gotoStudy() {
    wx.navigateTo({ url: '/pages/study/study' });
  },

  viewDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    wx.navigateTo({
      url: `/pages/reservationDetail/reservationDetail?id=${id}`
    });
  },

  stopPropagation() {},

  payNow(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    wx.navigateTo({
      url: `/pages/reservationDetail/reservationDetail?id=${id}`
    });
  },

  onPullDownRefresh() {
    this.loadReservations();
    wx.stopPullDownRefresh();
  }
});