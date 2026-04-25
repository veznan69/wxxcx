const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const ADMIN_OPENID = 'ojWd418mR3Z_TqtUeq5wJo4BisdQ';

async function getUserRole(openid) {
  if (!openid) return 'user';
  const res = await db.collection('users').where({ _openid: openid }).limit(1).get();
  if (!res.data.length) return 'user';
  return res.data[0].role || 'user';
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

async function listMyGoods(openid) {
  const res = await db.collection('goods_products')
    .where({ ownerOpenid: openid })
    .orderBy('updatedAt', 'desc')
    .get();
  return { success: true, data: res.data || [] };
}

async function listPublishedGoods() {
  // 所有用户都可以查看已上架的商品
  const res = await db.collection('goods_products')
    .where({
      status: 'approved',
      onShelf: true
    })
    .orderBy('updatedAt', 'desc')
    .get();
  return { success: true, data: res.data || [] };
}

async function listAllGoods(role) {
  if (role !== 'admin') return { success: false, error: 'no permission' };
  const res = await db.collection('goods_products')
    .orderBy('updatedAt', 'desc')
    .get();
  return { success: true, data: res.data || [] };
}

async function listPendingGoods(role) {
  if (role !== 'admin') return { success: false, error: 'no permission' };
  const res = await db.collection('goods_products')
    .where({ status: 'pending' })
    .orderBy('updatedAt', 'desc')
    .get();
  return { success: true, data: res.data || [] };
}

async function submitGoods(openid, role, data) {
  // 1. 先检查 openid 是否存在
  if (!openid) {
    return { success: false, error: 'missing openid' };
  }
  if (role !== 'merchant' && role !== 'admin') {
    return { success: false, error: 'no permission' };
  }

  // 2. 提取并验证业务字段
  const name = String((data && data.name) || '').trim();
  const price = Number(data && data.price);
  const image = String((data && data.image) || '').trim();
  const desc = String((data && data.desc) || '').trim();
  const images = Array.isArray(data && data.images)
    ? data.images.filter(Boolean)
    : (image ? [image] : []);
  const generateTraceCode = !!(data && data.generateTraceCode);
  const isMultiSpec = !!(data && data.isMultiSpec);

  if (!name || !image || !Number.isFinite(price) || price <= 0) {
    return { success: false, error: 'invalid params' };
  }

  // 3. 所有者openid：优先使用前端传入的值，否则使用当前用户openid
  const ownerOpenid = (data && data.ownerOpenid) ? String(data.ownerOpenid).trim() : openid;

  const maxId = await getMaxGoodsId();
  const customId = maxId + 1;
  const now = db.serverDate();

  const doc = {
    name,
    price,
    image,
    images,
    desc,
    isMultiSpec: false,
    customId,
    sales: 0,
    ownerOpenid,               // 只出现一次
    status: 'pending',
    onShelf: false,
    rejectReason: '',
    generateTraceCode,
    variants: [],
    specs: [],
    createdAt: now,
    updatedAt: now,
    auditBy: '',
    auditTime: null
  };

  const addRes = await db.collection('goods_products').add({ data: doc });
  return {
    success: true,
    id: addRes._id,
    customId,
    status: doc.status
  };
}

async function submitMultiSpecGoods(openid, role, data) {
  if (!openid) {
    return { success: false, error: 'missing openid' };
  }
  if (role !== 'merchant' && role !== 'admin') {
    return { success: false, error: 'no permission' };
  }

  const name = String((data && data.name) || '').trim();
  const specs = data && data.specs;
  const desc = String((data && data.desc) || '').trim();
  const generateTraceCode = !!(data && data.generateTraceCode);

  if (!name) {
    return { success: false, error: 'invalid params: name is required' };
  }

  if (!specs || !Array.isArray(specs) || specs.length === 0) {
    return { success: false, error: 'invalid params: specs is required' };
  }

  // 验证每个规格
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const specName = String(spec.name || '').trim();
    const specPrice = Number(spec.price);
    const specImage = String(spec.image || '').trim();
    const specImages = Array.isArray(spec.images)
      ? spec.images.filter(Boolean)
      : (specImage ? [specImage] : []);

    if (!specName) {
      return { success: false, error: `invalid params: spec ${i + 1} name is required` };
    }
    if (!Number.isFinite(specPrice) || specPrice <= 0) {
      return { success: false, error: `invalid params: spec ${i + 1} price is invalid` };
    }
    if (!specImage) {
      return { success: false, error: `invalid params: spec ${i + 1} image is required` };
    }

    // 使用最低价格作为商品主价格，第一张图片作为主图片
    if (i === 0 || specPrice < data.price) {
      data.price = specPrice;
      data.image = specImage;
      data.images = specImages;
    }
  }

  const isAdmin = role === 'admin';
  const now = db.serverDate();

  // 获取当前最大自定义ID
  const maxId = await getMaxGoodsId();
  const customId = maxId + 1;

  // 规格化规格数据
  const normalizedSpecs = specs.map(spec => ({
    name: String(spec.name || '').trim(),
    price: Number(spec.price),
    style: String(spec.style || '').trim(),
    image: String(spec.image || '').trim(),
    images: Array.isArray(spec.images) ? spec.images.filter(Boolean) : [spec.image]
  }));

  // submitMultiSpecGoods 中的 doc 部分
  const ownerOpenid = (data && data.ownerOpenid) ? String(data.ownerOpenid).trim() : openid;
  const doc = {
    name,
    price: data.price,
    image: data.image,
    images: data.images,
    desc,
    isMultiSpec: true,
    specs: normalizedSpecs,
    variants: [],
    customId,
    sales: 0,
    ownerOpenid,               // 只保留一次
    status: 'pending',
    onShelf: false,
    rejectReason: '',
    generateTraceCode,
    createdAt: now,
    updatedAt: now,
    auditBy: '',
    auditTime: null
  };

  // 所有用户（包括admin）提交的商品都需要审核
  doc.auditBy = '';
  doc.auditTime = null;

  const addRes = await db.collection('goods_products').add({ data: doc });
  return {
    success: true,
    id: addRes._id,
    customId,
    status: doc.status
  };
}

