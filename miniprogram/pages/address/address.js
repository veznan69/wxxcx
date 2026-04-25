// pages/address/address.js
const addressApi = require('../../utils/address.js');

Page({
  data: {
    addressList: [],
    showModal: false,
    editingId: null,
    formData: {
      name: '',
      phone: '',
      province: '',
      city: '',
      district: '',
      detail: '',
      isDefault: false,
      regionStr: ''
    }
  },

  onShow() {
    this.loadAddresses();
  },

  async loadAddresses() {
    const app = getApp();
    if (!app.globalData.openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '加载中' });
    const res = await addressApi.getAddressList();
    wx.hideLoading();
    if (res.success) {
      this.setData({ addressList: res.data });
    } else {
      wx.showToast({ title: res.error || '加载失败', icon: 'none' });
    }
  },

  addAddress() {
    this.setData({
      showModal: true,
      editingId: null,
      formData: {
        name: '', phone: '', province: '', city: '', district: '',
        detail: '', isDefault: false, regionStr: ''
      }
    });
  },

  editAddress(e) {
    const address = e.currentTarget.dataset.address;
    this.setData({
      showModal: true,
      editingId: address._id,
      formData: {
        name: address.name,
        phone: address.phone,
        province: address.province,
        city: address.city,
        district: address.district,
        detail: address.detail,
        isDefault: address.isDefault || false,
        regionStr: `${address.province} ${address.city} ${address.district}`
      }
    });
  },

  hideModal() {
    this.setData({ showModal: false });
  },

  onNameInput(e) { this.setData({ 'formData.name': e.detail.value }); },
  onPhoneInput(e) { this.setData({ 'formData.phone': e.detail.value }); },
  onDetailInput(e) { this.setData({ 'formData.detail': e.detail.value }); },

  pickRegion() {
    wx.chooseLocation({
      success: (res) => {
        // 简化处理，实际应使用省市区选择器
        this.setData({
          'formData.province': res.address,
          'formData.city': '',
          'formData.district': '',
          'formData.regionStr': res.address
        });
      }
    });
  },

  toggleDefault() {
    this.setData({ 'formData.isDefault': !this.data.formData.isDefault });
  },

  async saveAddress() {
    const { name, phone, province, city, district, detail, isDefault } = this.data.formData;
    if (!name || !phone || !province || !detail) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '手机号格式错误', icon: 'none' });
      return;
    }

    const app = getApp();
    if (!app.globalData.openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    // 构造地址数据对象
    const addressData = {
      name, phone, province, city, district, detail, isDefault
    };
    if (this.data.editingId) {
      addressData._id = this.data.editingId;
    }

    wx.showLoading({ title: '保存中' });
    const action = this.data.editingId ? 'update' : 'add';
    const res = await addressApi[action + 'Address'](addressData);
    wx.hideLoading();
    
    if (res.success) {
      wx.showToast({ title: '保存成功', icon: 'success' });
      this.hideModal();
      this.loadAddresses();
    } else {
      wx.showToast({ title: res.error || '保存失败', icon: 'none' });
    }
  },

  async deleteAddress(e) {
    const id = e.currentTarget.dataset.id;
    const confirm = await new Promise(resolve => {
      wx.showModal({
        title: '确认删除',
        content: '确定要删除该地址吗？',
        success: res => resolve(res.confirm)
      });
    });
    if (!confirm) return;

    wx.showLoading({ title: '删除中' });
    const res = await addressApi.deleteAddress(id);
    wx.hideLoading();
    
    if (res.success) {
      wx.showToast({ title: '已删除', icon: 'success' });
      this.loadAddresses();
    } else {
      wx.showToast({ title: res.error || '删除失败', icon: 'none' });
    }
  },

  async setDefault(e) {
    const id = e.currentTarget.dataset.id;
    wx.showLoading({ title: '设置中' });
    const res = await addressApi.setDefaultAddress(id);
    wx.hideLoading();
    
    if (res.success) {
      wx.showToast({ title: '已设为默认', icon: 'success' });
      this.loadAddresses();
    } else {
      wx.showToast({ title: res.error || '操作失败', icon: 'none' });
    }
  },

  // 供其他页面选择地址后返回
  selectAddress(e) {
    const address = e.currentTarget.dataset.address;
    const pages = getCurrentPages();
    const prevPage = pages[pages.length - 2];
    if (prevPage && prevPage.setAddress) {
      prevPage.setAddress(address);
    }
    wx.navigateBack();
  }
});