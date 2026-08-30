/* ============================================================
 * 《林间拾忆》工具函数
 * ============================================================ */
window.Utils = (() => {
  'use strict';

  const TAU = Math.PI * 2;

  // 可复现的伪随机数生成器：固定种子 → 每次进入画面都一样（不会闪变）
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b, rng) { return a + (rng || Math.random)() * (b - a); }
  function mod(v, m) { return ((v % m) + m) % m; }

  // '#rrggbb' 或 '#rgb' + alpha → 'rgba(r,g,b,a)'
  function rgba(hex, a) {
    const h = String(hex).replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }

  return { TAU, mulberry32, clamp, lerp, rand, mod, rgba };
})();

/* ============================================================
 * 《林间拾忆》全局设置（角色性别、界面语言，存 localStorage）
 * ============================================================ */
window.GAME_SETTINGS = (() => {
  'use strict';

  const store = { gender: 'male', lang: 'zh' };

  function init() {
    store.gender = localStorage.getItem('mls-gender') === 'female' ? 'female' : 'male';
    store.lang = localStorage.getItem('mls-lang') === 'en' ? 'en' : 'zh';
  }
  function getGender() { return store.gender; }
  function setGender(g) {
    store.gender = g === 'female' ? 'female' : 'male';
    localStorage.setItem('mls-gender', store.gender);
  }
  function getLang() { return store.lang; }
  function setLang(l) {
    store.lang = l === 'en' ? 'en' : 'zh';
    localStorage.setItem('mls-lang', store.lang);
  }

  init();
  return { getGender, setGender, getLang, setLang };
})();
