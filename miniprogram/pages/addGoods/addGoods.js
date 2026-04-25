Page({
  data: {
    resubmitId: '', // 再次提交的商品ID
    activeTab: 'single', // single: 单规格, multi: 多规格
    // 单规格商品数据
    singleGoods: {
      name: '',
      price: '',
      image: '',
      images: [],
      desc: '',
      generateTraceCode: false
    },
    // 多规格商品数据
    multiGoods: {
      name: '',
      specs: [
        {
          name: '',
          price: '',
          style: '',
          image: '',
          images: []
        }
      ],
      desc: '',
      generateTraceCode: false
    },
    submitting: false,
    isAdmin: false
  },

  onLoad(options) {
    const app = getApp();
    const role = app.globalData.userInfo && app.globalData.userInfo.role
      ? app.globalData.userInfo.role
      : 'user';

    if (role !== 'merchant' && role !== 'admin') {
      wx.showToast({ title: '无权限访问', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }

    // 设置页面标题
    if (options.resubmitId) {
      wx.setNavigationBarTitle({ title: '重新提交审核' });
    }

    this.setData({
      isAdmin: role === 'admin',
      resubmitId: options.resubmitId || ''
    });

    // 如果是再次提交，加载商品数据并预填充
    if (options.resubmitId) {
      this.loadGoodsForResubmit(options.resubmitId);
    }
  },

  // 加载商品数据用于再次提交
  async loadGoodsForResubmit(id) {
    try {
      wx.showLoading({ title: '加载中...' });
      const res = await wx.cloud.callFunction({
        name: 'goodsCenter',
        data: {
          action: 'getGoodsById',
          data: { id }
        }
      });

      const result = res.result;
      if (!result.success || !result.data) {
        wx.showToast({ title: '商品不存在', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1500);
        return;
      }

      const goods = result.data;

      // 根据商品类型预填充数据
      if (goods.isMultiSpec) {
        // 多规格商品
        const specs = (goods.specs || []).map(spec => ({
          name: spec.name || '',
          price: spec.price || '',
          style: spec.style || '',
          image: spec.image || '',
          images: spec.images || []
        }));

        this.setData({
          activeTab: 'multi',
          multiGoods: {
            name: goods.name || '',
            specs: specs,
            desc: goods.desc || '',
            generateTraceCode: goods.generateTraceCode || false
          }
        });
      } else {
        // 单规格商品
        this.setData({
          activeTab: 'single',
          singleGoods: {
            name: goods.name || '',
            price: goods.price || '',
            image: goods.image || '',
            images: goods.images || [],
            desc: goods.desc || '',
            generateTraceCode: goods.generateTraceCode || false
          }
        });
      }

      wx.hideLoading();
    } catch (err) {
      console.error('load goods for resubmit failed', err);
      wx.hideLoading();
      wx.showToast({ title: '加载失败', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  // Tab 切换
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },

  // === 单规格商品方法 ===

  onSingleNameInput(e) {
    this.setData({
      'singleGoods.name': e.detail.value
    });
  },

  onSinglePriceInput(e) {
    this.setData({
      'singleGoods.price': e.detail.value
    });
  },

  onSingleDescInput(e) {
    this.setData({
      'singleGoods.desc': e.detail.value
    });
  },

  onSingleChooseImage() {
    const currentImages = this.data.singleGoods.images || [];
    if (currentImages.length >= 9) {
      wx.showToast({ title: '最多上传9张图片', icon: 'none' });
      return;
    }

    wx.chooseMedia({
      count: 9 - currentImages.length,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFiles = res.tempFiles;
        this.uploadSingleImages(tempFiles);
      }
    });
  },

  async uploadSingleImages(files) {
    wx.showLoading({ title: '上传中...' });

    try {
      const uploadPromises = files.map(file =>
        wx.cloud.uploadFile({
          cloudPath: `goods/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`,
          filePath: file.tempFilePath
        })
      );

      const results = await Promise.all(uploadPromises);
      const fileIDs = results.map(r => r.fileID);

      const newImages = [...(this.data.singleGoods.images || []), ...fileIDs];

      this.setData({
        'singleGoods.images': newImages,
        'singleGoods.image': newImages[0] || ''
      });

      wx.showToast({ title: '上传成功', icon: 'success' });
    } catch (err) {
      console.error('upload images failed', err);
      wx.showToast({ title: '上传失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onSingleDeleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = [...this.data.singleGoods.images];
    images.splice(index, 1);

    this.setData({
      'singleGoods.images': images,
      'singleGoods.image': images[0] || ''
    });
  },

  onSinglePreviewImage(e) {
    const index = e.currentTarget.dataset.index;
    wx.previewImage({
      urls: this.data.singleGoods.images,
      current: index
    });
  },

  onSingleToggleTraceCode() {
    this.setData({
      'singleGoods.generateTraceCode': !this.data.singleGoods.generateTraceCode
    });
  },

  // === 多规格商品方法 ===

  onMultiNameInput(e) {
    this.setData({
      'multiGoods.name': e.detail.value
    });
  },

  onMultiDescInput(e) {
    this.setData({
      'multiGoods.desc': e.detail.value
    });
  },

  onMultiToggleTraceCode() {
    this.setData({
      'multiGoods.generateTraceCode': !this.data.multiGoods.generateTraceCode
    });
  },

  // 规格操作
  onSpecNameInput(e) {
    const index = e.currentTarget.dataset.index;
    const specs = [...this.data.multiGoods.specs];
    specs[index].name = e.detail.value;
    this.setData({ 'multiGoods.specs': specs });
  },

  onSpecPriceInput(e) {
    const index = e.currentTarget.dataset.index;
    const specs = [...this.data.multiGoods.specs];
    specs[index].price = e.detail.value;
    this.setData({ 'multiGoods.specs': specs });
  },

  onSpecStyleInput(e) {
    const index = e.currentTarget.dataset.index;
    const specs = [...this.data.multiGoods.specs];
    specs[index].style = e.detail.value;
    this.setData({ 'multiGoods.specs': specs });
  },

  onAddSpec() {
    const specs = [...this.data.multiGoods.specs];
    if (specs.length >= 10) {
      wx.showToast({ title: '最多添加10个规格', icon: 'none' });
      return;
    }
    specs.push({
      name: '',
      price: '',
      style: '',
      image: '',
      images: []
    });
    this.setData({ 'multiGoods.specs': specs });
  },

  onDeleteSpec(e) {
    const index = e.currentTarget.dataset.index;
    const specs = [...this.data.multiGoods.specs];
    if (specs.length <= 1) {
      wx.showToast({ title: '至少保留一个规格', icon: 'none' });
      return;
    }
    specs.splice(index, 1);
    this.setData({ 'multiGoods.specs': specs });
  },

  onSpecChooseImage(e) {
    const index = e.currentTarget.dataset.index;
    const spec = this.data.multiGoods.specs[index];
    const currentImages = spec.images || [];

    if (currentImages.length >= 5) {
      wx.showToast({ title: '每个规格最多上传5张图片', icon: 'none' });
      return;
    }

    wx.chooseMedia({
      count: 5 - currentImages.length,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.uploadSpecImages(index, res.tempFiles);
      }
    });
  },

  async uploadSpecImages(specIndex, files) {
    wx.showLoading({ title: '上传中...' });

    try {
      const uploadPromises = files.map(file =>
        wx.cloud.uploadFile({
          cloudPath: `goods/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`,
          filePath: file.tempFilePath
        })
      );

      const results = await Promise.all(uploadPromises);
      const fileIDs = results.map(r => r.fileID);

      const specs = [...this.data.multiGoods.specs];
      const newImages = [...(specs[specIndex].images || []), ...fileIDs];

      specs[specIndex].images = newImages;
      specs[specIndex].image = newImages[0] || '';

      this.setData({ 'multiGoods.specs': specs });

      wx.showToast({ title: '上传成功', icon: 'success' });
    } catch (err) {
      console.error('upload images failed', err);
      wx.showToast({ title: '上传失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onSpecDeleteImage(e) {
    const { specIndex, imageIndex } = e.currentTarget.dataset;
    const specs = [...this.data.multiGoods.specs];
    const images = [...specs[specIndex].images];
    images.splice(imageIndex, 1);

    specs[specIndex].images = images;
    specs[specIndex].image = images[0] || '';

    this.setData({ 'multiGoods.specs': specs });
  },

  onSpecPreviewImage(e) {
    const { specIndex, imageIndex } = e.currentTarget.dataset;
    wx.previewImage({
      urls: this.data.multiGoods.specs[specIndex].images,
      current: imageIndex
    });
  },

  // === 提交 ===

  async onSubmit() {
    if (this.data.activeTab === 'single') {
      await this.submitSingleGoods();
    } else {
      await this.submitMultiGoods();
    }
  },

  async submitSingleGoods() {
    const { name, price, image, images, desc, generateTraceCode } = this.data.singleGoods;

    if (!name.trim()) {
      wx.showToast({ title: '请输入商品名称', icon: 'none' });
      return;
    }

    if (!price || isNaN(price) || Number(price) <= 0) {
      wx.showToast({ title: '请输入正确的价格', icon: 'none' });
      return;
    }

    if (!image || !images || images.length === 0) {
      wx.showToast({ title: '请上传商品图片', icon: 'none' });
      return;
    }

    if (!desc.trim()) {
      wx.showToast({ title: '请输入商品描述', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      let action = 'submitGoods';
      let requestData = {
        name: name.trim(),
        price: Number(price),
        image,
        images,
        desc: desc.trim(),
        generateTraceCode,
        isMultiSpec: false
      };

      // 如果是再次提交，添加商品ID并使用更新接口
      if (this.data.resubmitId) {
        action = 'updateGoods';
        requestData._id = this.data.resubmitId;
      }

      const res = await wx.cloud.callFunction({
        name: 'goodsCenter',
        data: {
          action,
          data: requestData
        }
      });

      const result = res.result;
      if (!result.success) {
        wx.showToast({ title: result.error || '提交失败', icon: 'none' });
        return;
      }

      wx.showToast({
        title: '提交成功，等待审核',
        icon: 'success',
        duration: 2000,
        success: () => {
          setTimeout(() => {
            wx.navigateBack();
          }, 2000);
        }
      });
    } catch (err) {
      console.error('submit single goods failed', err);
      wx.showToast({ title: '提交失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async submitMultiGoods() {
    const { name, specs, desc, generateTraceCode } = this.data.multiGoods;

    if (!name.trim()) {
      wx.showToast({ title: '请输入商品名称', icon: 'none' });
      return;
    }

    if (!specs || specs.length === 0) {
      wx.showToast({ title: '请至少添加一个规格', icon: 'none' });
      return;
    }

    // 验证每个规格
    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i];
      if (!spec.name.trim()) {
        wx.showToast({ title: `请输入第${i + 1}个规格的名称`, icon: 'none' });
        return;
      }
      if (!spec.price || isNaN(spec.price) || Number(spec.price) <= 0) {
        wx.showToast({ title: `请输入第${i + 1}个规格的正确价格`, icon: 'none' });
        return;
      }
      if (!spec.image || !spec.images || spec.images.length === 0) {
        wx.showToast({ title: `请上传第${i + 1}个规格的图片`, icon: 'none' });
        return;
      }
    }

    if (!desc.trim()) {
      wx.showToast({ title: '请输入商品描述', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      let action = 'submitMultiSpecGoods';
      let requestData = {
        name: name.trim(),
        specs,
        desc: desc.trim(),
        generateTraceCode,
        isMultiSpec: true
      };

      // 如果是再次提交，添加商品ID并使用更新接口
      if (this.data.resubmitId) {
        action = 'updateMultiSpecGoods';
        requestData._id = this.data.resubmitId;
      }

      const res = await wx.cloud.callFunction({
        name: 'goodsCenter',
        data: {
          action,
          data: requestData
        }
      });

      const result = res.result;
      if (!result.success) {
        wx.showToast({ title: result.error || '提交失败', icon: 'none' });
        return;
      }

      wx.showToast({
        title: '提交成功，等待审核',
        icon: 'success',
        duration: 2000,
        success: () => {
          setTimeout(() => {
            wx.navigateBack();
          }, 2000);
        }
      });
    } catch (err) {
      console.error('submit multi goods failed', err);
      wx.showToast({ title: '提交失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
