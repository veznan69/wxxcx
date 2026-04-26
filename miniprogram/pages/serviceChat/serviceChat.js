// pages/serviceChat/serviceChat.js
const app = getApp()

Page({
  /**
   * 页面的初始数据
   */
  data: {
    useAI: true, // 是否使用AI
    messages: [], // 消息列表
    inputText: '', // 输入框内容
    toView: '', // 滚动到指定消息
    scrollTop: 0, // 滚动位置
    loading: false, // 加载状态
    messageId: 0, // 消息ID计数器
    lastMessageTime: 0, // 上次消息时间
    keyboardHeight: 0 // 键盘高度
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadHistory()
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 自动滚动到底部
    this.scrollToBottom()
  },

  /**
   * 加载历史消息
   */
  async loadHistory() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'aiCustomerService',
        data: {
          action: 'getHistory',
          userId: app.globalData.openid || 'test_user'
        }
      })

      if (res.result && res.result.success) {
        // 检查 messages 是否存在且是数组
        const messagesList = res.result.messages || []
        const historyMessages = messagesList.map(msg => ({
          id: msg.messageId,
          content: msg.message,
          isSelf: msg.role === 'user',
          isAI: msg.role === 'assistant',
          timeStr: this.formatTime(msg.timestamp),
          showTime: this.shouldShowTime(msg.timestamp)
        }))

        // 如果没有历史消息，显示欢迎消息
        if (historyMessages.length === 0) {
          this.showWelcomeMessage()
        } else {
          this.setData({
            messages: historyMessages,
            lastMessageTime: historyMessages[historyMessages.length - 1].timestamp
          }, () => {
            this.scrollToBottom()
          })
        }
      } else {
        this.showWelcomeMessage()
      }
    } catch (error) {
      console.error('加载历史消息失败:', error)
      this.showWelcomeMessage()
    }
  },

  /**
   * 显示欢迎消息
   */
  showWelcomeMessage() {
    const welcomeMsg = {
      id: this.data.messageId++,
      content: '您好！我是橙小妹，很高兴为您服务~ 有什么可以帮助您的吗？',
      isSelf: false,
      isAI: true,
      timeStr: this.formatTime(Date.now()),
      showTime: true
    }
    this.setData({
      messages: [welcomeMsg],
      lastMessageTime: Date.now()
    }, () => {
      this.scrollToBottom()
    })
  },

  /**
   * 输入框输入事件
   */
  onInput(e) {
    this.setData({
      inputText: e.detail.value
    })
  },

  /**
   * 发送消息
   */
  async sendMessage() {
    const message = this.data.inputText.trim()

    if (!message) {
      wx.showToast({
        title: '请输入消息',
        icon: 'none'
      })
      return
    }

    // 清空输入框
    this.setData({
      inputText: ''
    })

    // 添加用户消息
    this.addMessage(message, true)

    // 如果使用AI，调用AI服务
    if (this.data.useAI) {
      await this.callAIService(message)
    }
  },

  /**
   * 添加消息到列表
   */
  addMessage(content, isSelf) {
    const now = Date.now()
    const showTime = this.shouldShowTime(now)

    const newMessage = {
      id: this.data.messageId++,
      content: content,
      isSelf: isSelf,
      isAI: !isSelf,
      timeStr: this.formatTime(now),
      showTime: showTime
    }

    this.setData({
      messages: [...this.data.messages, newMessage],
      lastMessageTime: now
    }, () => {
      this.scrollToBottom()
    })
  },

  /**
   * 调用AI服务
   */
  async callAIService(message) {
    // 添加正在输入状态
    const typingMessage = {
      id: this.data.messageId++,
      content: '',
      isSelf: false,
      isAI: true,
      isTyping: true
    }

    this.setData({
      messages: [...this.data.messages, typingMessage]
    }, () => {
      this.scrollToBottom()
    })

    try {
      // 构建历史对话（最近6轮）
      const recentMessages = this.data.messages
        .filter(msg => !msg.isTyping)
        .slice(-12) // 取最后6轮对话（12条消息）
        .map(msg => ({
          role: msg.isSelf ? 'user' : 'assistant',
          content: msg.content
        }))

      console.log('📤 开始调用AI客服...')
      console.log('发送消息:', message)
      console.log('历史对话:', recentMessages)

      const res = await wx.cloud.callFunction({
        name: 'aiCustomerService',
        data: {
          action: 'chat',
          message: message,
          userId: app.globalData.openid || 'test_user',
          history: recentMessages
        }
      })

      console.log('📥 AI客服返回结果:', res.result)

      if (res.result && res.result.success) {
        // 移除正在输入状态
        this.removeTypingMessage()

        // 添加AI回复
        this.addMessage(res.result.response, false)
      } else {
        // 移除正在输入状态
        this.removeTypingMessage()

        // 显示错误提示
        wx.showToast({
          title: res.result?.error || 'AI客服暂时无法回复',
          icon: 'none'
        })

        // 添加错误消息
        this.addMessage('抱歉，AI客服遇到了点小问题 🙈 您可以直接联系人工客服：400-888-8888', false)
      }
    } catch (error) {
      console.error('AI客服调用失败:', error)

      // 移除正在输入状态
      this.removeTypingMessage()

      wx.showToast({
        title: '网络异常，请稍后重试',
        icon: 'none'
      })

      // 添加错误消息
      this.addMessage('网络异常，请稍后重试...', false)
    }
  },

  /**
   * 移除正在输入状态
   */
  removeTypingMessage() {
    const messages = this.data.messages.filter(msg => !msg.isTyping)
    this.setData({ messages })
  },

  /**
   * 滚动到底部
   */
  scrollToBottom() {
    const messages = this.data.messages
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      this.setData({
        toView: 'msg-' + lastMessage.id,
        scrollTop: 999999
      })
    }
  },

  /**
   * 判断是否显示时间
   */
  shouldShowTime(timestamp) {
    if (!this.data.lastMessageTime) {
      return true
    }
    const diff = timestamp - this.data.lastMessageTime
    return diff > 5 * 60 * 1000 // 超过5分钟才显示时间
  },

  /**
   * 格式化时间
   */
  formatTime(timestamp) {
    const date = new Date(timestamp)
    const hour = date.getHours().toString().padStart(2, '0')
    const minute = date.getMinutes().toString().padStart(2, '0')
    return `${hour}:${minute}`
  },

  // 输入框失去焦点时，强制重置键盘高度
  onInputBlur() {
    console.log('输入框失焦，重置键盘高度')
    this.setData({ keyboardHeight: 0 })
    this.scrollToBottom()
  },

  // 点击消息列表区域，收起键盘
  onMessageListTap() {
    // 让输入框失去焦点，触发 onInputBlur
    wx.hideKeyboard()
  },

  /**
   * 键盘高度变化事件
   */
  onKeyboardHeightChange(e) {
    const height = e.detail.height
    console.log('键盘高度变化:', height)
  
    // ✅ 键盘完全收起时，立即还原位置
    if (height === 0) {
      this.setData({ keyboardHeight: 0 })
      this.scrollToBottom()
      return
    }
  
    // 键盘弹出时，更新高度并滚动到底部
    this.setData({ keyboardHeight: height }, () => {
      this.scrollToBottom()
    })
  }
})
