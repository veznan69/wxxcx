// pages/cart/cart.js
Page({
  data: {
    cartItems: [],
    allChecked: false,
    totalPrice: 0,
    selectedCount: 0
  },

  onShow() {
    const app = getApp();
    if (app && app.checkUnreadMessages) {
      app.checkUnreadMessages();
    }
    this.loadCartFromCloud();
  },

  getCartItemId(goodsId, skuId) {
    return `${String(goodsId)}::${String(skuId || '')}`;
  },

  isSameCartItem(a, goodsId, skuId) {
    return String(a.goodsId) === String(goodsId) && String(a.skuId || '') === String(skuId || '');
  },

  getSkuFromGoods(goods, skuId) {
    if (!goods || !skuId) return null;
    const variants = Array.isArray(goods.variants) ? goods.variants : [];
    const specs = Array.isArray(goods.specs) ? goods.specs : [];
    return variants.find(v => String(v.id) === String(skuId)) ||
      specs.find(s => String(s.id) === String(skuId) || String(s.skuId || '') === String(skuId)) ||
      null;
  },

  async loadCartFromCloud() {
    const app = getApp();
    if (!app.globalData.openid) {
      this.setData({ cartItems: [], allChecked: false, totalPrice: 0 });
      return;
    }

    wx.showLoading({ title: '加载中' });
    try {
      const db = wx.cloud.database();
      const _ = db.command;
      const cartRes = await db.collection('carts').where({ _openid: app.globalData.openid }).get();

      let items = [];
      if (cartRes.data.length > 0 && Array.isArray(cartRes.data[0].items)) {
        items = cartRes.data[0].items;
      }

      const goodsIds = Array.from(new Set(items.map(i => String(i.goodsId || '')).filter(Boolean)));
      let goodsMap = {};
      if (goodsIds.length > 0) {
        const goodsRes = await db.collection('goods_products').where({ _id: _.in(goodsIds) }).get();
        (goodsRes.data || []).forEach(g => {
          goodsMap[String(g._id)] = g;
        });
      }

      const cartItems = items.map(item => {
        const goodsId = String(item.goodsId || '');
        if (!goodsId) return null;

        const skuId = String(item.skuId || '');
        const goods = goodsMap[goodsId] || null;
        const sku = this.getSkuFromGoods(goods, skuId);

        const baseName = String(item.name || (goods && goods.name) || '').trim();
        const skuName = String(item.skuName || (sku && (sku.name || sku.style)) || '').trim();
        const name = skuName ? `${baseName || goodsId} - ${skuName}` : (baseName || goodsId);

        let price = Number(item.price);
        if (!Number.isFinite(price) || price <= 0) {
          price = Number((sku && sku.price) || (goods && goods.price) || 0);
        }

        let image = String(item.image || '').trim();
        if (!image) {
          image = String((sku && sku.image) || (goods && goods.image) || '').trim();
        }

        return {
          id: this.getCartItemId(goodsId, skuId),
          goodsId,
          skuId,
          skuName,
          num: Number(item.num || 1),
          name,
          price,
          image,
          checked: item.checked !== undefined ? !!item.checked : true
        };
      }).filter(Boolean);

      this.setData({ cartItems });
      this.calcTotal();
      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      console.error('加载购物车失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  calcTotal() {
    let total = 0;
    let allChecked = this.data.cartItems.length > 0;
    let selectedCount = 0;

    this.data.cartItems.forEach(item => {
      if (item.checked) {
        total += Number(item.price || 0) * Number(item.num || 0);
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

  async toggleCheck(e) {
    const rowId = e.currentTarget.dataset.id;
    const goodsId = e.currentTarget.dataset.goodsId;
    const skuId = e.currentTarget.dataset.skuId || '';

    const item = this.data.cartItems.find(i => i.id === rowId);
    if (!item) {
      console.error('未找到对应商品');
      return;
    }

    const newChecked = !item.checked;
    const items = this.data.cartItems.map(i => (i.id === rowId ? { ...i, checked: newChecked } : i));
    this.setData({ cartItems: items }, () => this.calcTotal());

    const app = getApp();
    if (!app.globalData.openid) return;

    try {
      await wx.cloud.callFunction({
        name: 'updateCartChecked',
        data: { goodsId, skuId, checked: newChecked }
      });
    } catch (err) {
      console.error('更新勾选状态失败', err);
      const rollbackItems = this.data.cartItems.map(i => (i.id === rowId ? { ...i, checked: !newChecked } : i));
      this.setData({ cartItems: rollbackItems }, () => this.calcTotal());
      wx.showToast({ title: '更新失败', icon: 'none' });
    }
  },

  async addNum(e) {
    const goodsId = e.currentTarget.dataset.goodsId;
    const skuId = e.currentTarget.dataset.skuId || '';
    const rowId = e.currentTarget.dataset.id;
    const item = this.data.cartItems.find(i => i.id === rowId);
    if (!item) return;
    await this.updateCartItemNum(goodsId, skuId, item.num + 1);
  },

  async subNum(e) {
    const goodsId = e.currentTarget.dataset.goodsId;
    const skuId = e.currentTarget.dataset.skuId || '';
    const rowId = e.currentTarget.dataset.id;
    const item = this.data.cartItems.find(i => i.id === rowId);
    if (!item) return;

    if (item.num === 1) {
      wx.showModal({
        title: '提示',
        content: '确定要删除该商品吗？',
        success: async (res) => {
          if (res.confirm) {
            await this.removeCartItem(goodsId, skuId);
          }
        }
      });
      return;
    }

    await this.updateCartItemNum(goodsId, skuId, item.num - 1);
  },

  async removeCartItem(goodsId, skuId = '') {
    const app = getApp();
    if (!app.globalData.openid) return;

    wx.showLoading({ title: '删除中' });
    try {
      const db = wx.cloud.database();
      const cartRes = await db.collection('carts').where({ _openid: app.globalData.openid }).get();
      if (cartRes.data.length === 0) return;

      const cartId = cartRes.data[0]._id;
      const currentItems = cartRes.data[0].items || [];
      const newItems = currentItems.filter(item => !this.isSameCartItem(item, goodsId, skuId));

      await db.collection('carts').doc(cartId).update({ data: { items: newItems } });

      const cartItems = this.data.cartItems.filter(item => !this.isSameCartItem(item, goodsId, skuId));
      this.setData({ cartItems }, () => this.calcTotal());

      wx.hideLoading();
      wx.showToast({ title: '已删除', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      console.error('删除商品失败', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  async updateCartItemNum(goodsId, skuId = '', newNum) {
    const app = getApp();
    if (!app.globalData.openid) return;

    wx.showLoading({ title: '更新中' });
    try {
      const db = wx.cloud.database();
      const cartRes = await db.collection('carts').where({ _openid: app.globalData.openid }).get();
      if (cartRes.data.length === 0) return;

      const cartId = cartRes.data[0]._id;
      const currentItems = cartRes.data[0].items || [];
      const newItems = currentItems.map(item => {
        if (this.isSameCartItem(item, goodsId, skuId)) {
          return { ...item, num: newNum };
        }
        return item;
      }).filter(item => Number(item.num || 0) > 0);

      await db.collection('carts').doc(cartId).update({ data: { items: newItems } });

      const cartItems = this.data.cartItems.map(item => {
        if (this.isSameCartItem(item, goodsId, skuId)) {
          return { ...item, num: newNum };
        }
        return item;
      }).filter(item => Number(item.num || 0) > 0);

      this.setData({ cartItems }, () => this.calcTotal());
      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      console.error('更新数量失败', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

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

  goToShop() {
    wx.switchTab({ url: '/pages/goods/goods' });
  },
});
