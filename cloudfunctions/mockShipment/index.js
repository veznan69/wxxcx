const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  // 可选：限制只有特定 openid（管理员）可以调用，防止普通用户模拟发货
  const ADMIN_OPENIDS = ['your_admin_openid_here']; // 从云开发控制台获取你的 openid 填入
  if (ADMIN_OPENIDS.length > 0 && !ADMIN_OPENIDS.includes(openid)) {
    return { success: false, error: '无权限操作' };
  }

  const { orderId, action = 'ship' } = event;

  if (!orderId) {
    return { success: false, error: '缺少订单ID' };
  }

  try {
    // 获取订单信息
    const orderRes = await db.collection('orders').doc(orderId).get();
    if (!orderRes.data) {
      return { success: false, error: '订单不存在' };
    }
    
    const order = orderRes.data;
    
    // 检查订单状态是否允许发货
    if (order.status !== '待付款' && order.status !== '已付款') {
      return { success: false, error: '当前订单状态无法发货' };
    }

    // 更新订单状态为已发货，并记录发货时间、物流单号（模拟）
    const updateData = {
      status: '已发货',
      shipmentTime: db.serverDate(),
      // 模拟物流信息，可自定义
      logistics: {
        company: '模拟快递',
        trackingNumber: `MOCK${Date.now()}${Math.floor(Math.random()*1000)}`,
        remark: '此单为模拟发货，实际发货请替换真实物流'
      }
    };

    await db.collection('orders').doc(orderId).update({
      data: updateData
    });

    return { 
      success: true, 
      message: '模拟发货成功',
      logistics: updateData.logistics
    };
  } catch (err) {
    console.error('模拟发货失败:', err);
    return { success: false, error: err.message };
  }

  // 生成唯一溯源ID
  function generateTraceId() {
    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4,'0');
    return `TR${dateStr}${random}`;
  }

  // 根据商品ID获取预设溯源模板
  function getTraceTemplate(goodsId) {
    const templates = {
      '1': {  // 富硒脐橙 精品礼盒
        productName: '富硒脐橙 精品礼盒',
        orchard: '赣南富硒果园A区',
        plantTime: '2024-03-15',
        floweringPeriod: '2025-04-01 ~ 2025-04-15',
        fruitSettingPeriod: '2025-05-01 ~ 2025-06-15',
        harvestTime: '2025-11-10',
        description: '本批次脐橙产自赣南核心产区，土壤天然富硒，果肉饱满，酸甜适口。',
        images: ['cloud://xxx.jpg']
      },
      '2': { /* 有机脐橙 家庭装 */ },
      // ...其他商品
    };
    return templates[goodsId] || templates['1'];
  }

  async function shipOrder(orderId, order) {
    // ...原有发货状态更新
  
    // 为订单中每个商品生成溯源ID并写入数据库
    const traceItems = [];
    for (const item of order.items) {
      const traceId = generateTraceId();
      const template = getTraceTemplate(item.goodsId);
      await db.collection('traceability').add({
        data: {
          traceId,
          ...template,
          orderId: order._id,
          createTime: db.serverDate()
        }
      });
      traceItems.push({ goodsId: item.goodsId, traceId });
    }
  }
};