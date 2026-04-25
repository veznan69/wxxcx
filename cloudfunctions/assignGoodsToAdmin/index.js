// 云函数：assignGoodsToAdmin
// 功能：将现有商品绑定到 admin 用户
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()

  try {
    console.log('开始将商品绑定到 admin 用户...')

    // admin 用户的 openid
    const adminOpenid = 'ojWd418mR3Z_TqtUeq5wJo4BisdQ'

    // 1. 查询所有商品
    const goodsRes = await db.collection('goods').get()
    const allGoods = goodsRes.data || []

    console.log(`找到 ${allGoods.length} 个商品`)

    if (allGoods.length === 0) {
      return {
        success: true,
        message: '没有需要绑定的商品',
        count: 0
      }
    }

    // 2. 遍历更新每个商品的 _openid
    let updateCount = 0
    let errorCount = 0
    const errors = []

    for (const goods of allGoods) {
      try {
        // 如果商品没有 ownerOpenid 字段，添加该字段记录原始所有者
        const updateData = {
          _openid: adminOpenid
        }

        // 如果商品原本有 _openid 且不是 admin，记录到 ownerOpenid
        if (goods._openid && goods._openid !== adminOpenid && !goods.ownerOpenid) {
          updateData.ownerOpenid = goods._openid
        }

        await db.collection('goods').doc(goods._id).update({
          data: updateData
        })

        console.log(`✅ 商品 ${goods._id} (${goods.name || '未命名'}) 已绑定到 admin`)
        updateCount++

      } catch (err) {
        console.error(`❌ 更新商品 ${goods._id} 失败:`, err)
        errorCount++
        errors.push({
          goodsId: goods._id,
          goodsName: goods.name || '未命名',
          error: err.message
        })
      }
    }

    console.log(`完成绑定：成功 ${updateCount} 个，失败 ${errorCount} 个`)

    return {
      success: true,
      message: '商品绑定完成',
      total: allGoods.length,
      updateCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined
    }

  } catch (err) {
    console.error('绑定商品到 admin 失败:', err)

    return {
      success: false,
      error: err.message,
      message: '绑定失败'
    }
  }
}
