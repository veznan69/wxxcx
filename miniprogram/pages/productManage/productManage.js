Page({
  data: {
    role: 'user',
    isAdmin: false,
    activeTab: 'my',
    myGoods: [],
    allGoods: [],
    list: [],
    loading: false
  },

  onShow() {
    const app = getApp();
    const role = app.globalData.userInfo && app.globalData.userInfo.role
      ? app.globalData.userInfo.role
      : 'user';

    if (role !== 'merchant' && role !== 'admin') {
      wx.showToast({ title: '无权限访问', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }

    this.setData({
      role,
      isAdmin: role === 'admin',
      activeTab: 'my'
    }, () => {
      this.loadGoods(false);
    });
  },

  async callGoodsCenter(action, data) {
    const res = await wx.cloud.callFunction({
      name: 'goodsCenter',
      data: { action, data: data || {} }
    });
    const result = (res && res.result) || {};
    if (!result.success) {
      throw new Error(result.error || '操作失败');
    }
    return result;
  },

  normalizeItem(item) {
    return {
      ...item,
      statusText: item.status === 'approved'
        ? '已审核'
        : (item.status === 'pending' ? '待审核' : (item.status === 'rejected' ? '已驳回' : '未知')),
      shelfText: item.onShelf ? '上架中' : '已下架'
    };
  },

  isCollectionNotExistsError(err) {
    if (!err) return false;
    const msg = String(err.message || '');
    const errMsg = String(err.errMsg || '');
    return err.errCode === -502005
      || msg.includes('DATABASE_COLLECTION_NOT_EXIST')
      || msg.includes('database collection not exists')
      || errMsg.includes('-502005');
  },

  async tryInitDatabase() {
    try {
      await wx.cloud.callFunction({ name: 'initDatabase', data: {} });
      return true;
    } catch (err) {
      console.error('initDatabase failed', err);
      return false;
    }
  },

  async loadGoods(hasRetried) {
    this.setData({ loading: true });
    try {
      const myRes = await this.callGoodsCenter('listMyGoods');
      const myGoods = (myRes.data || []).map(item => this.normalizeItem(item));
      let allGoods = [];

      if (this.data.isAdmin) {
        const allRes = await this.callGoodsCenter('listAllGoods');
        allGoods = (allRes.data || []).map(item => this.normalizeItem(item));
      }

      this.setData({
        myGoods,
        allGoods,
        list: this.data.isAdmin && this.data.activeTab === 'all' ? allGoods : myGoods
      });
    } catch (err) {
      console.error('load goods failed', err);

      if (!hasRetried && this.isCollectionNotExistsError(err)) {
        wx.showLoading({ title: '初始化商品库...' });
        const ok = await this.tryInitDatabase();
        wx.hideLoading();
        if (ok) {
          return this.loadGoods(true);
        }
      }

      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      this.setData({ myGoods: [], allGoods: [], list: [] });
    } finally {
      this.setData({ loading: false });
    }
  },

  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.activeTab) return;
    this.setData({
      activeTab: tab,
      list: this.data.isAdmin && tab === 'all' ? this.data.allGoods : this.data.myGoods
    });
  },

  async onToggleShelf(e) {
    const id = e.currentTarget.dataset.id;
    const status = e.currentTarget.dataset.status;
    const onShelf = !!e.currentTarget.dataset.onshelf;
    if (!id) return;

    // 如果商品状态是驳回，跳转到"再次提交"页面
    if (status === 'rejected') {
      wx.navigateTo({
        url: `/pages/addGoods/addGoods?resubmitId=${id}`
      });
      return;
    }

    // 正常的上架/下架逻辑
    const targetStatus = !onShelf;
    const actionText = targetStatus ? '上架' : '下架';

    const ok = await new Promise((resolve) => {
      wx.showModal({
        title: `确认${actionText}`,
        content: `确定要${actionText}该商品吗？`,
        success: (res) => resolve(!!res.confirm)
      });
    });
    if (!ok) return;

    wx.showLoading({ title: '处理中...' });
    try {
      const result = await this.callGoodsCenter('toggleShelf', { id, onShelf: targetStatus });
      if (result.pending) {
        wx.showToast({ title: '已提交审核', icon: 'none' });
      } else {
        wx.showToast({ title: `${actionText}成功`, icon: 'success' });
      }
      this.loadGoods(false);
    } catch (err) {
      console.error('toggle shelf failed', err);
      wx.showToast({ title: err.message || `${actionText}失败`, icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async onDeleteGoods(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    const ok = await new Promise((resolve) => {
      wx.showModal({
        title: '确认删除',
        content: '确定要删除该商品吗？删除后无法恢复！',
        confirmColor: '#ff0000',
        success: (res) => resolve(!!res.confirm)
      });
    });
    if (!ok) return;

    wx.showLoading({ title: '删除中...' });
    try {
      const result = await this.callGoodsCenter('deleteGoods', { id });
      if (result.success) {
        wx.showToast({ title: '删除成功', icon: 'success' });
        this.loadGoods(false);
      }
    } catch (err) {
      console.error('delete goods failed', err);
      wx.showToast({ title: err.message || '删除失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onEditGoods(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    if (this.data.isAdmin && this.data.activeTab === 'all') {
      wx.navigateTo({
        url: `/pages/admin/goodsFullEdit/goodsFullEdit?id=${id}`
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/editGoods/editGoods?id=${id}`
    });
  },

  onAddGoods() {
    wx.navigateTo({
      url: '/pages/addGoods/addGoods'
    });
  }
});
