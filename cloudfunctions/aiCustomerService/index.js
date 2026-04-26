// 云函数入口文件
const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const https = require('https')
const http = require('http')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const SAFE_EXCLUDE_FIELDS = {
  users: ['_openid', 'role']
}
const DB_PAGE_SIZE = Number(process.env.AI_DB_PAGE_SIZE || 100)

// AI服务提供商配置
const AI_PROVIDER = process.env.AI_PROVIDER || 'mock' // 可选: deepseek, openai, moonshot, zhipu, qianwen, wenxin, hunyuan, mock

// AI服务API配置（通过环境变量配置）
const AI_CONFIGS = {
  // DeepSeek (推荐 - 有免费额度)
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat'
  },

  // OpenAI (ChatGPT)
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-3.5-turbo'
  },

  // Moonshot AI (Kimi - 新用户有免费额度)
  moonshot: {
    apiKey: process.env.MOONSHOT_API_KEY,
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    model: 'moonshot-v1-8k'
  },

  // 智谱AI (GLM-4)
  zhipu: {
    apiKey: process.env.ZHIPU_API_KEY,
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-4'
  },

  // 阿里通义千问
  qianwen: {
    apiKey: process.env.QIANWEN_API_KEY,
    endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    model: 'qwen-turbo'
  },

  // 百度文心一言
  wenxin: {
    apiKey: process.env.WENXIN_API_KEY,
    secretKey: process.env.WENXIN_SECRET_KEY,
    endpoint: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions',
    model: 'ERNIE-Bot'
  },

  // 腾讯混元
  hunyuan: {
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY,
    endpoint: 'https://hunyuan.tencentcloudapi.com/',
    model: 'hunyuan-pro'
  }
}

/**
 * 系统提示词 - 针对赣南脐橙小程序客服场景
 */
const SYSTEM_PROMPT = `你现在是"赣南脐橙生态果园"的智能客服助手，你的名字叫"橙小妹"。

【你的身份】
- 你是碧峰峡生态果园的专属客服
- 你的名字叫"橙小妹"
- 你的性格：热情、专业、亲切

【你的业务范围】
1. 商品咨询：赣南脐橙、农特产等商品信息
2. 果园认养：果树认养流程、价格、权益
3. 研学课程：采摘体验、科普课程、预约方式
4. 订单服务：订单查询、物流追踪、售后问题
5. 积分商城：积分获取、兑换规则
6. 橙友圈：发帖规则、点赞评论
7. 其他：果园地址、营业时间、联系方式

【果园信息】
- 果园名称：碧峰峡生态果园
- 地址：江西省赣州市信丰县（假设地址）
- 营业时间：每天 8:00-18:00
- 联系电话：400-888-8888（假设）

【赣南脐橙特色】
- 产地：江西省赣州市
- 特点：果肉饱满、汁多味甜、营养丰富
- 采摘期：每年11月-次年2月
- 存储方法：常温保存10-15天，冷藏可延长至30天

【回答风格】
1. 热情友好，称呼用户为"亲"或"您好"
2. 回答简洁明了，避免长篇大论
3. 如果不确定，诚实告知，引导联系人工客服
4. 涉及具体操作时，提供清晰的步骤
5. 可以适当使用表情符号增加亲和力

【注意事项】
- 不要编造不存在的功能或信息
- 如果超出客服范围，礼貌引导
- 保护用户隐私，不要询问敏感信息
- 对于投诉建议，引导用户通过反馈渠道提交

【示例对话】
用户：脐橙多少钱一斤？
橙小妹：亲，我们的赣南脐橙价格根据规格不同而变化哦~ 5斤装29.9元，10斤装59.9元，20斤装99.9元，都是产地直发，新鲜直达！🍊

用户：如何认养果树？
橙小妹：您好呀！认养果树很简单呢~ 1.进入"果园认养"页面 2.选择心仪的果树 3.填写认养信息 4.完成支付。认养后您可以享受果树挂牌、生长周期更新、优先采摘等权益哦~`

/**
 * 云函数入口函数
 */
