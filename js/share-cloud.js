/* ============================================================
 * 《林间拾忆》云端分享（照片/视频/BGM 完整还原）
 *
 * 把故事做成「云快照」：文字/布局存进 CloudBase 云数据库，
 * 照片/视频/BGM 二进制直传 CloudBase 云存储，链接只带一个
 * 随机短 ID（链接同时带 ?share= 与 #share=，防 CloudBase「中间页」
 * 跳转丢 hash；接收方打开链接后：
 *   ShareCloud.getShareWorld(shareId) → 云函数把文件转成
 *   临时公网 URL → 得到与本地结构一致的 memories 直接进
 *   只读体验模式（ui.js 零改动）。
 *
 * 传输层两套：
 *  - mode 'cloud'：@cloudbase/js-sdk（本地 vendor 单文件，懒加载）
 *  - mode 'mock' ：SITE_CONFIG.cloud.mockBase 指向本地联调服务
 *    （scripts/mock-share-server.mjs），供无云端环境开发/测试
 * ============================================================ */
window.ShareCloud = (() => {
  'use strict';

  const PREFIX = 's3.'; // 云端快照链接前缀：#share=s3.<shareId>

  class ShareError extends Error {
    constructor(code, msg) {
      super(msg || code);
      this.code = code;
    }
  }
  const err = (code, msg) => new ShareError(code, msg);

  /* ---------- 基础 ---------- */
  function cfgCloud() {
    const c = (window.SITE_CONFIG && window.SITE_CONFIG.cloud) || {};
    // 本地联调开关：URL 带 ?mock=1 时走 scripts/mock-share-server.mjs
    if (!c.mockBase && (location.search || '').indexOf('mock=1') >= 0) {
      return Object.assign({}, c, { mockBase: 'http://127.0.0.1:8091/mock-share' });
    }
    return c || {};
  }
  // 'cloud'：直连 CloudBase；'mock'：本地联调；'legacy'：退回纯文字版
  function mode() {
    const c = cfgCloud();
    if (!c || !c.enabled || !c.envId) return 'legacy';
    const p = (location.protocol || '').toLowerCase();
    if (p === 'file:') return 'legacy'; // 双击本地打开没有云端可用
    if (c.mockBase) return 'mock';
    return 'cloud';
  }

  function randomId(len) {
    const CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    const arr = new Uint8Array(len);
    if (crypto && crypto.getRandomValues) {
      crypto.getRandomValues(arr);
      for (let i = 0; i < len; i++) s += CH[arr[i] % CH.length];
    } else {
      for (let i = 0; i < len; i++) s += CH[Math.floor(Math.random() * CH.length)];
    }
    return s;
  }

  function makeShareUrl(shareId) {
    // 优先用「当前页面所在的真实域名」（作者在哪个站分享，链接就用哪个站），
    // 避免 shareBase 配置与真实静态域名不一致导致链接打不开。
    let base = '';
    try {
      if (location && location.origin && /^https?:$/.test(location.protocol)) {
        base = location.origin;
      }
    } catch (e) { /* ignore */ }
    if (!base) base = (window.SITE_CONFIG && window.SITE_CONFIG.shareBase) || '';
    if (!base && location && location.origin) base = location.origin;
    base = base.replace(/\/+$/, '');
    // CloudBase 默认测试域名首次访问会弹「风险提醒」中间页，点“确定访问”后丢 hash
    // 但保留 query。s3 负载只是随机短 ID，在 query 也带一份，中间页跳转后仍能找回。
    const payload = PREFIX + shareId;
    const q = base.indexOf('?') >= 0 ? '&share=' : '?share=';
    return base + q + payload + '#share=' + payload;
  }
  function isCloudHash(payload) {
    return typeof payload === 'string' && payload.indexOf(PREFIX) === 0;
  }
  function shareIdFromHash(payload) {
    return isCloudHash(payload) ? payload.slice(PREFIX.length) : null;
  }

  const MIME_EXT = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
    'image/webp': 'webp', 'image/avif': 'avif', 'image/bmp': 'bmp',
    'image/svg+xml': 'svg',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'video/ogg': 'ogv',
    'video/quicktime': 'mov', 'video/x-m4v': 'm4v',
    'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a',
    'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/webm': 'weba',
  };
  function extOf(mime, kind) {
    const m = String(mime || '').toLowerCase();
    if (MIME_EXT[m]) return MIME_EXT[m];
    if (kind === 'image') return 'img';
    if (kind === 'video') return 'vid';
    if (kind === 'bgm') return 'aud';
    return 'bin';
  }
  function safeName(s) {
    return String(s || 'm').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40) || 'm';
  }

  /* ============================================================
   * SDK 懒加载 / 初始化（cloud 模式专用）
   * ============================================================ */
  let sdkPromise = null;
  let appPromise = null;

  function loadSdk() {
    const c = cfgCloud();
    if (window.__CLOUDBASE_SDK__) return Promise.resolve(window.__CLOUDBASE_SDK__);
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve, reject) => {
      const url = c.sdkUrl || 'js/vendor/cloudbase-js-sdk.min.js';
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = () => {
        if (window.__CLOUDBASE_SDK__) resolve(window.__CLOUDBASE_SDK__);
        else reject(err('sdk', 'SDK 未正确加载'));
      };
      s.onerror = () => reject(err('sdk', 'SDK 加载失败（请确认已部署 js/vendor/ 目录）'));
      document.head.appendChild(s);
    });
    return sdkPromise;
  }

  function ensureApp() {
    if (appPromise) return appPromise;
    appPromise = (async () => {
      const c = cfgCloud();
      const cloudbase = await loadSdk();
      const app = cloudbase.init({ env: c.envId });
      try {
        const auth = app.auth({ persistence: 'local' });
        let state = null;
        try { state = await auth.signInAnonymously(); } catch (e) { state = null; }
        if (!state) {
          try {
            if (auth.getLoginState) state = await auth.getLoginState();
            else if (auth.hasLoginState && auth.hasLoginState()) state = true;
          } catch (e) { state = null; }
        }
        if (!state) throw err('auth', 'anonymous login failed');
      } catch (e) {
        if (e && e.code === 'auth') throw e;
        throw err('auth', '登录失败：请在 CloudBase 控制台开启「匿名登录」');
      }
      return app;
    })();
    return appPromise;
  }

  /* ============================================================
   * 传输：invoke（云函数动作） / upload（直传媒体）
   * ============================================================ */
  async function invoke(action, data) {
    const m = mode();
    if (m === 'cloud') {
      const app = await ensureApp();
      let res = null;
      try {
        res = await app.callFunction({ name: cfgCloud().functionName || 'shareApi', data: Object.assign({ action }, data) });
      } catch (e) {
        throw err('net', (e && e.message) || '网络错误');
      }
      const out = res && res.result;
      if (out && out.ok) return out;
      const code = (out && out.code) || 'unknown';
      const msg = (out && out.message) || (out && out.error) || 'unknown';
      throw err(String(code), String(msg));
    }
    if (m === 'mock') {
      let res;
      try {
        res = await fetch(cfgCloud().mockBase.replace(/\/+$/, '') + '/invoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.assign({ action }, data)),
        });
      } catch (e) {
        throw err('net', '无法连接本地 mock 服务');
      }
      const out = await res.json().catch(() => null);
      if (out && out.ok) return out;
      throw err((out && out.code) || 'unknown', (out && out.message) || 'mock error');
    }
    throw err('legacy', '云端分享未启用');
  }

  // 上传一个二进制（cloudPath 形如 shares/<id>/media/xxx.png）
  async function uploadOne(cloudPath, blob, mime, onProgress) {
    const m = mode();
    if (m === 'mock') {
      const res = await fetch(cfgCloud().mockBase.replace(/\/+$/, '') + '/upload?path=' + encodeURIComponent(cloudPath), {
        method: 'PUT',
        headers: { 'Content-Type': mime || blob.type || 'application/octet-stream' },
        body: blob,
      });
      const out = await res.json().catch(() => null);
      if (!out || !out.fileID) throw err('upload', 'mock 上传失败');
      if (onProgress) onProgress(1);
      return out.fileID;
    }
    const app = await ensureApp();
    const name = cloudPath.slice(cloudPath.lastIndexOf('/') + 1);
    let file = blob;
    try {
      file = new File([blob], name, { type: mime || blob.type || 'application/octet-stream' });
    } catch (e) { /* 某些环境没有 File 构造 */ }
    const r = await app.uploadFile({
      cloudPath,
      filePath: file,
      onUploadProgress: (e) => {
        if (onProgress && e && e.total) onProgress(e.loaded / e.total);
      },
    }).catch((e) => { throw err('upload', (e && e.message) || '上传失败'); });
    const fileID = r && (r.fileID || (r.fileList && r.fileList[0] && r.fileList[0].fileID));
    if (!fileID) {
      throw err('upload', (r && r.message) || '上传后未返回 fileID');
    }
    if (onProgress) onProgress(1);
    return fileID;
  }

  /* ============================================================
   * 生成分享快照（作者端）
   * world：StoryStore.getWorld(id) 的完整对象
   * onProgress(p)：{ stage:'upload', doneBytes, totalBytes, index, count, name }
   * ============================================================ */
  async function createShare(world, onProgress) {
    if (mode() === 'legacy') throw err('legacy', '云端分享未启用');
    const limits = (window.SITE_CONFIG && window.SITE_CONFIG.shareLimits) || {};
    const MB = 1024 * 1024;
    const lim = {
      image: (limits.imageMB || 1) * MB,
      video: (limits.videoMB || 15) * MB,
      bgm: (limits.bgmMB || 20) * MB,
      total: (limits.totalMB || 80) * MB,
    };
    const includeBgm =
      (window.SITE_CONFIG && window.SITE_CONFIG.includeBgm) !== false;

    const worldId = world.id;
    const shareId = randomId(14);
    const dir = 'shares/' + shareId + '/';
    const memClones = (world.memories || []).map((m) => ({
      ...m,
      text: Array.isArray(m.text) ? [...m.text] : [],
    }));
    // 快照时的布局（回忆位置 + 路长），与本地 loadActiveWorld 用同一函数，保证完全一致
    let worldLength = 0;
    if (world.config && Number(world.config.worldLength) > 0) {
      worldLength = Number(world.config.worldLength);
    } else {
      const cfg = window.StoryStore.layoutWorld(memClones); // 顺带给 memClones 填上 x
      worldLength = cfg.worldLength;
    }

    // 逐段收集媒体并做体积校验
    const items = []; // { kind, memId, blob, mime, path, size }
    const memories = [];
    let over = null; // 第一处超限 { kindLabel, memTitle, sizeMB, maxMB }
    for (const m of memClones) {
      const mem = {
        id: m.id || safeName('m' + randomId(6)),
        title: m.title || '',
        emoji: m.emoji || '🍃',
        color: m.color || '#d4a24e',
        x: typeof m.x === 'number' && m.x >= 0 ? m.x : null,
        text: Array.isArray(m.text) ? m.text.map((t) => String(t)) : [],
        media: { image: null, video: null },
      };
      if (m.image === 'image') {
        const a = await window.StoryStore.getAsset(worldId, m.id, 'image');
        if (a && a.blob) {
          const blob = a.blob;
          if (!over && blob.size > lim.image) {
            over = { kind: 'image', memTitle: mem.title, sizeMB: blob.size / MB, maxMB: lim.image / MB };
          }
          const path = dir + 'media/' + safeName(mem.id) + '.img.' + extOf(blob.type || a.mime, 'image');
          mem.media.image = { path, mime: blob.type || a.mime || 'image/jpeg', size: blob.size, fileID: '' };
          items.push({ kind: 'image', memId: mem.id, blob, mime: blob.type || a.mime, path, size: blob.size });
        }
      }
      if (m.video === 'video') {
        const a = await window.StoryStore.getAsset(worldId, m.id, 'video');
        if (a && a.blob) {
          const blob = a.blob;
          if (!over && blob.size > lim.video) {
            over = { kind: 'video', memTitle: mem.title, sizeMB: blob.size / MB, maxMB: lim.video / MB };
          }
          const path = dir + 'media/' + safeName(mem.id) + '.vid.' + extOf(blob.type || a.mime, 'video');
          mem.media.video = { path, mime: blob.type || a.mime || 'video/mp4', size: blob.size, fileID: '' };
          items.push({ kind: 'video', memId: mem.id, blob, mime: blob.type || a.mime, path, size: blob.size });
        }
      }
      memories.push(mem);
    }
    // BGM
    let bgm = null;
    if (includeBgm && world.bgm === true) {
      const a = await window.StoryStore.getWorldBGM(worldId);
      if (a && a.blob) {
        const blob = a.blob;
        if (!over && blob.size > lim.bgm) {
          over = { kind: 'bgm', memTitle: 'BGM', sizeMB: blob.size / MB, maxMB: lim.bgm / MB };
        }
        const path = dir + 'bgm.' + extOf(blob.type || a.mime, 'bgm');
        bgm = { path, mime: blob.type || a.mime || 'audio/mpeg', size: blob.size, fileID: '' };
        items.push({ kind: 'bgm', memId: '', blob, mime: blob.type || a.mime, path, size: blob.size });
      }
    }
    if (over) {
      throw err('limit', JSON.stringify(over));
    }
    const totalBytes = items.reduce((s, it) => s + it.size, 0);
    if (totalBytes > lim.total) {
      throw err('limitTotal', JSON.stringify({ sizeMB: totalBytes / MB, maxMB: lim.total / MB }));
    }

    // 依次上传（顺序执行避免并发把浏览器带宽打满）
    let doneBytes = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (onProgress) {
        onProgress({ stage: 'upload', doneBytes, totalBytes, index: i, count: items.length, name: it.memId || 'bgm' });
      }
      const fileID = await uploadOne(it.path, it.blob, it.mime, (ratio) => {
        if (onProgress && ratio != null) {
          onProgress({ stage: 'upload', doneBytes: doneBytes + Math.round(it.size * ratio), totalBytes, index: i, count: items.length, name: it.memId || 'bgm' });
        }
      });
      // 回填 fileID
      if (it.kind === 'bgm') bgm.fileID = fileID;
      else {
        const mem = memories.find((mm) => mm.id === it.memId);
        if (mem && mem.media[it.kind]) mem.media[it.kind].fileID = fileID;
      }
      doneBytes += it.size;
    }

    // 发布（文字/布局/清单 + fileID 一并存云数据库）
    const payload = {
      v: 2,
      shareId,
      createdAt: Date.now(),
      title: world.title || '',
      name: world.name || '',
      origin: world.origin || 'manual',
      gender: world.gender === 'female' ? 'female' : 'male',
      worldLength,
      memories,
      bgm,
    };
    if (onProgress) onProgress({ stage: 'finalize', doneBytes: totalBytes, totalBytes, index: items.length, count: items.length, name: '' });
    const out = await invoke('finalize', { payload });
    return {
      shareId: out.shareId || shareId,
      url: makeShareUrl(out.shareId || shareId),
      totalBytes,
      nImages: items.filter((i) => i.kind === 'image').length,
      nVideos: items.filter((i) => i.kind === 'video').length,
      hasBgm: !!bgm,
    };
  }

  /* ============================================================
   * 拉取分享快照（接收方，只读体验模式启动用）
   * 返回 { world, bgmUrl }；world.memories 结构与本地
   * StoryStore.loadActiveWorld() 产出一致（image 为 URL，
   * video 为 { url, poster }），可直接进 GameBoot。
   * ============================================================ */
  async function getShareWorld(shareId) {
    const out = await invoke('get', { shareId });
    const w = (out && out.world) || null;
    if (!w || !Array.isArray(w.memories)) throw err('notfound', '分享不存在或已撤回');
    return {
      world: w,
      bgmUrl: (out && out.bgmUrl) || null,
      createdAt: (w && w.createdAt) || 0,
    };
  }

  async function revokeShare(shareId) {
    const out = await invoke('revoke', { shareId });
    return !!(out && out.ok);
  }

  // 错误提取：给 UI 展示 code
  function errorCode(e) {
    if (e && e.code) return e.code;
    return 'unknown';
  }

  return {
    mode,
    randomId,
    makeShareUrl,
    isCloudHash,
    shareIdFromHash,
    createShare,
    getShareWorld,
    revokeShare,
    errorCode,
    ShareError,
  };
})();
