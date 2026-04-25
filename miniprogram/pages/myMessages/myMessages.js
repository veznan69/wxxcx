Page({
  data: {
    list: [],
    loading: false
  },

  onShow() {
    this.loadMessages();
  },

  formatTime(dateLike) {
    if (!dateLike) return '';
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  },

  async loadMessages() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'messageCenter',
        data: { action: 'list', limit: 200 }
      });
      const result = (res && res.result) || {};
      if (!result.success) {
        throw new Error(result.error || '加载消息失败');
      }
      const list = (result.list || []).map(item => ({
        ...item,
        createTimeStr: this.formatTime(item.createTime)
      }));
      this.setData({ list });
    } catch (err) {
      console.error('load messages failed', err);
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async onTapMessage(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    const current = this.data.list.find(item => item._id === id);
    if (!current || current.read) return;

    try {
      await wx.cloud.callFunction({
        name: 'messageCenter',
        data: { action: 'markRead', id }
      });
      this.setData({
        list: this.data.list.map(item => item._id === id ? { ...item, read: true } : item)
      });

      // 更新全局未读消息状态
      const app = getApp();
      await app.checkUnreadMessages();
    } catch (err) {
      console.error('mark read failed', err);
    }
  },

  async markAllRead() {
    try {
      await wx.cloud.callFunction({
        name: 'messageCenter',
        data: { action: 'markAllRead' }
      });
      this.setData({
        list: this.data.list.map(item => ({ ...item, read: true }))
      });
      wx.showToast({ title: '已全部设为已读', icon: 'success' });

      // 更新全局未读消息状态
      const app = getApp();
      await app.checkUnreadMessages();
    } catch (err) {
      console.error('mark all read failed', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  }
});
