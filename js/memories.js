/* ============================================================
 * 《林间拾忆》内容配置文件 —— 最重要的一份文件
 *
 * ★ 加新回忆 = 在 MEMORIES 数组里加一项，不需要改任何游戏代码 ★
 * 保存后刷新页面即可生效。
 *
 * 每一项字段说明：
 *   id     唯一标识（不要与其他项重复）
 *   title  回忆标题
 *   x      物品放在小路上的位置（世界坐标，范围 0 ~ worldLength）
 *   emoji  物品图标（没有配图时在游戏中显示这个 emoji）
 *   color  光晕颜色（#rrggbb）
 *   image  可选：回忆配图路径，如 'assets/images/xxx.jpg'，不需要填 null
 *   video  可选：回忆视频 { url, poster }，如
 *              { url: 'assets/videos/xxx.mp4', poster: 'assets/images/xxx.jpg' }
 *          不需要填 null。填了就会在回忆里出现视频播放器。
 *   text   回忆文案：字符串数组，每个元素是一段（打字机逐段显示）
 *
 * 想调整行走速度、小路长度等：改下面的 GAME_CONFIG。
 * ============================================================ */

window.GAME_CONFIG = {
  viewW: 960, // 游戏逻辑分辨率宽（发布到 itch.io 时嵌入尺寸填这个）
  viewH: 540, // 游戏逻辑分辨率高
  worldLength: 8000, // 小路总长度（世界坐标，像素）
  walkSpeed: 180, // 按住空格 / 点击时的行走速度（像素/秒）
  pickupRadius: 46, // 拾取判定半径（玩家与物品距离小于该值即拾取）
};

const ORIGIN_X = 500;
const STEP_WIDTH = 400;

window.MEMORIES = [
  {
    id: "pocket-watch",
    title: "旧怀表",
    titleEn: "The Old Pocket Watch",
    x: ORIGIN_X,
    emoji: "🕰️",
    color: "#d4a24e",
    image: null,
    video: null,
    text: [
      "你拾起一只旧怀表。表盘上的秒针早已停住，停在某个下午的三点十七分。",
      "你想起小时候，外婆总把怀表放在围裙口袋里。嘀嗒，嘀嗒，像一种不会停下来的承诺。",
      "后来表不走了。外婆说：「时间啊，走着走着就累了。」",
      "你把它握在手心，仿佛还能听见那一声温柔的嘀嗒。",
    ],
    textEn: [
      "You pick up an old pocket watch. The second hand stopped long ago — at 3:17 on some afternoon.",
      "You remember how Grandma always kept the watch in her apron pocket. Tick, tock, tick, tock — like a promise that never ends.",
      "One day it stopped. Grandma said: “Time, you see, gets tired of walking.”",
      "You hold it in your palm, as if you can still hear that gentle ticking.",
    ],
  },
  {
    id: "faded-photo",
    title: "泛黄的照片",
    titleEn: "The Faded Photo",
    x: ORIGIN_X + STEP_WIDTH * 1,
    emoji: "🖼️",
    color: "#e0b77a",
    image: null,
    video: null,
    text: [
      "一张边角卷起的照片。照片上的人笑得很用力，露出八颗牙齿，像是要把那一刻永远留在脸上。",
      "那是你和老友在毕业那天的合影。如今你们在不同的城市，隔着屏幕说「改天聚」，改天一直没有来。",
      "你把照片放回口袋。路还在脚下，慢慢走。",
    ],
    textEn: [
      "A photo with curled corners. The people in it smile so hard, all teeth, as if trying to keep that moment on their faces forever.",
      "It's a picture of you and an old friend on graduation day. Now you live in different cities, promising “let's meet someday” through a screen — and someday never comes.",
      "You put the photo back in your pocket. The road is still under your feet. Walk slowly.",
    ],
  },
  {
    id: "broken-kite",
    title: "断线的风筝",
    titleEn: "The Kite With a Broken String",
    x: ORIGIN_X + STEP_WIDTH * 2,
    emoji: "🪁",
    color: "#6fc3df",
    image: null,
    video: null,
    text: [
      "一只断了线的风筝，卡在灌木丛里。你想起童年那个下午，你在田埂上拉着风筝疯跑，风很大，线很细。",
      "风筝飞得那么高，高到你以为它能碰到云。后来线断了，你追了很远，最后坐在田埂上哭。",
      "现在你看着这只风筝，笑了——原来飞走的东西，未必是失去。",
    ],
    textEn: [
      "A kite with a broken string, caught in the bushes. You remember that afternoon of your childhood, running wild across the ridge with the kite, the wind strong and the string thin.",
      "It flew so high you thought it would touch the clouds. Then the string snapped. You chased it for a long way, and finally sat on the ridge and cried.",
      "Now you look at the kite and smile — what flies away isn't always lost.",
    ],
  },
  {
    id: "concert-ticket",
    title: "两张票根",
    titleEn: "Two Ticket Stubs",
    x: ORIGIN_X + STEP_WIDTH * 3,
    emoji: "🎫",
    color: "#e07b54",
    image: null,
    video: null,
    text: [
      "两张并排的票根，日期是很多年前的冬天。那场演唱会你们约了很久，后来还是没能一起去。",
      "票根一直放在书桌的抽屉里，像一个小小的、没来得及兑现的约定。",
      "你在人群里站了一整晚，跟着唱完了每一首歌。有些歌，一个人唱也很好听。",
    ],
    textEn: [
      "Two ticket stubs side by side, dated a winter many years ago. You had planned that concert for so long — and in the end you never went together.",
      "The stubs stayed in a desk drawer, like a small promise never kept.",
      "You stood in the crowd all night and sang along to every song. Some songs sound just as good sung alone.",
    ],
  },
  {
    id: "old-notebook",
    title: "旧笔记本",
    titleEn: "The Old Notebook",
    x: ORIGIN_X + STEP_WIDTH * 4,
    emoji: "📓",
    color: "#8aa6c9",
    image: null,
    video: null,
    text: [
      "一本封面磨破的笔记本。第一页用蓝色钢笔写着：「要成为很厉害的大人。」",
      "你翻开，里面是十几岁的你写下的计划和愿望——有的实现了，有的改了，有的已经想不起来为什么重要。",
      "你合上本子，继续往前走。现在的大人，好像也不算太差。",
    ],
    textEn: [
      "A notebook with a worn cover. On the first page, in blue ink: “Become a really great grown-up.”",
      "You flip through — plans and wishes written by the thirteen-year-old you. Some came true, some changed, some you can't remember why they mattered.",
      "You close the notebook and keep walking. The grown-up you turned out to be isn't so bad after all.",
    ],
  },
];