async function reviewGoods(openid, role, data) {
  if (role !== 'admin') return { success: false, error: 'no permission' };

  const id = data && data.id;
  const approved = !!(data && data.approved);
  const rejectReason = (data && data.rejectReason) ? String(data.rejectReason) : '';
  if (!id) return { success: false, error: 'id required' };

  const detail = await db.collection('goods_products').doc(id).get();
  const goods = detail.data;
  if (!goods) return { success: false, error: 'goods not found' };

  await db.collection('goods_products').doc(id).update({
    data: {
      status: approved ? 'approved' : 'rejected',
      onShelf: approved,
      rejectReason: approved ? '' : rejectReason,
      auditBy: openid,
      auditTime: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });

  // 商家上架商品审核通过/驳回时发送消息
  try {
    await createMessage(
      goods.ownerOpenid || goods._openid,
      approved ? '商品审核通过' : '商品审核驳回',
      approved
        ? `您提交的商品“${goods.name || ''}”已审核通过并上架。`
        : `您提交的商品“${goods.name || ''}”未通过审核。${rejectReason ? `原因：${rejectReason}` : ''}`,
      'goods_review_result',
      id
    );
  } catch (err) {
    console.error('notify goods review result failed', err);
  }

  return { success: true };
}

async function bindAllGoodsToAdmin(openid, role) {
  if (!openid) {
    return {
      success: false,
      error: 'missing openid: please call from mini program after admin login'
    };
  }
  if (role !== 'admin' || openid !== ADMIN_OPENID) {
    return { success: false, error: 'no permission' };
  }

  const listRes = await db.collection('goods_products').get();
  const list = listRes.data || [];

  let updated = 0;
  for (const item of list) {
    await db.collection('goods_products').doc(item._id).update({
      data: {
        ownerOpenid: ADMIN_OPENID,
        updatedAt: db.serverDate()
      }
    });
    updated++;
  }

  return { success: true, updated };
}

async function toggleShelf(openid, role, data) {
  const id = data && data.id;
  const onShelf = !!(data && data.onShelf);
  if (!id) return { success: false, error: 'id required' };

  const detail = await db.collection('goods_products').doc(id).get();
  const goods = detail.data;
  if (!goods) return { success: false, error: 'goods not found' };

  const isOwner = goods.ownerOpenid === openid;
  if (!(role === 'admin' || isOwner)) {
    return { success: false, error: 'no permission' };
  }

  // 上架商品时检查状态
  if (onShelf) {
    if (goods.status === 'pending') {
      return { success: false, error: '商品待审核，无法上架' };
    }
    if (goods.status === 'rejected') {
      return { success: false, error: '商品已驳回，无法上架' };
    }
  }

  if (onShelf && role !== 'admin' && goods.status !== 'approved') {
    await db.collection('goods_products').doc(id).update({
      data: {
        status: 'pending',
        onShelf: false,
        rejectReason: '',
        updatedAt: db.serverDate()
      }
    });
    return { success: true, pending: true, message: 'submitted for review' };
  }

  await db.collection('goods_products').doc(id).update({
    data: {
      onShelf,
      updatedAt: db.serverDate()
    }
  });

  return { success: true };
}

async function deleteGoods(openid, role, data) {
  const id = data && data.id;
  if (!id) return { success: false, error: 'id required' };

  const detail = await db.collection('goods_products').doc(id).get();
  const goods = detail.data;
  if (!goods) return { success: false, error: 'goods not found' };

  const isOwner = goods.ownerOpenid === openid;
  if (!(role === 'admin' || isOwner)) {
    return { success: false, error: 'no permission' };
  }

  // 删除商品
  await db.collection('goods_products').doc(id).remove();

  return { success: true };
}

async function getMaxGoodsId() {
  // 查询当前最大的自定义ID
  const res = await db.collection('goods_products')
    .orderBy('customId', 'desc')
    .limit(1)
    .get();

  if (res.data && res.data.length > 0 && res.data[0].customId) {
    return res.data[0].customId;
  }

  // 如果没有商品，从1开始
  return 0;
}

async function getGoodsById(openid, data) {
  const id = data && data.id;
  if (!id) {
    return { success: false, error: '缺少商品ID' };
  }

  try {
    const res = await db.collection('goods_products').doc(id).get();
    if (!res.data) {
      return { success: false, error: '商品不存在' };
    }

    const goods = res.data;

    // 权限检查：只有商品所有者或admin可以查看
    const userRes = await db.collection('users').where({ _openid: openid }).get();
    const role = userRes.data[0]?.role || 'user';
    if (role !== 'admin' && goods.ownerOpenid !== openid) {
      return { success: false, error: '无权限查看此商品' };
    }

    return { success: true, data: goods };
  } catch (err) {
    console.error('获取商品失败', err);
    return { success: false, error: err.message };
  }
}

async function getGoodsDetail(openid, goodsId) {
  if (!goodsId) {
    return { success: false, error: '缺少商品ID' };
  }
  try {
    const res = await db.collection('goods_products').doc(goodsId).get();
    if (!res.data) {
      return { success: false, error: '商品不存在' };
    }
    // 可在此处添加访问控制：例如只允许查看已上架商品，或管理员可看全部
    const goods = res.data;
    // 如果商品未上架且当前用户不是管理员或商品所有者，则拒绝
    if (!goods.onShelf) {
      const userRes = await db.collection('users').where({ _openid: openid }).get();
      const role = userRes.data[0]?.role || 'user';
      if (role !== 'admin' && goods.ownerOpenid !== openid) {
        return { success: false, error: '商品已下架' };
      }
    }
    return { success: true, data: goods };
  } catch (err) {
    console.error('获取商品详情失败', err);
    return { success: false, error: err.message };
  }
}

async function updateGoods(openid, role, data) {
  // 兼容 id 和 _id，优先使用 _id，其次 id
  const id = (data && (data._id || data.id)) || '';
  if (!openid) {
    return { success: false, error: '缺少用户身份信息，请重新登录' };
  }
  if (role !== 'merchant' && role !== 'admin') {
    return { success: false, error: '无编辑权限' };
  }
  if (!id) {
    return { success: false, error: '缺少商品ID' };
  }

  // 获取商品信息
  const detail = await db.collection('goods_products').doc(id).get();
  const goods = detail.data;
  if (!goods) {
    return { success: false, error: '商品不存在' };
  }

  // 权限检查：只有商品所有者或admin可以编辑
  const isOwner = goods.ownerOpenid === openid;
  if (!(role === 'admin' || isOwner)) {
    return { success: false, error: '无编辑权限' };
  }

  const isAdmin = role === 'admin';

  // 提取可编辑字段
  const name = data.name ? String(data.name).trim() : goods.name;
  const price = data.price !== undefined ? Number(data.price) : goods.price;
  const desc = data.desc !== undefined ? String(data.desc).trim() : goods.desc;
  const image = data.image ? String(data.image).trim() : goods.image;
  const images = data.images ? (Array.isArray(data.images) ? data.images.filter(Boolean) : []) : (goods.images || [goods.image]);

  // 验证必填字段
  if (!name || !image || !Number.isFinite(price) || price <= 0) {
    return { success: false, error: '请填写完整的商品信息' };
  }

  // 检查图片是否修改
  const oldImage = goods.image || '';
  const oldImages = goods.images || [];
  const imageChanged = oldImage !== image || JSON.stringify(oldImages) !== JSON.stringify(images);

  // 构建更新数据
  const updateData = {
    name,
    price,
    image,
    images,
    desc,
    ownerOpenid: data.ownerOpenid !== undefined ? data.ownerOpenid : goods.ownerOpenid,
    // ✅ 审核状态：只有管理员可以修改，否则保持原样
    status: isAdmin ? (data.status || goods.status) : goods.status,
    isMultiSpec: data.isMultiSpec !== undefined ? data.isMultiSpec : goods.isMultiSpec,
    variants: Array.isArray(data.variants) ? data.variants : goods.variants,
    specs: Array.isArray(data.specs) ? data.specs : goods.specs,
    generateTraceCode: data.generateTraceCode !== undefined ? data.generateTraceCode : goods.generateTraceCode,
    updatedAt: db.serverDate()
  };

  let needReview = false;
  if (!isAdmin && imageChanged) {
    needReview = true;
    updateData.status = 'pending';
    updateData.onShelf = false;
    updateData.rejectReason = '';
  }

  await db.collection('goods_products').doc(id).update({ data: updateData });

  return {
    success: true,
    needReview,
    message: needReview ? '修改成功，已提交审核' : '修改成功'
  };
}

async function updateMultiSpecGoods(openid, role, data) {
  if (!openid) {
    return { success: false, error: '缺少用户身份信息' };
  }
  if (role !== 'merchant' && role !== 'admin') {
    return { success: false, error: '无编辑权限' };
  }

  const id = data && data._id;
  if (!id) {
    return { success: false, error: '缺少商品ID' };
  }

  // 获取商品信息
  const detail = await db.collection('goods_products').doc(id).get();
  const goods = detail.data;
  if (!goods) {
    return { success: false, error: '商品不存在' };
  }

  // 权限检查：只有商品所有者或admin可以编辑
  const isOwner = goods.ownerOpenid === openid;
  if (!(role === 'admin' || isOwner)) {
    return { success: false, error: '无编辑权限' };
  }

  const isAdmin = role === 'admin';

  const name = data.name ? String(data.name).trim() : goods.name;
  const specs = data.specs || goods.specs;
  const desc = data.desc !== undefined ? String(data.desc).trim() : goods.desc;
  const generateTraceCode = data.generateTraceCode !== undefined ? data.generateTraceCode : goods.generateTraceCode;

  if (!name) {
    return { success: false, error: 'invalid params: name is required' };
  }

  if (!specs || !Array.isArray(specs) || specs.length === 0) {
    return { success: false, error: 'invalid params: specs is required' };
  }

  // 验证每个规格
  let minPrice = Infinity;
  let primaryImage = '';
  let primaryImages = [];

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const specName = String(spec.name || '').trim();
    const specPrice = Number(spec.price);
    const specImage = String(spec.image || '').trim();
    const specImages = Array.isArray(spec.images)
      ? spec.images.filter(Boolean)
      : (specImage ? [specImage] : []);

    if (!specName) {
      return { success: false, error: `invalid params: spec ${i + 1} name is required` };
    }
    if (!Number.isFinite(specPrice) || specPrice <= 0) {
      return { success: false, error: `invalid params: spec ${i + 1} price is invalid` };
    }
    if (!specImage) {
      return { success: false, error: `invalid params: spec ${i + 1} image is required` };
    }

    // 记录最低价格和第一张图片
    if (i === 0 || specPrice < minPrice) {
      minPrice = specPrice;
      primaryImage = specImage;
      primaryImages = specImages;
    }
  }

  // 检查图片是否修改
  const oldImage = goods.image || '';
  const oldImages = goods.images || [];
  const oldSpecs = goods.specs || [];
  const imageChanged = oldImage !== primaryImage || JSON.stringify(oldImages) !== JSON.stringify(primaryImages) ||
                       JSON.stringify(oldSpecs) !== JSON.stringify(specs);

  // 规格化规格数据
  const normalizedSpecs = specs.map(spec => ({
    name: String(spec.name || '').trim(),
    price: Number(spec.price),
    style: String(spec.style || '').trim(),
    image: String(spec.image || '').trim(),
    images: Array.isArray(spec.images) ? spec.images.filter(Boolean) : [spec.image]
  }));

  const updateData = {
    name,
    price: minPrice,
    image: primaryImage,
    images: primaryImages,
    desc,
    specs: normalizedSpecs,
    generateTraceCode,
    updatedAt: db.serverDate()
  };

  let needReview = false;

  // 商家用户：修改图片需要重新审核
  if (!isAdmin && imageChanged) {
    needReview = true;
    updateData.status = 'pending';
    updateData.onShelf = false;
    updateData.rejectReason = '';
  }

  // 更新商品
  await db.collection('goods_products').doc(id).update({ data: updateData });

  return {
    success: true,
    needReview,
    message: needReview ? '修改成功，已提交审核' : '修改成功'
  };
}

