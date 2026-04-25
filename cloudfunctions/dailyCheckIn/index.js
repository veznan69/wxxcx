const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function getTodayStart() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const date = now.getDate();
  return new Date(year, month, date, 0, 0, 0);
}

function getTodayEnd() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const date = now.getDate();
  return new Date(year, month, date, 23, 59, 59, 999);
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const action = event && event.action;

  if (!OPENID) {
    return { success: false, error: 'not login' };
  }

  try {
    // 检查今日是否已签到
    if (action === 'checkToday') {
      const todayStart = getTodayStart();
      const todayEnd = getTodayEnd();

      const res = await db.collection('check_in_records')
        .where({
          _openid: OPENID,
          createTime: db.command.gte(todayStart).and(db.command.lte(todayEnd))
        })
        .limit(1)
        .get();

      const checkedIn = res.data.length > 0;
      return { success: true, checkedIn };
    }

    // 签到
    if (action === 'checkIn') {
      // 先检查今日是否已签到
      const todayStart = getTodayStart();
      const todayEnd = getTodayEnd();

      const checkRes = await db.collection('check_in_records')
        .where({
          _openid: OPENID,
          createTime: db.command.gte(todayStart).and(db.command.lte(todayEnd))
        })
        .limit(1)
        .get();

      if (checkRes.data.length > 0) {
        return { success: false, error: '今日已签到' };
      }

      const now = db.serverDate();

      // 获取连续签到天数
      const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayEnd = new Date(todayEnd.getTime() - 24 * 60 * 60 * 1000);

      const yesterdayRes = await db.collection('check_in_records')
        .where({
          _openid: OPENID,
          createTime: db.command.gte(yesterdayStart).and(db.command.lte(yesterdayEnd))
        })
        .limit(1)
        .get();

      let consecutiveDays = 1;
      if (yesterdayRes.data.length > 0) {
        consecutiveDays = (yesterdayRes.data[0].consecutiveDays || 0) + 1;
      }

      // 计算积分奖励
      let points = 10; // 基础积分

      // 连续签到7天额外奖励
      if (consecutiveDays === 7) {
        points += 50;
      }

      // 连续签到30天额外奖励
      if (consecutiveDays === 30) {
        points += 300;
      }

      // 记录签到
      await db.collection('check_in_records').add({
        data: {
          _openid: OPENID,
          consecutiveDays,
          points,
          createTime: now
        }
      });

      // 增加积分
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
          points,
          type: 'add',
          reason: '每日签到',
          bizId: '',
          bizType: 'daily_checkin',
          createTime: now
        }
      });

      return { success: true, points, consecutiveDays };
    }

    // 获取连续签到天数
    if (action === 'getConsecutiveDays') {
      const todayStart = getTodayStart();
      const todayEnd = getTodayEnd();

      const todayRes = await db.collection('check_in_records')
        .where({
          _openid: OPENID,
          createTime: db.command.gte(todayStart).and(db.command.lte(todayEnd))
        })
        .limit(1)
        .get();

      if (todayRes.data.length > 0) {
        return { success: true, consecutiveDays: todayRes.data[0].consecutiveDays || 0 };
      }

      // 如果今天没签到，检查昨天
      const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayEnd = new Date(todayEnd.getTime() - 24 * 60 * 60 * 1000);

      const yesterdayRes = await db.collection('check_in_records')
        .where({
          _openid: OPENID,
          createTime: db.command.gte(yesterdayStart).and(db.command.lte(yesterdayEnd))
        })
        .limit(1)
        .get();

      if (yesterdayRes.data.length > 0) {
        return { success: true, consecutiveDays: yesterdayRes.data[0].consecutiveDays || 0 };
      }

      return { success: true, consecutiveDays: 0 };
    }

    return { success: false, error: 'unknown action' };
  } catch (err) {
    console.error('dailyCheckIn error', err);
    return { success: false, error: err.message || 'internal error' };
  }
};
