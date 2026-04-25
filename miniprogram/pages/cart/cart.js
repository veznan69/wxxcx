// pages/cart/cart.js
const { getImageUrl } = require('../../utils/imageMap.js');
const { getGoodsById } = require('../../utils/goodsData.js');   // ✅ 从数据中心获取商品信息

Page({
  data: {
    cartItems: [],
    allChecked: false,
    totalPrice: 0,
    selectedCount: 0
  },

  onShow() {
    // 检查未读消息并更新 TabBar 小红点
    const app = getApp();
    if (app && app.checkUnreadMessages) {
      app.checkUnreadMessages();
    }

    this.loadCartFromCloud();
  },

  // 从云数据库加载购物车
  async loadCartFromCloud() {
    const app = getApp();
    if (!app.globalData.openid) {
      this.setData({ cartItems: [], allChecked: false, totalPrice: 0 });
      return;
    }
  
    wx.showLoading({ title: '加载中' });
    try {
      const db = wx.cloud.database();
      const cartRes = await db.collection('carts').where({
        _openid: app.globalData.openid
      }).get();
  
      let items = [];
      if (cartRes.data.length > 0 && cartRes.data[0].items) {
        items = cartRes.data[0].items;
      }
  
      const cartItems = items.map(item => {
        // ✅ 从数据中心获取商品基础信息
        const goods = getGoodsById(item.goodsId);
        if (!goods) return null;

        // 确定最终显示的价格、图片、名称
        let price, image, name;
        if (item.skuId && goods.variants) {
          // 有规格：从 variants 中找到对应规格
          const sku = goods.variants.find(v => v.id === item.skuId);
          if (sku) {
            price = sku.price;
            image = sku.image;
            name = `${goods.name} - ${sku.name}`;
          } else {
            // 规格不存在（可能数据被修改），降级使用商品基础信息
            price = item.price || goods.price;
            image = item.image || goods.image;
            name = goods.name;
          }
        } else {
          // 无规格：直接使用商品基础信息
          price = item.price || goods.price;
          image = item.image || goods.image;
          name = goods.name;
        }

        return {
          goodsId: item.goodsId,
          skuId: item.skuId || '',
          num: item.num,
          name: name,
          price: price,
          image: image,
          checked: item.checked !== undefined ? item.checked : true
        };
      }).filter(item => item !== null);
  
      this.setData({ cartItems });
      this.calcTotal();
      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      console.error('加载购物车失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // 计算总价和全选状态
  calcTotal() {
    let total = 0;
    let allChecked = true;
    let selectedCount = 0;
    this.data.cartItems.forEach(item => {
      if (item.checked) {
        total += Number(item.price) * Number(item.num);
        selectedCount++;
      } else {
        allChecked = false;
      }
    });
    this.setData({ 
      totalPrice: total.toFixed(2), 
      allChecked,
      selectedCount
    });
  },

  // 切换单个商品勾选
  async toggleCheck(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.cartItems.find(i => String(i.goodsId) === String(id));
    if (!item) {
      console.error('未找到对应商品');
      return;
    }

    const newChecked = !item.checked;
    const items = this.data.cartItems.map(i => {
      if (String(i.goodsId) === String(id)) {
        return { ...i, checked: newChecked };
      }
      return i;
    });
    this.setData({ cartItems: items }, () => {
      this.calcTotal();
    });

    const app = getApp();
    if (!app.globalData.openid) return;
    try {
      await wx.cloud.callFunction({
        name: 'updateCartChecked',
        data: { goodsId: id, checked: newChecked }
      });
    } catch (err) {
      console.error('更新勾选状态失败', err);
      const rollbackItems = this.data.cartItems.map(i => {
        if (String(i.goodsId) === String(id)) {
          return { ...i, checked: !newChecked };
        }
        return i;
      });
      this.setData({ cartItems: rollbackItems }, () => {
        this.calcTotal();
      });
      wx.showToast({ title: '更新失败', icon: 'none' });
    }
  },

  // 增加数量
  async addNum(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.cartItems.find(i => i.goodsId === id);
    if (!item) return;
    const newNum = item.num + 1;
    await this.updateCartItemNum(id, newNum);
  },

  // 减少数量
  async subNum(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.cartItems.find(i => i.goodsId === id);
    if (!item) return;

    if (item.num === 1) {
      wx.showModal({
        title: '提示',
        content: '确定要删除该商品吗？',
        success: async (res) => {
          if (res.confirm) {
            await this.removeCartItem(id);
          }
        }
      });
      return;
    }
    const newNum = item.num - 1;
    await this.updateCartItemNum(id, newNum);
  },

  // 删除商品
  async removeCartItem(goodsId) {
    const app = getApp();
    if (!app.globalData.openid) return;

    wx.showLoading({ title: '删除中' });
    try {
      const db = wx.cloud.database();
      const cartRes = await db.collection('carts').where({
        _openid: app.globalData.openid
      }).get();
      if (cartRes.data.length === 0) return;

      const cartId = cartRes.data[0]._id;
      const currentItems = cartRes.data[0].items;
      const newItems = currentItems.filter(item => item.goodsId !== goodsId);

      await db.collection('carts').doc(cartId).update({
        data: { items: newItems }
      });

      const cartItems = this.data.cartItems.filter(item => item.goodsId !== goodsId);
      this.setData({ cartItems }, () => {
        this.calcTotal();
      });

      wx.hideLoading();
      wx.showToast({ title: '已删除', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      console.error('删除商品失败', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // 更新云数据库中指定商品的数量
  async updateCartItemNum(goodsId, newNum) {
    const app = getApp();
    if (!app.globalData.openid) return;
  
    wx.showLoading({ title: '更新中' });
    try {
      const db = wx.cloud.database();
      const cartRes = await db.collection('carts').where({
        _openid: app.globalData.openid
      }).get();
      if (cartRes.data.length === 0) return;
  
      const cartId = cartRes.data[0]._id;
      const currentItems = cartRes.data[0].items;
      const newItems = currentItems.map(item => {
        if (item.goodsId === goodsId) {
          item.num = newNum;
        }
        return item;
      }).filter(item => item.num > 0);
    
      await db.collection('carts').doc(cartId).update({
        data: { items: newItems }
      });
    
      const cartItems = this.data.cartItems.map(item => {
        if (item.goodsId === goodsId) item.num = newNum;
        return item;
      }).filter(item => item.num > 0);
      
      this.setData({ cartItems }, () => this.calcTotal());
      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      console.error('更新数量失败', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // 结算
  checkout() {
    const app = getApp();
    if (!app.checkLogin()) return;

    const selected = this.data.cartItems.filter(item => item.checked);
    if (selected.length === 0) {
      wx.showToast({ title: '请选择商品', icon: 'none' });
      return;
    }
    wx.setStorageSync('checkoutItems', selected);
    wx.navigateTo({ url: '/pages/order/order' });
  },

  // 手动跳转到商城 tab 页
  goToShop() {
    wx.switchTab({ url: '/pages/goods/goods' });
  },
});