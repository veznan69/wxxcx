const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  console.log('===== updateCartChecked 被调用 =====')  // ✅ 入口日志
  console.log('接收到的参数:', event)                 // 可选：打印传入参数
  
  const { goodsId, checked } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  console.log('===== updateCartChecked 被调用 =====')
  console.log('goodsId:', goodsId, 'checked:', checked)
  console.log('openid:', openid)

  if (!openid) {
    console.error('openid 为空，无法更新')
    return { success: false, error: '未获取到用户身份' }
  }

  const cartCollection = db.collection('carts')
  const cartRecord = await cartCollection.where({ _openid: openid }).get()
  if (cartRecord.data.length === 0) {
    console.error('购物车不存在')
    return { success: false, error: '购物车不存在' }
  }

  const cartId = cartRecord.data[0]._id
  const items = cartRecord.data[0].items
  const targetItem = items.find(item => String(item.goodsId) === String(goodsId))
  
  if (!targetItem) {
    console.error('未找到对应商品')
    return { success: false, error: '商品不存在' }
  }
  
  targetItem.checked = checked
  await cartCollection.doc(cartId).update({ data: { items } })
  
  console.log('更新成功')
  return { success: true }
}