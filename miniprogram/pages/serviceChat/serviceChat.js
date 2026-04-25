// pages/serviceChat/serviceChat.js
Page({
  data: {
    messages: [],
    inputText: '',
    toView: '',
    loading: false,
    // 管理员的 openid（固定值）
    adminOpenid: 'ojWd418mR3Z_TqtUeq5wJo4BisdQ'
  },

  onLoad(options) {
    // 检查登录
    const app = getApp();
    if (!app.globalData.userInfo) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    // 加载历史消息
    this.loadMessages();

    // 添加欢迎消息（如果消息列表为空）
    setTimeout(() => {
      if (this.data.messages.length === 0) {
        this.addSystemMessage('您好！有什么可以帮助您的？');
      }
    }, 500);
  },

  // 加载历史消息
  async loadMessages() {
    this.setData({ loading: true });
    try {
      const app = getApp();
      const db = wx.cloud.database();

      const res = await db.collection('chat_messages')
        .where({
          $or: [
            { fromOpenid: app.globalData.userInfo.openid, toOpenid: this.data.adminOpenid },
            { fromOpenid: this.data.adminOpenid, toOpenid: app.globalData.userInfo.openid }
          ]
        })
        .orderBy('createTime', 'asc')
        .get();

      // 格式化消息数据
      const messages = res.data.map((msg, index) => ({
        id: msg._id || index,
        content: msg.content,
        isSelf: msg.fromOpenid === app.globalData.userInfo.openid,
        createTime: msg.createTime,
        timeStr: this.formatTime(msg.createTime),
        // 每5条消息显示一次时间
        showTime: index % 5 === 0
      }));

      this.setData({ 
        messages,
        loading: false
      });

      // 滚动到底部
      this.scrollToBottom();
    } catch (err) {
      console.error('加载消息失败', err);
      this.setData({ loading: false });
    }
  },

  // 输入框输入事件
  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  // 发送消息
  async sendMessage() {
    const content = this.data.inputText.trim();
    if (!content) return;

    const app = getApp();
    const now = new Date();
    
    // 构建消息对象
    const newMessage = {
      id: Date.now(),
      content: content,
      isSelf: true,
      createTime: now,
      timeStr: this.formatTime(now),
      showTime: this.data.messages.length % 5 === 0
    };

    // 添加到消息列表
    const messages = [...this.data.messages, newMessage];
    this.setData({ 
      messages,
      inputText: '',
      toView: 'msg-' + newMessage.id
    });

    // 保存到数据库
    try {
      const db = wx.cloud.database();
      await db.collection('chat_messages').add({
        data: {
          fromOpenid: app.globalData.userInfo.openid,
          toOpenid: this.data.adminOpenid,
          content: content,
          createTime: db.serverDate(),
          read: false
        }
      });

      console.log('消息发送成功');
    } catch (err) {
      console.error('发送消息失败', err);
      wx.showToast({ title: '发送失败', icon: 'none' });
    }

    // 滚动到底部
    this.scrollToBottom();
  },

  // 添加系统消息
  addSystemMessage(content) {
    const now = new Date();
    const systemMessage = {
      id: Date.now(),
      content: content,
      isSelf: false,
      createTime: now,
      timeStr: this.formatTime(now),
      showTime: true,
      isSystem: true
    };

    this.setData({
      messages: [...this.data.messages, systemMessage],
      toView: 'msg-' + systemMessage.id
    });

    this.scrollToBottom();
  },

  // 滚动到底部
  scrollToBottom() {
    setTimeout(() => {
      if (this.data.messages.length > 0) {
        const lastId = this.data.messages[this.data.messages.length - 1].id;
        this.setData({ toView: 'msg-' + lastId });
      }
    }, 100);
  },

  // 格式化时间
  formatTime(date) {
    if (!date) return '';
    
    // 处理数据库时间格式
    let d = date;
    if (date.$date) {
      d = new Date(date.$date);
    } else if (typeof date === 'string') {
      d = new Date(date);
    }

    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const oneMinute = 60 * 1000;
    const oneHour = 60 * oneMinute;
    const oneDay = 24 * oneHour;

    if (diff < oneMinute) {
      return '刚刚';
    } else if (diff < oneHour) {
      return Math.floor(diff / oneMinute) + '分钟前';
    } else if (diff < oneDay) {
      return Math.floor(diff / oneHour) + '小时前';
    } else if (diff < 7 * oneDay) {
      return Math.floor(diff / oneDay) + '天前';
    } else {
      const month = d.getMonth() + 1;
      const day = d.getDate();
      return `${month}月${day}日`;
    }
  }
});
