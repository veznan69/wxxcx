// app.js
App({
  onLaunch: function () {
    // 【新增】初始化云开发环境（环境ID请替换为你自己的）
    wx.cloud.init({
      env: 'cloud1-0gk1j4mb29d57fbd',   // 你的云环境ID，从云开发控制台获取
      traceUser: true
    });

    // 【新增】自动初始化数据库集合
    this.initDatabase();

    // 新增
    // 尝试从本地存储恢复 openid
    const openid = wx.getStorageSync('openid');
    if (openid) {
      this.globalData.openid = openid;
    }

    // 初始化本地存储模拟数据
    if (!wx.getStorageSync('cart_list')) {
      wx.setStorageSync('cart_list', [])
    }
    if (!wx.getStorageSync('coupon_list')) {
      wx.setStorageSync('coupon_list', [])
    }
    if (!wx.getStorageSync('adoption_list')) {
      wx.setStorageSync('adoption_list', [])
    }
    if (!wx.getStorageSync('reservation_list')) {
      wx.setStorageSync('reservation_list', [])
    }
    if (!wx.getStorageSync('enrollment_list')) {
      wx.setStorageSync('enrollment_list', [])
    }

    // app.js - onLaunch 中添加
    wx.removeStorageSync('cart_list');  // 清除旧的本地购物车

    // 检查未读消息（延迟调用，确保 TabBar 已初始化）
    setTimeout(() => {
      this.checkUnreadMessages();
    }, 500);

    // 注释了方便测试用户登入
    // this.globalData.userInfo = { nickName: '测试用户', avatarUrl: '/images/avatar.png' }
    // this.globalData.openid = 'mock_openid'
  },

  // 新增：自动初始化数据库集合
  initDatabase() {
    console.log('开始初始化数据库集合...');

    wx.cloud.callFunction({
      name: 'initDatabase',
      success: (res) => {
        if (res.result.success) {
          console.log('✅ 数据库初始化成功:', res.result);
        } else {
          console.error('❌ 数据库初始化失败:', res.result.error);
        }
      },
      fail: (err) => {
        console.error('❌ 调用初始化数据库云函数失败:', err);
        // 云函数调用失败不影响应用启动，静默失败即可
      }
    });
  },

  // 新增
  // 检查登录状态，未登录则提示并跳转到"我的"页面
  checkLogin: function () {
    const openid = this.globalData.openid || wx.getStorageSync('openid');
    console.log('checkLogin openid:', openid);  // 添加日志
    if (!openid) {
      wx.showModal({
        title: '提示',
        content: '您还未登录，请先登录',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/user/user' });
          }
        }
      });
      return false;
    }
    return true;
  },

  globalData: {
    userInfo: null,
    openid: null,
    hasUnreadMessage: false
  },

  // 检查未读消息并更新 tabBar 小红点
  async checkUnreadMessages() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'messageCenter',
        data: {
          action: 'list'
        }
      });

      if (res.result && res.result.success) {
        const messages = res.result.list || [];
        const hasUnread = messages.some(msg => !msg.read);
        const oldHasUnread = this.globalData.hasUnreadMessage;
        this.globalData.hasUnreadMessage = hasUnread;

        console.log('检查未读消息:', hasUnread, '总数:', messages.length);

        // 更新 tabBar 小红点（只在 TabBar 页面才调用 API，避免报错）
        const pages = getCurrentPages();
        const currentPage = pages[pages.length - 1];
        const tabBarPages = ['pages/index/index', 'pages/goods/goods', 'pages/cart/cart', 'pages/user/user'];
        const isTabBarPage = currentPage && tabBarPages.includes(currentPage.route);

        if (isTabBarPage) {
          if (hasUnread) {
            console.log('显示 TabBar 小红点');
            wx.showTabBarRedDot({
              index: 3
            }).catch(err => {
              console.error('显示 TabBar 小红点失败:', err);
            });
          } else {
            console.log('隐藏 TabBar 小红点');
            wx.hideTabBarRedDot({
              index: 3
            }).catch(err => {
              console.error('隐藏 TabBar 小红点失败:', err);
            });
          }
        } else {
          console.log('当前页面非 TabBar 页面，跳过更新小红点:', currentPage ? currentPage.route : 'unknown');
        }
      }
    } catch (err) {
      console.error('检查未读消息失败:', err);
    }
  },

  // 新增：登录成功后自动发放满减优惠券
  sendLoginCoupon() {
    // 防止重复发放
    wx.cloud.database().collection('coupons').where({
      _openid: this.global.openId,
      type: 'manjian',
      used: false
    }).get().then(res => {
      // 没有未使用满减券才新增
      if(res.data.length === 0){
        wx.cloud.database().collection('coupons').add({
          data:{
            type:'manjian', //满减券
            title:'商品满200减30',
            minMoney:200,
            reduceMoney:30,
            used:false,
            createTime:new Date(),
            expireTime:new Date(Date.now()+30*24*3600*1000) //30天有效期
          }
        })
      }
    })
  },

  // 新增：下单支付成功 自动赠送文旅体验券
  sendOrderCoupon(){
    wx.cloud.database().collection('coupons').add({
      data:{
        type:'experience', //文旅体验券
        title:'研学课程专用券',
        used:false,
        createTime:new Date(),
        expireTime:new Date(Date.now()+90*24*3600*1000) //90天有效期
      }
    })
  }
})
