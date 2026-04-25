// utils/user.js
// 不要在顶层调用 getApp()
// const app = getApp()   ❌ 删除这行

/**
 * 执行登录：获取 code -> 调用云函数 userLogin -> 保存用户信息到全局和本地
 * @param {Object} userProfile 可选，通过 wx.getUserProfile 获取的 { nickName, avatarUrl }
 */
async function login(userProfile = null) {
  return new Promise((resolve, reject) => {
    wx.login({
      success: async (loginRes) => {
        try {
          const cloudRes = await wx.cloud.callFunction({
            name: 'userLogin',
            data: {
              nickName: userProfile ? userProfile.nickName : '',
              avatarUrl: userProfile ? userProfile.avatarUrl : ''
            }
          })
          if (cloudRes.result && cloudRes.result.success) {
            const app = getApp()
            app.globalData.userInfo = cloudRes.result.userInfo
            app.globalData.openid = cloudRes.result.openid   // 新增
            wx.setStorageSync('userInfo', cloudRes.result.userInfo)
            wx.setStorageSync('openid', cloudRes.result.openid) // 新增
            resolve(cloudRes.result.userInfo)
          } else {
            reject(new Error('登录失败'))
          }
        } catch (err) {
          console.error('调用云函数失败', err)
          reject(err)
        }
      },
      fail: (err) => {
        console.error('wx.login失败', err)
        reject(err)
      }
    })
  })
}

async function getUserProfileAndLogin() {
  return new Promise((resolve, reject) => {
    wx.getUserProfile({
      desc: '用于完善会员资料',
      success: async (res) => {
        console.log('getUserProfile 返回的 userInfo:', res.userInfo); // 新增
        try {
          const loginRes = await login(res.userInfo)
          resolve(loginRes)
        } catch (err) {
          reject(err)
        }
      },
      fail: (err) => {
        console.error('用户拒绝授权', err)
        reject(err)
      }
    })
  })
}

module.exports = {
  login,
  getUserProfileAndLogin
}