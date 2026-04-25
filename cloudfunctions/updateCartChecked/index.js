const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { goodsId, skuId = '', checked } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!openid) {
    return { success: false, error: 'missing openid' };
  }
  if (!goodsId) {
    return { success: false, error: 'missing goodsId' };
  }

  const cartCollection = db.collection('carts');
  const cartRecord = await cartCollection.where({ _openid: openid }).get();
  if (cartRecord.data.length === 0) {
    return { success: false, error: 'cart not found' };
  }

  const cartId = cartRecord.data[0]._id;
  const items = cartRecord.data[0].items || [];
  const targetItem = items.find(item =>
    String(item.goodsId) === String(goodsId) &&
    String(item.skuId || '') === String(skuId || '')
  );

  if (!targetItem) {
    return { success: false, error: 'item not found' };
  }

  targetItem.checked = !!checked;
  await cartCollection.doc(cartId).update({ data: { items } });
  return { success: true };
};
