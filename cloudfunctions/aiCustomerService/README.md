# AI客服云函数 - 多AI服务支持版

## 🤖 功能介绍

本云函数实现了智能客服功能，**支持多种AI服务提供商**，包括免费或有免费额度的AI服务，无需腾讯云密钥即可使用。

## ✨ 主要特性

- 🎯 **多AI服务支持**：支持7种主流AI服务
- 💬 **上下文对话**：支持多轮对话，记住最近的6轮对话历史
- 🍊 **专业客服角色**：针对赣南脐橙果园场景定制的"橙小妹"客服角色
- 🔒 **安全可靠**：所有对话记录保存在云数据库
- ⚡ **快速响应**：优化的API调用，秒级回复
- 🎨 **友好的UI**：AI消息带有特殊标识和样式
- 🆓 **免费方案**：支持免费或有免费额度的AI服务

## 🚀 支持的AI服务

| AI服务 | 状态 | 免费额度 | 推荐度 | 说明 |
|--------|------|----------|--------|------|
| **DeepSeek** | ✅ 推荐 | 有 | ⭐⭐⭐⭐⭐ | 性价比高，响应快，中文友好 |
| **Moonshot AI (Kimi)** | ✅ 推荐 | 有 | ⭐⭐⭐⭐⭐ | 新用户免费额度大，中文优秀 |
| **OpenAI (ChatGPT)** | ✅ | 无 | ⭐⭐⭐⭐ | 国际知名，需要国外手机号 |
| **智谱AI (GLM-4)** | ✅ | 有 | ⭐⭐⭐⭐ | 国产优秀模型 |
| **阿里通义千问** | ✅ | 有 | ⭐⭐⭐⭐ | 阿里云产品 |
| **百度文心一言** | ✅ | 有 | ⭐⭐⭐⭐ | 百度产品 |
| **腾讯混元** | ✅ 支持 | 有 | ⭐⭐⭐⭐⭐ | 微信AI成长计划免费Token |
| **Mock模式** | ✅ | 免费 | ⭐⭐⭐ | 内置模拟回复，无需配置 |

## 💡 推荐方案（按需求）

### 方案1：免费使用（推荐 ⭐⭐⭐⭐⭐）
**选择：DeepSeek 或 Moonshot AI**
- ✅ 完全免费或免费额度充足
- ✅ 中文支持优秀
- ✅ 响应速度快
- ✅ 注册简单，无需国外手机号

### 方案2：无需配置直接使用
**选择：Mock模式**
- ✅ 无需任何API密钥
- ✅ 零成本
- ⚠️ 功能有限（关键词匹配）

### 方案3：付费使用
**选择：OpenAI / 智谱AI / 通义千问**
- ✅ 功能强大
- ⚠️ 需要付费
- ⚠️ 可能需要企业认证

## 🔧 配置步骤

### 快速开始 - 使用Mock模式（无需配置）

直接部署云函数即可使用，无需任何配置！

### 使用DeepSeek（推荐 - 有免费额度）

#### 1. 注册DeepSeek账号
1. 访问：https://platform.deepseek.com/
2. 注册账号（支持国内手机号）
3. 完成实名认证

#### 2. 获取API密钥
1. 登录后进入"API Keys"页面
2. 点击"Create new key"
3. 复制生成的API Key

#### 3. 配置云函数环境变量

在微信开发者工具中：
1. 右键点击 `cloudfunctions/aiCustomerService` 文件夹
2. 选择"云函数管理"
3. 点击"配置"
4. 在"环境变量"中添加：

```bash
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=你的DeepSeek_API_KEY
```

#### 4. 部署云函数
右键云函数文件夹 → "上传并部署：云端安装依赖"

### 使用Moonshot AI (Kimi)（推荐 - 新用户有免费额度）

#### 1. 注册Moonshot AI账号
1. 访问：https://platform.moonshot.cn/
2. 注册账号
3. 完成实名认证

#### 2. 获取API密钥
1. 登录后进入"API Keys"页面
2. 创建API Key
3. 复制API Key

