const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ORIGIN_ADDRESS = '江西省赣州市宁都县会同乡·鹭鹭脐橙基地';

function normalizeStatus(status) {
  const s = String(status || '');
  if (s === '待发货' || s === '已发货' || s === '已完成') return s;
  if (s === '待付款' || s === '已付款') return '待发货';
  return '待发货';
}

function formatTime(dateLike) {
  if (!dateLike) return '';
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function hashCode(str) {
  const raw = String(str || '');
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function randInt(seed, min, max) {
  const r = seededRandom(seed);
  return Math.floor(r * (max - min + 1)) + min;
}

function getReceiverAddress(order) {
  const address = (order && order.address) || {};
  return String(address.detail || address.address || address.fullAddress || '收货地址未填写');
}

function getReceiverCity(destination) {
  const d = String(destination || '');
  const cityMatch = d.match(/(.+?市)/);
  if (cityMatch && cityMatch[1]) return cityMatch[1];
  const provinceMatch = d.match(/(.+?省)/);
  if (provinceMatch && provinceMatch[1]) return provinceMatch[1];
  return '目的地城市';
}

function pickTransitCities(seed, count, destination) {
  const pool = [
    '赣州分拨中心',
    '南昌干线中心',
    '长沙转运中心',
    '武汉转运中心',
    '郑州航空中心',
    '西安中转中心',
    '成都转运中心',
    '重庆分拨中心',
    '南京分拨中心',
    '杭州转运中心',
    '上海分拨中心',
    '广州转运中心',
    '深圳分拨中心',
    '福州中转中心',
    '合肥中转中心',
    '济南转运中心',
    '天津分拨中心',
    '北京转运中心'
  ];

  const filtered = pool.filter(p => destination.indexOf(p.slice(0, 2)) === -1);
  const picked = [];
  let cursor = seed;
  while (picked.length < count && filtered.length) {
    cursor += 11;
    const idx = randInt(cursor, 0, filtered.length - 1);
    picked.push(filtered[idx]);
    filtered.splice(idx, 1);
  }
  return picked;
}

function pickLocalNodes(seed, destination, city) {
  // 根据收货地址解析出县/区、乡镇、村等更细粒度节点
  const dest = String(destination || '');
  const cityName = String(city || '');

  // 尝试提取县/区
  let county = '';
  const countyMatch = dest.match(/(.+?县|.+?区)/);
  if (countyMatch) county = countyMatch[1];

  // 尝试提取乡镇/街道
  let town = '';
  const townMatch = dest.match(/(.+?镇|.+?乡|.+?街道)/);
  if (townMatch) town = townMatch[1];

  // 尝试提取村/社区
  let village = '';
  const villageMatch = dest.match(/(.+?村|.+?社区|.+?小区)/);
  if (villageMatch) village = villageMatch[1];

  const nodes = [];
  // 如果存在县级节点，添加到达县级分拨中心
  if (county) {
    nodes.push({
      text: `快件已到达【${county}】县级分拨中心`,
      minGapMinutes: randInt(seed + 60, 60, 180)
    });
  }
  // 如果存在乡镇级节点，添加到达乡镇营业点
  if (town) {
    nodes.push({
      text: `快件已到达【${town}】快递营业点，正在分拣`,
      minGapMinutes: randInt(seed + 61, 40, 120)
    });
  }
  // 如果存在村级节点，添加到达村级服务站
  if (village) {
    nodes.push({
      text: `快件已到达【${village}】村级服务站，等待派送`,
      minGapMinutes: randInt(seed + 62, 20, 60)
    });
  }

  // 如果提取不到具体节点，则使用默认的末端节点
  if (nodes.length === 0) {
    nodes.push({
      text: `快件已抵达【${cityName}】分拨中心`,
      minGapMinutes: randInt(seed + 50, 80, 220)
    });
    nodes.push({
      text: '快递员已揽件，正在派送，请保持电话畅通',
      minGapMinutes: randInt(seed + 51, 20, 80)
    });
  }

  return nodes;
}

function buildPlan(order) {
  const destination = getReceiverAddress(order);
  const destinationCity = getReceiverCity(destination);
  const seed = hashCode(`${order._id || ''}-${order.shipmentOrderNo || ''}-${destination}`);
  const transitCount = randInt(seed + 1, 3, 6);
  const transits = pickTransitCities(seed + 100, transitCount, destination);

  const plan = [
    {
      text: `订单已提交，发货地：${ORIGIN_ADDRESS}`,
      minGapMinutes: 0
    },
    {
      text: '仓库拣货完成，包裹出库扫描完成',
      minGapMinutes: randInt(seed + 2, 20, 60)
    },
    {
      text: `快件已揽收，离开发货地：${ORIGIN_ADDRESS}`,
      minGapMinutes: randInt(seed + 3, 40, 120)
    }
  ];

  transits.forEach((name, idx) => {
    plan.push({
      text: `快件到达【${name}】并完成分拣`,
      minGapMinutes: randInt(seed + 10 + idx, 90, 280)
    });
  });

  // 添加更细粒度的末端节点（县级、乡镇级、村级）
  const localNodes = pickLocalNodes(seed + 200, destination, destinationCity);
  plan.push(...localNodes);

  // 最终签收节点
  plan.push({
    text: `包裹已签收，签收地址：${destination}`,
    minGapMinutes: randInt(seed + 52, 10, 50)
  });

  return plan;
}

function toDate(val, fallbackDate) {
  if (!val) return new Date(fallbackDate);
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return new Date(fallbackDate);
  return d;
}

function getRoleFromUser(userDoc) {
  if (!userDoc) return 'user';
  return userDoc.role || 'user';
}

async function getUserRole(openid) {
  const res = await db.collection('users').where({ _openid: openid }).limit(1).get();
  return getRoleFromUser(res.data[0]);
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const orderId = String((event && event.orderId) || '');
  if (!orderId) return { success: false, error: 'missing orderId' };

  try {
    const orderRes = await db.collection('orders').doc(orderId).get();
    const order = orderRes.data;
    if (!order) return { success: false, error: 'order not found' };

    const role = await getUserRole(OPENID);
    if (order._openid !== OPENID && role !== 'admin') {
      return { success: false, error: 'no permission' };
    }

    const status = normalizeStatus(order.status);
    const plan = buildPlan(order);
    const now = new Date();
    const createdAt = toDate(order.createTime, now);
    const shipAt = toDate(order.shipTime, now);

    const sim = order.logisticsSim || {};
    let progress = Number(sim.progress || 0);
    let nodeTimes = Array.isArray(sim.nodeTimes) ? sim.nodeTimes.slice() : [];

    if (progress <= 0 || !nodeTimes.length) {
      progress = status === '待发货' ? 2 : 3;
      progress = Math.min(progress, plan.length);
      const t0 = createdAt;
      const t1 = new Date(t0.getTime() + plan[1].minGapMinutes * 60 * 1000);
      const t2 = status === '待发货'
        ? new Date(t1.getTime() + plan[2].minGapMinutes * 60 * 1000)
        : shipAt;
      nodeTimes = [t0.toISOString(), t1.toISOString(), t2.toISOString()].slice(0, progress);
    }

    const maxProgress = status === '待发货'
      ? 2
      : (status === '已发货' ? Math.max(plan.length - 1, 3) : plan.length);

    let lastNodeTime = toDate(nodeTimes[progress - 1], now);
    const clickTime = now;

    while (progress < maxProgress) {
      const gapMin = Number(plan[progress].minGapMinutes || 30);
      const nextAt = new Date(lastNodeTime.getTime() + gapMin * 60 * 1000);
      if (clickTime.getTime() >= nextAt.getTime()) {
        nodeTimes[progress] = nextAt.toISOString();
        lastNodeTime = nextAt;
        progress += 1;
      } else {
        break;
      }
    }

    if (status === '已完成' && progress < plan.length) {
      const finalAt = clickTime > lastNodeTime ? clickTime : new Date(lastNodeTime.getTime() + 5 * 60 * 1000);
      nodeTimes[plan.length - 1] = finalAt.toISOString();
      progress = plan.length;
      lastNodeTime = finalAt;
    }

    const traces = [];
    for (let i = 0; i < progress; i++) {
      traces.push({
        time: formatTime(nodeTimes[i]),
        text: plan[i].text
      });
    }

    const company = order.logistics && order.logistics.company
      ? order.logistics.company
      : '';
    const trackingNo = order.shipmentOrderNo || (order.logistics && order.logistics.shipmentOrderNo) || '';
    const hasLogistics = !!(company && trackingNo);

    await db.collection('orders').doc(orderId).update({
      data: {
        logisticsSim: {
          progress,
          nodeTimes,
          lastRefreshAt: db.serverDate(),
          lastNodeAt: lastNodeTime,
          planVersion: 3   // 版本号提升，表示新节点结构
        }
      }
    });

    return {
      success: true,
      order: { ...order, status },
      hasLogistics,
      company,
      trackingNo,
      traces: traces.reverse()  // 倒序，最新在前
    };
  } catch (err) {
    console.error('refreshLogisticsTrace error', err);
    return { success: false, error: err.message || 'internal error' };
  }
};