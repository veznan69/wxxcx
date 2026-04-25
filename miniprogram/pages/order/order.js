// pages/order/order.js - 静态模拟下单
Page({
  data: {
    orderItems: [],
    totalPrice: 0,
    address: { name: '请选择地址', phone: '', detail: '' }
  },
  onLoad() {
    // 新增
    // 检查登录状态
    const app = getApp();
    if (!app.checkLogin()) {
      wx.switchTab({ url: '/pages/user/user' });
      return;
    }

    const items = wx.getStorageSync('checkoutItems') || []
    let total = 0
    items.forEach(item => { total += item.price * item.num })
    this.setData({ orderItems: items, totalPrice: total.toFixed(2) })
  },
  chooseAddress() {
    wx.chooseAddress({
      success: (res) => {
        this.setData({
          address: {
            name: res.userName,
            phone: res.telNumber,
            detail: res.provinceName + res.cityName + res.countyName + res.detailInfo
          }
        })
      },
      fail: () => { wx.showToast({ title: '请授权获取地址', icon: 'none' }) }
    })
  },

// pages/order/order.js - 修改 submitOrder 方法
  // 提交订单（生成订单后立即支付）
  async submitOrder() {
    const app = getApp();
    if (!app.checkLogin()) return;

    if (this.data.address.name === '请选择地址') {
      wx.showToast({ title: '请选择收货地址', icon: 'none' });
      return;
    }

    const selectedItems = this.data.orderItems.map(item => ({
      goodsId: item.goodsId,
      name: item.name,
      price: item.price,
      num: item.num,
      image: item.image
    }));

    wx.showLoading({ title: '生成订单中...' });
    let orderId = null;
    try {
      const res = await wx.cloud.callFunction({
        name: 'checkout',
        data: {
          address: this.data.address,
          selectedItems: selectedItems,
          totalPrice: parseFloat(this.data.totalPrice)
        }
      });

      if (res.result && res.result.success) {
        orderId = res.result.orderId;
        // 清除本地存储的选中商品
        wx.removeStorageSync('checkoutItems');
        wx.hideLoading();
        // 订单生成成功，立即调起支付
        await this.payOrder(orderId, parseFloat(this.data.totalPrice));
      } else {
        throw new Error('订单生成失败');
      }
    } catch (err) {
      wx.hideLoading();
      console.error('下单失败', err);
      // 如果订单可能已生成（比如优惠券写入失败但订单已存在），引导用户去订单列表
      wx.showModal({
        title: '提示',
        content: '订单已生成，但支付初始化遇到问题，请稍后去“我的订单”中支付',
        showCancel: false,
        success: () => {
          wx.navigateTo({ url: '/pages/orders/orders' });
        }
      });
    }
  },

  // 模拟支付（可替换为真实微信支付）
  // pages/order/order.js
  async payOrder(orderId, totalPrice) {
    const confirm = await new Promise(resolve => {
      wx.showModal({
        title: '模拟支付',
        content: `订单金额：¥${totalPrice.toFixed(2)}\n确认支付吗？`,
        confirmText: '确认支付',
        cancelText: '取消',
        success: (res) => resolve(res.confirm)
      });
    });
    if (!confirm) return;

    wx.showLoading({ title: '支付处理中...', mask: true });
    setTimeout(async () => {
      try {
        const db = wx.cloud.database();
        // 更新订单状态
        await db.collection('orders').doc(orderId).update({
          data: {
            status: '待发货',
            payTime: db.serverDate()
          }
        });

        // ✅ 直接删除购物车中本次购买的商品
        const goodsIds = this.data.orderItems.map(item => item.goodsId);
        const app = getApp();
        if (app.globalData.openid) {
          const cartRes = await db.collection('carts').where({
            _openid: app.globalData.openid
          }).get();
          if (cartRes.data.length > 0) {
            const cartId = cartRes.data[0]._id;
            const newItems = cartRes.data[0].items.filter(
              item => !goodsIds.includes(item.goodsId)
            );
            await db.collection('carts').doc(cartId).update({
              data: { items: newItems }
            });
          }
        }

        // ✅ ========== 新增：处理认养订单，创建认养记录 ==========
        const hasAdoptItem = this.data.orderItems.some(item => item.isAdopt);
        if (hasAdoptItem) {
          // 获取用户选择的权益选项（存储在 orderItems 中）
          const adoptItem = this.data.orderItems.find(item => item.isAdopt);
          const benefitChoice = adoptItem.benefitChoice; // 1 或 2
          try {
            const adoptRes = await wx.cloud.callFunction({
              name: 'adoptionManager',
              data: { 
                action: 'create',
                data: { 
                  benefitChoice,
                  status: 'paid'          // 已付款状态
                }
              }
            });
            if (adoptRes.result.success) {
              console.log('认养记录创建成功', adoptRes.result.data);
              // 可选：将果树编号存入本地，便于展示
              wx.setStorageSync('lastAdopt', adoptRes.result.data);
            } else {
              console.error('认养记录创建失败', adoptRes.result.error);
            }
          } catch (err) {
            console.error('调用 adoptionManager 失败', err);
            // 即使创建认养失败，也不影响支付成功的结果，可后台补单
          }
        }
        // ========== 新增结束 ==========

        wx.hideLoading();
        wx.showToast({ title: '支付成功', icon: 'success' });
        setTimeout(() => {
          // 判断是否是认养订单
          const checkoutItems = wx.getStorageSync('checkoutItems') || [];
          if (checkoutItems.length > 0 && checkoutItems[0].isAdopt) {
            // 认养订单，跳转到我的认养页
            wx.navigateTo({ url: '/pages/myadopt/myadopt' });
          } else {
            // 普通订单，跳转到订单列表页
            wx.navigateTo({ url: '/pages/orders/orders' });
          }
        }, 1500);
      } catch (err) {
        wx.hideLoading();
        console.error('支付失败', err);
        wx.showToast({ title: '支付失败，请重试', icon: 'none' });
      }
    }, 1500);
  }
})
