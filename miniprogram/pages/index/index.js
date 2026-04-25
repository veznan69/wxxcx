const { getImageUrl } = require('../../utils/imageMap.js');

Page({
  data: {
    banners: [
      getImageUrl('banner1.png'),
      getImageUrl('banner2.png'),
      getImageUrl('banner3.png')
    ],
    expItems: [
      { name: '果园认养', icon: getImageUrl('icon_orchard.png'), tap: 'gotoOrchard' },
      { name: '采摘预约', icon: getImageUrl('icon_pick.png'), tap: 'gotoPick' },
      { name: '研学课程', icon: getImageUrl('icon_study.png'), tap: 'gotoStudy' },
      { name: '游玩攻略', icon: getImageUrl('icon_strategy.png'), tap: 'gotoStrategy' }
    ],
    hotGoods: [],

    // 首页多规格弹窗
    showSkuPopup: false,
    currentGoods: null,
    selectedSku: null,
    skuQuantity: 1
  },

  onLoad(options) {
    this.loadHotGoods();

    if (options.autoTrace === '1' && options.traceId && options.goodsId) {
      setTimeout(() => {
        wx.navigateTo({
          url: `/pages/detail/detail?id=${options.goodsId}&autoTrace=1&traceId=${options.traceId}`
        });
      }, 300);
    }
  },

  onShow() {
    // 检查未读消息并更新 TabBar 小红点
    const app = getApp();
    if (app && app.checkUnreadMessages) {
      app.checkUnreadMessages();
    }

    if (this.data.hotGoods.length > 0) {
      this.loadHotGoods(false);
    }
  },

  onPullDownRefresh() {
    this.loadHotGoods(false);
  },

  normalizeVariants(goods) {
    const list = (goods && (goods.variants || goods.specs)) || [];
    if (!Array.isArray(list)) return [];
    return list
      .filter(Boolean)
      .map((item, index) => ({
        id: item.id || `${index}`,
        name: item.name || item.style || `规格${index + 1}`,
        price: Number(item.price || goods.price || 0),
        image: item.image || goods.image
      }))
      .filter(item => item.image && Number.isFinite(item.price) && item.price > 0);
  },

  async loadHotGoods(showLoading = true) {
    if (showLoading) wx.showLoading({ title: '加载中' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'goodsCenter',
        data: { action: 'listPublishedGoods' }
      });

      if (res.result && res.result.success) {
        const goods = res.result.data || [];
        const hotGoods = goods.slice(0, 3).map(item => ({
          _id: item._id,
          name: item.name,
          price: Number(item.price || 0),
          image: item.image,
          isHot: true,
          variants: this.normalizeVariants(item),
          specs: item.specs || []
        }));
        this.setData({ hotGoods });
      } else {
        wx.showToast({ title: '商品加载失败', icon: 'none' });
      }
    } catch (err) {
      console.error('加载热销商品失败', err);
      this.setFallbackHotGoods();
    } finally {
      if (showLoading) wx.hideLoading();
      else wx.stopPullDownRefresh();
    }
  },

  setFallbackHotGoods() {
    this.setData({ hotGoods: [] });
  },

  gotoScience() {
    wx.navigateTo({ url: '/pages/science/science' });
  },
  gotoOrchard() {
    wx.navigateTo({ url: '/pages/orchard/orchard' });
  },
  gotoPick() {
    wx.navigateTo({ url: '/pages/pick/pick' });
  },
  gotoStudy() {
    wx.navigateTo({ url: '/pages/study/study' });
  },
  gotoStrategy() {
    wx.navigateTo({ url: '/pages/strategy/strategy' });
  },
  gotoDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  gotoCouponRule() {
    wx.showModal({
      title: '活动说明',
      content: '每消费满100元，赠送一张“满减体验券”（满100减20），可在“我的-我的体验券”中查看。',
      showCancel: false
    });
  },

  async _directAddToCart(goodsId, num, sku) {
    wx.showLoading({ title: '添加中' });
    try {
      await wx.cloud.callFunction({
        name: 'addToCart',
        data: { goodsId, num, sku }
      });
      wx.showToast({ title: '已加入购物车', icon: 'success' });
    } catch (err) {
      console.error('add to cart failed', err);
      wx.showToast({ title: '添加失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async addToCart(e) {
    const app = getApp();
    if (!app.checkLogin()) return;

    const id = e.currentTarget.dataset.id;
    const goods = this.data.hotGoods.find(g => g._id === id);
    if (!goods) {
      wx.showToast({ title: '商品不存在', icon: 'none' });
      return;
    }

    const variants = this.normalizeVariants(goods);
    if (variants.length > 0) {
      this.setData({
        showSkuPopup: true,
        currentGoods: { ...goods, variants },
        selectedSku: variants[0],
        skuQuantity: 1
      });
      return;
    }

    await this._directAddToCart(id, 1, null);
  },

  stopPropagation() {},

  selectGoodsSku(e) {
    const sku = e.currentTarget.dataset.sku;
    if (!sku) return;
    this.setData({ selectedSku: sku });
  },

  closeSkuPopup() {
    this.setData({ showSkuPopup: false, currentGoods: null, selectedSku: null, skuQuantity: 1 });
  },

  increaseSkuQuantity() {
    this.setData({ skuQuantity: this.data.skuQuantity + 1 });
  },

  decreaseSkuQuantity() {
    if (this.data.skuQuantity > 1) {
      this.setData({ skuQuantity: this.data.skuQuantity - 1 });
    }
  },

  async confirmSkuAdd() {
    const { currentGoods, selectedSku, skuQuantity } = this.data;
    if (!currentGoods || !selectedSku) {
      wx.showToast({ title: '请选择规格', icon: 'none' });
      return;
    }
    await this._directAddToCart(currentGoods._id, skuQuantity, selectedSku);
    this.closeSkuPopup();
  }
});
