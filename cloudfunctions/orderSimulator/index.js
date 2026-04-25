// 云函数：订单模拟操作（发货、取消、退款）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { action, orderId } = event;

  if (!openid) {
    return { success: false, error: '未获取到用户身份' };
  }
  if (!orderId) {
    return { success: false, error: '缺少订单ID' };
  }

  try {
    // 获取订单信息，同时校验权限
    const orderRes = await db.collection('orders').doc(orderId).get();
    const order = orderRes.data;
    if (!order || order._openid !== openid) {
      return { success: false, error: '订单不存在或无权操作' };
    }

    switch (action) {
      case 'ship':
        return await shipOrder(orderId, order);
      case 'cancel':
        return await cancelOrder(orderId, order);
      case 'refund':
        return await refundOrder(orderId, order);
      case 'verify':                                    // ✅ 新增核销
        return await verifyCourseOrder(orderId, order, openid, verifyCode);
      default:
        return { success: false, error: '未知操作' };
    }
  } catch (err) {
    console.error('云函数执行错误:', err);
    return { success: false, error: err.message };
  }
};

// 1. 模拟发货（仅限已付款状态）
async function shipOrder(orderId, order) {
  if (order.status !== '已付款') {
    return { success: false, error: '当前状态不可发货' };
  }
  await db.collection('orders').doc(orderId).update({
    data: {
      status: '已发货',
      shipTime: db.serverDate()
    }
  });
  return { success: true, message: '发货成功' };
}

// 2. 取消订单（仅限待付款状态）
async function cancelOrder(orderId, order) {
  if (order.status !== '待付款') {
    return { success: false, error: '仅待付款订单可取消' };
  }
  await db.collection('orders').doc(orderId).update({
    data: {
      status: '已取消',
      cancelTime: db.serverDate()
    }
  });
  // 可在此处恢复库存、退回优惠券等（模拟时不处理）
  return { success: true, message: '订单已取消' };
}

// 3. 申请退款（已付款或已发货状态，模拟直接退款成功）
async function refundOrder(orderId, order) {
  const allowedStatus = ['已付款', '已发货'];
  if (!allowedStatus.includes(order.status)) {
    return { success: false, error: '当前状态不可申请退款' };
  }
  // 模拟退款成功，状态改为“已退款”
  await db.collection('orders').doc(orderId).update({
    data: {
      status: '已退款',
      refundTime: db.serverDate()
    }
  });
  // 可在此处处理退款逻辑（如恢复库存）
  return { success: true, message: '退款成功' };
}

async function verifyCourseOrder(orderId, order, operatorOpenid, inputCode) {
  // 1. 权限校验：操作者必须是商家或管理员
  const userRes = await db.collection('users').where({ _openid: operatorOpenid }).get();
  if (userRes.data.length === 0 || !['merchant', 'admin'].includes(userRes.data[0].role)) {
    return { success: false, error: '无核销权限' };
  }

  // 2. 订单类型校验
  if (order.orderType !== 'course') {
    return { success: false, error: '非课程订单，无法核销' };
  }

  // 3. 状态校验：必须是待核销状态
  if (order.status !== 'pending_verify') {
    return { success: false, error: '订单当前状态不可核销' };
  }

  // 4. 核销码校验（可选，如果传入）
  if (inputCode && order.verifyCode !== inputCode) {
    return { success: false, error: '核销码错误' };
  }

  // 5. 更新订单状态为已完成，记录核销信息
  await db.collection('orders').doc(orderId).update({
    data: {
      status: '已完成',
      verifyStatus: 'verified',
      verifyTime: db.serverDate(),
      verifyOpenid: operatorOpenid
    }
  });

  return { success: true, message: '核销成功' };
}