exports.main = async (event, context) => {
  const { action, message, userId, history = [], AI_PROVIDER: eventProvider } = event

  console.log('AI客服云函数调用:', action, message, eventProvider)

  // 根据不同action执行不同操作
  switch (action) {
    case 'chat':
      return await chatWithAI(message, userId, history, eventProvider)

    case 'getHistory':
      return await getChatHistory(userId)

    default:
      return {
        success: false,
        error: '未知操作类型'
      }
  }
}

/**
 * 与AI对话
 */
async function chatWithAI(message, userId, history = [], eventProvider = null) {
  try {
    // 获取AI服务提供商（优先使用前端传入的，否则使用环境变量）
    const provider = eventProvider || AI_PROVIDER
    console.log('使用AI服务:', provider)

    // 检查AI服务配置
    const config = AI_CONFIGS[provider]

    if (provider === 'mock') {
      // 使用模拟回复
      console.log('使用模拟回复模式')
      const mockResponse = generateMockResponse(message)
      await saveChatRecord(userId, message, mockResponse)
      return { success: true, response: mockResponse }
    }

    if (!config) {
      console.error('AI服务配置不存在:', provider)
      return {
        success: false,
        error: 'AI服务配置异常',
        fallbackResponse: '抱歉，AI客服暂时无法使用，您可以留言给人工客服哦~'
      }
    }

    // 检查API密钥
    if (!config.apiKey && !config.secretId) {
      console.error('AI服务API密钥未配置:', provider)
      return {
        success: false,
        error: 'AI服务密钥未配置',
        fallbackResponse: '抱歉，AI客服暂时无法使用，您可以留言给人工客服哦~'
      }
    }

    // 构建对话上下文
    const dbContext = await buildDatabaseContextForAI()
    const messages = [
      { role: 'system', content: buildSystemPromptWithDbContext(dbContext) },
      ...history.slice(-6), // 只保留最近6轮对话上下文
      { role: 'user', content: message }
    ]

    console.log('发送到AI服务的消息数:', messages.length)

    // 调用AI服务API
    const aiResponse = await callAIAPI(provider, messages, config)

    // 保存对话记录
    await saveChatRecord(userId, message, aiResponse)

    return {
      success: true,
      response: aiResponse
    }

  } catch (error) {
    console.error('AI对话失败:', error)

    // 返回友好的错误提示和备用回复
    return {
      success: false,
      error: error.message,
      fallbackResponse: '抱歉，AI客服遇到了点小问题 🙈 您可以直接联系人工客服：400-888-8888'
    }
  }
}

/**
 * 调用AI服务API（通用函数）
 */
async function callAIAPI(provider, messages, config) {
  console.log(`调用 ${provider} API...`)

  switch (provider) {
    case 'deepseek':
      return await callDeepSeekAPI(messages, config)
    case 'openai':
      return await callOpenAIAPI(messages, config)
    case 'moonshot':
      return await callMoonshotAPI(messages, config)
    case 'zhipu':
      return await callZhipuAPI(messages, config)
    case 'qianwen':
      return await callQianwenAPI(messages, config)
    case 'wenxin':
      return await callWenxinAPI(messages, config)
    case 'hunyuan':
      return await callHunyuanAPI(messages, config)
    default:
      throw new Error(`不支持的AI服务: ${provider}`)
  }
}

/**
 * 调用 DeepSeek API (推荐 - 有免费额度)
 */
async function callDeepSeekAPI(messages, config) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: config.model,
      messages: messages,
      temperature: 0.7
    })

    const options = {
      hostname: 'api.deepseek.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      }
    }

    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try {
          const response = JSON.parse(body)
          if (response.choices && response.choices[0]) {
            resolve(response.choices[0].message.content)
          } else {
            reject(new Error('DeepSeek API响应格式错误'))
          }
        } catch (e) {
          reject(e)
        }
      })
    })

    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

/**
 * 调用 OpenAI API (ChatGPT)
 */
async function callOpenAIAPI(messages, config) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: config.model,
      messages: messages,
      temperature: 0.7
    })

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      }
    }

    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try {
          const response = JSON.parse(body)
          if (response.choices && response.choices[0]) {
            resolve(response.choices[0].message.content)
          } else {
            reject(new Error('OpenAI API响应格式错误'))
          }
        } catch (e) {
          reject(e)
        }
      })
    })

    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

