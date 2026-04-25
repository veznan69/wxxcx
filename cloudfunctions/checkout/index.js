const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

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

async function getAdminOpenids() {
  const res = await db.collection('users').where({ role: 'admin' }).get();
  return (res.data || []).map(item => item._openid).filter(Boolean);
}

async function getMerchantOpenidsByGoodsIds(goodsIds) {
  if (!goodsIds.length) return [];
  const res = await db.collection('goods_products').where({ _id: _.in(goodsIds) }).get();
  const set = new Set();
  (res.data || []).forEach(item => {
    if (item.ownerOpenid) set.add(item.ownerOpenid);
    if (item._openid) set.add(item._openid);
  });
  return Array.from(set);
}

exports.main = async (event) => {
  const { address, selectedItems, totalPrice, orderType = 'goods' } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const initialStatus = orderType === 'course' ? '已完成' : '待发货';
  const orderAddress = orderType === 'course' && !address ? {} : address;

  const orderData = {
    _openid: openid,
    items: selectedItems,
    address: orderAddress,
    totalPrice,
    status: initialStatus,
    orderType,
    createTime: db.serverDate()
  };

  const orderRes = await db.collection('orders').add({ data: orderData });
  const orderId = orderRes._id;

  if (orderType === 'course') {
    const verifyCode = orderId.slice(-6).toUpperCase();
    await db.collection('orders').doc(orderId).update({
      data: {
        verifyCode,
        verifyStatus: 'pending'
      }
    });
    orderData.verifyCode = verifyCode;
  }

  if (orderType === 'goods') {
    const cartRecord = await db.collection('carts').where({ _openid: openid }).get();
    if (cartRecord.data.length > 0) {
      const cartId = cartRecord.data[0]._id;
      const currentItems = cartRecord.data[0].items || [];
      const newItems = currentItems.filter(item => {
        const itemGoodsId = String(item.goodsId || '');
        const itemSkuId = String(item.skuId || '');
        return !selectedItems.some(sel => {
          const selGoodsId = String(sel.goodsId || '');
          const selSkuId = String(sel.skuId || '');
          return selGoodsId === itemGoodsId && selSkuId === itemSkuId;
        });
      });
      await db.collection('carts').doc(cartId).update({ data: { items: newItems } });
    }
  }

  let couponMsg = '';
  if (totalPrice >= 100) {
    try {
      const couponData = {
        _openid: openid,
        name: '满减体验券',
        value: '满100减20',
        used: false,
        createTime: db.serverDate()
      };
      await db.collection('coupons').add({ data: couponData });
      couponMsg = '，已赠送满减券';
    } catch (err) {
      console.error('赠送优惠券失败', err);
    }
  }

  // 2) 商家、管理员接到新订单时发送消息（仅商品订单）
  if (orderType === 'goods') {
    try {
      const goodsIds = Array.from(new Set((selectedItems || []).map(item => String(item.goodsId || '')).filter(Boolean)));
      const merchantOpenids = await getMerchantOpenidsByGoodsIds(goodsIds);
      const adminOpenids = await getAdminOpenids();
      const receivers = Array.from(new Set([...merchantOpenids, ...adminOpenids]));
      const itemCount = (selectedItems || []).reduce((sum, item) => sum + Number(item.num || 0), 0);
      for (const toOpenid of receivers) {
        await createMessage(
          toOpenid,
          '收到新订单',
          `您有一笔新商品订单，订单号：${orderId}，共${itemCount}件商品，请及时处理。`,
          'new_order',
          orderId
        );
      }
    } catch (err) {
      console.error('send new order messages failed', err);
    }
  }

  return {
    success: true,
    orderId,
    orderType,
    verifyCode: orderType === 'course' ? orderData.verifyCode : undefined,
    couponMsg
  };
};
