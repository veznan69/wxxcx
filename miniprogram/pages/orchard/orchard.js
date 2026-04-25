const { getImageUrl } = require('../../utils/imageMap.js');

Page({
  data: {
    // 替换为你的果园横幅图地址
    bannerImage: getImageUrl('banner1.png'),  // 若映射中无此图片，可先用 orange1.png 代替
    selectedChoice: 1 ,// 默认选中选项一（景区住宿套餐）
    orchardSwiperList: [
      getImageUrl('banner4.png'),
      getImageUrl('banner0.png'),
      getImageUrl('banner5.png'),
      getImageUrl('banner6.png')
    ]
  },
    // 点击图片预览大图
  previewImg(e) {
    const index = e.currentTarget.dataset.index
    wx.previewImage({
      current: this.data.orchardSwiperList[index],
      urls: this.data.orchardSwiperList
    })
  },

  goBack() {
    wx.navigateBack()
  },

  goAdopt() {
    wx.showModal({
      title: '认养提示',
      content: '即将开放线上认养功能，敬请期待！',
      showCancel: false
    })
  },

  // 选择二选一权益
  selectChoice(e) {
    const choice = parseInt(e.currentTarget.dataset.choice);
    this.setData({ selectedChoice: choice });
  },

  // 认养按钮点击事件
  adopt() {
    // 1. 登录校验（必须先登录）
    const app = getApp();
    if (!app.checkLogin()) {
      wx.switchTab({ url: '/pages/user/user' });
      return;
    }

    // 2. 确认认养弹窗（显示用户选择的权益）
    const choiceText = this.data.selectedChoice === 1 
      ? '景区住宿套餐' 
      : '农产品套餐（5只土鸡+30枚土鸡蛋）';
    
    wx.showModal({
      title: '确认认养',
      content: `您即将认养一棵赣南脐橙树，价格998元/年。\n\n您选择的权益：${choiceText}\n\n认养成功后将获得全部权益，是否确认？`,
      confirmText: '确认认养',
      success: (res) => {
        if (res.confirm) {
          this.goToPay();
        }
      }
    });
  },

  // 跳转到支付页
  goToPay() {
    // 构造认养商品对象（和普通商品格式一致）
    const adoptItem = {
      goodsId: 'adopt_' + Date.now(), // 特殊商品ID，标识认养订单
      name: '赣南脐橙树认养（1年）',
      price: 998,
      image: this.data.bannerImage,
      num: 1,
      checked: true,
      // 认养专属字段（后端预留）
      isAdopt: true,
      benefitChoice: this.data.selectedChoice, // 1=景区套餐，2=农产品套餐
      benefitChoiceText: this.data.selectedChoice === 1 
        ? '景区住宿套餐' 
        : '农产品套餐（5只土鸡+30枚土鸡蛋）'
    };

    // 存入本地缓存，供订单页读取（和现有购物车结算逻辑一致）
    wx.setStorageSync('checkoutItems', [adoptItem]);

    // 3. 跳转到现有订单确认页
    wx.navigateTo({
      url: '/pages/order/order',
      success: () => {
        // 4. 支付成功后，跳转到我的认养页（在order.js的payOrder方法中添加）
        // 【后端预留】支付成功后，后端需要：
        // - 创建认养订单
        // - 根据benefitChoice生成对应的权益包
        // - 生成果树编号
      }
    });
  }
})