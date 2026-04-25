// utils/address.js

/**
 * 调用地址管理云函数
 */
async function callAddressAction(action, data = {}) {
  try {
    const res = await wx.cloud.callFunction({
      name: 'addressManager',
      data: { action, data }
    });
    return res.result;
  } catch (err) {
    console.error('云函数调用失败', err);
    return { success: false, error: err.message };
  }
}

/**
 * 获取地址列表
 */
async function getAddressList() {
  return await callAddressAction('list');
}

/**
 * 新增地址
 */
async function addAddress(addressInfo) {
  return await callAddressAction('add', addressInfo);
}

/**
 * 更新地址
 */
async function updateAddress(addressInfo) {
  return await callAddressAction('update', addressInfo);
}

/**
 * 删除地址
 */
async function deleteAddress(id) {
  return await callAddressAction('delete', { id });
}

/**
 * 设为默认地址
 */
async function setDefaultAddress(id) {
  return await callAddressAction('setDefault', { id });
}

module.exports = {
  getAddressList,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
};