/* ============================================================
 * 《林间拾忆》声音模块（Web Audio 程序化合成，无需音频文件）
 * - 环境风声（循环噪声）
 * - 抒情背景音乐（程序化生成：温暖和弦 + 五声音阶琶音）
 * - 拾取回忆时的提示音
 * - 到达终点时的和弦
 * - 支持用户上传自定义背景音乐（经主音量/静音统一控制）
 * 音量（0~1，默认 0.5）保存在 localStorage（key: mls-volume）
 * 静音开关保存在 localStorage（key: mls-muted）
 * 浏览器要求用户先与页面交互才能出声，因此所有输入都会调用 unlock()
 * ============================================================ */
window.AUDIO = (() => {
  'use strict';

  let ctx = null;
  let master = null;
  let muted = false;
  let volume = 0.5; // 默认中间音量
  let windGain = null;
  let windSrc = null;

  try {
    muted = localStorage.getItem('mls-muted') === '1';
    const stored = parseFloat(localStorage.getItem('mls-volume'));
    if (Number.isFinite(stored)) volume = Math.max(0, Math.min(1, stored));
  } catch (e) { /* 隐私模式等场景忽略 */ }

  function applyGain() {
    if (master) master.gain.value = muted ? 0 : volume;
  }

  // 首次用户手势时初始化音频上下文（音频不可用绝不影响游戏流程）
  function unlock() {
    try {
      if (ctx) {
        if (ctx.state === 'suspended') { try { ctx.resume().catch(() => {}); } catch (e) { /* ignore */ } }
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      applyGain();
      master.connect(ctx.destination);
      buildWind();
      if (customBgmBlob) startCustomBGM(customBgmBlob);
      else startBGM();
    } catch (e) {
      ctx = null;
      master = null;
    }
  }

  // 林间风声：白噪声 → 低通滤波 → 低频缓慢起伏
  function buildWind() {
    if (!ctx) return;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    windSrc = ctx.createBufferSource();
    windSrc.buffer = buf;
    windSrc.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 360;

    windGain = ctx.createGain();
    windGain.gain.value = 0.11;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.05;
    lfo.connect(lfoGain);
    lfoGain.connect(windGain.gain);

    windSrc.connect(lp);
    lp.connect(windGain);
    windGain.connect(master);

    windSrc.start();
    lfo.start();
  }

  /* ============================================================
   * 抒情背景音乐（程序化生成，无音频文件）
   * 4 个温暖和弦循环（Cmaj7 → Am7 → Fmaj7 → G6）
   * 弦乐铺底 + 五声音阶琶音 + 低音，安静、抒情、有呼吸感
   * ============================================================ */
  const BGM = {
    chordDur: 4.2,
    arpGap: 0.42,
    chords: [
      { pad: [130.81, 164.81, 196.0, 246.94], bass: 65.41 }, // Cmaj7
      { pad: [110.0, 130.81, 164.81, 196.0], bass: 55.0 }, // Am7
      { pad: [87.31, 110.0, 130.81, 164.81], bass: 43.65 }, // Fmaj7
      { pad: [98.0, 123.47, 146.83, 196.0], bass: 49.0 }, // G6
    ],
    arps: [
      [261.63, 293.66, 329.63, 392.0, 440.0], // C D E G A
      [220.0, 261.63, 293.66, 329.63, 392.0], // A C D E G
      [174.61, 220.0, 261.63, 329.63, 392.0], // F A C E G
      [196.0, 246.94, 293.66, 329.63, 392.0], // G B D E G
    ],
  };
  let bgmOn = false;
  let chordIdx = 0;
  let arpNote = 0;
  let padTimer = null;
  let arpTimer = null;

  function startBGM() {
    if (!ctx || bgmOn) return;
    bgmOn = true;
    chordIdx = 0;
    arpNote = 0;
    playPad();
    padTimer = setInterval(() => {
      chordIdx = (chordIdx + 1) % BGM.chords.length;
      playPad();
    }, BGM.chordDur * 1000);
    arpTimer = setInterval(playArp, BGM.arpGap * 1000);
  }
  function stopBGM() {
    bgmOn = false;
    if (padTimer) clearInterval(padTimer);
    if (arpTimer) clearInterval(arpTimer);
    padTimer = null;
    arpTimer = null;
  }

  // 弦乐铺底（缓慢淡入淡出，和声叠置）
  function playPad() {
    const c = BGM.chords[chordIdx];
    const t = ctx.currentTime + 0.05;
    const end = t + BGM.chordDur + 0.9;
    c.pad.forEach((f) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.03, t + 1.8);
      g.gain.setValueAtTime(0.03, end - 1.6);
      g.gain.linearRampToValueAtTime(0.0001, end);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(end + 0.1);
    });
    // 低音（比根音低一个八度）
    const b = ctx.createOscillator();
    b.type = 'sine';
    b.frequency.value = c.bass;
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, t);
    bg.gain.linearRampToValueAtTime(0.05, t + 1.2);
    bg.gain.setValueAtTime(0.05, end - 1.2);
    bg.gain.linearRampToValueAtTime(0.0001, end);
    b.connect(bg);
    bg.connect(master);
    b.start(t);
    b.stop(end + 0.1);
  }

  // 五声音阶琶音（柔和三角波，带轻微随机强弱）
  function playArp() {
    const scale = BGM.arps[chordIdx];
    const note = scale[arpNote % scale.length];
    arpNote++;
    const freq = note * (Math.random() < 0.25 ? 2 : 1);
    const t = ctx.currentTime;
    const vol = 0.05 + Math.random() * 0.04;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 2);
  }

  /* ============================================================
   * 自定义背景音乐（用户上传，经主音量/静音统一控制）
   * ============================================================ */
  let customBgmBlob = null;
  let customEl = null; // HTMLAudioElement

  function setCustomBGM(blob) {
    customBgmBlob = blob;
    if (!ctx) return; // 尚未解锁，unlock() 时会自动接上
    stopCustomBGM();
    if (blob) {
      stopBGM();
      startCustomBGM(blob);
    } else {
      startBGM();
    }
  }
  function hasCustomBGM() {
    return !!customBgmBlob;
  }
  function startCustomBGM(blob) {
    if (!ctx) return;
    const url = URL.createObjectURL(blob);
    const el = new Audio(url);
    el.loop = true;
    el.volume = 1;
    const src = ctx.createMediaElementSource(el);
    src.connect(master); // 音量/静音跟随 master
    el.play().catch(() => {});
    customEl = el;
  }
  function stopCustomBGM() {
    if (customEl) {
      customEl.pause();
      customEl.src = '';
      customEl = null;
    }
  }
  // 当前 BGM 状态（供 UI 与测试）
  function getBGMState() {
    if (!ctx) return 'off';
    return hasCustomBGM() ? 'custom' : 'procedural';
  }

  function tone(freq, delay, dur, vol, type = 'sine') {
    if (!ctx || muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    const t = ctx.currentTime + delay;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // 拾取：两声音阶上行（清脆）
  function pickup() {
    tone(659.25, 0, 0.5, 0.16);
    tone(987.77, 0.09, 0.6, 0.12);
  }

  // 小提示音
  function chime() {
    tone(523.25, 0, 0.4, 0.1);
    tone(783.99, 0.08, 0.5, 0.08);
  }

  // 到达终点：温暖大三和弦
  function ending() {
    tone(392.00, 0, 1.2, 0.12, 'triangle');
    tone(523.25, 0.15, 1.4, 0.10, 'triangle');
    tone(659.25, 0.30, 1.8, 0.09, 'triangle');
  }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('mls-muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
    applyGain();
  }

  function isMuted() { return muted; }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    try { localStorage.setItem('mls-volume', String(volume)); } catch (e) { /* ignore */ }
    applyGain();
  }

  function getVolume() { return volume; }

  return {
    unlock, pickup, chime, ending,
    setMuted, isMuted, setVolume, getVolume,
    setCustomBGM, hasCustomBGM, getBGMState,
  };
})();
