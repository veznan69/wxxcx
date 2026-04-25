// pages/admin/verify/verify.js
Page({
  data: {
    verifyCode: '',
    verifying: false,
    inputFocus: true,
    hasPermission: false,
    permissionMsg: '',
    recentVerifications: []  // 可存储最近核销成功记录（本地缓存）
  },

  onLoad() {
    // 加载历史记录（可选）
    const history = wx.getStorageSync('verify_history') || [];
    this.setData({ recentVerifications: history.slice(0, 5) });
  },

  onShow() {
    // 每次显示时检查权限
    this.checkPermission();
  },

  async checkPermission() {
    const app = getApp();
    if (!app.globalData.openid) {
      this.setData({
        hasPermission: false,
        permissionMsg: '您还未登录，请先登录'
      });
      return;
    }

    // 获取用户角色
    let role = app.globalData.userInfo?.role;
    if (!role) {
      try {
        const db = wx.cloud.database();
        const res = await db.collection('users').where({ _openid: app.globalData.openid }).get();
        if (res.data.length > 0) {
          role = res.data[0].role;
          if (app.globalData.userInfo) {
            app.globalData.userInfo.role = role;
          }
        }
      } catch (err) {
        console.error('获取角色失败', err);
      }
    }

    if (role !== 'merchant' && role !== 'admin') {
      this.setData({
        hasPermission: false,
        permissionMsg: '您不是商家或管理员，无核销权限'
      });
    } else {
      this.setData({ hasPermission: true });
    }
  },

  onCodeInput(e) {
    this.setData({ verifyCode: e.detail.value.trim().toUpperCase() });
  },

  async doVerify() {
    const code = this.data.verifyCode;
    if (!code) {
      wx.showToast({ title: '请输入核销码', icon: 'none' });
      return;
    }

    if (!this.data.hasPermission) {
      wx.showToast({ title: this.data.permissionMsg, icon: 'none' });
      return;
    }

      // ✅ 3. 新增：尝试权益核销（认养下的子权益）
    if (!success) {
      try {
        const res = await wx.cloud.callFunction({
          name: 'benefitManager',           // 需新建此云函数，见下文
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

    this.setData({ verifying: true });
    wx.showLoading({ title: '核销中', mask: true });

    let success = false;
    let type = '';

    // 1. 先尝试认养核销
    try {
      const res = await wx.cloud.callFunction({
        name: 'adoptionManager',
        data: { action: 'verify', data: { verifyCode: code } }
      });
      if (res.result && res.result.success) {
        success = true;
        type = '认养';
      } else if (!res.result.error.includes('无效')) {
        throw new Error(res.result.error);
      }
    } catch (err) {
      console.log('认养核销失败', err);
    }

    // 2. 如果认养核销失败，尝试课程核销
    if (!success) {
      try {
        const res = await wx.cloud.callFunction({
          name: 'orderSimulator',
          data: { action: 'verify', verifyCode: code }
        });
        if (res.result && res.result.success) {
          success = true;
          type = '课程';
        } else {
          throw new Error(res.result.error);
        }
      } catch (err) {
        console.error('课程核销失败', err);
      }
    }

    wx.hideLoading();
    this.setData({ verifying: false });

    if (success) {
      // 保存到历史记录
      this.saveHistory(code, type);
      
      wx.showModal({
        title: `${type}核销成功`,
        content: `核销码：${code} 已完成核销`,
        showCancel: false,
        success: () => {
          this.setData({ verifyCode: '', inputFocus: true });
        }
      });
      
      // 可选：震动反馈
      wx.vibrateShort({ type: 'light' });
    } else {
      wx.showToast({ 
        title: '核销码无效或已核销', 
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 保存核销历史（本地）
  saveHistory(code, type) {
    const history = wx.getStorageSync('verify_history') || [];
    history.unshift({
      code,
      type,
      time: this.formatTime(new Date())
    });
    // 只保留最近10条
    const newHistory = history.slice(0, 10);
    wx.setStorageSync('verify_history', newHistory);
    this.setData({ recentVerifications: newHistory.slice(0, 5) });
  },

  formatTime(date) {
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
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
        // 从扫码结果中提取核销码（假设直接是6位码，或需要正则提取）
        let code = res.result.trim();
        // 如果扫码内容是链接，尝试提取最后的6位字母数字
        const match = code.match(/[A-Z0-9]{6}$/i);
        if (match) code = match[0];
        this.setData({ verifyCode: code.toUpperCase() });
        // 自动核销
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