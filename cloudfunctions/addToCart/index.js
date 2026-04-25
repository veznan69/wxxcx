const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function findSku(goods, skuId) {
  if (!goods || !skuId) return null;
  const variants = Array.isArray(goods.variants) ? goods.variants : [];
  const specs = Array.isArray(goods.specs) ? goods.specs : [];
  return variants.find(v => String(v.id) === String(skuId)) ||
    specs.find(s => String(s.id) === String(skuId) || String(s.skuId || '') === String(skuId)) ||
    null;
}

exports.main = async (event) => {
  const { goodsId, num = 1, sku } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!goodsId || !openid) {
    return { success: false, error: 'missing goodsId or openid' };
  }

  const goodsRes = await db.collection('goods_products').doc(String(goodsId)).get();
  const goods = goodsRes && goodsRes.data;
  if (!goods) {
    return { success: false, error: 'goods not found' };
  }

  const skuId = sku && sku.id ? String(sku.id) : '';
  const resolvedSku = skuId ? (findSku(goods, skuId) || sku) : null;

  const price = Number((resolvedSku && resolvedSku.price) || goods.price || 0);
  const image = String((resolvedSku && resolvedSku.image) || goods.image || '').trim();
  const skuName = String((resolvedSku && (resolvedSku.name || resolvedSku.style)) || (sku && sku.name) || '').trim();

  const newItem = {
    goodsId: String(goodsId),
    num: Number(num || 1),
    checked: true,
    name: String(goods.name || '').trim(),
    price,
    image
  };

  if (skuId) {
    newItem.skuId = skuId;
    newItem.skuName = skuName;
  }

  const cartCollection = db.collection('carts');
  const cartRecord = await cartCollection.where({ _openid: openid }).get();

  if (cartRecord.data.length === 0) {
    await cartCollection.add({
      data: {
        _openid: openid,
        items: [newItem],
        createTime: db.serverDate()
      }
    });
    return { success: true };
  }

  const cartId = cartRecord.data[0]._id;
  const items = cartRecord.data[0].items || [];
  const existIndex = items.findIndex(item => {
    if (String(item.goodsId) !== String(goodsId)) return false;
    const itemSkuId = String(item.skuId || '');
    return itemSkuId === skuId;
  });

  if (existIndex !== -1) {
    items[existIndex].num = Number(items[existIndex].num || 0) + Number(num || 1);
    // 每次加购时同步最新展示字段，避免历史脏数据导致购物车回显异常。
    items[existIndex].name = newItem.name;
    items[existIndex].price = newItem.price;
    items[existIndex].image = newItem.image;
    if (skuId) {
      items[existIndex].skuId = skuId;
      items[existIndex].skuName = skuName;
    }
  } else {
    items.push(newItem);
  }

  await cartCollection.doc(cartId).update({ data: { items } });
  return { success: true };
};
