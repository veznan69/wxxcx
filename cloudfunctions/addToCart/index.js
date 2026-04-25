const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { goodsId, num = 1, sku } = event   // ✅ 接收规格对象
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  const cartCollection = db.collection('carts')
  let cartRecord = await cartCollection.where({ _openid: openid }).get()

  // 构造购物车项
  const newItem = {
    goodsId,
    num,
    checked: true
  }
  if (sku) {
    newItem.skuId = sku.id
    newItem.skuName = sku.name
    newItem.price = sku.price
    newItem.image = sku.image
  }

  if (cartRecord.data.length === 0) {
    await cartCollection.add({
      data: {
        _openid: openid,
        items: [newItem],
        createTime: db.serverDate()
      }
    })
  } else {
    const cartId = cartRecord.data[0]._id
    const items = cartRecord.data[0].items

    // 查找是否存在相同商品且相同规格的项
    const existIndex = items.findIndex(item => {
      if (item.goodsId !== goodsId) return false
      if (sku && item.skuId) {
        return item.skuId === sku.id
      }
      return !sku && !item.skuId
    })

    if (existIndex !== -1) {
      items[existIndex].num += num
    } else {
      items.push(newItem)
    }
    await cartCollection.doc(cartId).update({ data: { items } })
  }
  return { success: true }
}