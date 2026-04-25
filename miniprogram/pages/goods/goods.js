// pages/goods/goods.js 
const { getGoodsList } = require('../../utils/goodsData.js');

Page({
  data: {
    goodsList: [],
    allGoods: [],
    showSkuPopup: false,
    currentGoods: null,
    selectedSku: null,
    skuQuantity: 1
  },

  onLoad(options) {
    this.loadGoods();
    if (options.autoTrace === '1' && options.traceId && options.goodsId) {
      setTimeout(() => {
        wx.navigateTo({ url: `/pages/detail/detail?id=${options.goodsId}&autoTrace=1&traceId=${options.traceId}` });
      }, 300);
    }
  },

  onShow() {
    // 检查未读消息并更新 TabBar 小红点
    const app = getApp();
    if (app && app.checkUnreadMessages) {
      app.checkUnreadMessages();
    }

    // 每次页面显示时重新加载数据，确保数据是最新的
    // 但如果是首次加载（onLoad刚执行完），避免重复请求
    if (this.data.goodsList.length > 0) {
      this.loadGoods(false);
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadGoods(false);
  },

  async loadGoods(showLoading = true) {
    if (showLoading) {
      wx.showLoading({ title: '加载中' });
    }
    try {
      const res = await wx.cloud.callFunction({
        name: 'goodsCenter',
        data: { action: 'listPublishedGoods' }  // 所有用户都可以查看已上架的商品
      });
      if (showLoading) {
        wx.hideLoading();
      } else {
        // 如果是下拉刷新，停止刷新动画
        wx.stopPullDownRefresh();
      }
      if (res.result.success) {
        this.setData({ goodsList: res.result.data, allGoods: res.result.data });
      }
    } catch (err) {
      if (showLoading) {
        wx.hideLoading();
      } else {
        wx.stopPullDownRefresh();
      }
      console.error('加载商品失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ goodsList: [], allGoods: [] });
    }
  },
  // 注意：addToCart 中的 image 参数是从 dataset 获取的，无需修改（因为 dataset 中的 image 已经是正确的 URL）

  onSearchInput(e) {
    const keyword = e.detail.value.toLowerCase()
    if (!keyword) {
      this.setData({ goodsList: this.data.allGoods })
      return
    }
    const filtered = this.data.allGoods.filter(g => g.name.toLowerCase().includes(keyword))
    this.setData({ goodsList: filtered })
  },
  gotoDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },

  // 新增
// pages/goods/goods.js - 修改 addToCart 方法
    async addToCart(e) {
        const app = getApp();
        if (!app.checkLogin()) return;
    
        const { id } = e.currentTarget.dataset;
        const goods = this.data.allGoods.find(g => g._id === id);
        if (!goods) return;
    
        // 如果有规格，弹出规格选择弹窗
        if (goods.variants && goods.variants.length > 0) {
        this.setData({
            showSkuPopup: true,
            currentGoods: goods,
            selectedSku: goods.variants[0],
            skuQuantity: 1
        });
        return;
        }
    
        // 无规格直接加购
        await this._directAddToCart(goods._id, 1, null);
    },
    
    async _directAddToCart(goodsId, num, sku) {
        wx.showLoading({ title: '添加中' });
        try {
        await wx.cloud.callFunction({
            name: 'addToCart',
            data: { goodsId, num, sku }
        });
        wx.hideLoading();
        wx.showToast({ title: '已添加', icon: 'success' });
        } catch (err) {
        wx.hideLoading();
        wx.showToast({ title: '添加失败', icon: 'none' });
        console.error(err);
        }
    },

    selectGoodsSku(e) {
        const sku = e.currentTarget.dataset.sku;
        this.setData({ selectedSku: sku });
      },
      closeSkuPopup() {
        this.setData({ showSkuPopup: false, currentGoods: null });
      },
      increaseSkuQuantity() {
        this.setData({ skuQuantity: this.data.skuQuantity + 1 });
      },
      decreaseSkuQuantity() {
        if (this.data.skuQuantity > 1) {
          this.setData({ skuQuantity: this.data.skuQuantity - 1 });
        }
      },
      confirmSkuAdd() {
        const { currentGoods, selectedSku, skuQuantity } = this.data;
        this._directAddToCart(currentGoods._id, skuQuantity, selectedSku);
        this.closeSkuPopup();
      }
})