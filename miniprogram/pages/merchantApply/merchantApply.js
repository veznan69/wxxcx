Page({
  data: {
    form: {
      shopName: '',
      contactName: '',
      contactPhone: '',
      shopAddress: '',
      licenseImages: [],
      remark: ''
    }
  },

  onLoad() {
    // this.checkExistingApplication();
  },

  async checkExistingApplication() {
    const res = await wx.cloud.callFunction({
      name: 'merchantApplication',
      data: { action: 'getMyApplication' }
    });
    if (res.result.success && res.result.data) {
      const app = res.result.data;
      wx.showModal({
        title: '申请状态',
        content: `当前状态：${app.status === 'pending' ? '审核中' : app.status === 'approved' ? '已通过' : '已拒绝'}`,
        showCancel: false
      });
    }
  },

  // ========== 上传营业执照 ==========
  async uploadLicense() {
    const that = this;
    try {
      // 1. 选择图片
      const res = await wx.chooseImage({
        count: 3 - that.data.form.licenseImages.length,  // 最多3张
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      });

      const tempFilePaths = res.tempFilePaths;
      if (tempFilePaths.length === 0) return;

      wx.showLoading({ title: '上传中...', mask: true });

      // 2. 批量上传到云存储
      const uploadPromises = tempFilePaths.map(filePath => {
        const cloudPath = `licenses/${Date.now()}_${Math.random().toString(36).substr(2, 8)}.png`;
        return wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: filePath
        });
      });

      const uploadRes = await Promise.all(uploadPromises);
      const fileIDs = uploadRes.map(r => r.fileID);

      // 3. 更新本地数据
      const newImages = that.data.form.licenseImages.concat(fileIDs);
      that.setData({ 'form.licenseImages': newImages });

      wx.hideLoading();
      wx.showToast({ title: `成功上传${fileIDs.length}张`, icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      // 用户取消选择
      if (err.errMsg && err.errMsg.includes('cancel')) {
        console.log('用户取消选择图片');
        // 可加提示：wx.showToast({ title: '已取消', icon: 'none' });
      } else {
        console.error('上传图片失败', err);
        wx.showToast({ title: '上传失败，请重试', icon: 'none' });
      }
    }
  },

  // ========== 删除已选图片 ==========
  deleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.form.licenseImages;
    images.splice(index, 1);
    this.setData({ 'form.licenseImages': images });
  },

  // ========== 输入框绑定 ==========
  onShopNameInput(e) { this.setData({ 'form.shopName': e.detail.value }); },
  onContactNameInput(e) { this.setData({ 'form.contactName': e.detail.value }); },
  onContactPhoneInput(e) { this.setData({ 'form.contactPhone': e.detail.value }); },
  onShopAddressInput(e) { this.setData({ 'form.shopAddress': e.detail.value }); },
  onRemarkInput(e) { this.setData({ 'form.remark': e.detail.value }); },

  // ========== 提交申请 ==========
  async submitApply() {
    // 简单校验
    const { shopName, contactName, contactPhone, shopAddress } = this.data.form;
    if (!shopName || !contactName || !contactPhone || !shopAddress) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(contactPhone)) {
      wx.showToast({ title: '手机号格式错误', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '提交中...', mask: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'merchantApplication',
        data: {
          action: 'submit',
          data: this.data.form
        }
      });
      wx.hideLoading();
      if (res.result.success) {
        wx.showToast({ title: '提交成功', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 1500);
      } else {
        wx.showToast({ title: res.result.error, icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('提交失败', err);
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
    }
  },

  // 预览大图
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      urls: this.data.form.licenseImages,
      current: url
    });
  },
  
  // 查看申请状态（供按钮调用）
  checkStatus() {
    this.checkExistingApplication();
  },

  async checkExistingApplication(silent = false) {
    const res = await wx.cloud.callFunction({
      name: 'merchantApplication',
      data: { action: 'getMyApplication' }
    });
    if (res.result.success && res.result.data) {
      const app = res.result.data;
      if (!silent) {
        wx.showModal({
          title: '申请状态',
          content: `当前状态：${app.status === 'pending' ? '审核中' : app.status === 'approved' ? '已通过' : '已拒绝'}`,
          showCancel: false
        });
      }
      // 可以在这里将状态存入 data，用于页面顶部展示
      this.setData({ applicationStatus: app.status });
    }
  },
});