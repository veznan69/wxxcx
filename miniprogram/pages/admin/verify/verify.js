// pages/admin/verify/verify.js
Page({
  data: {
    verifyCode: '',
    verifying: false,
    inputFocus: true,
    hasPermission: false,
    permissionMsg: '',
    recentVerifications: []
  },

  onLoad() {
    const history = wx.getStorageSync('verify_history') || [];
    this.setData({ recentVerifications: history.slice(0, 5) });
  },

  onShow() {
    this.checkPermission();
  },

  async checkPermission() {
    const app = getApp();
    if (!app.globalData.openid) {
      this.setData({ hasPermission: false, permissionMsg: '您还未登录，请先登录' });
      return;
    }

    let role = app.globalData.userInfo && app.globalData.userInfo.role;
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

    if (role !== 'merchant' && role !== 'admin') {
      this.setData({ hasPermission: false, permissionMsg: '您不是商家或管理员，无核销权限' });
    } else {
      this.setData({ hasPermission: true });
    }
  },

  onCodeInput(e) {
    this.setData({ verifyCode: String(e.detail.value || '').trim().toUpperCase() });
  },

  async doVerify() {
    const code = String(this.data.verifyCode || '').trim().toUpperCase();
    if (!code) {
      wx.showToast({ title: '请输入核销码', icon: 'none' });
      return;
    }
    if (!this.data.hasPermission) {
      wx.showToast({ title: this.data.permissionMsg, icon: 'none' });
      return;
    }

    this.setData({ verifying: true });
    wx.showLoading({ title: '核销中', mask: true });

    let success = false;
    let type = '';

    // 1) 认养主核销码（6位）
    if (!success) {
      try {
        const res = await wx.cloud.callFunction({
          name: 'adoptionManager',
          data: { action: 'verify', data: { verifyCode: code } }
        });
        if (res.result && res.result.success) {
          success = true;
          type = '认养';
        }
      } catch (err) {
        console.log('认养核销失败', err);
      }
    }

    // 2) 认养权益核销码（通常为 ADV... 长码）
    if (!success) {
      try {
        const res = await wx.cloud.callFunction({
          name: 'benefitManager',
          data: { action: 'verify', benefitCode: code }
        });
        if (res.result && res.result.success) {
          success = true;
          type = '权益';
        }
      } catch (err) {
        console.log('权益核销失败', err);
      }
    }

    // 3) 课程核销
    if (!success) {
      try {
        const res = await wx.cloud.callFunction({
          name: 'orderSimulator',
          data: { action: 'verify', verifyCode: code }
        });
        if (res.result && res.result.success) {
          success = true;
          type = '课程';
        }
      } catch (err) {
        console.log('课程核销失败', err);
      }
    }

    wx.hideLoading();
    this.setData({ verifying: false });

    if (success) {
      this.saveHistory(code, type);
      wx.showModal({
        title: `${type}核销成功`,
        content: `核销码：${code} 已完成核销`,
        showCancel: false,
        success: () => this.setData({ verifyCode: '', inputFocus: true })
      });
      wx.vibrateShort({ type: 'light' });
      return;
    }

    wx.showToast({ title: '核销码无效或已核销', icon: 'none', duration: 2000 });
  },

  saveHistory(code, type) {
    const history = wx.getStorageSync('verify_history') || [];
    history.unshift({ code, type, time: this.formatTime(new Date()) });
    const newHistory = history.slice(0, 10);
    wx.setStorageSync('verify_history', newHistory);
    this.setData({ recentVerifications: newHistory.slice(0, 5) });
  },

  formatTime(date) {
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${hour}:${minute}`;
  },

  scanCode() {
    if (!this.data.hasPermission) {
      wx.showToast({ title: this.data.permissionMsg, icon: 'none' });
      return;
    }

    wx.scanCode({
      onlyFromCamera: true,
      scanType: ['qrCode', 'barCode'],
      success: (res) => {
        const raw = String(res.result || '').trim();
        // 优先保留原值，兼容 ADV... 权益码；若是链接再尝试提取末尾 6 位。
        let code = raw.toUpperCase();
        if (!code.startsWith('ADV')) {
          const match = raw.match(/[A-Z0-9]{6}$/i);
          if (match) code = match[0].toUpperCase();
        }
        this.setData({ verifyCode: code });
        this.doVerify();
      },
      fail: (err) => {
        console.log('扫码取消或失败', err);
      }
    });
  },

  goToUser() {
    wx.switchTab({ url: '/pages/user/user' });
  }
});
