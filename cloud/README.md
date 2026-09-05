# CloudBase 云端分享 · 部署说明

让「分享链接」带上照片/视频/BGM 完整还原，需要一次性在腾讯云 CloudBase 控制台
配好下面 5 件事（约 10~15 分钟）。配好后网页端分享按钮即可上传媒体并生成
`#share=s3.<id>` 链接；接收方打开链接由云函数把媒体换成公网 URL 渲染，无需登录。

> 本项目已固定使用环境：**`cloud1-7gjfr85i3b664708`**（js/site-config.js 里已填好）。

---

## 1. 开启「匿名登录」（作者上传与接收方拉取都要）

控制台 → 你的环境 → **登录授权**（或「身份认证」）→ 找到 **匿名登录** → 开启。

> Web 端会用 `auth.signInAnonymously()` 拿一个临时身份来直传媒体/调云函数，
> 不需要用户注册，也不需要任何微信/邮箱配置。

## 2. 创建云数据库集合

控制台 → **数据库** → 新建集合，名字填：**`mls_shares`**
（云函数会往这里写快照记录：文字/布局/媒体 fileID/creatorUid）。

权限保持默认即可（默认仅管理端可读写，我们只通过云函数读写它）。

## 3. 创建云函数 `shareApi`

推荐用**控制台上传文件夹**（不用手压 zip，最稳）：

1. 控制台 → **云函数** → 新建：名称填 **`shareApi`**；
2. 运行环境选 **Nodejs（16.13 或更高）**——⚠️ **不要选「自定义运行时」**，
   选了会要求 `scf_bootstrap` 入口（报
   `ResourceNotFound.BootstrapFile / scf_bootstrap` 就是它）；
3. 上传方式选「**本地上传文件夹**」，直接选择本仓库
   `cloud/functions/shareApi/` 这个文件夹（控制台会自动装依赖）；
4. 创建/部署后确认函数日志无报错。

如果控制台只有「本地上传 zip」，用仓库脚本打包（保证 zip 第一层就是
`index.js` + `package.json`，不会出现顶层文件夹 / `__MACOSX` 导致的入口解析失败）：

```bash
bash cloud/scripts/zip-shareapi.sh      # 生成 cloud/dist/shareApi.zip
unzip -l cloud/dist/shareApi.zip        # 应看到：index.js / package.json（第一层）
```

再在控制台：运行环境选 Nodejs → 上传 `cloud/dist/shareApi.zip`。

> 两种方式都要确认「云端自动安装依赖」开启（创建/部署页有该选项），否则会因缺
> `@cloudbase/node-sdk` 运行报错；函数「访问权限」保持默认即可（登录用户可调用，
> 匿名登录用户算登录用户）。

### ⚠️ 云函数「权限控制」必须放行匿名调用（否则网页端报 EXCEED_AUTHORITY）

CloudBase 云函数默认的**安全规则**是「匿名登录用户不可调用」——但我们网页端正是用
匿名登录身份来调用 `shareApi` 的，不改规则会报：
`{"code":"EXCEED_AUTHORITY","message":"Request exceeds granted authority…"}`。

设置方法：云开发控制台 → **云函数** → 顶部「**权限控制**」→ 编辑规则 JSON，
把 `shareApi` 单独放行（其余函数保持默认）：

```json
{
  "*": { "invoke": "auth.loginType != 'ANONYMOUS' && auth != null" },
  "shareApi": { "invoke": "auth != null" }
}
```

> 只给 `shareApi` 开匿名调用即可：`get` 本身就是公开只读的；
> `finalize`/`revoke` 在函数内部用 `creatorUid` 校验「只能操作自己创建的分享」。

> **遇到 `ResourceNotFound.BootstrapFile … scf_bootstrap` 怎么办**：SCF 把函数当成
> 自定义运行时去找 `scf_bootstrap` 入口了。自查两步：
> ① 函数「运行环境」是不是被设成了自定义运行时 → 改成 Nodejs；
> ② zip 第一层是不是 `shareApi/` 文件夹或带 `__MACOSX` → 用上面的脚本重新打包。
> 都改对后重新「部署/更新」即可，无需改代码。