async function updateGoodsAllFields(openid, role, data) {
  if (!openid) {
    return { success: false, error: 'missing openid' };
  }
  if (role !== 'admin') {
    return { success: false, error: 'no permission' };
  }

  const id = data && data._id;
  const payload = data && data.payload;

  if (!id) {
    return { success: false, error: 'missing _id' };
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { success: false, error: 'invalid payload' };
  }

  const toUpdate = { ...payload };
  delete toUpdate._id;
  toUpdate.updatedAt = db.serverDate();

  await db.collection('goods_products').doc(id).update({
    data: toUpdate
  });

  return { success: true };
}

exports.main = async (event) => {
  let { OPENID } = cloud.getWXContext(); // 注意这里改为 let
  console.log('======== goodsCenter 调用 ========');
  console.log('OPENID:', OPENID);
  console.log('event.action:', event && event.action);
  console.log('event.data.adminOpenid:', (event.data && event.data.adminOpenid));
  
  // 容错处理：如果匿名登录失效，OPENID为空，则使用前端传来的管理员ID
  if (!OPENID) {
    const dataObj = event.data || {};
    const adminOpenid = dataObj.adminOpenid;
    // 只在使用管理员身份操作时启用此容错
    if (adminOpenid) {
      OPENID = adminOpenid;
      console.log('使用前端传入的管理员openid作为备用身份:', OPENID);
    }
  }

  // ✅ 必须先初始化 role
  let role = await getUserRole(OPENID);

  // ✅ 角色提升：如果当前 OPENID 就是管理员，或者前端传来匹配的管理员 openid
  const dataObj = event.data || {};
  const adminOpenid = dataObj.adminOpenid;

  // 动态角色提升：如果前端传来 adminOpenid，查询该 openid 在 users 集合中的角色
  if (adminOpenid) {
    const adminRole = await getUserRole(adminOpenid);
    if (adminRole === 'admin') {
      role = 'admin';
    }
  }

  const action = event && event.action;
  const data = event && event.data;

  try {
    switch (action) {
      case 'listMyGoods':
        return await listMyGoods(OPENID);
      case 'listPublishedGoods':
        return await listPublishedGoods();
      case 'listAllGoods':
        return await listAllGoods(role);
      case 'listPendingGoods':
        return await listPendingGoods(role);
      case 'submitGoods':
        return await submitGoods(OPENID, role, data);
      case 'submitMultiSpecGoods':
        return await submitMultiSpecGoods(OPENID, role, data);
      case 'reviewGoods':
        return await reviewGoods(OPENID, role, data);
      case 'bindAllGoodsToAdmin':
        return await bindAllGoodsToAdmin(OPENID, role);
      case 'toggleShelf':
        return await toggleShelf(OPENID, role, data);
      case 'deleteGoods':
        return await deleteGoods(OPENID, role, data);
      case 'getDetail':
        return await getGoodsDetail(OPENID, data.id);
      case 'getGoodsById':
        return await getGoodsById(OPENID, data);
      case 'updateGoods':
        return await updateGoods(OPENID, role, data);
      case 'updateMultiSpecGoods':
        return await updateMultiSpecGoods(OPENID, role, data);
      case 'updateGoodsAllFields':
        return await updateGoodsAllFields(OPENID, role, data);
      default:
        return { success: false, error: 'unknown action' };
    }
  } catch (err) {
    console.error('goodsCenter error', err);
    return { success: false, error: err.message || 'internal error' };
  }
};