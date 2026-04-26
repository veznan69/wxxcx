// pages/strategy/strategy.js - 静态攻略数据
const { getImageUrl } = require('../../utils/imageMap.js');

Page({
  data: {
    articles: [],
    loading: false
  },
  onLoad() {
    this.loadStrategies()
  },
  loadStrategies() {
    const mockArticles = [
      { _id: 'a1', title: '赣南脐橙采摘季最强攻略', summary: '最佳时间、路线、住宿推荐', cover: getImageUrl('strategy1.jpg'), createTime: '2025-10-01', views: 234 },
      { _id: 'a2', title: '富硒脐橙怎么挑？果农教你三招', summary: '看色泽、闻香味、掂重量', cover: getImageUrl('strategy2.jpg'), createTime: '2025-10-05', views: 189 },
      { _id: 'a3', title: '亲子游：果园+周边景点一日游', summary: '果园、客家围屋、温泉', cover: getImageUrl('strategy3.jpg'), createTime: '2025-10-10', views: 312 }
    ];
    this.setData({ articles: mockArticles });
  },

  viewDetail(e) {
    const item = e.currentTarget.dataset.item
    wx.showModal({
      title: item.title,
      content: item.summary + '\n完整内容即将上线，敬请期待！',
      showCancel: false
    })
  }
})