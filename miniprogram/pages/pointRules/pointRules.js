// pages/pointRules/pointRules.js
Page({
  data: {
    getRules: [
      {
        icon: '📅',
        name: '每日签到',
        points: 10,
        desc: '每日签到可获得10积分，连续签到7天额外奖励50积分，连续签到30天额外奖励300积分。'
      },
      {
        icon: '🛒',
        name: '购买商品',
        points: 0,
        desc: '每消费1元获得1积分，积分在订单完成后发放。订单取消或退款，对应积分将被收回。'
      },
      {
        icon: '📝',
        name: '橙友圈发帖',
        points: 20,
        desc: '发布优质原创内容，审核通过后获得20积分。内容违规或广告将不予积分奖励。'
      },
      {
        icon: '🌳',
        name: '果树认养',
        points: 100,
        desc: '成功认养一棵果树，立即获得100积分奖励。'
      },
      {
        icon: '🎓',
        name: '预约课程',
        points: 50,
        desc: '成功预约并参与研学课程，获得50积分。'
      },
      {
        icon: '🍊',
        name: '预约采摘',
        points: 30,
        desc: '成功预约并参与采摘活动，获得30积分。'
      },
      {
        icon: '📦',
        name: '确认收货',
        points: 5,
        desc: '订单确认收货后，获得5积分。'
      },
      {
        icon: '✍️',
        name: '商品评价',
        points: 5,
        desc: '对已购买商品进行评价，获得5积分。图文评价额外奖励5积分。'
      }
    ]
  },

  contactService() {
    wx.navigateTo({ url: '/pages/serviceChat/serviceChat' });
  }
});