/**
 * 调用 Moonshot API (Kimi - 新用户有免费额度)
 */
async function callMoonshotAPI(messages, config) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: config.model,
      messages: messages,
      temperature: 0.7
    })

    const options = {
      hostname: 'api.moonshot.cn',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      }
    }

    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try {
          const response = JSON.parse(body)
          if (response.choices && response.choices[0]) {
            resolve(response.choices[0].message.content)
          } else {
            reject(new Error('Moonshot API响应格式错误'))
          }
        } catch (e) {
          reject(e)
        }
      })
    })

    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

/**
 * 调用智谱AI API (GLM-4)
 */
async function callZhipuAPI(messages, config) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: config.model,
      messages: messages,
      temperature: 0.7
    })

    const options = {
      hostname: 'open.bigmodel.cn',
      path: '/api/paas/v4/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      }
    }

    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try {
          const response = JSON.parse(body)
          if (response.choices && response.choices[0]) {
            resolve(response.choices[0].message.content)
          } else {
            reject(new Error('智谱AI API响应格式错误'))
          }
        } catch (e) {
          reject(e)
        }
      })
    })

    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

/**
 * 调用阿里通义千问API
 */
async function callQianwenAPI(messages, config) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: config.model,
      input: {
        messages: messages
      },
      parameters: {
        temperature: 0.7
      }
    })

    const options = {
      hostname: 'dashscope.aliyuncs.com',
      path: '/api/v1/services/aigc/text-generation/generation',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      }
    }

    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try {
          const response = JSON.parse(body)
          if (response.output && response.output.choices && response.output.choices[0]) {
            resolve(response.output.choices[0].message.content)
          } else {
            reject(new Error('通义千问API响应格式错误'))
          }
        } catch (e) {
          reject(e)
        }
      })
    })

    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

/**
 * 调用百度文心一言API
 */
async function callWenxinAPI(messages, config) {
  return new Promise(async (resolve, reject) => {
    try {
      // 文心一言需要先获取access_token
      const accessToken = await getWenxinAccessToken(config.apiKey, config.secretKey)

      const data = JSON.stringify({
        messages: messages
      })

      const options = {
        hostname: 'aip.baidubce.com',
        path: `/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions?access_token=${accessToken}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }

      const req = https.request(options, (res) => {
        let body = ''
        res.on('data', chunk => body += chunk)
        res.on('end', () => {
          try {
            const response = JSON.parse(body)
            if (response.result) {
              resolve(response.result)
            } else {
              reject(new Error('文心一言API响应格式错误'))
            }
          } catch (e) {
            reject(e)
          }
        })
      })

      req.on('error', reject)
      req.write(data)
      req.end()
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * 获取文心一言 access_token
 */
function getWenxinAccessToken(apiKey, secretKey) {
  return new Promise((resolve, reject) => {
    const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`

    https.get(url, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try {
          const response = JSON.parse(body)
          if (response.access_token) {
            resolve(response.access_token)
          } else {
            reject(new Error('获取文心一言 access_token 失败'))
          }
        } catch (e) {
          reject(e)
        }
      })
    }).on('error', reject)
  })
}

/**
 * 腾讯云API签名工具函数
 */
