/* ============================================================
 * 《林间拾忆》故事分享（纯静态，无后端）
 *
 * 方案：把故事（标题 + 各段回忆文字/图标/颜色）压缩编码进 URL hash
 *   （#share=…），接收方打开链接即进入「只读体验模式」。
 *  - 压缩：原生 CompressionStream('deflate') + base64url（中文压缩后很小）
 *  - 降级：不支持 CompressionStream 时直接 base64url（仍可工作，只是更长）
 *  - 照片/视频是二进制，体积太大，不放进分享链接（UI 有说明）
 * ============================================================ */
window.ShareCode = (() => {
  'use strict';

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
  // 只保留文字类字段（照片/视频不带入分享链接）
  function buildPayload(world) {
    return {
      v: 1,
      title: (world && world.title) || '',
      name: (world && world.name) || '',
      origin: (world && world.origin) || 'manual',
      memories: ((world && world.memories) || []).map((m) => ({
        id: m.id,
        title: m.title,
        emoji: m.emoji,
        color: m.color,
        text: Array.isArray(m.text) ? m.text : [],
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
    const bytes = fromBase64Url(payload);
    const inflated = await inflate(bytes);
    const json = new TextDecoder().decode(inflated);
    const data = JSON.parse(json);
    if (!data || !Array.isArray(data.memories)) throw new Error('bad payload');
    return {
      title: data.title || '',
      name: data.name || '',
      origin: data.origin || 'manual',
      memories: data.memories
        .filter((m) => m && Array.isArray(m.text) && m.text.length)
        .map((m) => ({
          id: m.id || ('m' + Math.random().toString(36).slice(2, 8)),
          title: m.title || '',
          emoji: m.emoji || '🍃',
          color: m.color || '#d4a24e',
          text: m.text.map((t) => String(t)),
          image: null,
          video: null,
        })),
    };
  }

  // 生成可分享的完整链接：优先用部署配置的地址（国内访问更快），否则用当前页面地址
  function makeShareUrl(payload) {
    const cfg = (window.SITE_CONFIG && window.SITE_CONFIG.shareBase) || '';
    const base = cfg ? cfg.replace(/\/+$/, '') : location.href.split('#')[0];
    return base + '#share=' + payload;
  }

  // 从 location.hash 里提取分享负载
  function extractFromHash(hash) {
    const m = /[#&]share=([^&]+)/.exec(hash || '');
    return m ? m[1] : null;
  }

  return { encode, decode, makeShareUrl, extractFromHash, buildPayload };
})();
