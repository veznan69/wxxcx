Page({
  data: {
    id: '',
    loading: false,
    submitting: false,
    originalDoc: null,
    statusOptions: ['pending', 'approved', 'rejected'],
    form: {
      name: '',
      price: '',
      desc: '',
      image: '',
      imagesText: '',
      ownerOpenid: '',
      customId: '',
      sales: '',
      rejectReason: '',
      statusIndex: 0,
      onShelf: false,
      generateTraceCode: false,
      isMultiSpec: false,
      specsText: '[]',
      extraJson: '{}'
    }
  },

  onLoad(options) {
    const id = options && options.id;
    if (!id) {
      wx.showToast({ title: '缺少商品ID', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.setData({ id }, () => this.loadDetail());
  },

  async callGoodsCenter(action, data) {
    const res = await wx.cloud.callFunction({
      name: 'goodsCenter',
      data: { action, data: data || {} }
    });
    const result = (res && res.result) || {};
    if (!result.success) {
      throw new Error(result.error || '操作失败');
    }
    return result;
  },

  formatImagesText(images) {
    if (!Array.isArray(images)) return '';
    return images.join('\n');
  },

  async loadDetail() {
    this.setData({ loading: true });
    try {
      const result = await this.callGoodsCenter('getGoodsById', { id: this.data.id });
      const doc = result.data || {};
      const statusIndex = Math.max(0, this.data.statusOptions.indexOf(doc.status || 'pending'));

      const knownKeys = [
        '_id', 'name', 'price', 'desc', 'image', 'images', 'ownerOpenid',
        'customId', 'sales', 'rejectReason', 'status', 'onShelf',
        'generateTraceCode', 'isMultiSpec', 'specs'
      ];
      const extra = {};
      Object.keys(doc).forEach((k) => {
        if (!knownKeys.includes(k)) extra[k] = doc[k];
      });

      this.setData({
        originalDoc: doc,
        form: {
          name: doc.name || '',
          price: doc.price === undefined || doc.price === null ? '' : String(doc.price),
          desc: doc.desc || '',
          image: doc.image || '',
          imagesText: this.formatImagesText(doc.images || (doc.image ? [doc.image] : [])),
          ownerOpenid: doc.ownerOpenid || '',
          customId: doc.customId === undefined || doc.customId === null ? '' : String(doc.customId),
          sales: doc.sales === undefined || doc.sales === null ? '' : String(doc.sales),
          rejectReason: doc.rejectReason || '',
          statusIndex,
          onShelf: !!doc.onShelf,
          generateTraceCode: !!doc.generateTraceCode,
          isMultiSpec: !!doc.isMultiSpec,
          specsText: JSON.stringify(Array.isArray(doc.specs) ? doc.specs : [], null, 2),
          extraJson: JSON.stringify(extra, null, 2)
        }
      });
    } catch (err) {
      console.error('load goods detail failed', err);
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onStatusChange(e) {
    this.setData({ 'form.statusIndex': Number(e.detail.value) || 0 });
  },

  onSwitchChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: !!e.detail.value });
  },

  parseImages(imagesText) {
    return String(imagesText || '')
      .split(/[\n,]/g)
      .map((s) => s.trim())
      .filter(Boolean);
  },

  parseInteger(v, fallback) {
    if (v === '' || v === null || v === undefined) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? Math.floor(n) : fallback;
  },

  parseNumber(v, fallback) {
    if (v === '' || v === null || v === undefined) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  },

  async onSave() {
    if (this.data.submitting) return;

    const { originalDoc, form, statusOptions } = this.data;
    if (!originalDoc) return;

    const name = String(form.name || '').trim();
    const image = String(form.image || '').trim();
    const price = this.parseNumber(form.price, NaN);
    const images = this.parseImages(form.imagesText);

    if (!name) {
      wx.showToast({ title: '商品名称不能为空', icon: 'none' });
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      wx.showToast({ title: '价格必须大于0', icon: 'none' });
      return;
    }
    if (!image) {
      wx.showToast({ title: '主图不能为空', icon: 'none' });
      return;
    }

    let specs;
    try {
      specs = JSON.parse(form.specsText || '[]');
      if (!Array.isArray(specs)) throw new Error('specs must be array');
    } catch (err) {
      wx.showToast({ title: '规格JSON格式错误', icon: 'none' });
      return;
    }

    let extra;
    try {
      extra = JSON.parse(form.extraJson || '{}');
      if (!extra || typeof extra !== 'object' || Array.isArray(extra)) {
        throw new Error('extra must be object');
      }
    } catch (err) {
      wx.showToast({ title: '扩展字段JSON格式错误', icon: 'none' });
      return;
    }

    const payload = {
      ...originalDoc,
      name,
      price,
      desc: String(form.desc || ''),
      image,
      images: images.length ? images : [image],
      ownerOpenid: String(form.ownerOpenid || ''),
      customId: this.parseInteger(form.customId, originalDoc.customId),
      sales: this.parseInteger(form.sales, originalDoc.sales || 0),
      rejectReason: String(form.rejectReason || ''),
      status: statusOptions[form.statusIndex] || 'pending',
      onShelf: !!form.onShelf,
      generateTraceCode: !!form.generateTraceCode,
      isMultiSpec: !!form.isMultiSpec,
      specs
    };

    Object.assign(payload, extra);

    this.setData({ submitting: true });
    wx.showLoading({ title: '保存中...' });
    try {
      await this.callGoodsCenter('updateGoodsAllFields', {
        _id: this.data.id,
        payload
      });
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (err) {
      console.error('update all fields failed', err);
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ submitting: false });
    }
  }
});
