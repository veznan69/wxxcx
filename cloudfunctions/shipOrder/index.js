const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function normalizeStatus(status) {
  const s = String(status || '');
  if (s === '待发货' || s === '已发货' || s === '已完成') return s;
  if (s === '待付款' || s === '已付款') return '待发货';
  return '待发货';
}

function generateShipmentOrderNo() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 900000 + 100000);
  return `YD${y}${m}${d}${rand}`;
}

async function getRole(openid) {
  const res = await db.collection('users').where({ _openid: openid }).limit(1).get();
  if (!res.data.length) return 'user';
  return res.data[0].role || 'user';
}

async function getMerchantGoodsIdSet(openid) {
  const set = new Set();
  const res = await db.collection('goods_products')
    .where(db.command.or([{ ownerOpenid: openid }, { _openid: openid }]))
    .get();
  (res.data || []).forEach(item => set.add(String(item._id)));
  return set;
}

async function createMessage(toOpenid, title, content, type, bizId) {
  if (!toOpenid) return;
  await db.collection('user_messages').add({
    data: {
      toOpenid,
      title,
      content,
      type,
      bizId: bizId || '',
      read: false,
      createTime: db.serverDate()
    }
  });
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const role = await getRole(OPENID);

  if (role !== 'merchant' && role !== 'admin') {
    return { success: false, error: 'no permission' };
  }

  const orderId = event && event.orderId;
  const logisticsCompany = String((event && event.logisticsCompany) || '').trim();
  if (!orderId) return { success: false, error: 'missing orderId' };
  if (!logisticsCompany) return { success: false, error: 'missing logisticsCompany' };

  try {
    const orderRes = await db.collection('orders').doc(orderId).get();
    const order = orderRes.data;
    if (!order) return { success: false, error: 'order not found' };

    if (String(order.orderType || '') === 'course') {
      return { success: false, error: 'course order cannot be shipped here' };
    }

    const status = normalizeStatus(order.status);
    if (status !== '待发货') {
      return { success: false, error: `order status is ${status}, cannot ship` };
    }

    if (role === 'merchant') {
      const goodsSet = await getMerchantGoodsIdSet(OPENID);
      const hasOwnedItem = (order.items || []).some(item => goodsSet.has(String(item.goodsId)));
      if (!hasOwnedItem) {
        return { success: false, error: 'no permission for this order' };
      }
    }

    const shipmentOrderNo = generateShipmentOrderNo();
    await db.collection('orders').doc(orderId).update({
      data: {
        status: '已发货',
        shipTime: db.serverDate(),
        shipmentOrderNo,
        logistics: {
          company: logisticsCompany,
          shipmentOrderNo
        },
        shippedBy: OPENID
      }
    });

    // 1) 用户订单从待发货变更为已发货时发送消息
    await createMessage(
      order._openid,
      '订单已发货',
      `您的订单已由商家发货，物流公司：${logisticsCompany}，运单号：${shipmentOrderNo}`,
      'order_shipped',
      orderId
    );

    return {
      success: true,
      shipmentOrderNo
    };
  } catch (err) {
    console.error('shipOrder error', err);
    return { success: false, error: err.message || 'internal error' };
  }
};