## 4. 部署网页本身（静态托管）

1. 控制台 → **静态托管** → 上传网站根目录：
   `index.html`、`css/`、`js/`（**必须包含 js/vendor/cloudbase-js-sdk.min.js**）、
   `assets/`（如有）；
2. 得到默认域名，形如 `https://your-life-story-cloud1-7gjfr85i3b664708.webapps.tcloudbase.com`；
3. 确认 `js/site-config.js` 里 `shareBase` 就是这个域名（已填，若域名不同请改）。

## 5. 配置安全来源（CORS，否则浏览器里 SDK 报跨域）

控制台 → **环境 → 安全配置 / 安全来源** → 把下面这些都加进「安全域名」：

- `https://your-life-story-cloud1-7gjfr85i3b664708.webapps.tcloudbase.com`（正式域名）
- `http://127.0.0.1:8090`、`http://localhost:8090`（本地开发，可选）

> 加完若仍报跨域：把已加的域名删掉重新加一次（官方常见做法）。

## 存储权限

**保持默认**（仅创建者可读写）即可，无需改成公开读：
- 媒体由作者浏览器匿名登录后**直传**到 `shares/<shareId>/…`（自己的文件自己可写）；
- 接收方不直接读存储，统一走 `shareApi.get`（云函数管理员权限换临时 URL）。

## 验证

1. 本地起服务：`python3 -m http.server 8090`，浏览器开 `http://127.0.0.1:8090`；
   （别忘了把 `http://127.0.0.1:8090` 加进安全来源）
2. 「我的游戏」→ 一个带照片/视频的故事 → 🔗 分享 → 看到上传进度 → 得到
   `…/#share=s3.xxxx…` 的链接；
3. 用**另一个浏览器**（或手机，无本地数据）打开该链接 → 走完故事，
   照片/视频/BGM 应与本地一致，且无法编辑/创作；
4. 回原浏览器「我的游戏」→ 该故事卡出现「🔗 已分享 n」→ 点进去可「撤回」，
   撤回后第 3 步的链接应显示「分享不存在或已被撤回」。

## 没有云端时（本地 file:// 或未配置）

网页自动退回**纯文字版**分享链接（不含照片/视频），并在分享对话框里提示。
本地开发想完整走通上传流程，可用仓库内的 mock 服务：

```bash
node scripts/mock-share-server.mjs   # 起在 127.0.0.1:8091
# 再把 js/site-config.js 的 cloud.mockBase 临时填为 http://127.0.0.1:8091/mock-share
```

## 首次访问有「风险提醒」中间页，点了“确定访问”却进了默认故事？

CloudBase 默认测试域名（`*.webapps.tcloudbase.com`）首次/无痕访问会先弹一个
**「风险提醒」中间页**：点“确定访问”后跳回站点时会**丢掉 URL hash、保留 query**。
前端已兼容：云端分享链接现在同时携带 `?share=s3.<id>` 与 `#share=s3.<id>`，
中间页跳转后能从 query 找回分享，不会落入默认故事（旧版本发的链接第一次在无痕里
仍会丢失，重新“分享”一次生成新格式链接即可）。

> 想彻底去掉这个中间页：控制台 → 静态托管 → 绑定**自定义域名**（需备案），
> 这是 CloudBase 官方建议的做法（[如何去除中间页](https://docs.cloudbase.net/service/alias#%E5%A6%82%E4%BD%95%E7%A7%BB%E9%99%A4%E4%B8%AD%E9%97%B4%E9%A1%B5)）。

## 可选：换更专业的自定义域名

购买域名 → 备案 → CloudBase 静态托管「自定义域名」绑定 → 改
`js/site-config.js` 的 `shareBase` 即可（前端代码零改动）。
