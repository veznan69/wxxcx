const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { scene, page, width = 280, mockOpenid } = event;
  const wxContext = cloud.getWXContext();
  let openid = wxContext.OPENID;

  // 测试模式：云端测试时通过 mockOpenid 传入模拟 openid
  if (!openid && mockOpenid) {
    openid = mockOpenid;
    console.log('⚠️ 测试模式：使用模拟 openid:', openid);
  }

  // 参数校验
  if (!scene || !page) {
    return { success: false, error: '缺少必要参数 scene 或 page' };
  }
  if (scene.length > 32) {
    return { success: false, error: 'scene 参数不能超过32个字符' };
  }

  try {
    const qrRes = await cloud.openapi.wxacode.getUnlimited({
      scene: scene,
      page: page,
      width: width,
      check_path: false,        // ✅ 关键：跳过对页面是否发布的检查
      env_version: 'trial',    // 开发版，可根据需要改为 'trial' 或 'release'
      autoColor: true,
      isHyaline: false
    });

    const cloudPath = `trace_qrcode/${Date.now()}_${scene}.png`;
    const uploadRes = await cloud.uploadFile({
      cloudPath: cloudPath,
      fileContent: qrRes.buffer
    });

    return {
      success: true,
      fileID: uploadRes.fileID,
      message: '溯源码生成成功'
    };
  } catch (err) {
    console.error('生成溯源码失败:', err);
    return { success: false, error: err.message };
  }
};