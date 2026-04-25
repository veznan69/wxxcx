const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { action, data = {} } = event || {};

  if (!openid) {
    return { success: false, error: '未登录' };
  }

  try {
    switch (action) {
      case 'create':
        return await createAdoption(openid, data);
      case 'list':
        return await listAdoptions(openid);
      case 'verify':
        if (!(await isMerchantOrAdmin(openid))) {
          return { success: false, error: '无核销权限' };
        }
        return await verifyAdoption(data.verifyCode, openid);
      case 'getDetail':
        return await getAdoptionDetail(openid, data.adoptId);
      default:
        return { success: false, error: '未知操作' };
    }
  } catch (err) {
    console.error('adoptionManager error', err);
    return { success: false, error: err.message || '服务异常' };
  }
};

async function isMerchantOrAdmin(openid) {
  const res = await db.collection('users').where({ _openid: openid }).limit(1).get();
  const role = res.data && res.data[0] && res.data[0].role;
  return role === 'merchant' || role === 'admin';
}

async function createAdoption(openid, data = {}) {
  const benefitChoice = Number(data.benefitChoice) === 2 ? 2 : 1;
  const status = String(data.status || 'paid');

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const treeNo = `GZ${dateStr}${random}`;

  const benefits = generateBenefits(benefitChoice, treeNo);

  const addRes = await db.collection('adoptions').add({
    data: {
      _openid: openid,
      treeNo,
      status,
      benefitChoice,
      benefits,
      createTime: db.serverDate(),
      expireTime: db.serverDate({ offset: 365 * 24 * 60 * 60 * 1000 })
    }
  });

  const verifyCode = addRes._id.slice(-6).toUpperCase();
  await db.collection('adoptions').doc(addRes._id).update({ data: { verifyCode } });

  return { success: true, data: { _id: addRes._id, treeNo, verifyCode, status, benefitChoice } };
}

function generateBenefits(choice, treeNo) {
  const validTime = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const baseBenefits = [
    {
      name: '脐橙权益',
      desc: '保底70斤脐橙，包邮到家',
      code: `ADV${treeNo}01`,
      status: 'unused',
      validTime
    }
  ];

  if (choice === 1) {
    return baseBenefits.concat([
      { name: '酒店住宿', desc: '大余丫山酒店2天1晚（含双早）', code: `ADV${treeNo}02`, status: 'unused', validTime },
      { name: '景区门票', desc: '景区门票2张', code: `ADV${treeNo}03`, status: 'unused', validTime }
    ]);
  }

  return baseBenefits.concat([
    { name: '土鸡土鸡蛋', desc: '6只土鸡+30枚土鸡蛋', code: `ADV${treeNo}02`, status: 'unused', validTime }
  ]);
}

async function listAdoptions(openid) {
  const res = await db.collection('adoptions')
    .where({ _openid: openid })
    .orderBy('createTime', 'desc')
    .get();
  return { success: true, data: res.data || [] };
}

async function verifyAdoption(verifyCode, verifierOpenid) {
  const code = String(verifyCode || '').trim().toUpperCase();
  if (!code) {
    return { success: false, error: '缺少核销码' };
  }

  const res = await db.collection('adoptions')
    .where({
      verifyCode: code,
      status: _.in(['paid', 'pending'])
    })
    .limit(1)
    .get();

  if (!res.data.length) {
    return { success: false, error: '核销码无效或已核销' };
  }

  const record = res.data[0];
  await db.collection('adoptions').doc(record._id).update({
    data: {
      status: 'verified',
      verifyTime: db.serverDate(),
      verifyOpenid: verifierOpenid
    }
  });

  return { success: true, message: '核销成功', data: { adoptId: record._id, treeNo: record.treeNo } };
}

async function getAdoptionDetail(openid, adoptId) {
  if (!adoptId) {
    return { success: false, error: '缺少认养ID' };
  }

  const res = await db.collection('adoptions').doc(String(adoptId)).get();
  if (!res.data) {
    return { success: false, error: '认养记录不存在' };
  }

  if (res.data._openid !== openid) {
    return { success: false, error: '无权查看' };
  }

  return { success: true, data: res.data };
}