#### 3. 配置环境变量
```bash
AI_PROVIDER=moonshot
MOONSHOT_API_KEY=你的Moonshot_API_KEY
```

### 使用OpenAI (ChatGPT)

#### 1. 注册OpenAI账号
1. 访问：https://platform.openai.com/
2. 注册账号（需要国外手机号或邮箱）

#### 2. 获取API密钥
1. 登录后进入"API Keys"页面
2. 创建API Key
3. 复制API Key

#### 3. 配置环境变量
```bash
AI_PROVIDER=openai
OPENAI_API_KEY=你的OpenAI_API_KEY
```

### 使用智谱AI (GLM-4)

#### 1. 注册智谱AI账号
1. 访问：https://open.bigmodel.cn/
2. 注册账号
3. 完成实名认证

#### 2. 获取API密钥
1. 登录后进入"API Keys"页面
2. 创建API Key
3. 复制API Key

#### 3. 配置环境变量
```bash
AI_PROVIDER=zhipu
ZHIPU_API_KEY=你的智谱AI_API_KEY
```

### 使用阿里通义千问

#### 1. 注册阿里云账号
1. 访问：https://dashscope.aliyuncs.com/
2. 注册账号
3. 完成实名认证

#### 2. 获取API密钥
1. 登录后进入"API-KEY管理"
2. 创建API Key
3. 复制API Key

#### 3. 配置环境变量
```bash
AI_PROVIDER=qianwen
QIANWEN_API_KEY=你的通义千问_API_KEY
```

### 使用百度文心一言

#### 1. 注册百度智能云账号
1. 访问：https://cloud.baidu.com/
2. 注册账号
3. 完成实名认证

#### 2. 获取API密钥
1. 进入"人工智能" → "千帆大模型平台"
2. 创建应用
3. 获取 API Key 和 Secret Key

#### 3. 配置环境变量
```bash
AI_PROVIDER=wenxin
WENXIN_API_KEY=你的文心一言_API_Key
WENXIN_SECRET_KEY=你的文心一言_Secret_Key
```

### 使用腾讯混元（微信AI成长计划）⭐

#### 1. 申请腾讯云密钥
1. 通过"微信AI小程序成长计划"申请资源
2. 登录腾讯云控制台：https://console.cloud.tencent.com/
3. 进入"访问管理" → "API密钥管理"
4. 创建密钥或查看已有密钥
5. 获取 `SecretId` 和 `SecretKey`

