/* ============================================================
 * 站点部署配置（分享链接使用哪个地址打开）
 *
 * shareBase：分享故事链接的基准地址（= 游戏部署的地址）。
 * 项目已接入腾讯云 CloudBase：静态托管 + 云存储 + 云函数，
 * 分享链接会带照片/视频/BGM 完整还原，不再是文字版。
 *
 * cloud.enabled = false 时退回旧行为（纯文字版分享链接）。
 * 部署与配置步骤见 cloud/README.md。
 * ============================================================ */
window.SITE_CONFIG = {
  // 游戏部署地址（CloudBase 静态托管默认域名，免备案、自带 HTTPS）
  // 以「静态托管」页面显示的访问域名为准（新环境形如 <名称>-<envId>.webapps.tcloudbase.com）
  shareBase: 'https://your-life-story-cloud1-7gjfr85i3b664708.webapps.tcloudbase.com',

  // 云端分享（照片/视频/BGM 完整还原）
  cloud: {
    enabled: true,
    envId: 'cloud1-7gjfr85i3b664708', // CloudBase 环境 ID
    functionName: 'shareApi', // 云函数名（部署见 cloud/README.md）
    sdkUrl: 'js/vendor/cloudbase-js-sdk.min.js', // 本地 SDK（已打包进仓库，无需外网）
    mockBase: '', // 留空 = 直连 CloudBase；本地联调可填 http://127.0.0.1:8091/mock-share
  },

  // 分享体积上限（在本地先拦，避免把超大文件传上云）
  shareLimits: {
    imageMB: 1, // 单张照片（创作时已压缩到 1280px 内）
    videoMB: 15, // 单段视频（沿用创作时上限）
    bgmMB: 20, // 单段 BGM（沿用创作时上限）
    totalMB: 80, // 一次分享的总上限
  },

  // 故事配了专属 BGM 时，是否随链接一起还原（true = 完全复原）
  includeBgm: true,
};
