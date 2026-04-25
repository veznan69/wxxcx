// cloudfunctions/generateLoginQrcode/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { sessionId } = event;
  if (!sessionId) return { success: false, error: '缺少 sessionId' };

  try {
    // 生成小程序码
    const qrRes = await cloud.openapi.wxacode.getUnlimited({
      scene: sessionId,
      page: 'pages/scanLogin/scanLogin',
      check_path: false,
      env_version: 'trial' // 可根据需要改为 'release'
    });

    // 上传到云存储
    const cloudPath = `login_qrcode/${sessionId}.png`;
    const uploadRes = await cloud.uploadFile({
      cloudPath,
      fileContent: qrRes.buffer
    });

    return {
      success: true,
      fileID: uploadRes.fileID
    };
  } catch (err) {
    console.error('生成小程序码失败:', err);
    return { success: false, error: err.message };
  }
};