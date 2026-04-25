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
    // 获取用户积分
    if (action === 'getUserPoints') {
      const res = await db.collection('user_points').where({ _openid: OPENID }).get();
      const points = res.data.length > 0 ? (res.data[0].totalPoints || 0) : 0;
      return { success: true, points };
    }

    // 增加积分
    if (action === 'addPoints') {
      const { points, reason, bizId, bizType } = event.data || {};

      if (!points || points <= 0) {
        return { success: false, error: 'invalid points' };
      }

      const now = db.serverDate();

      // 检查是否已存在该业务记录（防止重复加分）
      if (bizId && bizType) {
        const exists = await db.collection('point_records')
          .where({ _openid: OPENID, bizId, bizType })
          .limit(1)
          .get();

        if (exists.data.length > 0) {
          return { success: true, alreadyAdded: true, message: '积分已添加' };
        }
      }

      // 更新或创建用户积分
      const userRes = await db.collection('user_points').where({ _openid: OPENID }).get();

      if (userRes.data.length === 0) {
        await db.collection('user_points').add({
          data: {
            _openid: OPENID,
            totalPoints: points,
            usedPoints: 0,
            availablePoints: points,
            createdAt: now,
            updatedAt: now
          }
        });
      } else {
        await db.collection('user_points').doc(userRes.data[0]._id).update({
          data: {
            totalPoints: db.command.inc(points),
            availablePoints: db.command.inc(points),
            updatedAt: now
          }
        });
      }

      // 记录积分变更
      await db.collection('point_records').add({
        data: {
          _openid: OPENID,
          points: points,
          type: 'add',
          reason: reason || '积分奖励',
          bizId: bizId || '',
          bizType: bizType || '',
          createTime: now
        }
      });

      return { success: true, points };
    }

    // 扣减积分
    if (action === 'deductPoints') {
      const { points, reason, bizId, bizType } = event.data || {};

      if (!points || points <= 0) {
        return { success: false, error: 'invalid points' };
      }

      const now = db.serverDate();

      // 获取用户积分
      const userRes = await db.collection('user_points').where({ _openid: OPENID }).get();

      if (userRes.data.length === 0) {
        return { success: false, error: 'user points not found' };
      }

      const userPoints = userRes.data[0];

      if (userPoints.availablePoints < points) {
        return { success: false, error: 'insufficient points' };
      }

      // 扣减积分
      await db.collection('user_points').doc(userPoints._id).update({
        data: {
          availablePoints: db.command.inc(-points),
          usedPoints: db.command.inc(points),
          updatedAt: now
        }
      });

      // 记录积分变更
      await db.collection('point_records').add({
        data: {
          _openid: OPENID,
          points: points,
          type: 'deduct',
          reason: reason || '积分消费',
          bizId: bizId || '',
          bizType: bizType || '',
          createTime: now
        }
      });

      return { success: true, points };
    }

    // 获取积分记录
    if (action === 'getPointRecords') {
      const limit = Math.min(Number((event && event.limit) || 50), 100);
      const res = await db.collection('point_records')
        .where({ _openid: OPENID })
        .orderBy('createTime', 'desc')
        .limit(limit)
        .get();

      return { success: true, list: res.data || [] };
    }

    return { success: false, error: 'unknown action' };
  } catch (err) {
    console.error('pointsManager error', err);
    return { success: false, error: err.message || 'internal error' };
  }
};
