// utils/goodsData.js
const { getImageUrl } = require('./imageMap.js');

// 商品基础信息（不含规格）
const goodsBase = {
  '1': { _id: '1', name: '赣南脐橙 礼盒装(10斤)', price: 58.8, image: getImageUrl('orange1.png'), images: [getImageUrl('orange1.png'), getImageUrl('orange2.png')], sales: 128, desc: '产地赣南，土壤天然富硒，果肉饱满酸甜适口', description: '<p>赣南原产地直发，果园土壤富含硒元素，孕育优质脐橙。</p><p>精美礼盒包装，送礼自用皆宜。</p>' },
  '2': { _id: '2', name: '赣南脐橙 家庭装(18斤)', price: 118, image: getImageUrl('orange2.png'), images: [getImageUrl('orange2.png')], sales: 256, desc: '有机种植，绿色健康', description: '<p>不打蜡，不催熟，自然成熟。</p>' },
  '3': { _id: '3', name: '脐橙果酱 纯手工', price: 22.8, image: getImageUrl('juice.png'), images: [getImageUrl('juice.png')], sales: 45, desc: '新鲜脐橙熬制，无添加', description: '<p>选用优质脐橙，手工熬制，果香浓郁，早餐好伴侣。</p>' },
  '4': { _id: '4', name: '黄粄(1000克)', price: 26.8, image: getImageUrl('orange3.png'), images: [getImageUrl('orange3.png')], sales: 67, desc: '软糯黄粄，香甜绵密，传统风味，一口难忘', description: '<p>手工黄粄，Q 弹不腻，天然米香，健康解馋。</p>' },
  '5': { _id: '5', name: '赣南脐橙 (5斤)', price: 36.8, image: getImageUrl('orange3.png'), images: [getImageUrl('orange3.png')], sales: 320, desc: '实惠家庭装，产地直发', description: '<p>新鲜采摘，保证品质。</p>' },
  '6': { _id: '6', name: '文创公仔', price: 28.8, image: getImageUrl('Post_a_sign'), images: [getImageUrl('Post_a_sign')], sales: 320, desc: '软萌公仔，温暖陪伴', description: '<p>潮玩公仔，趣味无限。</p>' },
  '7': { _id: '7', name: '玻璃杯', price: 23.8, image: getImageUrl('Glass_cup_1'), images: [getImageUrl('Glass_cup_1'), getImageUrl('Glass_cup_2'), getImageUrl('Glass_cup_3'), getImageUrl('Glass_cup_4')], sales: 320, desc: '多款可选', description: '<p>优质玻璃杯，多种款式可选。</p>' },
  '8': { _id: '8', name: '玩偶', price: 28.8, image: getImageUrl('Doll_1'), images: [getImageUrl('Doll_1'), getImageUrl('Doll_2'), getImageUrl('Doll_3'), getImageUrl('Doll_4')], sales: 320, desc: '多尺寸可选', description: '<p>可爱玩偶，多种尺寸可选。</p>' },
  '9': { _id: '9', name: '赣橙文创抱枕', price: 9.9, image: getImageUrl('pillow'), images: [getImageUrl('pillow')], sales: 320, desc: '软糯抱枕，舒适亲肤，居家陪伴好物', description: '<p>暖心抱枕，细腻触感，陪伴每一刻放松。</p>' },
  //  黄粄商品
  '10': { 
    _id: '10', 
    name: '传统黄粄 礼盒装(3斤)', 
    price: 58.8, 
    image: getImageUrl('pillow1'),    
    images: [
      getImageUrl('pillow1'),getImageUrl('pillow2'),getImageUrl('pillow3'),getImageUrl('pillow4')], sales: 88, desc: '传统手工黄粄，软糯香甜，礼盒包装', description: '<p>精选优质大米，传统工艺手工制作。</p><p>软糯Q弹，米香浓郁，送礼自用皆宜。</p>' 
  },
  // 钥匙扣商品
  '11': { 
    _id: '11', 
    name: '脐橙文创钥匙扣', 
    price: 6.8, 
    image: getImageUrl('pillow5'),    
    images: [
      getImageUrl('pillow5'), 
      getImageUrl('pillow6'), 
      getImageUrl('pillow7'), 
      getImageUrl('pillow8')
    ], 
    sales: 156, 
    desc: '可爱脐橙造型，随身小物', 
    description: '<p>软萌脐橙造型，精致小巧。</p><p>挂钥匙、挂包包，好看又实用。</p>' 
  },

  // 12. 冰箱贴商品（pillow9封面，pillow9-12详情）
  '12': { 
    _id: '12', 
    name: '赣南脐橙冰箱贴', 
    price: 6.8, 
    image: getImageUrl('pillow9'),  
    images: [
      getImageUrl('pillow9'), 
      getImageUrl('pillow10'), 
      getImageUrl('pillow11'), 
      getImageUrl('pillow12')
    ], 
    sales: 210, 
    desc: '创意冰箱贴，留住果园记忆', 
    description: '<p>创意脐橙主题冰箱贴。</p><p>装饰冰箱，记录美好时光。</p>' 
  }
};

// 规格定义（只有有规格的商品才需要定义）
const variantsMap = {
  '7': [
    { id: 'v1', name: '清透基础', price: 28.8, image: getImageUrl('Glass_cup_1') },
    { id: 'v2', name: '高级质感', price: 45, image: getImageUrl('Glass_cup_2') },
    { id: 'v3', name: '橙宝印花', price: 42, image: getImageUrl('Glass_cup_3') },
    { id: 'v4', name: '国风限定', price: 42, image: getImageUrl('Glass_cup_4') }
  ],
  '8': [
    { id: 'd1', name: '橙小露', price: 9.9, image: getImageUrl('Doll_1') },
    { id: 'd2', name: '橙威威', price: 9.9, image: getImageUrl('Doll_2') },
    { id: 'd3', name: '橙团团', price: 10.9, image: getImageUrl('Doll_3') },
    { id: 'd4', name: '橙小焰', price: 10.9, image: getImageUrl('Doll_4') }
  ]
};

// 导出完整商品详情（用于详情页、商城页商品列表）
function getGoodsDetail(id) {
  const base = goodsBase[id];
  if (!base) return null;
  const variants = variantsMap[id] || [];
  // 返回新的对象，避免污染原始数据
  return {
    ...base,
    variants,
    // 如果有规格，使用第一个规格的默认价格和图片覆盖
    ...(variants.length > 0 ? { price: variants[0].price, image: variants[0].image } : {})
  };
}

// 获取商品列表（仅包含展示所需字段）
function getGoodsList() {
  const list = [];
  for (const id in goodsBase) {
    const base = goodsBase[id];
    const variants = variantsMap[id] || [];
    list.push({
      _id: base._id,
      name: base.name,
      price: variants.length > 0 ? variants[0].price : base.price,
      image: variants.length > 0 ? variants[0].image : base.image,
      variants: variants  // 商城页需要知道是否有规格，以便弹出弹窗
    });
  }
  return list;
}

// 获取购物车映射表（用于 cart.js）
function getGoodsMap() {
  const map = {};
  for (const id in goodsBase) {
    const base = goodsBase[id];
    map[id] = {
      name: base.name,
      price: base.price,
      image: base.image
    };
  }
  return map;
}

// ✅ 导出 getGoodsById（别名）
module.exports = {
  getGoodsDetail,
  getGoodsById: getGoodsDetail,   // 关键：供 cart.js 使用
  getGoodsList,
  getGoodsMap
};