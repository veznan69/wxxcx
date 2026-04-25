Page({
  data: {
    traceId: '',
    goodsList: [],
    selectedGoodsId: '',
    selectedGoodsName: '',
    qrCodeFileID: ''
  },

  onLoad() {
    this.loadGoods();
  },

  loadGoods() {
    // 同 goods.js 中的商品数据，可直接从云函数获取或使用静态数据
    const mockGoods = [
      { _id: '1', name: '富硒脐橙 精品礼盒' },
      { _id: '2', name: '有机脐橙 家庭装' },
      { _id: '3', name: '脐橙果酱 纯手工' },
      { _id: '4', name: '脐橙米果 香脆' },
      { _id: '5', name: '赣南脐橙 5斤装' }
    ];
    this.setData({ goodsList: mockGoods });
  },
  //原代码
  // generateRandomId() {
  //   const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
  //   const random = Math.floor(Math.random() * 10000).toString().padStart(4,'0');
  //   const traceId = `TR${dateStr}${random}`;
  //   this.setData({ traceId });
  // },
  generateRandomId() {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const traceId = `TR${dateStr}${random}`;
    this.setData({ traceId });
    wx.showToast({ title: '已生成', icon: 'success', duration: 1000 });
  },

  onTraceIdInput(e) {
    this.setData({ traceId: e.detail.value.trim() });
  },

  onGoodsChange(e) {
    const index = e.detail.value;
    const goods = this.data.goodsList[index];
    this.setData({
      selectedGoodsId: goods._id,
      selectedGoodsName: goods.name
    });
  },

  async generateCode() {
    const { traceId } = this.data;
    if (!traceId) {
      wx.showToast({ title: '请输入溯源ID', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '生成中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'genTraceCode',
        data: {
          scene: this.data.traceId,
          page: 'pages/trace/trace',
          width: 280
        }
      });
      wx.hideLoading();
      if (res.result.success) {
        this.setData({ qrCodeFileID: res.result.fileID });
        wx.showToast({ title: '生成成功', icon: 'success' });
      } else {
        wx.showToast({ title: res.result.error || '生成失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('生成二维码失败', err);
      wx.showToast({ title: '网络错误，请稍后重试', icon: 'none' });
    }
  },

  saveToAlbum() {
    if (!this.data.qrCodeFileID) return;
    wx.cloud.downloadFile({
      fileID: this.data.qrCodeFileID,
      success: res => {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => wx.showToast({ title: '保存成功', icon: 'success' }),
          fail: () => wx.showToast({ title: '保存失败', icon: 'none' })
        });
      }
    });
  },

  copyFileID() {
    wx.setClipboardData({
      data: this.data.qrCodeFileID,
      success: () => wx.showToast({ title: '已复制', icon: 'success' })
    });
  }
});