/* ============================================================
 * 《林间拾忆》UI 模块：回忆弹层、结尾、暂停、Toast、打字机
 * ============================================================ */
window.UI = (() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    memoryScreen: $('memory-screen'),
    memoryCard: $('memory-card'),
    memoryArt: $('memory-art'),
    memoryTitle: $('memory-title'),
    memoryCount: $('memory-count'),
    memoryVideo: $('memory-video'),
    memoryText: $('memory-text'),
    memoryIndex: $('memory-index'),
    memoryNext: $('memory-next'),
    endScreen: $('end-screen'),
    endStats: $('end-stats'),
    btnRestart: $('btn-restart'),
    btnMakeStory: $('btn-make-story'),
    pauseScreen: $('pause-screen'),
    btnPauseResume: $('btn-pause-resume'),
    btnPauseRestart: $('btn-pause-restart'),
    toast: $('toast'),
    startScreen: $('start-screen'),
    btnStart: $('btn-start'),
    volumeSlider: $('volume-slider'),
    volumeIcon: $('volume-icon'),
  };

  let tw = null;          // 当前打字机控制器
  let onCloseMemory = null;
  let pauseResumeCb = null;
  let pauseRestartCb = null;
  let toastTimer = null;

  /* ---------- 语言 ---------- */
  const hintEl = document.getElementById('hint');
  function applyLang() {
    if (hintEl) hintEl.innerHTML = window.I18N.t('hint');
    // 语言按钮选中态
    const l = window.GAME_SETTINGS.getLang();
    const lz = document.getElementById('lang-zh');
    const le = document.getElementById('lang-en');
    if (lz) lz.classList.toggle('active', l === 'zh');
    if (le) le.classList.toggle('active', l === 'en');
  }
  function bindSettings() {
    const lz = document.getElementById('lang-zh');
    const le = document.getElementById('lang-en');
    // 用 I18N.setLang：统一更新 <html lang> / <title> / 静态文案，并派发 i18n:change
    if (lz) lz.addEventListener('click', () => { window.I18N.setLang('zh'); });
    if (le) le.addEventListener('click', () => { window.I18N.setLang('en'); });
    document.addEventListener('i18n:change', applyLang);
  }

  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  // 隐藏全部游戏界面（供创作器/我的游戏覆盖全屏时使用）
  function hideAllScreens() {
    hide(els.memoryScreen);
    hide(els.endScreen);
    hide(els.pauseScreen);
    hide(els.startScreen);
  }

  /* ---------- 打字机 ---------- */
  // paras: 字符串数组，逐段显示；onAllDone: 全部显示完后的回调
  function runTypewriter(paras, onAllDone) {
    const container = els.memoryText;
    container.innerHTML = '';
    let p = 0, c = 0, cur = null;
    let finished = false, killed = false;
    let timer = null;

    const finish = () => {
      if (finished || killed) return;
      finished = true;
      if (cur) cur.classList.remove('typing');
      if (onAllDone) onAllDone();
    };

    const tick = () => {
      if (killed) return;
      const text = paras[p];
      if (c < text.length) {
        // 中文字符每次前进 1 个，避免半字闪烁
        const step = text.charCodeAt(c) > 0x2e7f ? 1 : 2;
        c = Math.min(text.length, c + step);
        cur.textContent = text.slice(0, c);
        timer = setTimeout(tick, 32);
      } else {
        cur.classList.remove('typing');
        p += 1;
        if (p < paras.length) timer = setTimeout(nextPara, 420);
        else finish();
      }
    };

    const nextPara = () => {
      cur = document.createElement('p');
      cur.classList.add('typing');
      container.appendChild(cur);
      c = 0;
      tick();
    };

    const skip = () => {
      if (killed || finished) return;
      if (c < paras[p].length) {
        // 正在打字：立刻补完当前段
        clearTimeout(timer);
        c = paras[p].length;
        cur.textContent = paras[p];
        cur.classList.remove('typing');
        timer = setTimeout(tick, 420);
      } else {
        // 段间停顿：直接进下一段
        clearTimeout(timer);
        p += 1;
        if (p < paras.length) nextPara();
        else finish();
      }
    };

    const kill = () => { killed = true; clearTimeout(timer); };
    const done = () => finished;

    nextPara();
    return { skip, kill, done };
  }

  /* ---------- 回忆弹层 ---------- */
  function showMemory(mem, idx, total, onClose) {
    onCloseMemory = onClose;

    // 图标 / 配图
    els.memoryArt.innerHTML = '';
    const color = mem.color || '#d4a24e';
    els.memoryArt.style.background =
      `radial-gradient(circle at 35% 30%, ${window.Utils.rgba(color, 0.45)}, ${window.Utils.rgba(color, 0.85)} 65%, rgba(0,0,0,0.35))`;
    els.memoryArt.style.boxShadow = `0 0 30px ${window.Utils.rgba(color, 0.55)}`;
    if (mem.image) {
      const img = document.createElement('img');
      img.src = mem.image;
      img.alt = mem.title;
      els.memoryArt.appendChild(img);
    } else {
      const e = document.createElement('div');
      e.className = 'art-emoji';
      e.textContent = mem.emoji;
      els.memoryArt.appendChild(e);
    }

    // 内置故事支持中英文（textEn/titleEn）；自定义故事是用户内容，保持原样
    const en = window.I18N.isEn();
    const title = en && mem.titleEn ? mem.titleEn : mem.title;
    const text = en && mem.textEn ? mem.textEn : mem.text;

    els.memoryTitle.textContent = `「${title}」`;
    els.memoryIndex.textContent = window.I18N.t('memory.index', { idx, total });
    els.memoryCount.textContent = mem.id ? '' : '';
    els.memoryCount.style.display = 'none';

    // 视频（可选）
    els.memoryVideo.innerHTML = '';
    if (mem.video && mem.video.url) {
      const v = document.createElement('video');
      v.src = mem.video.url;
      if (mem.video.poster) v.poster = mem.video.poster;
      v.controls = true;
      v.playsInline = true;
      v.preload = 'metadata';
      els.memoryVideo.appendChild(v);
      show(els.memoryVideo);
    } else {
      hide(els.memoryVideo);
    }

    els.memoryNext.disabled = true;
    els.memoryNext.classList.remove('ready');

    hide(els.endScreen);
    hide(els.pauseScreen);
    show(els.memoryScreen);
    els.memoryCard.scrollTop = 0;

    tw = runTypewriter(text, () => {
      els.memoryNext.disabled = false;
      els.memoryNext.classList.add('ready');
      els.memoryNext.focus();
    });
  }

  function skipTyping() {
    if (tw) tw.skip();
  }

  function closeMemory() {
    if (tw) tw.kill();
    tw = null;
    hide(els.memoryScreen);
    const cb = onCloseMemory;
    onCloseMemory = null;
    if (cb) cb();
  }

  // 弹层交互：打字中点击任意处 → 跳过当前段；按钮 → 关闭
  els.memoryNext.addEventListener('click', (e) => {
    e.stopPropagation();
    window.AUDIO.unlock();
    closeMemory();
  });
  els.memoryScreen.addEventListener('click', (e) => {
    // 点击遮罩层 → 关闭回忆，回到主页面
    if (e.target === els.memoryScreen) {
      window.AUDIO.unlock();
      closeMemory();
      return;
    }
    // 点击卡片 → 打字中跳过当前段
    if (tw && !tw.done()) tw.skip();
  });

  /* ---------- 结尾 ---------- */
  function showEnd(stats, onRestart) {
    els.endStats.textContent = window.I18N.t('end.stats', { n: stats.collected, total: stats.total });
    hide(els.memoryScreen);
    hide(els.pauseScreen);
    show(els.endScreen);
    els.btnRestart.onclick = () => {
      window.AUDIO.unlock();
      if (onRestart) onRestart();
    };
  }

  // 结尾屏的「make your life story…」入口
  if (els.btnMakeStory) {
    els.btnMakeStory.addEventListener('click', () => {
      window.AUDIO.unlock();
      if (window.Creator && window.Creator.open) window.Creator.open();
    });
  }

  function hideEnd() {
    hide(els.endScreen);
  }

  /* ---------- 暂停 ---------- */
  function resumePause() {
    hide(els.pauseScreen);
    const cb = pauseResumeCb;
    pauseResumeCb = null;
    pauseRestartCb = null;
    if (cb) cb();
  }

  function showPause(onResume, onRestart) {
    hide(els.memoryScreen);
    hide(els.endScreen);
    show(els.pauseScreen);
    pauseResumeCb = onResume;
    pauseRestartCb = onRestart;
  }

  function hidePause() {
    hide(els.pauseScreen);
    pauseResumeCb = null;
    pauseRestartCb = null;
  }

  els.btnPauseResume.addEventListener('click', (e) => {
    e.stopPropagation();
    window.AUDIO.unlock();
    resumePause();
  });
  els.btnPauseRestart.addEventListener('click', (e) => {
    e.stopPropagation();
    window.AUDIO.unlock();
    const cb = pauseRestartCb;
    hidePause();
    if (cb) cb();
  });
  els.pauseScreen.addEventListener('click', (e) => {
    if (e.target === els.pauseScreen) resumePause();
  });

  /* ---------- Toast ---------- */
  function toast(msg, ms = 4000) {
    els.toast.textContent = msg;
    show(els.toast);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => hide(els.toast), ms);
  }

  /* ---------- 开始页 ---------- */
  function volumeIconFor(pct) {
    if (pct <= 0) return '🔇';
    if (pct < 34) return '🔈';
    if (pct < 67) return '🔉';
    return '🔊';
  }

  function syncVolumeUI() {
    const pct = Math.round(window.AUDIO.getVolume() * 100);
    els.volumeSlider.value = String(pct);
    els.volumeIcon.textContent = window.AUDIO.isMuted() ? '🔇' : volumeIconFor(pct);
    els.volumeSlider.style.background =
      `linear-gradient(90deg, #e8b45a ${pct}%, rgba(255,255,255,0.18) ${pct}%)`;
  }

  els.volumeSlider.addEventListener('input', () => {
    window.AUDIO.unlock();
    window.AUDIO.setMuted(false);
    window.AUDIO.setVolume(Number(els.volumeSlider.value) / 100);
    syncVolumeUI();
    const muteBtn = $('btn-mute');
    if (muteBtn) muteBtn.textContent = '🔊';
  });
  syncVolumeUI();

  // 初始化界面语言 + 角色/语言切换
  window.I18N.applyStatic();
  bindSettings();
  applyLang();

  let startCb = null;
  let started = false;
  function beginGame() {
    if (started) return;
    started = true;
    window.AUDIO.unlock();
    hide(els.startScreen);
    if (startCb) startCb();
  }

  function bindStart(onStart) {
    startCb = onStart;
    els.btnStart.addEventListener('click', beginGame);
    window.addEventListener('keydown', (e) => {
      if (started) return;
      if (e.code === 'Enter') {
        e.preventDefault();
        beginGame();
      }
    });
  }

  function showStart() {
    started = false;
    hide(els.pauseScreen);
    hide(els.endScreen);
    hide(els.memoryScreen);
    hide(els.toast);
    const creator = document.getElementById('creator-screen');
    const worlds = document.getElementById('worlds-screen');
    const settings = document.getElementById('settings-screen');
    if (creator) hide(creator);
    if (worlds) hide(worlds);
    if (settings) hide(settings);
    show(els.startScreen);
  }

  // 开始页标题 = 当前选中的故事（点击哪个故事的「游玩」就显示哪个）
  function setStartTitle(title) {
    const el = document.querySelector('.start-title');
    if (el && title) el.textContent = title;
  }

  return { showMemory, skipTyping, showEnd, hideEnd, showPause, hidePause, toast, bindStart, showStart, hideAllScreens, setStartTitle };
})();
