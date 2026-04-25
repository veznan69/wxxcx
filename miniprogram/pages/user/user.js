const { getImageUrl } = require('../../utils/imageMap.js');

Page({
  data: {
    userInfo: {},
    isLoggedIn: false,
    showEdit: false,
    tempAvatarUrl: '',
    tempNickName: '',
    showFeedback: false,
    feedbackContent: '',
    feedbackContact: '',
    submitting: false,
    roleMenus: [],
    pendingPayCount: 0,
    pendingShipCount: 0,
    pendingReceiveCount: 0,
    hasUnreadMessage: false,
    userPoints: 0
  },

  onShow() {
    this._menuAnimatedInThisEntry = false;
    if (this._menuBuildTimer) {
      clearTimeout(this._menuBuildTimer);
      this._menuBuildTimer = null;
    }
    this.rebuildMenus();
    this.refreshUserState();
    this.loadOrderStatusStats();
    this.checkUnreadMessages();
    this.loadUserPoints();
  },

  onHide() {
    if (this._menuBuildTimer) {
      clearTimeout(this._menuBuildTimer);
      this._menuBuildTimer = null;
    }
  },

  async checkUnreadMessages() {
    const app = getApp();
    await app.checkUnreadMessages();
    this.setData({ hasUnreadMessage: app.globalData.hasUnreadMessage });
  },

  rebuildMenus() {
    this.setData({ roleMenus: [] });
  },

  async refreshUserState() {
    const app = getApp();

    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo,
        isLoggedIn: true
      });
      this.buildRoleMenus();
      this.loadOrderStatusStats();
      return;
    }

    const localUser = wx.getStorageSync('userInfo');
    if (localUser) {
      app.globalData.userInfo = localUser;
      this.setData({
        userInfo: localUser,
        isLoggedIn: true
      });
      this.buildRoleMenus();
      this.refreshUserInfoFromCloud();
      this.loadOrderStatusStats();
      return;
    }

    this.setData({
      isLoggedIn: false,
      userInfo: {
        nickName: '点击登录',
        avatarUrl: getImageUrl('avatar.png')
      }
    });
    this.buildRoleMenus();
    this.setData({
      pendingPayCount: 0,
      pendingShipCount: 0,
      pendingReceiveCount: 0
    });
  },

  async refreshUserInfoFromCloud() {
    const app = getApp();
    try {
      const res = await wx.cloud.callFunction({
        name: 'userLogin',
        data: { nickName: '', avatarUrl: '' }
      });

      if (res.result && res.result.success) {
        const userInfo = res.result.userInfo;
        app.globalData.userInfo = userInfo;
        if (res.result.openid) {
          app.globalData.openid = res.result.openid;
          wx.setStorageSync('openid', res.result.openid);
        }
        wx.setStorageSync('userInfo', userInfo);
        this.setData({ userInfo, isLoggedIn: true });
        this.buildRoleMenus();
        this.loadOrderStatusStats();
      }
    } catch (err) {
      console.error('refresh user info failed', err);
    }
  },

  buildRoleMenus() {
    const app = getApp();
    const role = app.globalData.userInfo && app.globalData.userInfo.role
      ? app.globalData.userInfo.role
      : 'user';

    const baseMenus = [
      { name: '我的订单', icon: '📦', tap: 'gotoOrders' },
      { name: '积分商城', icon: '🎁', tap: 'gotoPointsMall' },
      { name: '我的体验券', icon: '🎟️', tap: 'gotoCoupons' },
      { name: '我的认养', icon: '🌳', tap: 'gotoOrchard' },
      { name: '我的预约', icon: '📅', tap: 'gotoMyReserve' }
    ];

    const extraMenus = [];

    if (role === 'user' || role === 'admin') {
      extraMenus.push({ name: '申请成为商家', icon: '🏪', tap: 'gotoMerchantApply' });
    }

    if (role === 'merchant' || role === 'admin') {
      extraMenus.push({ name: '商家核销', icon: '✅', tap: 'gotoVerify' });
      extraMenus.push({ name: '商品管理', icon: '🛍️', tap: 'gotoProductManage' });
      extraMenus.push({ name: '订单管理', icon: '📬', tap: 'gotoOrderManage' });
    }

    if (role === 'admin') {
      extraMenus.push({ name: '商家审核', icon: '📋', tap: 'gotoMerchantReview' });
      extraMenus.push({ name: '商品审核', icon: '🧾', tap: 'gotoGoodsReview' });
      extraMenus.push({ name: '生成溯源码', icon: '🔗', tap: 'gotoTraceGenerator' });
    }

    const allMenus = baseMenus.concat(extraMenus);
    allMenus.push({ name: '我的消息', icon: '🔔', tap: 'gotoMyMessages' });
    allMenus.push({ name: '投诉建议', icon: '💬', tap: 'showFeedbackDialog' });
    allMenus.push({ name: '退出登录', icon: '🚪', tap: 'onLogout' });

    // 先清空再重建，保证每次进入“我的”页面都触发从上到下动画
    const shouldAnimate = !this._menuAnimatedInThisEntry;
    this._menuAnimatedInThisEntry = true;

    // 每次进入页面仅首次构建时触发一次从上到下动画，后续刷新只更新内容不重播动画。
    if (shouldAnimate) {
      this.setData({ roleMenus: [] }, () => {
        if (this._menuBuildTimer) {
          clearTimeout(this._menuBuildTimer);
        }
        this._menuBuildTimer = setTimeout(() => {
          this.setData({ roleMenus: allMenus });
          this._menuBuildTimer = null;
        }, 16);
      });
      return;
    }

    this.setData({ roleMenus: allMenus });
  },

  async handleLogin() {
    if (this.data.isLoggedIn) return;
    wx.showLoading({ title: '登录中...' });
    try {
      await new Promise((resolve, reject) => wx.login({ success: resolve, fail: reject }));
      const cloudRes = await wx.cloud.callFunction({
        name: 'userLogin',
        data: { nickName: '', avatarUrl: '' }
      });

      if (!cloudRes.result || !cloudRes.result.success) {
        throw new Error('登录失败');
      }

      const app = getApp();
      const userInfo = cloudRes.result.userInfo;
      const openid = cloudRes.result.openid;
      app.globalData.userInfo = userInfo;
      app.globalData.openid = openid;
      wx.setStorageSync('userInfo', userInfo);
      wx.setStorageSync('openid', openid);

      this.setData({ userInfo, isLoggedIn: true });
      this.buildRoleMenus();
      wx.showToast({ title: '登录成功', icon: 'success' });
    } catch (err) {
      console.error(err);
      wx.showToast({ title: '登录失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  showEditPopup() {
    if (!this.data.isLoggedIn) return;
    this.setData({
      showEdit: true,
      tempAvatarUrl: this.data.userInfo.avatarUrl,
      tempNickName: this.data.userInfo.nickName
    });
  },

  hideEditPopup() {
    this.setData({ showEdit: false });
  },

  onChooseAvatar(e) {
    this.setData({ tempAvatarUrl: e.detail.avatarUrl });
  },

  onNicknameInput(e) {
    this.setData({ tempNickName: e.detail.value });
  },

  async saveUserInfo() {
    const { tempAvatarUrl, tempNickName } = this.data;
    if (!tempNickName) {
      wx.showToast({ title: '请填写昵称', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });
    try {
      let avatarUrl = tempAvatarUrl;
      if (avatarUrl && (avatarUrl.startsWith('wxfile://') || avatarUrl.startsWith('http://tmp/'))) {
        const cloudPath = `avatars/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.png`;
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: avatarUrl
        });
        avatarUrl = uploadRes.fileID;
      }

      const res = await wx.cloud.callFunction({
        name: 'userLogin',
        data: { nickName: tempNickName, avatarUrl }
      });

      if (!res.result || !res.result.success) {
        throw new Error('保存失败');
      }

      const app = getApp();
      app.globalData.userInfo = res.result.userInfo;
      wx.setStorageSync('userInfo', res.result.userInfo);
      this.setData({
        userInfo: res.result.userInfo,
        showEdit: false
      });
      this.buildRoleMenus();
      wx.showToast({ title: '保存成功', icon: 'success' });
    } catch (err) {
      console.error(err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  gotoOrders() {
    wx.navigateTo({ url: '/pages/orders/orders' });
  },

  onTapPendingPay() {
    const count = Number(this.data.pendingPayCount || 0);
    if (count <= 1) {
      wx.showToast({ title: '暂无待付款商品', icon: 'none' });
      return;
    }
    wx.switchTab({ url: '/pages/cart/cart' });
  },

  onTapPendingShip() {
    const count = Number(this.data.pendingShipCount || 0);
    if (count <= 1) {
      wx.showToast({ title: '暂无待发货订单', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/orders/orders' });
  },

  onTapPendingReceive() {
    const count = Number(this.data.pendingReceiveCount || 0);
    if (count <= 1) {
      wx.showToast({ title: '暂无待收货订单', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/orders/orders' });
  },

  gotoCoupons() {
    wx.navigateTo({ url: '/pages/coupon/coupon' });
  },

  gotoOrchard() {
    const app = getApp();
    if (!app.checkLogin()) {
      wx.switchTab({ url: '/pages/user/user' });
      return;
    }
    wx.navigateTo({ url: '/pages/myadopt/myadopt' });
  },

  gotoMyReserve() {
    const app = getApp();
    if (!app.checkLogin()) {
      wx.switchTab({ url: '/pages/user/user' });
      return;
    }
    wx.navigateTo({ url: '/pages/myreserve/myreserve' });
  },

  gotoMerchantApply() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/merchantApply/merchantApply' });
  },

  gotoVerify() {
    if (!this.data.isLoggedIn) return;
    wx.navigateTo({ url: '/pages/admin/verify/verify' });
  },

  gotoProductManage() {
    if (!this.data.isLoggedIn) return;
    wx.navigateTo({ url: '/pages/productManage/productManage' });
  },

  gotoOrderManage() {
    if (!this.data.isLoggedIn) return;
    wx.navigateTo({ url: '/pages/orderManage/orderManage' });
  },

  gotoMerchantReview() {
    if (!this.data.isLoggedIn) return;
    wx.navigateTo({ url: '/pages/admin/merchantReview/merchantReview' });
  },

  gotoGoodsReview() {
    if (!this.data.isLoggedIn) return;
    wx.navigateTo({ url: '/pages/admin/goodsReview/goodsReview' });
  },

  gotoTraceGenerator() {
    if (!this.data.isLoggedIn) return;
    wx.navigateTo({ url: '/pages/admin/traceGenerator/traceGenerator' });
  },

  gotoMyMessages() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/myMessages/myMessages' });
  },

  onLogout() {
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('openid');
    wx.removeStorageSync('cart_checked_map');
    const app = getApp();
    app.globalData.userInfo = null;
    app.globalData.openid = null;
    this.setData({
      userInfo: { nickName: '点击登录', avatarUrl: getImageUrl('avatar.png') },
      isLoggedIn: false,
      showEdit: false
    });
    this.buildRoleMenus();
    wx.showToast({ title: '已退出', icon: 'success' });
  },

  showFeedbackDialog() {
    this.setData({ showFeedback: true });
  },

  hideFeedbackDialog() {
    this.setData({ showFeedback: false });
  },

  stopPropagation() {},

  onFeedbackContentInput(e) {
    this.setData({ feedbackContent: e.detail.value });
  },

  onFeedbackContactInput(e) {
    this.setData({ feedbackContact: e.detail.value });
  },

  async submitFeedback() {
    const { feedbackContent, feedbackContact } = this.data;
    if (!feedbackContent.trim()) {
      wx.showToast({ title: '请输入反馈内容', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'submitFeedback',
        data: {
          content: feedbackContent.trim(),
          contact: feedbackContact.trim()
        }
      });

      if (!res.result || !res.result.success) {
        throw new Error('提交失败');
      }

      wx.showToast({ title: '提交成功', icon: 'success' });
      this.setData({
        showFeedback: false,
        feedbackContent: '',
        feedbackContact: ''
      });
    } catch (err) {
      console.error('submit feedback failed', err);
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async onPullDownRefresh() {
    await this.refreshUserInfoFromCloud();
    await this.loadOrderStatusStats();
    wx.stopPullDownRefresh();
  },

  normalizeOrderStatus(status) {
    const s = String(status || '');
    if (s === '待发货' || s === '已发货' || s === '已完成') return s;
    if (s === '待付款' || s === '已付款') return '待发货';
    return s;
  },

  async loadOrderStatusStats() {
    const app = getApp();
    const openid = app.globalData.openid || wx.getStorageSync('openid');
    if (!openid) {
      this.setData({
        pendingPayCount: 0,
        pendingShipCount: 0,
        pendingReceiveCount: 0
      });
      return;
    }

    try {
      const db = wx.cloud.database();
      const _ = db.command;

      // 待付款：购物车里未结算的商品数量（按件数累加）
      const cartRes = await db.collection('carts')
        .where({ _openid: openid })
        .limit(1)
        .get();
      let pendingPayCount = 0;
      if (cartRes.data.length) {
        const items = cartRes.data[0].items || [];
        pendingPayCount = items.reduce((sum, item) => sum + Number(item.num || 0), 0);
      }

      // 待发货 / 待收货（= 已发货）
      const orderRes = await db.collection('orders')
        .where({ _openid: openid, orderType: _.neq('course') })
        .get();

      let pendingShipCount = 0;
      let pendingReceiveCount = 0;
      (orderRes.data || []).forEach(order => {
        const status = this.normalizeOrderStatus(order.status);
        if (status === '待发货') pendingShipCount += 1;
        if (status === '已发货') pendingReceiveCount += 1;
      });

      this.setData({
        pendingPayCount,
        pendingShipCount,
        pendingReceiveCount
      });
    } catch (err) {
      console.error('load order status stats failed', err);
      this.setData({
        pendingPayCount: 0,
        pendingShipCount: 0,
        pendingReceiveCount: 0
      });
    }
  },

  async loadUserPoints() {
    const app = getApp();
    const openid = app.globalData.openid || wx.getStorageSync('openid');
    if (!openid) {
      this.setData({ userPoints: 0 });
      return;
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'pointsManager',
        data: { action: 'getUserPoints' }
      });

      if (res.result && res.result.success) {
        this.setData({ userPoints: res.result.points || 0 });
      }
    } catch (err) {
      console.error('加载积分失败', err);
      this.setData({ userPoints: 0 });
    }
  },

  gotoPointsMall() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/pointsMall/pointsMall' });
  }
});