function getTencentCloudAuthorization(secretId, secretKey, action, version, payload, endpoint, service) {
  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date(timestamp * 1000).toISOString().substr(0, 10)

  // 1. 拼接规范请求串
  const httpRequestMethod = 'POST'
  const canonicalUri = '/'
  const canonicalQueryString = ''
  const canonicalHeaders = `content-type:application/json\nhost:${endpoint}\n`
  const signedHeaders = 'content-type;host'
  const hashedRequestPayload = crypto.createHash('sha256').update(payload).digest('hex')
  const canonicalRequest = `${httpRequestMethod}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${hashedRequestPayload}`

  // 2. 拼接待签名字符串
  const credentialScope = `${date}/${service}/tc3_request`
  const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`

  // 3. 计算签名
  const secretDate = crypto.createHmac('sha256', `TC3${secretKey}`).update(date).digest()
  const secretService = crypto.createHmac('sha256', secretDate).update(service).digest()
  const secretSigning = crypto.createHmac('sha256', secretService).update('tc3_request').digest()
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex')

  // 4. 拼接Authorization
  const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  return {
    Authorization: authorization,
    'X-TC-Action': action,
    'X-TC-Timestamp': timestamp,
    'X-TC-Version': version,
    'X-TC-Region': 'ap-guangzhou',
    'Content-Type': 'application/json',
    'Host': endpoint
  }
}

/**
 * 调用腾讯混元API
 */
async function callHunyuanAPI(messages, config) {
  return new Promise((resolve, reject) => {
    try {
      const payload = JSON.stringify({
        Model: config.model,
        Messages: messages.map(msg => ({
          Role: msg.role,
          Content: msg.content
        })),
        Stream: false
      })

      const endpoint = 'hunyuan.tencentcloudapi.com'
      const action = 'ChatCompletions'
      const version = '2023-09-01'

      const headers = getTencentCloudAuthorization(
        config.secretId,
        config.secretKey,
        action,
        version,
        payload,
        endpoint,
        'hunyuan'
      )

      console.log('调用腾讯混元API，请求头:', JSON.stringify(headers))

      const options = {
        hostname: endpoint,
        path: '/',
        method: 'POST',
        headers: headers
      }

      const req = https.request(options, (res) => {
        let body = ''
        res.on('data', chunk => body += chunk)
        res.on('end', () => {
          try {
            console.log('腾讯混元API响应:', body)

            const response = JSON.parse(body)

            // 检查是否有错误
            if (response.Response && response.Response.Error) {
              reject(new Error(`腾讯混元API错误: ${response.Response.Error.Message} (${response.Response.Error.Code})`))
              return
            }

            // 解析成功响应
            if (response.Response && response.Response.Choices && response.Response.Choices[0]) {
              resolve(response.Response.Choices[0].Message.Content)
            } else {
              reject(new Error('腾讯混元API响应格式错误: ' + JSON.stringify(response)))
            }
          } catch (e) {
            console.error('解析腾讯混元响应失败:', e)
            reject(new Error('腾讯混元API响应解析失败: ' + e.message))
          }
        })
      })

      req.on('error', (error) => {
        console.error('腾讯混元API请求失败:', error)
        reject(error)
      })

      req.write(payload)
      req.end()
    } catch (error) {
      console.error('调用混元API失败:', error)
      reject(error)
    }
  })
}

function buildSystemPromptWithDbContext(dbContext) {
  if (!dbContext) {
    return SYSTEM_PROMPT
  }
  return `${SYSTEM_PROMPT}\n\n【云数据库实时数据（已脱敏）】\n${dbContext}`
}

async function buildDatabaseContextForAI() {
  try {
    const collectionsRes = await db.listCollections()
    const collections = (collectionsRes.collections || []).map(item => item.name).filter(Boolean)
    const context = {}

    for (const collectionName of collections) {
      context[collectionName] = await fetchAllDocsFromCollection(collectionName)
    }

    return JSON.stringify(context)
  } catch (error) {
    console.error('构建数据库上下文失败:', error)
    return ''
  }
}

async function fetchAllDocsFromCollection(collectionName) {
  const docs = []
  let skip = 0

  while (true) {
    const res = await db.collection(collectionName).skip(skip).limit(DB_PAGE_SIZE).get()
    const rows = (res && Array.isArray(res.data)) ? res.data : []

    if (!rows.length) {
      break
    }

    for (const doc of rows) {
      docs.push(sanitizeCollectionDoc(collectionName, doc))
    }

    if (rows.length < DB_PAGE_SIZE) {
      break
    }

    skip += DB_PAGE_SIZE
  }

  return docs
}

function sanitizeCollectionDoc(collectionName, doc) {
  if (!doc || typeof doc !== 'object') {
    return doc
  }

  const safeDoc = { ...doc }
  const blockedFields = SAFE_EXCLUDE_FIELDS[collectionName] || []
  for (const field of blockedFields) {
    if (Object.prototype.hasOwnProperty.call(safeDoc, field)) {
      delete safeDoc[field]
    }
  }

  return safeDoc
}

/**
 * 生成模拟回复（用于测试，实际使用时删除）
 * TODO: 替换为真实的腾讯混元API调用
 */
function generateMockResponse(userMessage) {
  const lowerMessage = userMessage.toLowerCase()

  // 简单的关键词匹配回复
  if (lowerMessage.includes('价格') || lowerMessage.includes('多少钱')) {
    return '亲，我们的赣南脐橙价格根据规格不同而变化哦~ 5斤装29.9元，10斤装59.9元，20斤装99.9元，都是产地直发，新鲜直达！🍊'
  }

  if (lowerMessage.includes('认养') || lowerMessage.includes('果树')) {
    return '您好呀！认养果树很简单呢~ 1.进入"果园认养"页面 2.选择心仪的果树 3.填写认养信息 4.完成支付。认养后您可以享受果树挂牌、生长周期更新、优先采摘等权益哦~'
  }

  if (lowerMessage.includes('地址') || lowerMessage.includes('位置') || lowerMessage.includes('在哪里')) {
    return '我们的果园位于江西省赣州市信丰县碧峰峡，营业时间是每天8:00-18:00，欢迎您来采摘体验哦~ 🍊'
  }

  if (lowerMessage.includes('订单') || lowerMessage.includes('查询')) {
    return '亲，您可以在"我的-我的订单"中查看订单详情和物流信息哦~ 如果有其他问题，我也可以帮您查询呢~'
  }

  if (lowerMessage.includes('积分') || lowerMessage.includes('兑换')) {
    return '关于积分商城：您可以通过每日签到、购买商品、橙友圈发帖等方式获取积分~ 积分可以在积分商城兑换精美礼品哦！详细规则请查看"积分规则"页面~'
  }

  if (lowerMessage.includes('客服') || lowerMessage.includes('人工')) {
    return '亲，如果您需要人工客服帮助，可以拨打我们的客服热线：400-888-8888，或者在"我的-客服聊天"中留言，我们会尽快回复您~'
  }

  // 默认回复
  return '亲，我明白了~ 关于这个问题，您可以详细说明一下吗？或者您也可以查看相关页面的帮助说明哦~ 如果问题比较复杂，我建议您联系人工客服：400-888-8888'
}

/**
 * 保存对话记录
 */
async function saveChatRecord(userId, userMessage, aiResponse) {
  try {
    const baseTs = Date.now()
    const now = new Date(baseTs)

    // 保存用户消息
    await db.collection('ai_chat_history').add({
      data: {
        userId: userId || 'guest',
        role: 'user',
        content: userMessage,
        createTime: now,
        seq: baseTs * 10
      }
    })

    // 保存AI回复
    await db.collection('ai_chat_history').add({
      data: {
        userId: userId || 'guest',
        role: 'assistant',
        content: aiResponse,
        createTime: now,
        seq: baseTs * 10 + 1
      }
    })

    console.log('对话记录保存成功')

  } catch (error) {
    console.error('保存对话记录失败:', error)
    // 保存失败不影响主流程
  }
}

/**
 * 获取对话历史
 */
async function getChatHistory(userId) {
  try {
    const res = await db.collection('ai_chat_history')
      .where({ userId: userId || 'guest' })
      .orderBy('createTime', 'desc')
      .limit(20)
      .get()

    // 稳定排序：先按时间，再按 seq；无 seq 的旧数据同时间按 user 在前
    const messages = res.data
      .sort((a, b) => {
        const ta = a.createTime ? new Date(a.createTime).getTime() : 0
        const tb = b.createTime ? new Date(b.createTime).getTime() : 0
        if (ta !== tb) return ta - tb
        const sa = typeof a.seq === 'number' ? a.seq : (a.role === 'user' ? 0 : 1)
        const sb = typeof b.seq === 'number' ? b.seq : (b.role === 'user' ? 0 : 1)
        if (sa !== sb) return sa - sb
        return String(a._id || '').localeCompare(String(b._id || ''))
      })
      .map(item => ({
        messageId: item._id,
        role: item.role,
        content: item.content,
        message: item.content,
        createTime: item.createTime,
        timestamp: item.createTime ? new Date(item.createTime).getTime() : Date.now()
      }))

    return {
      success: true,
      data: messages,
      messages
    }

  } catch (error) {
    console.error('获取对话历史失败:', error)
    return {
      success: false,
      error: error.message,
      data: [],
      messages: []
    }
  }
}
