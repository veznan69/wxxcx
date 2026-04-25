const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

/**
 * 获取橙友圈图片的临时访问链接
 * 用于绕过云存储权限限制，让其他用户可以查看帖子图片
 * 
 * @param {string[]} fileIDs - 图片fileID数组
 * @returns {object} { success: boolean, fileList: array, error: string }
 */
exports.main = async (event, context) => {
  const { fileIDs } = event;

  // 参数校验
  if (!fileIDs || !Array.isArray(fileIDs) || fileIDs.length === 0) {
    return {
      success: false,
      error: '请提供有效的fileID数组'
    };
  }

  // 限制最多50个（微信云开发限制）
  if (fileIDs.length > 50) {
    return {
      success: false,
      error: '一次最多查询50个图片'
    };
  }

  try {
    // 获取临时URL（有效期2小时）
    const result = await cloud.getTempFileURL({
      fileList: fileIDs
    });

    return {
      success: true,
      fileList: result.fileList,
      message: `成功获取${result.fileList.length}个图片的临时链接`
    };
  } catch (err) {
    console.error('获取临时URL失败:', err);
    return {
      success: false,
      error: err.message || '获取图片临时链接失败'
    };
  }
};
