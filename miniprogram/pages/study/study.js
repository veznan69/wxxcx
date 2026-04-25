// pages/study/study.js
const { getImageUrl } = require('../../utils/imageMap.js');

Page({
  data: {
    courses: [],
    loading: false
  },

  onLoad() {
    this.loadCourses();
  },

  onShow() {
    // 返回列表页时刷新报名人数，保证接近实时
    this.loadCourses();
  },

  getCourseTemplates() {
    return [
      {
        _id: 'c1',
        name: '中山初中两天一夜游',
        subTitle: '研途有你，学趣同行',
        price: 598,
        image: getImageUrl('ourse_thumb1.jpg'),
        poster: getImageUrl('course1.jpg'),
        desc: '适合初中生，两天一夜深度研学',
        enrolled: 0
      },
      {
        _id: 'c2',
        name: '中山初中研学一日游',
        subTitle: '自然探索·劳动实践·红色教育',
        price: 298,
        image: getImageUrl('ourse_thumb2.jpg'),
        poster: getImageUrl('course2.jpg'),
        desc: '初中生一日研学',
        enrolled: 0
      },
      {
        _id: 'c3',
        name: '中山小学两天一夜研学之旅',
        subTitle: '探索自然·传承文化·快乐成长',
        price: 498,
        image: getImageUrl('ourse_thumb3.jpg'),
        poster: getImageUrl('course3.jpg'),
        desc: '小学生两天一夜研学',
        enrolled: 0
      },
      {
        _id: 'c4',
        name: '中山小学研学一日游',
        subTitle: '自然探索·文化传承·团队成长',
        price: 198,
        image: getImageUrl('ourse_thumb4.jpg'),
        poster: getImageUrl('course4.jpg'),
        desc: '小学生一日研学',
        enrolled: 0
      },
      {
        _id: 'c5',
        name: '中山高中研学两天一夜游',
        subTitle: '自然探索·文化传承·团队成长',
        price: 598,
        image: getImageUrl('ourse_thumb5.jpg'),
        poster: getImageUrl('course5.jpg'),
        desc: '高中生两天一夜深度研学',
        enrolled: 0
      },
      {
        _id: 'c6',
        name: '中山高中研学一日游',
        subTitle: '自然探索·文化传承·红色教育',
        price: 298,
        image: getImageUrl('ourse_thumb6.jpg'),
        poster: getImageUrl('course6.jpg'),
        desc: '高中生一日研学',
        enrolled: 0
      }
    ];
  },

  async getPaidEnrollmentMap() {
    const db = wx.cloud.database();
    const _ = db.command;
    const pageSize = 100;
    let skip = 0;
    let hasMore = true;
    const enrollmentMap = {};

    while (hasMore) {
      const res = await db.collection('reservations')
        .where({
          type: 'course',
          status: _.in(['paid', 'completed'])
        })
        .field({
          courseId: true,
          peopleCount: true
        })
        .skip(skip)
        .limit(pageSize)
        .get();

      const list = res.data || [];

      list.forEach(item => {
        const courseId = item.courseId;
        if (!courseId) return;

        const people = Number(item.peopleCount) || 1;
        enrollmentMap[courseId] = (enrollmentMap[courseId] || 0) + people;
      });

      if (list.length < pageSize) {
        hasMore = false;
      } else {
        skip += pageSize;
      }
    }

    return enrollmentMap;
  },

  async loadCourses() {
    this.setData({ loading: true });

    try {
      const courses = this.getCourseTemplates();
      const enrollmentMap = await this.getPaidEnrollmentMap();

      const mergedCourses = courses.map(course => ({
        ...course,
        enrolled: enrollmentMap[course._id] || 0
      }));

      this.setData({ courses: mergedCourses });
    } catch (err) {
      console.error('加载课程或统计报名人数失败', err);
      // 失败时也展示课程，报名人数回退为 0
      this.setData({ courses: this.getCourseTemplates() });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 点击课程跳转详情页
  goToDetail(e) {
    const course = e.currentTarget.dataset.course;
    wx.navigateTo({
      url: `/pages/studyDetail/studyDetail?course=${encodeURIComponent(JSON.stringify(course))}`
    });
  },

  // 预约（从卡片按钮触发）
  signup(e) {
    const app = getApp();

    if (!app.globalData.openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/user/user' });
      }, 1500);
      return;
    }

    const course = e.currentTarget.dataset.item;

    wx.navigateTo({
      url: `/pages/courseReservation/courseReservation?course=${encodeURIComponent(JSON.stringify(course))}`
    });
  }
});