**密钥格式**：
```
SecretId: AKIDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SecretKey: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### 2. 配置环境变量
```bash
AI_PROVIDER=hunyuan
TENCENT_SECRET_ID=你的SecretId
TENCENT_SECRET_KEY=你的SecretKey
```

#### 3. 部署云函数
1. 右键 `cloudfunctions/aiCustomerService`
2. 选择"上传并部署：云端安装依赖"
3. 等待部署完成（2-5分钟）

#### 4. 测试
在云开发控制台测试：
```json
{
  "action": "chat",
  "message": "你好",
  "userId": "test_user_123",
  "history": []
}
```

#### 5. 查看日志
如果调用失败，查看云函数日志中的错误信息：
- `Authorization签名错误`：检查 SecretId 和 SecretKey 是否正确
- `资源不存在`：检查腾讯云账户是否有混元服务权限
- `请求超时`：可能是网络问题，重试即可

## 🎮 使用方式

### 前端调用

```javascript
// 发送消息给AI客服
wx.cloud.callFunction({
  name: 'aiCustomerService',
  data: {
    action: 'chat',
    message: '脐橙多少钱一斤？',
    userId: app.globalData.openid,
    history: []  // 可选，传入历史对话上下文
  },
  success: (res) => {
    if (res.result.success) {
      console.log('AI回复:', res.result.response)
    } else {
      console.error('AI回复失败:', res.result.error)
      // 使用降级回复
      if (res.result.fallbackResponse) {
        console.log('降级回复:', res.result.fallbackResponse)
      }
    }
  }
})
```

### 获取对话历史

```javascript
wx.cloud.callFunction({
  name: 'aiCustomerService',
  data: {
    action: 'getHistory',
    userId: app.globalData.openid
  },
  success: (res) => {
    if (res.result.success) {
      console.log('对话历史:', res.result.data)
    }
  }
})
```

### 切换AI服务

```javascript
// 临时指定AI服务
wx.cloud.callFunction({
  name: 'aiCustomerService',
  data: {
    action: 'chat',
    message: '你好',
    userId: app.globalData.openid,
    AI_PROVIDER: 'deepseek'  // 临时使用DeepSeek
  }
})
```

## 📊 数据库结构

### ai_chat_history 集合

```javascript
{
  _id: "记录ID",
  userId: "用户ID",
  role: "user/assistant",
  content: "消息内容",
  createTime: "创建时间"
}
```

## 🎯 系统提示词

云函数内置了完整的客服角色定义，包括：
- 客服身份："橙小妹"，碧峰峡生态果园专属客服
- 业务范围：商品、认养、研学、订单、积分、橙友圈等
- 果园信息：地址、营业时间、联系方式
- 赣南脐橙特色：产地、特点、采摘期、存储方法
- 回答风格：热情友好、简洁明了

## 🔐 安全注意事项

1. **保护API密钥**：不要将API密钥提交到代码仓库
2. **使用环境变量**：始终通过环境变量配置密钥
3. **限制调用频率**：在前端添加防抖和限流
4. **敏感信息过滤**：不要让AI处理用户的敏感信息
5. **内容审核**：对AI回复进行内容安全检测

## 🧪 测试建议

1. **先使用Mock模式测试**
   - 无需任何配置
   - 测试页面功能和交互

2. **再使用免费AI服务测试**
   - DeepSeek 或 Moonshot AI
   - 测试真实对话效果

3. **最后部署到生产环境**
   - 选择合适的AI服务
   - 监控API调用成本

## 💰 成本对比

| AI服务 | 免费额度 | 收费标准 |
|--------|----------|----------|
| DeepSeek | 有 | ¥1/百万tokens |
| Moonshot AI | 有 | ¥12/百万tokens |
| OpenAI | 无 | $0.002/千tokens |
| 智谱AI | 有 | ¥5/百万tokens |
| 通义千问 | 有 | ¥8/百万tokens |
| 文心一言 | 有 | ¥6/百万tokens |
| Mock模式 | 无限 | 免费 |

## 📝 常见问题

### Q: 为什么推荐DeepSeek或Moonshot AI？
A: 两者都有免费额度，中文支持优秀，注册简单，无需国外手机号，适合国内开发者。

### Q: API密钥会过期吗？
A: 一般不会过期，但建议定期更换以提高安全性。

### Q: 可以同时使用多个AI服务吗？
A: 可以，通过环境变量或前端参数切换不同的AI服务。

### Q: 如何查看API调用次数和费用？
A: 登录对应的AI服务平台的控制台查看。

### Q: Mock模式能用多久？
A: Mock模式永久免费，但功能有限，仅适合测试和演示。

## 🚀 部署步骤

### 使用Mock模式（推荐用于测试）
1. 右键云函数文件夹 → "上传并部署：云端安装依赖"
2. 测试功能

### 使用真实AI服务
1. 注册AI服务平台账号
2. 获取API密钥
3. 配置云函数环境变量
4. 右键云函数文件夹 → "上传并部署：云端安装依赖"
5. 测试功能

## 📞 联系支持

如有问题，请：
1. 检查云函数日志
2. 检查环境变量配置
3. 查看AI服务平台文档
4. 联系技术支持

## 📄 相关文档

- [DeepSeek API文档](https://platform.deepseek.com/api-docs/)
- [Moonshot AI文档](https://platform.moonshot.cn/docs)
- [OpenAI文档](https://platform.openai.com/docs)
- [智谱AI文档](https://open.bigmodel.cn/dev/api)
- [通义千问文档](https://help.aliyun.com/zh/dashscope/)
- [微信云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/)

---

**祝你使用愉快！🍊**
