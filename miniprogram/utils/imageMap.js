// utils/imageMap.js
const cloudEnv = 'cloud1-0gk1j4mb29d57fbd';
// 注意：下面的完整路径前缀请替换为你自己云存储中的实际路径
// 你可以在云存储中点击任意图片的“详情”复制“文件ID”，然后去掉文件名得到前缀
const cloudBase = `http://td2bnk15n.hn-bkt.clouddn.com/`;
const cloudBase1 = `https://s41.ax1x.com/`;

const imageMap = {
  'orange1.png': `${cloudBase1}2026/04/07/peU97in.png`,
  'orange2.png': `${cloudBase1}2026/04/07/peU9oIs.png`,
  'orange3.png': `${cloudBase1}2026/04/08/peUTXgs.png`,
  'juice.png': `${cloudBase1}2026/04/08/peUTO3j.png`,
  'dried.png': `${cloudBase1}2026/04/08/peUTO3j.png`,
  //旧首页轮播图
  'banner0.png': `${cloudBase1}2026/04/07/peU9HGq.png`,
  // 'banner2.png': `${cloudBase1}2026/04/07/peU9bR0.png`,
  // 'banner3.png': `${cloudBase1}2026/04/08/peU7SbV.png`,

  //新首页轮播图
  'banner1.png': `${cloudBase1}2026/04/18/pe6y8w6.jpg`,
  'banner2.png': `${cloudBase1}2026/04/18/pe6yGTK.jpg`,
  'banner3.png': `${cloudBase1}2026/04/18/pe6yYFO.jpg`,
  'banner4.png': `${cloudBase1}2026/04/16/pesqQL8.jpg`,
  'banner5.png': `${cloudBase1}2026/04/16/pesqzTg.jpg`,
  'banner6.png': `${cloudBase1}2026/04/16/pesLipn.jpg`,
  'icon_orchard.png': `${cloudBase1}2026/04/07/peU9fsS.png`,
  'icon_pick.png': `${cloudBase1}2026/04/07/peU9XsU.png`,
  'icon_study.png': `${cloudBase1}2026/04/07/peU9OMT.png`,
  'icon_strategy.png': `${cloudBase1}2026/04/07/peU9qzV.png`,
  'avatar.png': `${cloudBase1}2026/04/08/peUTO3j.png`,
  'course1.jpg': `${cloudBase1}2026/04/08/peUTjvn.jpg`,
  'course2.jpg': `${cloudBase1}2026/04/08/peUTxuq.jpg`,
  'course3.jpg': `${cloudBase1}2026/04/08/peUTzD0.jpg`,
  'strategy1.jpg': `${cloudBase1}2026/04/08/peUTO3j.png`,
  'strategy2.jpg': `${cloudBase1}2026/04/08/peUTO3j.png`,
  'strategy3.jpg': `${cloudBase1}2026/04/08/peUTO3j.png`,
  'trace_qrcode.png': `${cloudBase1}2026/04/13/peDFimn.jpg`,  // 溯源码
  'gov_cert_thumb.png': `${cloudBase1}2026/04/08/peUTO3j.png`,  // 政府对接证明大图的缩略图
  'gov_cert_full.jpg': `${cloudBase1}2026/04/08/peUTO3j.png`,  // 预览政府对接证明大图

  // 海报
  'course1.jpg': `${cloudBase1}2026/04/14/peDOBUH.jpg`,
  'course2.jpg': `${cloudBase1}2026/04/14/peDOdbD.jpg`,
  'course3.jpg': `${cloudBase1}2026/04/14/peDO0Ve.jpg`,
  'course4.jpg': `${cloudBase1}2026/04/14/peDOaDO.jpg`,
  'course5.jpg': `${cloudBase1}2026/04/14/peDOA4s.jpg`,
  'course6.jpg': `${cloudBase1}2026/04/14/peDOUKK.jpg`,

  // 研学课程封面
  'ourse_thumb1.jpg': `${cloudBase1}2026/04/15/perIJtx.jpg`,
  'ourse_thumb2.jpg': `${cloudBase1}2026/04/15/perIehV.jpg`,
  'ourse_thumb3.jpg': `${cloudBase1}2026/04/15/perIsAI.jpg`,
  'ourse_thumb4.jpg': `${cloudBase1}2026/04/15/perIDHA.jpg`,
  'ourse_thumb5.jpg': `${cloudBase1}2026/04/15/perIKcF.jpg`,
  'ourse_thumb6.jpg': `${cloudBase1}2026/04/15/perIk0s.jpg`,

  // 采摘预约背景图
  'pick_bg.jpg': `${cloudBase1}2026/04/15/peranbj.jpg`,

  // 新商品
  'Post_a_sign': `${cloudBase1}2026/04/16/pes1DpQ.jpg`,
  'Glass_cup_1': `${cloudBase1}2026/04/16/pes1wtS.jpg`,
  'Glass_cup_2': `${cloudBase1}2026/04/16/pes10fg.jpg`,
  'Glass_cup_3': `${cloudBase1}2026/04/16/pes1dk8.jpg`,
  'Glass_cup_4': `${cloudBase1}2026/04/16/pes1JOI.jpg`,
  'Doll_1': `${cloudBase1}2026/04/16/pes1tmt.jpg`,
  'Doll_2': `${cloudBase1}2026/04/16/pes1N0P.jpg`,
  'Doll_3': `${cloudBase1}2026/04/16/pes1UTf.jpg`,
  'Doll_4': `${cloudBase1}2026/04/16/pes3dD1.jpg`,
  'pillow': `${cloudBase1}2026/04/16/pes3wHx.jpg`,
  //黄粄商品
  'pillow1': `${cloudBase1}2026/04/17/peyRWu9.jpg`,
  'pillow2': `${cloudBase1}2026/04/17/peyfq0A.jpg`,
  'pillow3': `${cloudBase1}2026/04/17/peyfLTI.jpg`,
  'pillow4': `${cloudBase1}2026/04/17/peyfXkt.jpg`,
    //钥匙扣商品
  'pillow5': `${cloudBase1}2026/04/17/peyhS1S.jpg`,
  'pillow6': `${cloudBase1}2026/04/17/peyhp6g.jpg`,
  'pillow7': `${cloudBase1}2026/04/17/peyhPmj.jpg`,
  'pillow8': `${cloudBase1}2026/04/17/peyhi0s.jpg`,
    //冰箱贴商品
  'pillow9': `${cloudBase1}2026/04/18/pe6rTuq.jpg`,
  'pillow10': `${cloudBase1}2026/04/18/pe6rIvn.jpg`,
  'pillow11': `${cloudBase1}2026/04/18/pe6r5gs.jpg`,
  'pillow12': `${cloudBase1}2026/04/18/pe6rO5F.jpg`,

};

function getImageUrl(fileName) {
  return imageMap[fileName] || `/images/${fileName}`; // 降级到本地
}

module.exports = {
  getImageUrl
};