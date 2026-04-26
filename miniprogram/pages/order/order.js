// pages/order/order.js - 静态模拟下单
Page({
  data: {
    orderItems: [],
    totalPrice: 0,
    address: { name: '请选择地址', phone: '', detail: '' }
  },

  onLoad() {
    const app = getApp();
    if (!app.checkLogin()) {
      wx.switchTab({ url: '/pages/user/user' });
      return;
    }

    const items = wx.getStorageSync('checkoutItems') || [];
    let total = 0;
    items.forEach(item => { total += Number(item.price || 0) * Number(item.num || 0); });
    this.setData({ orderItems: items, totalPrice: total.toFixed(2) });
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
        });
      },
      fail: () => {
        wx.showToast({ title: '请授权获取地址', icon: 'none' });
      }
    });
  },

  async submitOrder() {
    const app = getApp();
    if (!app.checkLogin()) return;

    if (this.data.address.name === '请选择地址') {
      wx.showToast({ title: '请选择收货地址', icon: 'none' });
      return;
    }

    const selectedItems = this.data.orderItems.map(item => ({
      goodsId: item.goodsId,
      skuId: item.skuId || '',
      name: item.name,
      price: item.price,
      num: item.num,
      image: item.image,
      isAdopt: !!item.isAdopt,
      benefitChoice: item.benefitChoice
    }));

    wx.showLoading({ title: '生成订单中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'checkout',
        data: {
          address: this.data.address,
          selectedItems,
          totalPrice: parseFloat(this.data.totalPrice)
        }
      });

      if (!(res.result && res.result.success)) {
        throw new Error('订单生成失败');
      }

      const orderId = res.result.orderId;
      const hasAdoptItem = this.data.orderItems.some(item => item.isAdopt);
      wx.removeStorageSync('checkoutItems');
      wx.hideLoading();
      await this.payOrder(orderId, parseFloat(this.data.totalPrice), hasAdoptItem);
    } catch (err) {
      wx.hideLoading();
      console.error('下单失败', err);
      wx.showModal({
        title: '提示',
        content: '订单已生成，但支付初始化遇到问题，请稍后去“我的订单”中支付',
        showCancel: false,
        success: () => wx.navigateTo({ url: '/pages/orders/orders' })
      });
    }
  },

  async payOrder(orderId, totalPrice, hasAdoptItem = false) {
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

        await db.collection('orders').doc(orderId).update({
          data: {
            status: '待发货',
            payTime: db.serverDate()
          }
        });

        const goodsIds = this.data.orderItems.map(item => item.goodsId);
        const app = getApp();
        if (app.globalData.openid) {
          const cartRes = await db.collection('carts').where({ _openid: app.globalData.openid }).get();
          if (cartRes.data.length > 0) {
            const cartId = cartRes.data[0]._id;
            const newItems = (cartRes.data[0].items || []).filter(item => !goodsIds.includes(item.goodsId));
            await db.collection('carts').doc(cartId).update({ data: { items: newItems } });
          }
        }

        if (hasAdoptItem) {
          const adoptItem = this.data.orderItems.find(item => item.isAdopt);
          const benefitChoice = adoptItem && adoptItem.benefitChoice ? adoptItem.benefitChoice : 1;

          try {
            const adoptRes = await wx.cloud.callFunction({
              name: 'adoptionManager',
              data: {
                action: 'create',
                data: { benefitChoice, status: 'paid' }
              }
            });

            if (adoptRes.result && adoptRes.result.success) {
              wx.setStorageSync('lastAdopt', adoptRes.result.data);
            } else {
              console.error('认养记录创建失败', adoptRes.result && adoptRes.result.error);
            }
          } catch (err) {
            console.error('调用 adoptionManager 失败', err);
          }
        }

        wx.hideLoading();
        wx.showToast({ title: '支付成功', icon: 'success' });

        setTimeout(() => {
          if (hasAdoptItem) {
            wx.navigateTo({ url: '/pages/myadopt/myadopt' });
          } else {
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
});
