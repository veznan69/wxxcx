const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const action = event && event.action;

  if (!OPENID) {
    return { success: false, error: 'not login' };
  }

  try {
    // 获取积分商品列表
    if (action === 'listGoods') {
      const res = await db.collection('point_goods')
        .where({ onShelf: true, stock: db.command.gt(0) })
        .orderBy('createdAt', 'desc')
        .get();

      return { success: true, data: res.data || [] };
    }

    // 获取商品详情
    if (action === 'getGoodsDetail') {
      const { id } = event.data || {};

      if (!id) {
        return { success: false, error: 'missing goods id' };
      }

      const res = await db.collection('point_goods').doc(id).get();

      if (!res.data) {
        return { success: false, error: 'goods not found' };
      }

      return { success: true, data: res.data };
    }

    // 兑换商品
    if (action === 'exchangeGoods') {
      const { goodsId, addressId } = event.data || {};

      if (!goodsId) {
        return { success: false, error: 'missing goods id' };
      }

      const now = db.serverDate();

      // 获取商品信息
      const goodsRes = await db.collection('point_goods').doc(goodsId).get();

      if (!goodsRes.data) {
        return { success: false, error: 'goods not found' };
      }

      const goods = goodsRes.data;

      if (!goods.onShelf) {
        return { success: false, error: '商品已下架' };
      }

      if (goods.stock <= 0) {
        return { success: false, error: '商品已售罄' };
      }

      // 获取用户积分
      const userRes = await db.collection('user_points').where({ _openid: OPENID }).get();

      if (userRes.data.length === 0) {
        return { success: false, error: '积分不足' };
      }

      const userPoints = userRes.data[0];

      if (userPoints.availablePoints < goods.points) {
        return { success: false, error: '积分不足' };
      }

      // 扣减积分
      await db.collection('user_points').doc(userPoints._id).update({
        data: {
          availablePoints: db.command.inc(-goods.points),
          usedPoints: db.command.inc(goods.points),
          updatedAt: now
        }
      });

      // 记录积分变更
      await db.collection('point_records').add({
        data: {
          _openid: OPENID,
          points: goods.points,
          type: 'deduct',
          reason: `兑换商品：${goods.name}`,
          bizId: goodsId,
          bizType: 'point_exchange',
          createTime: now
        }
      });

      // 扣减库存
      await db.collection('point_goods').doc(goodsId).update({
        data: {
          stock: db.command.inc(-1),
          updatedAt: now
        }
      });

      // 创建兑换记录
      const exchangeNo = `EX${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${Math.floor(Math.random() * 900000 + 100000)}`;

      let addressInfo = {};
      if (addressId) {
        const addressRes = await db.collection('addresses').doc(addressId).get();
        if (addressRes.data && addressRes.data._openid === OPENID) {
          addressInfo = {
            recipient: addressRes.data.recipient,
            phone: addressRes.data.phone,
            province: addressRes.data.province,
            city: addressRes.data.city,
            district: addressRes.data.district,
            detail: addressRes.data.detail
          };
        }
      }

      await db.collection('point_exchanges').add({
        data: {
          _openid: OPENID,
          exchangeNo,
          goodsId,
          goodsName: goods.name,
          goodsImage: goods.image,
          points: goods.points,
          addressId,
          addressInfo,
          status: 'pending', // pending: 待发货, shipped: 已发货, completed: 已完成
          createTime: now
        }
      });

      return { success: true, exchangeNo };
    }

    // 获取兑换记录
    if (action === 'getExchangeList') {
      const res = await db.collection('point_exchanges')
        .where({ _openid: OPENID })
        .orderBy('createTime', 'desc')
        .limit(50)
        .get();

      return { success: true, list: res.data || [] };
    }

    return { success: false, error: 'unknown action' };
  } catch (err) {
    console.error('pointExchange error', err);
    return { success: false, error: err.message || 'internal error' };
  }
};
