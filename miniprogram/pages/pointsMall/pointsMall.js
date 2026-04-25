// pages/pointsMall/pointsMall.js
Page({
  data: {
    userPoints: 0,
    checkedIn: false,
    loading: false,
    goods: [],
    pointWays: [
      {
        icon: '📅',
        name: '每日签到',
        desc: '每天签到一次，连续签到有额外奖励',
        points: 10
      },
      {
        icon: '🛒',
        name: '购买商品',
        desc: '每消费1元获得1积分',
        points: 0
      },
      {
        icon: '📝',
        name: '橙友圈发帖',
        desc: '发布帖子并获得点赞',
        points: 20
      },
      {
        icon: '🌳',
        name: '果树认养',
        desc: '成功认养一棵果树',
        points: 100
      },
      {
        icon: '🎓',
        name: '预约课程',
        desc: '成功预约研学课程',
        points: 50
      },
      {
        icon: '🍊',
        name: '预约采摘',
        desc: '成功预约采摘活动',
        points: 30
      },
      {
        icon: '📦',
        name: '确认收货',
        desc: '订单确认收货',
        points: 5
      },
      {
        icon: '✍️',
        name: '商品评价',
        desc: '对已购买商品进行评价',
        points: 5
      }
    ]
  },

  onLoad() {
    this.loadUserPoints();
    this.loadGoods();
    this.checkTodayCheckIn();
  },

  onShow() {
    this.loadUserPoints();
  },

  onPullDownRefresh() {
    this.loadUserPoints();
    this.loadGoods();
    this.checkTodayCheckIn();
    wx.stopPullDownRefresh();
  },

  async loadUserPoints() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'pointsManager',
        data: { action: 'getUserPoints' }
      });

      if (res.result && res.result.success) {
        this.setData({ userPoints: res.result.points || 0 });
      }
    } catch (err) {
      console.error('加载积分失败', err);
    }
  },

  async loadGoods() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'pointExchange',
        data: { action: 'listGoods' }
      });

      if (res.result && res.result.success) {
        this.setData({ goods: res.result.data || [] });
      }
    } catch (err) {
      console.error('加载商品失败', err);
      this.setData({ goods: [] });
    } finally {
      this.setData({ loading: false });
    }
  },

  async checkTodayCheckIn() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'dailyCheckIn',
        data: { action: 'checkToday' }
      });

      if (res.result && res.result.success) {
        this.setData({ checkedIn: res.result.checkedIn || false });
      }
    } catch (err) {
      console.error('检查签到状态失败', err);
      this.setData({ checkedIn: false });
    }
  },

  async checkIn() {
    if (this.data.checkedIn) {
      wx.showToast({ title: '今日已签到', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '签到中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'dailyCheckIn',
        data: { action: 'checkIn' }
      });

      if (res.result && res.result.success) {
        const points = res.result.points || 0;
        this.setData({ checkedIn: true });
        await this.loadUserPoints();
        wx.showToast({ title: `签到成功！+${points}积分`, icon: 'success' });
      } else {
        throw new Error(res.result?.error || '签到失败');
      }
    } catch (err) {
      console.error('签到失败', err);
      wx.showToast({ title: err.message || '签到失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  gotoPointRules() {
    wx.navigateTo({ url: '/pages/pointRules/pointRules' });
  },

  gotoGoodsDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/pointGoodsDetail/pointGoodsDetail?id=${id}` });
  }
});
