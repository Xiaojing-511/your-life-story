/* ============================================================
 * 《林间拾忆》故事分享
 *
 * 两代分享格式（用 #share= 负载前缀区分）：
 *  - v1（旧/纯文字，兼容保留）：s3. 之外的内容 = 标题+各段回忆
 *    文字/图标/颜色压缩进 URL（#share=<base64>）。照片/视频不带。
 *  - v2（云快照，?share= 与 #share= 同时带 s3.<shareId>）：文字/布局存云数据库，
 *    照片/视频/BGM 存云存储，接收方完整还原 —— 见 share-cloud.js。
 *    本文件只负责识别与旧版编解码。
 * 压缩：原生 CompressionStream('deflate') + base64url
 * 降级：不支持 CompressionStream 时直接 base64url（仍可工作）
 * ============================================================ */
window.ShareCode = (() => {
  'use strict';

  // 云端快照前缀（与 ShareCloud 一致），decode 见到它应走云端拉取
  const CLOUD_PREFIX = 's3.';
  function isCloudPayload(payload) {
    return typeof payload === 'string' && payload.indexOf(CLOUD_PREFIX) === 0;
  }

  /* ---------- base64url ---------- */
  function toBase64Url(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromBase64Url(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  /* ---------- 压缩 / 解压 ---------- */
  async function deflate(bytes) {
    if (typeof CompressionStream === 'undefined') return bytes;
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function inflate(bytes) {
    if (typeof DecompressionStream === 'undefined') return bytes;
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (e) {
      return bytes; // 旧版未压缩数据
    }
  }

  /* ---------- 编码 / 解码 ---------- */
  // 只保留文字类字段（照片/视频不带入分享链接）；角色和完整布局（回忆位置、
  // 路长）随故事一起分享，接收方看到的初始位置和原故事完全一致。
  function buildPayload(world) {
    const worldLength =
      world && world.config && Number(world.config.worldLength) > 0
        ? Number(world.config.worldLength)
        : 0;
    return {
      v: 1,
      title: (world && world.title) || '',
      name: (world && world.name) || '',
      origin: (world && world.origin) || 'manual',
      gender: world && world.gender === 'female' ? 'female' : 'male',
      worldLength,
      memories: ((world && world.memories) || []).map((m) => ({
        id: m.id,
        title: m.title,
        emoji: m.emoji,
        color: m.color,
        text: Array.isArray(m.text) ? m.text : [],
        x: typeof m.x === 'number' && m.x >= 0 ? m.x : null,
      })),
    };
  }

  async function encode(world) {
    const json = JSON.stringify(buildPayload(world));
    const bytes = new TextEncoder().encode(json);
    const compressed = await deflate(bytes);
    return toBase64Url(compressed);
  }

  async function decode(payload) {
    if (isCloudPayload(payload)) {
      // v2 云快照：不在这里解（文本解码器解不动），由调用方走 ShareCloud
      throw new Error('cloud-share');
    }
    const bytes = fromBase64Url(payload);
    const inflated = await inflate(bytes);
    const json = new TextDecoder().decode(inflated);
    const data = JSON.parse(json);
    if (!data || !Array.isArray(data.memories)) throw new Error('bad payload');
    return {
      title: data.title || '',
      name: data.name || '',
      origin: data.origin || 'manual',
      gender: data.gender === 'female' ? 'female' : 'male',
      worldLength: Number(data.worldLength) > 0 ? Number(data.worldLength) : 0,
      memories: data.memories
        .filter((m) => m && Array.isArray(m.text) && m.text.length)
        .map((m) => ({
          id: m.id || ('m' + Math.random().toString(36).slice(2, 8)),
          title: m.title || '',
          emoji: m.emoji || '🍃',
          color: m.color || '#d4a24e',
          text: m.text.map((t) => String(t)),
          x: typeof m.x === 'number' && m.x >= 0 ? m.x : null,
          image: null,
          video: null,
        })),
    };
  }

  // 生成可分享的完整链接：优先用当前页面的真实域名（部署的站），
  // 再退回 SITE_CONFIG.shareBase；纯文字版与云端链接都保证域名可达。
  // CloudBase 默认测试域名首次访问会先弹「风险提醒」中间页，点“确定访问”后
  // 会丢掉 URL hash 但保留 query——所以云端短负载（s3.<id>，不含内容）在
  // query 里也带一份：接收方无痕/首次打开经中间页跳转后仍能进入分享的故事。
  // 纯文字负载是完整故事（可能几 KB 且属于隐私内容），只放 hash，不进 query。
  function makeShareUrl(payload) {
    let base = '';
    try {
      if (location && location.origin && /^https?:$/.test(location.protocol)) {
        base = location.origin;
      }
    } catch (e) { /* ignore */ }
    if (!base) {
      const cfg = (window.SITE_CONFIG && window.SITE_CONFIG.shareBase) || '';
      base = cfg ? cfg.replace(/\/+$/, '') : location.href.split('#')[0];
    }
    base = base.replace(/\/+$/, '');
    const q = isCloudPayload(payload)
      ? (base.indexOf('?') >= 0 ? '&share=' : '?share=') + payload
      : '';
    return base + q + '#share=' + payload;
  }

  // 从 location.hash 里提取分享负载
  function extractFromHash(hash) {
    const m = /[#&]share=([^&]+)/.exec(hash || '');
    return m ? m[1] : null;
  }

  // 从当前页面地址里提取分享负载：先看 #share=（常规/同页 hash 切换），
  // 再看 ?share=（云端“中间页”跳转会丢 hash，query 里带的那份在这里找回）
  function extractFromLocation(loc) {
    const h = extractFromHash((loc && (loc.hash || '')) || '');
    if (h) return h;
    const q = loc && loc.search;
    if (q) {
      const m = /[?&]share=([^&]+)/.exec(q);
      if (m) {
        try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
      }
    }
    return null;
  }

  return {
    encode, decode, makeShareUrl, extractFromHash, extractFromLocation, buildPayload,
    isCloudPayload,
  };
})();
