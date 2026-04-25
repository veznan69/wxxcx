// pages/pick/pick.js
const { getImageUrl } = require('../../utils/imageMap.js');

Page({
  data: {
    name: '',
    phone: '',
    date: '',
    people: '',
    peopleOptions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    bgImage: ''
  },

  onLoad() {
    this.setData({
      bgImage: getImageUrl('pick_bg.jpg')
    });
  },

  onNameInput(e) { this.setData({ name: e.detail.value }); },
  onPhoneInput(e) { this.setData({ phone: e.detail.value }); },
  onDateChange(e) { this.setData({ date: e.detail.value }); },

  onPeopleChange(e) {
    const idx = Number(e.detail.value);
    this.setData({ people: this.data.peopleOptions[idx] });
  },

  submitPick() {
    const app = getApp();

    if (!app.globalData.openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/user/user' });
      }, 1500);
      return;
    }

    const { name, phone, date, people } = this.data;
    if (!name || !phone || !date || !people) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '手机号格式错误', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '提交中...' });

    wx.cloud.database()
      .collection('reservations')
      .add({
        data: {
          type: 'pick',
          name,
          phone,
          date,
          people,
          status: 'pending',
          createTime: new Date()
        }
      })
      .then(() => {
        wx.hideLoading();

        // 赠送优惠券（失败不影响主流程）
        wx.cloud.database()
          .collection('coupons')
          .add({
            data: {
              type: 'pick',
              name: '采摘优惠券',
              value: '满50减10元',
              used: false,
              createTime: new Date(),
              expireTime: new Date(Date.now() + 90 * 24 * 3600 * 1000)
            }
          })
          .catch(err => {
            console.error('赠送优惠券失败', err);
          });

        wx.showToast({ title: '预约成功', icon: 'success' });
        setTimeout(() => {
          wx.redirectTo({
            url: '/pages/myreserve/myreserve',
            fail: () => wx.navigateTo({ url: '/pages/myreserve/myreserve' })
          });
        }, 1200);
      })
      .catch(err => {
        wx.hideLoading();
        console.error('提交预约失败', err);

        if (err.errCode === -502005) {
          wx.showModal({
            title: '系统提示',
            content: '预约功能需要配置数据库，请联系管理员或稍后重试',
            showCancel: false
          });
          return;
        }

        // 云失败时降级到本地存储
        const reservations = wx.getStorageSync('reservation_list') || [];
        reservations.push({
          id: Date.now().toString(),
          type: 'pick',
          name,
          phone,
          date,
          people,
          openid: app.globalData.openid,
          status: 'pending',
          createTime: new Date().toLocaleString()
        });
        wx.setStorageSync('reservation_list', reservations);

        wx.showToast({ title: '预约成功', icon: 'success' });
        setTimeout(() => {
          wx.redirectTo({
            url: '/pages/myreserve/myreserve',
            fail: () => wx.navigateTo({ url: '/pages/myreserve/myreserve' })
          });
        }, 1200);
      });
  }
});