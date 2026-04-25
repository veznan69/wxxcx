const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  try {
    const collections = [
      'reservations',
      'coupons',
      'addresses',
      'carts',
      'orders',
      'users',
      'goods_products',
      'user_messages',
      'user_points',
      'point_records',
      'point_goods',
      'point_exchanges',
      'check_in_records'
    ];

    const results = [];

    for (const name of collections) {
      try {
        const addRes = await db.collection(name).add({
          data: {
            _init: true,
            createTime: db.serverDate()
          }
        });

        await db.collection(name).doc(addRes._id).remove();

        results.push({
          collection: name,
          status: 'success',
          message: 'collection ready'
        });
      } catch (err) {
        console.error(`init collection ${name} failed`, err);
        results.push({
          collection: name,
          status: 'error',
          message: err.message || 'unknown error',
          errCode: err.errCode
        });
      }
    }

    return {
      success: true,
      message: 'database init finished',
      results
    };
  } catch (err) {
    console.error('initDatabase failed', err);
    return {
      success: false,
      error: err.message,
      errCode: err.errCode
    };
  }
};
