// pages/trace/trace.js
const { getImageUrl } = require('../../utils/imageMap.js');

Page({
  data: {
    traceId: '',
    traceInfo: {},
    blockchainInfo: {},   // 区块链模拟数据
    govCertImage: ''      // 政府对接证明图片（可能是外部链接或本地路径）
  },

  onLoad(options) {
    const traceId = options.traceId || options.scene;
    if (!traceId) {
      wx.showToast({ title: '无效的溯源码', icon: 'none' });
      return;
    }

    const pages = getCurrentPages();
    if (pages.length === 1) {
      // 直接进入（包括扫码、从分享进入等），重建页面栈
      this.rebuildPageStack(traceId);
      return;
    }

    // 正常从详情页 navigateTo 进入
    this.setData({ traceId });
    this.loadTraceInfo(traceId);
  },

  async rebuildPageStack(traceId) {
    // 从数据库获取商品ID
    const goodsId = await this.getGoodsIdByTraceId(traceId);
    // reLaunch 到首页，携带参数，清空页面栈并重建
    wx.reLaunch({
      url: `/pages/index/index?autoTrace=1&traceId=${traceId}&goodsId=${goodsId}`
    });
  },

  async getGoodsIdByTraceId(traceId) {
    try {
      const db = wx.cloud.database();
      const res = await db.collection('traceability')
        .where({ traceId })
        .field({ goodsId: true })
        .limit(1)
        .get();
      if (res.data.length > 0 && res.data[0].goodsId) {
        return res.data[0].goodsId;
      }
    } catch (err) {
      console.error('查询商品ID失败', err);
    }
    return '1'; // 默认商品ID
  },

  // 自定义返回按钮（用于页面左上角）
  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: '/pages/index/index' });
    }
  },

  async loadTraceInfo(traceId) {
    wx.showLoading({ title: '加载中' });
    try {
      const db = wx.cloud.database();
      const res = await db.collection('traceability')
        .where({ traceId: traceId })
        .get();
      wx.hideLoading();
      
      if (res.data.length > 0) {
        let traceInfo = res.data[0];
        
        // 处理图片：如果已经是完整 URL（http/https/cloud://），直接使用，否则通过 getImageUrl 转换
        const processImage = (img) => {
          if (!img) return '';
          if (img.startsWith('http') || img.startsWith('https') || img.startsWith('cloud://')) {
            return img;
          }
          return getImageUrl(img);
        };

        // 处理 images 数组
        if (traceInfo.images && traceInfo.images.length) {
          traceInfo.images = traceInfo.images.map(img => processImage(img));
        } else {
          traceInfo.images = [getImageUrl('banner1.png')]; // 使用已存在的图片作为默认
        }

        if (traceInfo.productImage) {
          traceInfo.productImage = processImage(traceInfo.productImage);
        }

        if (traceInfo.bannerImage) {
          traceInfo.bannerImage = processImage(traceInfo.bannerImage);
        } else {
          traceInfo.bannerImage = getImageUrl('banner1.png'); // 默认头图
        }
        
        this.setData({ traceInfo });
      } else {
        wx.showToast({ title: '溯源信息不存在', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('加载溯源失败', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    } finally {
      // ✅ 无论数据库是否有数据，都设置模拟区块链信息（包含政府图片处理）
      this.setMockBlockchainInfo();
    }
  },

  // 设置模拟区块链存证数据，并智能处理政府证明图片
  // 设置模拟区块链存证数据，并设置政府证明图片（统一使用 getImageUrl 获取外部链接）
  setMockBlockchainInfo() {
    // 生成随机交易哈希（0x开头，64位十六进制）
    const randomHex = () => Math.floor(Math.random() * 16).toString(16);
    let hash = '0x';
    for (let i = 0; i < 64; i++) hash += randomHex();
    
    // 随机区块高度
    const blockHeight = (16000000 + Math.floor(Math.random() * 500000)).toString();
    
    // 当前时间作为上链时间
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
    
    // ✅ 统一通过 getImageUrl 获取政府证明图片的外部链接
    const govCertImage = getImageUrl('gov_cert_thumb.png'); // 缩略图

    this.setData({
      blockchainInfo: {
        txHash: hash.toUpperCase(),
        blockHeight: blockHeight,
        timestamp: timestamp
      },
      govCertImage: govCertImage
    });
  },

  // 预览政府对接证明大图（支持外部链接和本地图片）
  // 预览政府对接证明大图（使用 getImageUrl 获取外部链接）
  previewGovCert() {
    const fullImageUrl = getImageUrl('gov_cert_full.jpg'); // 大图文件名
    wx.previewImage({
      urls: [fullImageUrl],
      current: fullImageUrl
    });
  }
});