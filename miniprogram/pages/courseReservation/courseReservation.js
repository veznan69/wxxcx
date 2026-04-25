// pages/courseReservation/courseReservation.js
Page({
  data: {
    course: null,
    peopleOptions: [],
    minDate: '',
    maxDate: '',
    formData: {
      travelDate: '',
      peopleCount: '',
      courseType: '',
      contactName: '',
      emergencyContact: '',
      contactPhone: '',
      emergencyPhone: '',
      organization: '',
      remarks: ''
    },
    totalPrice: 0
  },

  onLoad(options) {
    if (options.course) {
      try {
        const course = JSON.parse(decodeURIComponent(options.course));
        this.setData({
          course,
          totalPrice: course.price
        });
      } catch (e) {
        console.error('解析课程参数失败', e);
      }
    }

    const today = new Date();
    const minDate = this.formatDate(today);

    const max = new Date();
    max.setFullYear(max.getFullYear() + 1);
    const maxDate = this.formatDate(max);

    const peopleOptions = [];
    for (let i = 1; i <= 50; i++) {
      peopleOptions.push(String(i) + '人');
    }

    this.setData({
      minDate,
      maxDate,
      peopleOptions
    });
  },

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  },

  onDateChange(e) {
    this.setData({
      'formData.travelDate': e.detail.value
    });
  },

  onPeopleChange(e) {
    const index = Number(e.detail.value);
    const peopleCount = index + 1;
    const price = this.data.course ? this.data.course.price : 0;

    this.setData({
      'formData.peopleCount': peopleCount,
      totalPrice: price * peopleCount
    });
  },

  onInputChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      ['formData.' + field]: e.detail.value
    });
  },

  async submitReservation() {
    const app = getApp();

    if (!app.globalData.openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/user/user' });
      }, 1500);
      return;
    }

    const { formData, course } = this.data;

    if (!course) {
      wx.showToast({ title: '课程信息异常', icon: 'none' });
      return;
    }

    if (!formData.travelDate) {
      wx.showToast({ title: '请选择出行时间', icon: 'none' });
      return;
    }

    if (!formData.peopleCount) {
      wx.showToast({ title: '请选择出行人数', icon: 'none' });
      return;
    }

    if (!formData.contactName) {
      wx.showToast({ title: '请输入联系人姓名', icon: 'none' });
      return;
    }

    if (!formData.contactPhone) {
      wx.showToast({ title: '请输入联系电话', icon: 'none' });
      return;
    }

    if (!/^1[3-9]\d{9}$/.test(formData.contactPhone)) {
      wx.showToast({ title: '联系电话格式错误', icon: 'none' });
      return;
    }

    if (formData.emergencyPhone && !/^1[3-9]\d{9}$/.test(formData.emergencyPhone)) {
      wx.showToast({ title: '紧急联系电话格式错误', icon: 'none' });
      return;
    }

    if (!formData.organization) {
      wx.showToast({ title: '请输入单位名称', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '提交中...' });

    try {
      await wx.cloud.database().collection('reservations').add({
        data: {
          type: 'course',
          courseId: course._id,
          courseName: course.name,
          coursePrice: course.price,
          courseImage: course.image,
          courseType: formData.courseType,
          travelDate: formData.travelDate,
          peopleCount: formData.peopleCount,
          contactName: formData.contactName,
          emergencyContact: formData.emergencyContact,
          contactPhone: formData.contactPhone,
          emergencyPhone: formData.emergencyPhone,
          organization: formData.organization,
          remarks: formData.remarks,
          totalPrice: this.data.totalPrice,
          status: 'unpaid',
          createTime: new Date()
        }
      });

      wx.hideLoading();
      wx.showToast({ title: '预约成功', icon: 'success' });

      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/myreserve/myreserve',
          fail: () => {
            wx.navigateTo({ url: '/pages/myreserve/myreserve' });
          }
        });
      }, 1500);
    } catch (err) {
      wx.hideLoading();
      console.error('提交预约失败', err);

      if (err.errCode === -502005) {
        wx.showModal({
          title: '系统提示',
          content: '数据库未初始化，请联系管理员配置数据库',
          showCancel: false
        });
        return;
      }

      wx.showToast({ title: '预约失败，请重试', icon: 'none' });
    }
  }
});