Page({
  data: {
    id: '',
    goodsId: '',
    loading: false,
    submitting: false,
    isAdmin: false,
    activeTab: 'single', // single | multi
    singleGoods: {
      name: '',
      price: '',
      image: '',
      images: [],
      desc: '',
      generateTraceCode: false
    },
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
    }
  },

  onLoad(options) {
    const id = options.id;
    if (!id) {
      wx.showToast({ title: '商品ID错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    const app = getApp();
    const role = app.globalData.userInfo && app.globalData.userInfo.role
      ? app.globalData.userInfo.role
      : 'user';

    if (role !== 'merchant' && role !== 'admin') {
      wx.showToast({ title: '无权限访问', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }

    this.setData({
      id,
      goodsId: id,
      isAdmin: role === 'admin'
    });

    this.loadGoodsDetail();
  },

  async loadGoodsDetail() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'goodsCenter',
        data: {
          action: 'getDetail',
          data: { id: this.data.goodsId }
        }
      });

      const result = res.result;
      if (!result.success) {
        wx.showToast({ title: result.error || '加载失败', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1500);
        return;
      }

      const goods = result.data || {};

      if (goods.isMultiSpec) {
        const specs = (goods.specs || []).map(spec => ({
          name: spec.name || '',
          price: spec.price || '',
          style: spec.style || '',
          image: spec.image || '',
          images: spec.images || (spec.image ? [spec.image] : [])
        }));

        this.setData({
          activeTab: 'multi',
          multiGoods: {
            name: goods.name || '',
            specs: specs.length ? specs : [{ name: '', price: '', style: '', image: '', images: [] }],
            desc: goods.desc || '',
            generateTraceCode: !!goods.generateTraceCode
          }
        });
      } else {
        const images = goods.images && goods.images.length
          ? goods.images
          : (goods.image ? [goods.image] : []);

        this.setData({
          activeTab: 'single',
          singleGoods: {
            name: goods.name || '',
            price: goods.price || '',
            image: goods.image || images[0] || '',
            images,
            desc: goods.desc || '',
            generateTraceCode: !!goods.generateTraceCode
          }
        });
      }
    } catch (err) {
      console.error('load goods detail failed', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  getCloudPath() {
    return `goods/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
  },

  onSingleNameInput(e) {
    this.setData({ 'singleGoods.name': e.detail.value });
  },

  onSinglePriceInput(e) {
    this.setData({ 'singleGoods.price': e.detail.value });
  },

  onSingleDescInput(e) {
    this.setData({ 'singleGoods.desc': e.detail.value });
  },

  onSingleToggleTraceCode() {
    this.setData({
      'singleGoods.generateTraceCode': !this.data.singleGoods.generateTraceCode
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
        this.uploadSingleImages(res.tempFiles || []);
      }
    });
  },

  async uploadSingleImages(files) {
    if (!files.length) return;

    wx.showLoading({ title: '上传中...' });
    try {
      const uploadPromises = files.map(file => wx.cloud.uploadFile({
        cloudPath: this.getCloudPath(),
        filePath: file.tempFilePath
      }));

      const results = await Promise.all(uploadPromises);
      const fileIDs = results.map(item => item.fileID).filter(Boolean);
      const newImages = [...(this.data.singleGoods.images || []), ...fileIDs];

      this.setData({
        'singleGoods.images': newImages,
        'singleGoods.image': newImages[0] || ''
      });

      wx.showToast({ title: '上传成功', icon: 'success' });
    } catch (err) {
      console.error('upload single images failed', err);
      wx.showToast({ title: '上传失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onSingleDeleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = [...(this.data.singleGoods.images || [])];
    images.splice(index, 1);

    this.setData({
      'singleGoods.images': images,
      'singleGoods.image': images[0] || ''
    });
  },

  onSinglePreviewImage(e) {
    const index = e.currentTarget.dataset.index;
    const urls = this.data.singleGoods.images || [];
    if (!urls.length) return;
    wx.previewImage({
      urls,
      current: urls[index] || urls[0]
    });
  },

  onMultiNameInput(e) {
    this.setData({ 'multiGoods.name': e.detail.value });
  },

  onMultiDescInput(e) {
    this.setData({ 'multiGoods.desc': e.detail.value });
  },

  onMultiToggleTraceCode() {
    this.setData({
      'multiGoods.generateTraceCode': !this.data.multiGoods.generateTraceCode
    });
  },

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
    const currentImages = (this.data.multiGoods.specs[index] && this.data.multiGoods.specs[index].images) || [];

    if (currentImages.length >= 5) {
      wx.showToast({ title: '每个规格最多上传5张图片', icon: 'none' });
      return;
    }

    wx.chooseMedia({
      count: 5 - currentImages.length,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.uploadSpecImages(index, res.tempFiles || []);
      }
    });
  },

  async uploadSpecImages(specIndex, files) {
    if (!files.length) return;

    wx.showLoading({ title: '上传中...' });
    try {
      const uploadPromises = files.map(file => wx.cloud.uploadFile({
        cloudPath: this.getCloudPath(),
        filePath: file.tempFilePath
      }));

      const results = await Promise.all(uploadPromises);
      const fileIDs = results.map(item => item.fileID).filter(Boolean);

      const specs = [...this.data.multiGoods.specs];
      const newImages = [...(specs[specIndex].images || []), ...fileIDs];
      specs[specIndex].images = newImages;
      specs[specIndex].image = newImages[0] || '';

      this.setData({ 'multiGoods.specs': specs });
      wx.showToast({ title: '上传成功', icon: 'success' });
    } catch (err) {
      console.error('upload spec images failed', err);
      wx.showToast({ title: '上传失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onSpecDeleteImage(e) {
    const specIndex = e.currentTarget.dataset.specIndex;
    const imageIndex = e.currentTarget.dataset.imageIndex;

    const specs = [...this.data.multiGoods.specs];
    const images = [...(specs[specIndex].images || [])];
    images.splice(imageIndex, 1);

    specs[specIndex].images = images;
    specs[specIndex].image = images[0] || '';

    this.setData({ 'multiGoods.specs': specs });
  },

  onSpecPreviewImage(e) {
    const specIndex = e.currentTarget.dataset.specIndex;
    const imageIndex = e.currentTarget.dataset.imageIndex;

    const urls = this.data.multiGoods.specs[specIndex].images || [];
    if (!urls.length) return;

    wx.previewImage({
      urls,
      current: urls[imageIndex] || urls[0]
    });
  },

  async onSubmit() {
    if (this.data.activeTab === 'multi') {
      await this.submitMultiGoods();
      return;
    }
    await this.submitSingleGoods();
  },

  async submitSingleGoods() {
    const { goodsId, singleGoods } = this.data;
    const { name, price, image, images, desc, generateTraceCode } = singleGoods;

    if (!name.trim()) {
      wx.showToast({ title: '请输入商品名称', icon: 'none' });
      return;
    }

    if (!price || isNaN(price) || Number(price) <= 0) {
      wx.showToast({ title: '请输入正确的价格', icon: 'none' });
      return;
    }

    if (!image || !images || !images.length) {
      wx.showToast({ title: '请上传商品图片', icon: 'none' });
      return;
    }

    if (!desc.trim()) {
      wx.showToast({ title: '请输入商品描述', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'goodsCenter',
        data: {
          action: 'updateGoods',
          data: {
            _id: goodsId,
            name: name.trim(),
            price: Number(price),
            image,
            images,
            desc: desc.trim(),
            generateTraceCode,
            isMultiSpec: false
          }
        }
      });

      const result = res.result;
      if (!result.success) {
        wx.showToast({ title: result.error || '修改失败', icon: 'none' });
        return;
      }

      wx.showToast({
        title: result.message || '修改成功',
        icon: 'success',
        duration: 1800
      });
      setTimeout(() => wx.navigateBack(), 1800);
    } catch (err) {
      console.error('submit single goods failed', err);
      wx.showToast({ title: '修改失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async submitMultiGoods() {
    const { goodsId, multiGoods } = this.data;
    const { name, specs, desc, generateTraceCode } = multiGoods;

    if (!name.trim()) {
      wx.showToast({ title: '请输入商品名称', icon: 'none' });
      return;
    }

    if (!specs || !specs.length) {
      wx.showToast({ title: '请至少添加一个规格', icon: 'none' });
      return;
    }

    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i];
      if (!String(spec.name || '').trim()) {
        wx.showToast({ title: `请输入第${i + 1}个规格名称`, icon: 'none' });
        return;
      }
      if (!spec.price || isNaN(spec.price) || Number(spec.price) <= 0) {
        wx.showToast({ title: `请输入第${i + 1}个规格正确价格`, icon: 'none' });
        return;
      }
      if (!spec.image || !spec.images || !spec.images.length) {
        wx.showToast({ title: `请上传第${i + 1}个规格图片`, icon: 'none' });
        return;
      }
    }

    if (!desc.trim()) {
      wx.showToast({ title: '请输入商品描述', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      const normalizedSpecs = specs.map(spec => ({
        name: String(spec.name || '').trim(),
        price: Number(spec.price),
        style: String(spec.style || '').trim(),
        image: String(spec.image || '').trim(),
        images: Array.isArray(spec.images) ? spec.images.filter(Boolean) : []
      }));

      const res = await wx.cloud.callFunction({
        name: 'goodsCenter',
        data: {
          action: 'updateMultiSpecGoods',
          data: {
            _id: goodsId,
            name: name.trim(),
            specs: normalizedSpecs,
            desc: desc.trim(),
            generateTraceCode,
            isMultiSpec: true
          }
        }
      });

      const result = res.result;
      if (!result.success) {
        wx.showToast({ title: result.error || '修改失败', icon: 'none' });
        return;
      }

      wx.showToast({
        title: result.message || '修改成功',
        icon: 'success',
        duration: 1800
      });
      setTimeout(() => wx.navigateBack(), 1800);
    } catch (err) {
      console.error('submit multi goods failed', err);
      wx.showToast({ title: '修改失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
