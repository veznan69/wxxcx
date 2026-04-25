// pages/reservationDetail/reservationDetail.js
Page({
  data: {
    reservationId: null,
    reservation: null,
    isEditing: false,
    peopleOptions: [],
    peopleIndex: 0,
    minDate: '',
    maxDate: '',
    formData: {},
    statusText: '',
    statusClass: '',
    canPay: false,
    agreed: false
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ reservationId: options.id });
      this.loadReservationDetail();
    }

    const today = new Date();
    const minDate = this.formatDate(today);
    const max = new Date();
    max.setFullYear(max.getFullYear() + 1);
    const maxDate = this.formatDate(max);

    const peopleOptions = [];
    for (let i = 1; i <= 50; i++) {
      peopleOptions.push(String(i));
    }

    this.setData({ minDate, maxDate, peopleOptions });
  },

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  getStatusMeta(status) {
    if (status === 'paid') return { text: '已付款', cls: 'paid' };
    if (status === 'completed') return { text: '已完成', cls: 'completed' };
    if (status === 'cancelled') return { text: '已取消', cls: 'cancelled' };
    return { text: '待付款', cls: 'unpaid' };
  },

  isPayableStatus(status) {
    return status === 'unpaid' || status === 'pending';
  },

  async ensureReservationNo(reservation) {
    if (reservation.reservationNo) {
      return reservation.reservationNo;
    }

    const res = await wx.cloud.callFunction({
      name: 'assignReservationNo',
      data: { reservationId: this.data.reservationId }
    });

    const result = (res && res.result) || {};
    if (!result.success || !result.reservationNo) {
      throw new Error(result.error || 'assign reservation no failed');
    }

    return result.reservationNo;
  },

  async loadReservationDetail() {
    try {
      const res = await wx.cloud.database()
        .collection('reservations')
        .doc(this.data.reservationId)
        .get();

      const reservation = res.data || {};
      reservation.reservationNo = await this.ensureReservationNo(reservation);

      const statusMeta = this.getStatusMeta(reservation.status);
      const isCourse = reservation.type === 'course';
      const peopleRaw = isCourse ? reservation.peopleCount : reservation.people;
      const peopleNum = Number(peopleRaw) || 1;

      this.setData({
        reservation,
        statusText: statusMeta.text,
        statusClass: statusMeta.cls,
        canPay: this.isPayableStatus(reservation.status),
        peopleIndex: Math.max(0, peopleNum - 1),
        agreed: false,
        formData: isCourse
          ? {
              travelDate: reservation.travelDate || '',
              peopleCount: reservation.peopleCount || '',
              courseType: reservation.courseType || '',
              contactName: reservation.contactName || '',
              emergencyContact: reservation.emergencyContact || '',
              contactPhone: reservation.contactPhone || '',
              emergencyPhone: reservation.emergencyPhone || '',
              organization: reservation.organization || '',
              remarks: reservation.remarks || ''
            }
          : {
              name: reservation.name || '',
              phone: reservation.phone || '',
              date: reservation.date || '',
              people: peopleNum
            }
      });
    } catch (err) {
      console.error('加载预约详情失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onDateChange(e) {
    this.setData({ 'formData.travelDate': e.detail.value });
  },

  onPeopleChange(e) {
    const index = Number(e.detail.value);
    const peopleCount = index + 1;
    this.setData({
      peopleIndex: index,
      'formData.peopleCount': peopleCount
    });
  },

  onPickDateChange(e) {
    this.setData({ 'formData.date': e.detail.value });
  },

  onPickPeopleChange(e) {
    const index = Number(e.detail.value);
    const people = index + 1;
    this.setData({
      peopleIndex: index,
      'formData.people': people
    });
  },

  onInputChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ['formData.' + field]: e.detail.value });
  },

  toggleEdit() {
    this.setData({ isEditing: !this.data.isEditing });
  },

  onAgreementChange(e) {
    this.setData({ agreed: !!(e.detail.value && e.detail.value.length) });
  },

  openOrderAgreement() {
    wx.navigateTo({ url: '/pages/orderAgreement/orderAgreement' });
  },

  openSafetyNotice() {
    wx.navigateTo({ url: '/pages/safetyNotice/safetyNotice' });
  },

  async saveEdit() {
    const { formData, reservation, reservationId } = this.data;
    const isCourse = reservation.type === 'course';

    if (isCourse) {
      if (!formData.travelDate) return wx.showToast({ title: '请选择出行时间', icon: 'none' });
      if (!formData.peopleCount) return wx.showToast({ title: '请选择出行人数', icon: 'none' });
      if (!formData.contactName) return wx.showToast({ title: '请输入联系人姓名', icon: 'none' });
      if (!formData.contactPhone) return wx.showToast({ title: '请输入联系电话', icon: 'none' });
      if (!/^1[3-9]\d{9}$/.test(formData.contactPhone)) return wx.showToast({ title: '联系电话格式错误', icon: 'none' });
      if (formData.emergencyPhone && !/^1[3-9]\d{9}$/.test(formData.emergencyPhone)) return wx.showToast({ title: '紧急联系电话格式错误', icon: 'none' });
      if (!formData.organization) return wx.showToast({ title: '请输入单位名称', icon: 'none' });
    } else {
      if (!formData.name) return wx.showToast({ title: '请输入预约人姓名', icon: 'none' });
      if (!formData.phone) return wx.showToast({ title: '请输入手机号', icon: 'none' });
      if (!/^1[3-9]\d{9}$/.test(formData.phone)) return wx.showToast({ title: '手机号格式错误', icon: 'none' });
      if (!formData.date) return wx.showToast({ title: '请选择预约日期', icon: 'none' });
      if (!formData.people) return wx.showToast({ title: '请选择人数', icon: 'none' });
    }

    wx.showLoading({ title: '保存中...' });

    try {
      const updateData = isCourse
        ? {
            ...formData,
            totalPrice: (Number(reservation.coursePrice) || 0) * (Number(formData.peopleCount) || 1)
          }
        : {
            name: formData.name,
            phone: formData.phone,
            date: formData.date,
            people: Number(formData.people) || 1
          };

      await wx.cloud.database()
        .collection('reservations')
        .doc(reservationId)
        .update({ data: updateData });

      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => {
        this.setData({ isEditing: false });
        this.loadReservationDetail();
      }, 600);
    } catch (err) {
      wx.hideLoading();
      console.error('保存失败', err);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },

  cancelReservation() {
    wx.showModal({
      title: '确认取消',
      content: '确定要取消这个预约吗？',
      success: (res) => {
        if (res.confirm) this.doCancel();
      }
    });
  },

  async doCancel() {
    wx.showLoading({ title: '取消中...' });

    try {
      await wx.cloud.database()
        .collection('reservations')
        .doc(this.data.reservationId)
        .update({ data: { status: 'cancelled' } });

      wx.hideLoading();
      wx.showToast({ title: '已取消预约', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 800);
    } catch (err) {
      wx.hideLoading();
      console.error('取消预约失败', err);
      wx.showToast({ title: '取消失败，请重试', icon: 'none' });
    }
  },

  async payNow() {
    const { reservation, agreed } = this.data;

    if (!agreed) {
      wx.showToast({ title: '请先同意协议与须知', icon: 'none' });
      return;
    }

    const amount = reservation.type === 'course' ? `¥${reservation.totalPrice || 0}` : '采摘预约';

    const confirm = await new Promise(resolve => {
      wx.showModal({
        title: '支付确认',
        content: `支付内容：${amount}\n确认支付吗？`,
        confirmText: '确认支付',
        cancelText: '取消',
        success: (res) => resolve(!!res.confirm)
      });
    });

    if (!confirm) return;

    wx.showLoading({ title: '支付处理中...', mask: true });

    setTimeout(async () => {
      try {
        await wx.cloud.database()
          .collection('reservations')
          .doc(this.data.reservationId)
          .update({
            data: {
              status: 'paid',
              paymentTime: new Date()
            }
          });

        wx.hideLoading();
        wx.showToast({ title: '支付成功', icon: 'success' });
        setTimeout(() => this.loadReservationDetail(), 600);
      } catch (err) {
        wx.hideLoading();
        console.error('支付失败', err);
        wx.showToast({ title: '支付失败，请重试', icon: 'none' });
      }
    }, 1000);
  }
});