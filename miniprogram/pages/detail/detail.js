// pages/detail/detail.js
const { getImageUrl } = require('../../utils/imageMap.js');

Page({
  data: {
    goods: {
      _id: '',
      name: '',
      price: 0,
      image: '',
      images: [],
      sales: 0,
      desc: '',
      description: '',
      variants: []        // 规格列表
    },
    quantity: 1,
    showSpecPopup: false,
    traceCodeImage: '',
    traceCodeLoading: false,
    currentTraceId: '',
    showTraceSection: true,
    skuList: [],           // 规格列表（对象数组）
    selectedSku: null,     // 当前选中的规格对象
    currentAction: null    // 'cart' 或 'buy'
  },

  onLoad(options) {
    const goodsId = options.id;
    if (!goodsId) {
      wx.showToast({ title: '商品不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    // 记录来源页面
    const pages = getCurrentPages();
    const prevPage = pages[pages.length - 2];
    let sourceTab = 'index';
    if (prevPage) {
      const route = prevPage.route;
      if (route.includes('goods/goods')) sourceTab = 'goods';
      else if (route.includes('index/index')) sourceTab = 'index';
    }
    const app = getApp();
    app.globalData.lastSourceTab = sourceTab;
    app.globalData.lastGoodsId = goodsId;

    // 判断是否需要隐藏溯源区块（ID 6~9 无溯源）
    const hideTraceIds = ['6', '7', '8', '9'];
    this.setData({
      showTraceSection: !hideTraceIds.includes(goodsId)
    });

    // 加载商品详情
    this.loadGoodsDetail(goodsId);

    // 生成溯源码（仅当商品显示溯源区块时）
    if (!hideTraceIds.includes(goodsId)) {
      this.generateTraceQRCode(goodsId);
    }

    // 处理从溯源码 reLaunch 过来的自动跳转
    if (options.autoTrace === '1' && options.traceId) {
      setTimeout(() => {
        wx.navigateTo({ url: `/pages/trace/trace?traceId=${options.traceId}` });
      }, 100);
    }
  },

  // ========== 从云数据库加载商品详情 ==========
  async loadGoodsDetail(goodsId) {
    wx.showLoading({ title: '加载中' });
    try {
      // 改为调用云函数
      const res = await wx.cloud.callFunction({
        name: 'goodsCenter',
        data: { 
          action: 'getDetail', 
          data: { id: goodsId } 
        }
      });
      wx.hideLoading();
  
      if (!res.result.success) {
        throw new Error(res.result.error || '商品不存在');
      }
  
      const goods = res.result.data;
      
      // ========== 以下处理图片、规格等逻辑完全不变 ==========
      const processImage = (img) => {
        if (!img) return '';
        if (img.startsWith('cloud://')) return img;
        return img;
      };
  
      const images = goods.images || [];
      const mainImage = goods.image || (images.length > 0 ? images[0] : '');
      const variants = goods.variants || [];
      const selectedSku = variants.length > 0 ? variants[0] : null;
  
      this.setData({
        goods: {
          ...goods,
          image: processImage(mainImage),
          images: images.map(processImage),
          variants,
          description: goods.description || goods.desc || ''
        },
        skuList: variants,
        selectedSku,
        ...(selectedSku ? {
          'goods.price': selectedSku.price,
          'goods.image': processImage(selectedSku.image)
        } : {})
      });
  
    } catch (err) {
      wx.hideLoading();
      console.error('加载商品详情失败', err);
      wx.showModal({
        title: '加载失败',
        content: '商品信息获取失败，请稍后重试',
        showCancel: false,
        success: () => wx.navigateBack()
      });
    }
  },

  // ========== 生成溯源码二维码 ==========
  generateTraceId(goodsId) {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `TR${dateStr}${random}`;
  },

  async generateTraceQRCode(goodsId) {
    this.setData({ traceCodeLoading: true });

    // 不需要溯源码的商品直接返回
    const skipTraceIds = ['6', '7', '8', '9'];
    if (skipTraceIds.includes(goodsId)) {
      this.setData({ traceCodeImage: '', showTraceSection: false, traceCodeLoading: false });
      return;
    }

    try {
      const db = wx.cloud.database();
      // 查询是否已有溯源码
      const res = await db.collection('traceability')
        .where({ goodsId: goodsId })
        .orderBy('createTime', 'desc')
        .limit(1)
        .get();

      let qrCodeFileID = '';
      let traceId = '';

      if (res.data.length > 0 && res.data[0].qrCodeFileID) {
        qrCodeFileID = res.data[0].qrCodeFileID;
        traceId = res.data[0].traceId;
      } else {
        traceId = this.generateTraceId(goodsId);

        // 调用云函数生成二维码图片
        const cloudRes = await wx.cloud.callFunction({
          name: 'genTraceCode',
          data: {
            scene: traceId,
            page: 'pages/trace/trace',
            width: 280
          }
        });

        if (cloudRes.result && cloudRes.result.success) {
          qrCodeFileID = cloudRes.result.fileID;

          // 将溯源码信息写入数据库
          await db.collection('traceability').add({
            data: {
              traceId: traceId,
              goodsId: goodsId,
              qrCodeFileID: qrCodeFileID,
              createTime: db.serverDate(),
              productName: this.data.goods.name,
              orchard: '赣南富硒果园',
              plantTime: '2024-03-15',
              floweringPeriod: '2025-04-01 ~ 2025-04-15',
              fruitSettingPeriod: '2025-05-01 ~ 2025-06-15',
              harvestTime: '2025-11-10',
              description: this.data.goods.desc,
              images: [this.data.goods.image]
            }
          });
        } else {
          throw new Error(cloudRes.result.error || '生成失败');
        }
      }

      this.setData({
        traceCodeImage: qrCodeFileID,
        currentTraceId: traceId
      });
    } catch (err) {
      console.error('生成溯源码失败', err);
      wx.showToast({ title: '溯源码生成失败', icon: 'none' });
      this.setData({ traceCodeImage: getImageUrl('trace_qrcode.png') });
    } finally {
      this.setData({ traceCodeLoading: false });
    }
  },

  // ========== 数量操作 ==========
  addQuantity() {
    this.setData({ quantity: this.data.quantity + 1 });
  },
  subQuantity() {
    if (this.data.quantity > 1) {
      this.setData({ quantity: this.data.quantity - 1 });
    }
  },
  stopPropagation() {},

  // ========== 登录检查 ==========
  checkLogin() {
    return getApp().checkLogin();
  },

  // ========== 加入购物车入口 ==========
  addToCart() {
    if (!this.checkLogin()) return;
    const { skuList } = this.data;
    if (skuList.length > 0) {
      this.setData({ showSpecPopup: true, currentAction: 'cart' });
    } else {
      this._doAddToCart();
    }
  },

  // ========== 实际执行加入购物车 ==========
  async _doAddToCart() {
    const app = getApp();
    const { goods, quantity, selectedSku } = this.data;
    const goodsId = goods._id;
    wx.showLoading({ title: '添加中' });
    try {
      await wx.cloud.callFunction({
        name: 'addToCart',
        data: {
          goodsId,
          num: quantity,
          sku: selectedSku || null
        }
      });
      wx.hideLoading();
      wx.showToast({ title: '已加入购物车', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '添加失败', icon: 'none' });
      console.error(err);
    }
  },

  // ========== 立即购买入口 ==========
  buyNow() {
    if (!this.checkLogin()) return;
    const { skuList } = this.data;
    if (skuList.length > 0) {
      this.setData({ showSpecPopup: true, currentAction: 'buy' });
    } else {
      this._doBuyNow();
    }
  },

  // ========== 实际执行立即购买 ==========
  _doBuyNow() {
    const { goods, quantity, selectedSku } = this.data;
    const item = {
      goodsId: goods._id,
      name: goods.name,
      price: selectedSku ? selectedSku.price : goods.price,
      image: selectedSku ? selectedSku.image : goods.image,
      num: quantity,
      skuName: selectedSku ? selectedSku.name : '',
      checked: true
    };
    wx.setStorageSync('checkoutItems', [item]);
    wx.navigateTo({ url: '/pages/order/order' });
  },

  // ========== 规格弹窗相关 ==========
  selectSku(e) {
    const sku = e.currentTarget.dataset.sku;
    this.setData({
      selectedSku: sku,
      'goods.price': sku.price,
      'goods.image': sku.image
    });
  },

  confirmSku() {
    const { currentAction } = this.data;
    this.setData({ showSpecPopup: false });
    if (currentAction === 'cart') {
      this._doAddToCart();
    } else if (currentAction === 'buy') {
      this._doBuyNow();
    }
    this.setData({ currentAction: null });
  },

  hideSpecPopup() {
    this.setData({ showSpecPopup: false, currentAction: null });
  },

  // ========== 客服 ==========
  contactService() {
    // 跳转到客服聊天页面
    wx.navigateTo({ url: '/pages/serviceChat/serviceChat' });
  },

  // ========== 科普页面 ==========
  gotoScience() {
    wx.navigateTo({ url: '/pages/science/science' });
  },

  // ========== 查看溯源 ==========
  viewTrace() {
    const traceId = this.data.currentTraceId;
    if (!traceId) {
      wx.showToast({ title: '溯源码未就绪', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/trace/trace?traceId=${traceId}`
    });
  },

  // ========== 保存二维码到相册 ==========
  saveQRCodeToAlbum() {
    if (!this.data.traceCodeImage) return;
    wx.cloud.downloadFile({
      fileID: this.data.traceCodeImage,
      success: res => {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => wx.showToast({ title: '保存成功', icon: 'success' }),
          fail: () => wx.showToast({ title: '保存失败', icon: 'none' })
        });
      },
      fail: () => wx.showToast({ title: '下载失败', icon: 'none' })
    });
  }
});