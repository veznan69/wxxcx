const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function normalizeStatus(status) {
  const s = String(status || '');
  if (s === '待发货' || s === '已发货' || s === '已完成') return s;
  if (s === '待付款' || s === '已付款') return '待发货';
  return '待发货';
}

async function getRole(openid) {
  const res = await db.collection('users').where({ _openid: openid }).limit(1).get();
  if (!res.data.length) return 'user';
  return res.data[0].role || 'user';
}

async function getMerchantGoodsIdSet(openid) {
  const set = new Set();
  const res = await db.collection('goods_products')
    .where(_.or([{ ownerOpenid: openid }, { _openid: openid }]))
    .get();
  (res.data || []).forEach(item => set.add(String(item._id)));
  return set;
}

async function listAllGoodsOrders() {
  let all = [];
  let hasMore = true;
  let skip = 0;
  const pageSize = 100;

  while (hasMore) {
    const res = await db.collection('orders')
      .where({ orderType: _.neq('course') })
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();
    const rows = res.data || [];
    all = all.concat(rows);
    hasMore = rows.length === pageSize;
    skip += rows.length;
  }
  return all;
}

function pickMerchantItems(order, goodsIdSet) {
  const items = (order.items || []).filter(item => goodsIdSet.has(String(item.goodsId)));
  if (!items.length) return null;
  const totalPrice = items.reduce((sum, item) => {
    return sum + Number(item.price || 0) * Number(item.num || 0);
  }, 0);
  return { ...order, items, totalPrice };
}

async function listOrders(openid, role) {
  if (role !== 'merchant' && role !== 'admin') {
    return { success: false, error: 'no permission' };
  }

  const rows = await listAllGoodsOrders();
  let orders = rows;

  if (role === 'merchant') {
    const goodsIdSet = await getMerchantGoodsIdSet(openid);
    orders = rows.map(order => pickMerchantItems(order, goodsIdSet)).filter(Boolean);
  }

  orders = orders.map(order => ({
    ...order,
    status: normalizeStatus(order.status)
  }));

  return { success: true, list: orders };
}

async function getOrderDetail(openid, role, orderId) {
  if (role !== 'merchant' && role !== 'admin') {
    return { success: false, error: 'no permission' };
  }
  if (!orderId) return { success: false, error: 'missing orderId' };

  const res = await db.collection('orders').doc(orderId).get();
  const order = res.data;
  if (!order) return { success: false, error: 'order not found' };
  if (String(order.orderType || '') === 'course') {
    return { success: false, error: 'course order cannot be shipped here' };
  }

  let output = { ...order, status: normalizeStatus(order.status) };
  if (role === 'merchant') {
    const goodsIdSet = await getMerchantGoodsIdSet(openid);
    const picked = pickMerchantItems(output, goodsIdSet);
    if (!picked) return { success: false, error: 'no permission for this order' };
    output = { ...picked, status: normalizeStatus(output.status) };
  }

  return { success: true, order: output };
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const role = await getRole(OPENID);
    const action = event && event.action;

    if (action === 'listOrders') {
      return await listOrders(OPENID, role);
    }
    if (action === 'getOrderDetail') {
      return await getOrderDetail(OPENID, role, event && event.orderId);
    }
    return { success: false, error: 'unknown action' };
  } catch (err) {
    console.error('orderManageCenter failed', err);
    return { success: false, error: err.message || 'internal error' };
  }
};