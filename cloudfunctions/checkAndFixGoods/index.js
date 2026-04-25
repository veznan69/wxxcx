// 云函数：checkAndFixGoods
// 功能：检查商品数据，并提供修复选项
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()

  try {
    const { action, adminOpenid } = event

    // 默认 admin openid
    const targetAdminOpenid = adminOpenid || 'ojWd418mR3Z_TqtUeq5wJo4BisdQ'

    // 查询所有商品
    const goodsRes = await db.collection('goods').get()
    const allGoods = goodsRes.data || []

    console.log(`找到 ${allGoods.length} 个商品`)

    // 分析商品数据
    const analysis = {
      total: allGoods.length,
      byOpenid: {},
      withoutOpenid: [],
      alreadyAdmin: 0,
      needUpdate: []
    }

    allGoods.forEach(goods => {
      const openid = goods._openid

      if (!openid) {
        analysis.withoutOpenid.push({
          _id: goods._id,
          name: goods.name || '未命名'
        })
      } else {
        if (!analysis.byOpenid[openid]) {
          analysis.byOpenid[openid] = []
        }
        analysis.byOpenid[openid].push({
          _id: goods._id,
          name: goods.name || '未命名'
        })

        if (openid === targetAdminOpenid) {
          analysis.alreadyAdmin++
        } else {
          analysis.needUpdate.push({
            _id: goods._id,
            name: goods.name || '未命名',
            currentOpenid: openid
          })
        }
      }
    })

    if (action === 'check') {
      return {
        success: true,
        message: '商品数据检查完成',
        data: {
          total: analysis.total,
          alreadyAdmin: analysis.alreadyAdmin,
          needUpdate: analysis.needUpdate.length,
          withoutOpenid: analysis.withoutOpenid.length,
          byOpenid: Object.keys(analysis.byOpenid).length,
          details: analysis
        }
      }
    }

    if (action === 'fix') {
      let updateCount = 0
      const updateDetails = []

      // 更新需要绑定的商品
      for (const item of analysis.needUpdate) {
        try {
          await db.collection('goods').doc(item._id).update({
            data: {
              _openid: targetAdminOpenid,
              ownerOpenid: item.currentOpenid  // 记录原始所有者
            }
          })

          updateCount++
          updateDetails.push({
            _id: item._id,
            name: item.name,
            from: item.currentOpenid,
            to: targetAdminOpenid
          })

          console.log(`✅ 商品 ${item.name} 已从 ${item.currentOpenid} 绑定到 admin`)
        } catch (err) {
          console.error(`❌ 更新商品 ${item._id} 失败:`, err)
        }
      }

      // 更新没有 _openid 的商品
      for (const item of analysis.withoutOpenid) {
        try {
          await db.collection('goods').doc(item._id).update({
            data: {
              _openid: targetAdminOpenid
            }
          })

          updateCount++
          updateDetails.push({
            _id: item._id,
            name: item.name,
            from: 'null',
            to: targetAdminOpenid
          })

          console.log(`✅ 商品 ${item.name} 已绑定到 admin`)
        } catch (err) {
          console.error(`❌ 更新商品 ${item._id} 失败:`, err)
        }
      }

      return {
        success: true,
        message: '商品数据修复完成',
        data: {
          totalUpdated: updateCount,
          details: updateDetails
        }
      }
    }

    return {
      success: false,
      message: '无效的操作类型',
      validActions: ['check', 'fix']
    }

  } catch (err) {
    console.error('操作失败:', err)

    return {
      success: false,
      error: err.message,
      message: '操作失败'
    }
  }
}
