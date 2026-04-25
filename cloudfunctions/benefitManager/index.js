const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const operatorOpenid = wxContext.OPENID;
  const { action, benefitCode } = event;

  console.log('===== benefitManager 调用 =====');
  console.log('operatorOpenid:', operatorOpenid);
  console.log('action:', action);
  console.log('benefitCode:', benefitCode);

  if (!operatorOpenid) {
    return { success: false, error: '未登录' };
  }

  // 权限校验：仅商家/管理员可核销
  const userRes = await db.collection('users').where({ _openid: operatorOpenid }).get();
  if (userRes.data.length === 0 || !['merchant', 'admin'].includes(userRes.data[0].role)) {
    return { success: false, error: '无核销权限' };
  }

  if (action === 'verify') {
    return await verifyBenefit(benefitCode, operatorOpenid);
  }

  return { success: false, error: '未知操作' };
};

async function verifyBenefit(benefitCode, operatorOpenid) {
  if (!benefitCode) {
    return { success: false, error: '缺少核销码' };
  }

  // 统一转为大写，去除首尾空格
  const code = benefitCode.trim().toUpperCase();
  console.log('处理后的权益码:', code);

  try {
    // ✅ 正确查询：使用 _.elemMatch 匹配数组中对象字段
    const res = await db.collection('adoptions')
      .where({
        benefits: _.elemMatch({
          code: code,
          status: 'unused'
        })
      })
      .get();

    console.log('查询到的记录数:', res.data.length);

    if (res.data.length === 0) {
      return { success: false, error: '核销码无效或已核销' };
    }

    const record = res.data[0];
    const benefits = record.benefits;
    const targetIndex = benefits.findIndex(b => b.code === code);

    if (targetIndex === -1) {
      return { success: false, error: '权益不存在' };
    }

    // 更新该权益状态为 used
    benefits[targetIndex].status = 'used';
    benefits[targetIndex].usedTime = db.serverDate();
    benefits[targetIndex].verifyOpenid = operatorOpenid;

    await db.collection('adoptions').doc(record._id).update({
      data: { benefits }
    });

    console.log('权益核销成功，记录ID:', record._id);
    return { success: true, message: '核销成功' };
  } catch (err) {
    console.error('核销执行错误:', err);
    return { success: false, error: err.message };
  }
}