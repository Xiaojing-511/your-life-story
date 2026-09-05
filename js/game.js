/* ============================================================
 * 《林间拾忆》游戏主逻辑
 * 场景：程序化生成的林间小路（多层视差）
 * 玩法：自动行走 → 走近物品自动拾取 → 弹出回忆 → 走到底 → 未完待续
 * 存档：localStorage（key: mls-progress[:<worldId>]）
 *
 * 从 IIFE 改为 GameBoot(cfg, memories, worldId, gender)：
 * 支持「我的故事」世界——启动时由 StoryStore 决定加载哪个世界。
 * ============================================================ */
window.GameBoot = (CFG, MEMORIES, worldId, gender) => {
  "use strict";

  const U = window.Utils;
  const { TAU, clamp, mod, rgba } = U;

  const W = CFG.viewW;
  const H = CFG.viewH;
  const LENGTH = CFG.worldLength;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = Math.round(W * scale) + "px";
    canvas.style.height = Math.round(H * scale) + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  /* ================= 世界生成（固定种子 → 画面稳定） ================= */
  const rng = U.mulberry32(20240527);

  // 小路中心的 y 随世界 x 起伏
  const pathY = (wx) =>
    H * 0.66 + Math.sin(wx * 0.0032) * 34 + Math.sin(wx * 0.0009 + 1.7) * 46;
  // 小路半宽
  const halfPath = (wx) => 64 + Math.sin(wx * 0.0013) * 12;

  const clouds = [];
  for (let i = 0; i < 8; i++) {
    clouds.push({
      x: rng() * LENGTH,
      y: 34 + rng() * 110,
      s: 0.6 + rng() * 0.9,
      v: 4 + rng() * 8,
    });
  }

  // 远景群山：用正弦叠加生成起伏的轮廓
  const hill = (wx, k1, k2, a1, a2) =>
    46 + Math.sin(wx * k1 + a1) * 26 + Math.sin(wx * k2 + a2) * 40;

  // 树木行
  const farTrees = [];
  for (let x = -200; x < LENGTH + 500; x += 42 + rng() * 170) {
    farTrees.push({
      x,
      type: rng() < 0.5 ? 0 : 1,
      s: 0.7 + rng() * 0.9,
      tint: rng() < 0.5 ? 0 : 1,
    });
  }
  const midTrees = [];
  for (let x = -300; x < LENGTH + 600; x += 60 + rng() * 230) {
    midTrees.push({
      x,
      type: rng() < 0.34 ? 0 : rng() < 0.5 ? 1 : 2,
      s: 0.9 + rng() * 1.2,
      tint: rng() < 0.5 ? 0 : 1,
    });
  }
  const frontTrees = [];
  for (let x = -400; x < LENGTH + 700; x += 420 + rng() * 480) {
    frontTrees.push({
      x,
      type: rng() < 0.5 ? 1 : 2,
      s: 1.6 + rng() * 1.0,
      tint: rng() < 0.5 ? 0 : 1,
    });
  }

  // 小路装饰：石子、花、草丛
  const stones = [],
    flowers = [],
    tufts = [],
    pebbles = [];
  const FLOWER_COLORS = ["#f4d03f", "#e67e9c", "#f0f0f0", "#c39bd3", "#f7a052"];
  for (let i = 0; i < LENGTH / 38; i++) {
    const wx = i * 38 + rng() * 38;
    const py = pathY(wx);
    const side = rng() < 0.5 ? -1 : 1;
    const off = (64 + rng() * 80) * side;
    const roll = rng();
    if (roll < 0.22) {
      stones.push({
        x: wx,
        y: py + 50 + rng() * 26 + off * 0.45,
        s: 0.6 + rng() * 1.1,
        r: rng() * 0.4,
      });
    } else if (roll < 0.45) {
      flowers.push({
        x: wx,
        y: py + 58 + rng() * 26 + off * 0.45,
        c: FLOWER_COLORS[Math.floor(rng() * FLOWER_COLORS.length)],
      });
    } else if (roll < 0.8) {
      tufts.push({
        x: wx,
        y: py + 64 + rng() * 20 + off * 0.45,
        s: 0.7 + rng() * 1.2,
      });
    } else {
      pebbles.push({
        x: wx,
        y: py + (rng() < 0.5 ? -1 : 1) * rng() * 22,
        s: 0.5 + rng() * 0.8,
      });
    }
  }

  // 灌木丛（路边，稍靠前景）
  const bushes = [];
  for (let x = -300; x < LENGTH + 500; x += 150 + rng() * 280) {
    const side = rng() < 0.5 ? -1 : 1;
    bushes.push({ x, side, s: 0.8 + rng() * 0.9, y: 60 + rng() * 24 });
  }

  // 萤火虫（环绕小路漂浮）
  const fireflies = [];
  for (let i = 0; i < 14; i++) {
    fireflies.push({
      x: rng() * LENGTH,
      y: H * 0.55 + rng() * H * 0.28,
      ph: rng() * TAU,
    });
  }

  // 飘落的叶子
  const leaves = [];
  for (let i = 0; i < 10; i++) {
    leaves.push({
      x: rng() * LENGTH,
      y: rng() * H,
      vy: 16 + rng() * 22,
      ph: rng() * TAU,
      s: 0.7 + rng() * 0.8,
      warm: rng() < 0.4,
    });
  }

  // 雾带
  const fogBands = [];
  for (let i = 0; i < 4; i++) {
    fogBands.push({
      x: rng() * LENGTH,
      y: H * 0.68 + rng() * 60,
      w: 280 + rng() * 160,
      a: 0.06 + rng() * 0.06,
      v: 6 + rng() * 8,
    });
  }

  // 粒子（拾取爆点、物品闪光）
  const bursts = [];
  const sparkles = [];

  /* ================= 状态 ================= */
  const SAVE_KEY =
    worldId && worldId !== "default"
      ? "mls-progress:" + worldId
      : "mls-progress";

  // 右上角「用户」故事切换钩子（Creator 使用）：
  // 打开菜单时安静暂停（不显示暂停页），关闭时恢复行走
  window.GameHooks = {
    pauseQuietly() {
      if (state === "walking") {
        holding = false;
        clickTarget = null;
        state = "paused";
      }
    },
    resume() {
      if (state === "paused") state = "walking";
    },
  };
  let state = "start"; // start | walking | memory | paused | end
  let playerX = 170;
  let camX = 0;
  let t = 0;
  let holding = false; // 键盘（空格/→/D）按住
  let clickTarget = null; // 点击目的地（世界坐标），到达后置空
  let facing = 1; // 1 = 朝右（前进），-1 = 朝左（往回走）
  let autoSaveTimer = 0;

  const collected = new Set();
  const items = MEMORIES.map((m) => ({ x: m.x, mem: m })).sort(
    (a, b) => a.x - b.x,
  );
  // 每次进入故事都从头开始：不恢复上次进度（save() 仍保留，便于以后做「继续」）

  function save() {
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          v: 1,
          collected: [...collected],
          x: Math.floor(playerX),
        }),
      );
    } catch (e) {
      /* ignore */
    }
  }

  /* ================= HUD ================= */
  const hudCount = document.getElementById("hud-count");
  const hudBarFill = document.getElementById("hud-bar-fill");
  const btnMute = document.getElementById("btn-mute");
  btnMute.textContent = window.AUDIO.isMuted() ? "🔇" : "🔊";
  btnMute.addEventListener("click", () => {
    window.AUDIO.unlock();
    window.AUDIO.setMuted(!window.AUDIO.isMuted());
    btnMute.textContent = window.AUDIO.isMuted() ? "🔇" : "🔊";
  });

  /* ================= 输入 ================= */
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (state === "start") return;
    if (e.code === "Escape") {
      // 故事切换菜单 / 游戏内管理界面优先吃掉 Esc
      if (
        window.Creator &&
        window.Creator.handleEscape &&
        window.Creator.handleEscape()
      )
        return;
      togglePause();
      return;
    }
    if (e.code === "Space" || e.code === "ArrowRight" || e.code === "KeyD") {
      e.preventDefault();
      window.AUDIO.unlock();
      if (state === "memory") window.UI.skipTyping();
      else if (state === "walking") holding = true;
    }
    window.AUDIO.unlock();
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space" || e.code === "ArrowRight" || e.code === "KeyD")
      holding = false;
  });
  canvas.addEventListener("pointerdown", (e) => {
    window.AUDIO.unlock();
    if (state !== "walking") return;
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (W / rect.width);
    const sy = (e.clientY - rect.top) * (H / rect.height);
    // 先判断是否直接点中了物品标识 → 立即触发回忆（往回走也能点）
    for (const it of items) {
      const ix = it.x - camX;
      if (ix < -70 || ix > W + 70) continue;
      const iy = pathY(it.x) - 44;
      const dx = sx - ix;
      const dy = sy - iy;
      if (dx * dx + dy * dy < 50 * 50) {
        triggerItem(it);
        return;
      }
    }
    // 否则走到点击位置（向前、往回走都可以，到达后停下）
    const target = clamp(camX + sx, 0, LENGTH - 40);
    if (Math.abs(target - playerX) > 2) clickTarget = target;
  });
  window.addEventListener("pointerup", () => {
    holding = false;
  });
  window.addEventListener("beforeunload", save);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) save();
  });

  /* ================= 流程控制 ================= */
  function togglePause() {
    if (state === "walking") {
      holding = false;
      clickTarget = null;
      state = "paused";
      window.UI.showPause(() => {
        state = "walking";
      }, restart);
    } else if (state === "paused") {
      state = "walking";
      window.UI.hidePause();
    }
  }

  // 触发一段回忆（走过自动拾取 / 点击标识都会走到这里）
  // replay=true 表示已拾取过、往回走时点击标识重新观看
  function triggerItem(it, replay) {
    if (!replay) {
      collected.add(it.mem.id);
      window.AUDIO.pickup();
      spawnBurst(it.x, pathY(it.x) - 40, it.mem.color);
      save();
    } else {
      window.AUDIO.pickup();
    }
    holding = false;
    clickTarget = null;
    state = "memory";
    // 最后一段回忆看完后：若剩余路不长（按记忆段数设计的结尾步行），
    // 自动走完并触发结尾（内置旅程同样按记忆段数排布，行为一致）
    const endX = LENGTH - 140;
    const autoWalk =
      !replay && collected.size === MEMORIES.length && endX - playerX < 1600;
    window.UI.showMemory(it.mem, collected.size, MEMORIES.length, () => {
      state = "walking";
      if (autoWalk) {
        facing = 1;
        clickTarget = endX;
      }
    });
  }

  function checkPickup() {
    for (const it of items) {
      if (collected.has(it.mem.id)) continue;
      if (Math.abs(playerX - it.x) < CFG.pickupRadius) {
        triggerItem(it, false);
        break;
      }
    }
  }

  function reachEnd() {
    state = "end";
    holding = false;
    clickTarget = null;
    save();
    window.AUDIO.ending();
    window.UI.showEnd(
      { collected: collected.size, total: MEMORIES.length },
      restart,
    );
  }

  // 重置进度并回到开始页（暂停 Restart / 结尾「再走一遍」）
  function restart() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {
      /* ignore */
    }
    collected.clear();
    playerX = 170;
    camX = 0;
    facing = 1;
    autoSaveTimer = 0;
    holding = false;
    clickTarget = null;
    state = "start";
    window.UI.hideEnd();
    window.UI.hidePause();
    document.getElementById("stage").classList.add("prestart");
    window.UI.showStart();
  }

  /* ================= 粒子 ================= */
  function spawnBurst(wx, wy, color) {
    for (let i = 0; i < 14; i++) {
      const a = rng() * TAU;
      const sp = 50 + rng() * 110;
      bursts.push({
        x: wx,
        y: wy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: 0.7,
        max: 0.7,
        color,
      });
    }
  }

  function updateParticles(dt) {
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.life -= dt;
      if (b.life <= 0) {
        bursts.splice(i, 1);
        continue;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy += 160 * dt; // 轻微重力
    }
    for (const f of fireflies) {
      f.x += Math.sin(t * 0.35 + f.ph) * 14 * dt;
    }
    for (const l of leaves) {
      l.y += l.vy * dt;
      l.x += Math.sin(t * 0.8 + l.ph) * 26 * dt;
      if (l.y > H + 20) {
        l.y = -10;
        l.x = playerX + rng() * W;
      }
    }
    for (const it of items) {
      if (collected.has(it.mem.id)) continue; // 已拾取的点亮，不再冒星光
      if (!it.sparkleTimer) it.sparkleTimer = rng() * 0.3;
      it.sparkleTimer -= dt;
      if (it.sparkleTimer <= 0) {
        it.sparkleTimer = 0.2 + rng() * 0.3;
        sparkles.push({
          x: it.x + (rng() - 0.5) * 30,
          y: pathY(it.x) - 46 + (rng() - 0.5) * 26,
          life: 0.9,
          max: 0.9,
          ph: rng() * TAU,
        });
      }
    }
    for (let i = sparkles.length - 1; i >= 0; i--) {
      const s = sparkles[i];
      s.life -= dt;
      if (s.life <= 0) sparkles.splice(i, 1);
    }
  }

  /* ================= 主循环 ================= */
  let last = performance.now();
  function frame(now) {
    const endX = LENGTH - 140;
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    t += dt;

    // 世界更新：点击 → 走到点击位置（前后都可，到达即停）；按住空格/→/D → 一直向前
    if (state === "walking") {
      let moved = false;
      if (holding) {
        clickTarget = null; // 键盘按住优先，取消点击目标
        facing = 1;
        playerX += CFG.walkSpeed * dt;
        moved = true;
      } else if (clickTarget !== null) {
        const step = CFG.walkSpeed * dt;
        const diff = clickTarget - playerX;
        if (Math.abs(diff) <= step) {
          playerX = clickTarget; // 到达目的地，停下
          clickTarget = null;
        } else {
          facing = diff > 0 ? 1 : -1;
          playerX += Math.sign(diff) * step;
        }
        moved = true;
      }
      if (moved) {
        playerX = clamp(playerX, 0, endX);
        if (playerX >= endX) {
          playerX = endX;
          reachEnd();
        }
        autoSaveTimer += dt;
        if (autoSaveTimer > 1.2) {
          autoSaveTimer = 0;
          save();
        }
        checkPickup();
      }
    }
    camX = clamp(playerX - W * 0.38, 0, Math.max(0, LENGTH - W));
    updateParticles(dt);

    // HUD
    hudBarFill.style.width =
      (clamp(playerX / LENGTH, 0, 1) * 100).toFixed(1) + "%";
    const cntText = window.I18N.t("hud.count", {
      n: collected.size,
      total: MEMORIES.length,
    });
    if (hudCount.textContent !== cntText) hudCount.textContent = cntText;

    draw();
  }

  /* ================= 绘制 ================= */
  const sunX = W * 0.76;
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
  skyGrad.addColorStop(0, "#cfe6ef");
  skyGrad.addColorStop(0.55, "#e9efd4");
  skyGrad.addColorStop(1, "#f6e0b4");

  function drawSky() {
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);
    // 太阳光晕
    const sg = ctx.createRadialGradient(sunX, 70, 10, sunX, 70, 170);
    sg.addColorStop(0, "rgba(255,244,214,0.95)");
    sg.addColorStop(0.25, "rgba(255,224,150,0.35)");
    sg.addColorStop(1, "rgba(255,224,150,0)");
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sunX, 70, 170, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#fff6dc";
    ctx.beginPath();
    ctx.arc(sunX, 70, 32, 0, TAU);
    ctx.fill();
  }

  function drawClouds() {
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    for (const c of clouds) {
      const sx = mod(c.x - camX * 0.06 + t * c.v, W + 400) - 200;
      ctx.beginPath();
      ctx.ellipse(sx, c.y, 46 * c.s, 15 * c.s, 0, 0, TAU);
      ctx.ellipse(sx + 30 * c.s, c.y - 8 * c.s, 28 * c.s, 12 * c.s, 0, 0, TAU);
      ctx.ellipse(sx - 32 * c.s, c.y + 2 * c.s, 24 * c.s, 10 * c.s, 0, 0, TAU);
      ctx.fill();
    }
  }

  function drawHills() {
    // 远山（最淡）
    fillHill(0.08, 0.0022, 0.0007, 1.2, 4.0, 52, "#7d9c6d");
    // 近山（稍深）
    fillHill(0.18, 0.0018, 0.0006, 1.2, 4.0, 38, "#5d8352");
  }
  function fillHill(p, k1, k2, a1, a2, base, color) {
    const yb = H * 0.6;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let sx = 0; sx <= W; sx += 8) {
      const wx = sx + camX * p;
      ctx.lineTo(sx, yb - base - hill(wx, k1, k2, a1, a2) * 0.55);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  // 树：type 0=松树 1=圆冠 2=高瘦
  function drawTree(x, baseY, type, s, trunk, leaf1, leaf2) {
    ctx.fillStyle = trunk;
    ctx.fillRect(x - 5 * s, baseY - 34 * s, 10 * s, 34 * s);
    if (type === 0) {
      ctx.fillStyle = leaf1;
      for (let i = 0; i < 3; i++) {
        const w = (46 - i * 13) * s;
        const h = (30 - i * 6) * s;
        const yy = baseY - (12 + i * 16) * s;
        ctx.beginPath();
        ctx.moveTo(x - w / 2, yy + h / 2);
        ctx.lineTo(x, yy - h / 2);
        ctx.lineTo(x + w / 2, yy + h / 2);
        ctx.closePath();
        ctx.fill();
      }
    } else if (type === 1) {
      ctx.fillStyle = leaf1;
      ctx.beginPath();
      ctx.arc(x, baseY - 46 * s, 27 * s, 0, TAU);
      ctx.fill();
      ctx.fillStyle = leaf2;
      ctx.beginPath();
      ctx.arc(x - 17 * s, baseY - 37 * s, 16 * s, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 15 * s, baseY - 30 * s, 14 * s, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = leaf1;
      ctx.beginPath();
      ctx.ellipse(x, baseY - 58 * s, 16 * s, 27 * s, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = leaf2;
      ctx.beginPath();
      ctx.ellipse(x - 6 * s, baseY - 66 * s, 11 * s, 16 * s, -0.4, 0, TAU);
      ctx.fill();
    }
  }

  const FAR_PALETTES = [
    { trunk: "#3a4a35", leaf1: "#3e5f3f", leaf2: "#466a44" },
    { trunk: "#37452f", leaf1: "#45623c", leaf2: "#4f6f42" },
  ];
  const MID_PALETTES = [
    { trunk: "#5b4632", leaf1: "#4e7a45", leaf2: "#57884c" },
    { trunk: "#57422f", leaf1: "#527a3f", leaf2: "#5d8745" },
  ];
  const FRONT_PALETTES = [
    { trunk: "#2c4031", leaf1: "#2f4633", leaf2: "#36523a" },
    { trunk: "#28392c", leaf1: "#33492f", leaf2: "#3a5233" },
  ];

  function drawTreeRow(list, p, baseY, palettes) {
    for (const tr of list) {
      const sx = tr.x - camX * p;
      if (sx < -160 || sx > W + 160) continue;
      const pal = palettes[tr.tint];
      drawTree(sx, baseY, tr.type, tr.s, pal.trunk, pal.leaf1, pal.leaf2);
    }
  }

  function drawPath() {
    // 草地
    const g = ctx.createLinearGradient(0, H * 0.5, 0, H);
    g.addColorStop(0, "#7aa35c");
    g.addColorStop(1, "#4c7a41");
    ctx.fillStyle = g;
    ctx.fillRect(0, H * 0.5, W, H * 0.5);

    // 泥路主体
    ctx.beginPath();
    for (let sx = -20; sx <= W + 20; sx += 8) {
      const wx = sx + camX;
      ctx.lineTo(sx, pathY(wx) - halfPath(wx));
    }
    for (let sx = W + 20; sx >= -20; sx -= 8) {
      const wx = sx + camX;
      ctx.lineTo(sx, pathY(wx) + halfPath(wx));
    }
    ctx.closePath();
    ctx.fillStyle = "#c89b67";
    ctx.fill();
    ctx.strokeStyle = "rgba(90,60,30,0.30)";
    ctx.lineWidth = 5;
    ctx.stroke();

    // 路中间被走亮的浅色带
    ctx.beginPath();
    for (let sx = -20; sx <= W + 20; sx += 8) {
      const wx = sx + camX;
      ctx.lineTo(sx, pathY(wx) - halfPath(wx) * 0.55);
    }
    for (let sx = W + 20; sx >= -20; sx -= 8) {
      const wx = sx + camX;
      ctx.lineTo(sx, pathY(wx) + halfPath(wx) * 0.55);
    }
    ctx.closePath();
    ctx.fillStyle = "#d3aa74";
    ctx.fill();

    // 两道车辙
    for (const off of [-22, 22]) {
      ctx.beginPath();
      for (let sx = -20; sx <= W + 20; sx += 8) {
        const wx = sx + camX;
        ctx.lineTo(sx, pathY(wx) + off - halfPath(wx) * 0.35);
      }
      for (let sx = W + 20; sx >= -20; sx -= 8) {
        const wx = sx + camX;
        ctx.lineTo(sx, pathY(wx) + off + halfPath(wx) * 0.35);
      }
      ctx.closePath();
      ctx.fillStyle = "rgba(140,95,55,0.30)";
      ctx.fill();
    }

    // 路上小石子
    ctx.fillStyle = "#a8835c";
    for (const p of pebbles) {
      const sx = p.x - camX;
      if (sx < -20 || sx > W + 20) continue;
      ctx.beginPath();
      ctx.ellipse(sx, p.y, 4 * p.s, 2.6 * p.s, 0, 0, TAU);
      ctx.fill();
    }
  }

  function drawDecor() {
    // 草丛
    ctx.lineCap = "round";
    for (const tu of tufts) {
      const sx = tu.x - camX;
      if (sx < -30 || sx > W + 30) continue;
      ctx.strokeStyle = "rgba(93,148,72,0.85)";
      ctx.lineWidth = 2.2;
      for (let i = -1; i <= 1; i++) {
        const ang = i * 0.55 + (tu.x % 1) * 0.2;
        const len = (10 + (tu.x % 5)) * tu.s;
        ctx.beginPath();
        ctx.moveTo(sx, tu.y);
        ctx.lineTo(sx + Math.sin(ang) * len, tu.y - Math.cos(ang) * len);
        ctx.stroke();
      }
    }
    // 花
    for (const fl of flowers) {
      const sx = fl.x - camX;
      if (sx < -30 || sx > W + 30) continue;
      ctx.strokeStyle = "#4c7a41";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(sx, fl.y);
      ctx.lineTo(sx, fl.y - 9);
      ctx.stroke();
      ctx.fillStyle = fl.c;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        ctx.beginPath();
        ctx.arc(sx + Math.cos(a) * 3, fl.y - 11 + Math.sin(a) * 3, 2.1, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = "#f9e58c";
      ctx.beginPath();
      ctx.arc(sx, fl.y - 11, 1.8, 0, TAU);
      ctx.fill();
    }
    // 石头
    for (const st of stones) {
      const sx = st.x - camX;
      if (sx < -30 || sx > W + 30) continue;
      ctx.fillStyle = "#9b8a72";
      ctx.beginPath();
      ctx.ellipse(sx, st.y, 9 * st.s, 6 * st.s, st.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.ellipse(
        sx - 2 * st.s,
        st.y - 2 * st.s,
        4 * st.s,
        2.4 * st.s,
        st.r,
        0,
        TAU,
      );
      ctx.fill();
    }
  }

  function drawBushes() {
    for (const b of bushes) {
      const sx = b.x - camX * 1.05;
      if (sx < -80 || sx > W + 80) continue;
      const sy = pathY(b.x) + b.y;
      ctx.fillStyle = b.side > 0 ? "#3f6b3d" : "#355c34";
      ctx.beginPath();
      ctx.arc(sx - 14 * b.s, sy, 17 * b.s, 0, TAU);
      ctx.arc(sx + 12 * b.s, sy + 4 * b.s, 15 * b.s, 0, TAU);
      ctx.arc(sx, sy - 10 * b.s, 14 * b.s, 0, TAU);
      ctx.fill();
    }
  }

  function drawItems() {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const it of items) {
      const sx = it.x - camX;
      if (sx < -130 || sx > W + 130) continue;
      const sy = pathY(it.x);
      const done = collected.has(it.mem.id); // 已拾取 = 点亮
      const bob = Math.sin(t * 2.2 + it.x) * (done ? 3 : 5);
      const dist = Math.abs(playerX - it.x);
      const boost = clamp(1 - dist / 420, 0, 1); // 走近时更亮
      const pulse = 0.5 + Math.sin(t * 3 + it.x) * 0.5;

      if (done) {
        // ── 已拾取：点亮（金色暖光，物品保持可见） ──
        const g = ctx.createRadialGradient(
          sx,
          sy - 44 + bob,
          4,
          sx,
          sy - 44 + bob,
          42,
        );
        g.addColorStop(0, "rgba(255,216,120,0.55)");
        g.addColorStop(1, "rgba(255,216,120,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy - 44 + bob, 42, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,216,120,0.7)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy - 44 + bob, 23 + Math.sin(t * 2 + it.x) * 1.5, 0, TAU);
        ctx.stroke();
      } else {
        // ── 未拾取：光柱 + 大光晕 + 大图标（一眼可见） ──
        // 向上的光柱
        const beamH = 130 + pulse * 24 + boost * 34;
        const bg = ctx.createLinearGradient(0, sy, 0, sy - beamH);
        bg.addColorStop(0, rgba(it.mem.color, 0.4 + boost * 0.15));
        bg.addColorStop(1, rgba(it.mem.color, 0));
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(sx - 9, sy);
        ctx.lineTo(sx - 26, sy - beamH);
        ctx.lineTo(sx + 26, sy - beamH);
        ctx.lineTo(sx + 9, sy);
        ctx.closePath();
        ctx.fill();
        // 大光晕
        const g = ctx.createRadialGradient(
          sx,
          sy - 44 + bob,
          4,
          sx,
          sy - 44 + bob,
          46 + pulse * 10 + boost * 16,
        );
        g.addColorStop(0, rgba(it.mem.color, 0.65 + boost * 0.15));
        g.addColorStop(1, rgba(it.mem.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy - 44 + bob, 46 + pulse * 10 + boost * 16, 0, TAU);
        ctx.fill();
        // 光环
        ctx.strokeStyle = rgba(it.mem.color, 0.65);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(sx, sy - 44 + bob, 27 + pulse * 5 + boost * 8, 0, TAU);
        ctx.stroke();
      }

      // 地面阴影
      ctx.fillStyle = "rgba(30,40,20,0.25)";
      ctx.beginPath();
      ctx.ellipse(sx, sy + 2, 13, 4, 0, 0, TAU);
      ctx.fill();

      // 物品 emoji（未拾取更大更明显；已拾取稍小、稳定发光）
      ctx.font = done
        ? '30px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'
        : '46px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
      ctx.fillText(it.mem.emoji, sx, sy - 44 + bob);

      // 已拾取：✓ 徽记
      if (done) {
        ctx.fillStyle = "#ffe3a1";
        ctx.beginPath();
        ctx.arc(sx + 17, sy - 58 + bob, 7.5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#3a2a10";
        ctx.font = 'bold 10px "PingFang SC",sans-serif';
        ctx.fillText("✓", sx + 17, sy - 58 + bob);
      }
    }
  }

  /* ================= 角色 ================= */
  function limb(x, y, ang, len, color, w = 6) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sin(ang) * len, y + Math.cos(ang) * len);
    ctx.stroke();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  function drawPlayer() {
    const sx = playerX - camX;
    const sy = pathY(playerX);
    const moving = state === "walking" && (holding || clickTarget !== null);
    const phase = t * 8;
    const amp = moving ? 0.55 : 0.05;
    const legA = Math.sin(phase) * amp;
    const legB = Math.sin(phase + Math.PI) * amp;
    const armA = Math.sin(phase + Math.PI) * amp * 0.9;
    const armB = Math.sin(phase) * amp * 0.9;
    const bob = moving
      ? Math.abs(Math.sin(phase)) * 2.2
      : Math.sin(t * 2) * 0.8;
    const hipY = sy - 20 + bob;
    const shY = hipY - 13;

    // 影子（不随朝向翻转）
    ctx.fillStyle = "rgba(30,40,20,0.28)";
    ctx.beginPath();
    ctx.ellipse(sx, sy - 1, 16, 4.5, 0, 0, TAU);
    ctx.fill();

    // 身体部分按朝向水平镜像（往回走时面朝左）
    ctx.save();
    ctx.translate(sx, 0);
    ctx.scale(facing, 1);
    ctx.translate(-sx, 0);

    // 后腿
    limb(sx - 2, hipY, legA, 20, "#4a3b2f");
    // 后臂
    limb(sx + 1, shY, armA, 14, "#3f6b5f");
    // 背包
    ctx.fillStyle = "#6b4f35";
    roundRect(sx - 14, shY + 1, 6, 12, 3);
    // 身体
    ctx.fillStyle = "#4a7c6f";
    roundRect(sx - 8, shY - 1, 16, 15, 5);
    // 围巾（尾部随步伐轻摆）
    ctx.fillStyle = "#c8503f";
    roundRect(sx - 9, shY - 4, 7, 3.4, 2);
    roundRect(sx - 13 + Math.sin(t * 8) * 1.2, shY - 1, 5, 3, 1.5);
    // 头
    ctx.fillStyle = "#f2c49b";
    ctx.beginPath();
    ctx.arc(sx + 7, shY - 10, 9, 0, TAU);
    ctx.fill();
    // 头发（女角色长发，男角色短发）
    ctx.fillStyle = "#4a3728";
    if (gender === "female") {
      ctx.beginPath();
      ctx.arc(sx + 6, shY - 12, 10, Math.PI * 0.82, Math.PI * 1.98);
      ctx.fill();
      // 侧发
      ctx.beginPath();
      ctx.ellipse(sx + 13, shY - 6, 2.6, 6.8, -0.25, 0, TAU);
      ctx.fill();
      // 后发/马尾
      ctx.beginPath();
      ctx.ellipse(sx - 2, shY - 5, 3.2, 9.5, 0.35, 0, TAU);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(sx + 6, shY - 12, 9, Math.PI * 0.9, Math.PI * 1.9);
      ctx.fill();
    }
    // 眼睛
    ctx.fillStyle = "#2b241c";
    ctx.beginPath();
    ctx.arc(sx + 11, shY - 10, 1.4, 0, TAU);
    ctx.fill();
    // 前腿
    limb(sx + 3, hipY, legB, 20, "#5b4a3f");
    // 前臂
    limb(sx + 6, shY, armB, 14, "#4a7c6f");

    ctx.restore();
  }

  /* ================= 粒子与氛围 ================= */
  function drawParticles() {
    // 拾取爆点
    for (const b of bursts) {
      const sx = b.x - camX;
      if (sx < -30 || sx > W + 30) continue;
      const a = b.life / b.max;
      ctx.fillStyle = rgba(b.color, a);
      ctx.beginPath();
      ctx.arc(sx, b.y, 3.2 * a + 1.4, 0, TAU);
      ctx.fill();
    }
    // 物品闪光
    for (const s of sparkles) {
      const sx = s.x - camX;
      if (sx < -20 || sx > W + 20) continue;
      const a = s.life / s.max;
      ctx.save();
      ctx.translate(sx, s.y);
      ctx.rotate(s.ph + t * 2);
      ctx.fillStyle = `rgba(255,244,200,${0.7 * a})`;
      ctx.fillRect(-2.2, -0.6, 4.4, 1.2);
      ctx.fillRect(-0.6, -2.2, 1.2, 4.4);
      ctx.restore();
    }
    // 萤火虫
    for (const f of fireflies) {
      const sx = f.x - camX;
      if (sx < -40 || sx > W + 40) continue;
      const px = sx + Math.sin(t * 0.6 + f.ph) * 26;
      const py = f.y + Math.cos(t * 0.45 + f.ph * 1.7) * 14;
      const a = Math.max(0, 0.35 + Math.sin(t * 2.4 + f.ph) * 0.25);
      const g = ctx.createRadialGradient(px, py, 0, px, py, 10);
      g.addColorStop(0, `rgba(255,236,160,${a * 0.55})`);
      g.addColorStop(1, "rgba(255,236,160,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, 10, 0, TAU);
      ctx.fill();
      ctx.fillStyle = `rgba(255,231,140,${a})`;
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, TAU);
      ctx.fill();
    }
    // 飘叶
    for (const l of leaves) {
      const sx = l.x - camX;
      if (sx < -30 || sx > W + 30) continue;
      ctx.save();
      ctx.translate(sx, l.y);
      ctx.rotate(Math.sin(t + l.ph) * 0.8);
      ctx.fillStyle = l.warm
        ? "rgba(214,158,64,0.65)"
        : "rgba(122,163,92,0.65)";
      ctx.beginPath();
      ctx.ellipse(0, 0, 7 * l.s, 3.4 * l.s, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawFog() {
    for (const b of fogBands) {
      const span = W + 900;
      const sx = mod(b.x - camX * 0.35 + t * b.v, span) - 450;
      const g = ctx.createRadialGradient(sx, b.y, 10, sx, b.y, b.w);
      g.addColorStop(0, `rgba(240,246,238,${b.a})`);
      g.addColorStop(1, "rgba(240,246,238,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, b.y, b.w, 0, TAU);
      ctx.fill();
    }
  }

  function drawLightRays() {
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const sway = Math.sin(t * 0.15 + i * 2.1) * 14;
      const x0 = W * 0.5 + i * 130 - 60;
      const w0 = 60 + i * 30;
      ctx.fillStyle = `rgba(255,240,190,${0.05 - i * 0.012})`;
      ctx.beginPath();
      ctx.moveTo(x0 + sway, -20);
      ctx.lineTo(x0 + w0 + sway, -20);
      ctx.lineTo(x0 + w0 + sway + 260, H);
      ctx.lineTo(x0 + sway + 120, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(
      W / 2,
      H / 2,
      H * 0.45,
      W / 2,
      H / 2,
      H * 0.95,
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(10,20,12,0.30)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function draw() {
    drawSky();
    drawClouds();
    drawHills();
    drawTreeRow(farTrees, 0.3, H * 0.6, FAR_PALETTES);
    drawTreeRow(midTrees, 0.6, H * 0.64, MID_PALETTES);
    drawPath();
    drawDecor();
    drawBushes();
    drawItems();
    drawPlayer();
    drawParticles();
    drawFog();
    drawTreeRow(frontTrees, 1.25, H * 0.8, FRONT_PALETTES);
    drawLightRays();
    drawVignette();
  }

  /* ================= 启动 ================= */
  window.UI.bindStart(() => {
    document.getElementById("stage").classList.remove("prestart");
    state = "walking";
    window.UI.toast(
      worldId === "shared"
        ? window.I18N.t("toast.sharedStart", {
            title: window.SHARED_TITLE || "",
          })
        : worldId && worldId !== "default"
          ? window.I18N.t("toast.customStart")
          : window.I18N.t("toast.defaultStart"),
      6500,
    );
  });
  last = performance.now();
  requestAnimationFrame(frame);
};

/* ================= 世界加载 ================= */
(async () => {
  const stage = document.getElementById("stage");

  // 分享链接（#share=… 或 ?share=…）→ 只读体验模式：仅 Start + 音量，不能编辑
  // （?share= 用于 CloudBase 默认域名首次访问的「风险提醒」中间页：点“确定访问”
  // 会丢 hash 但保留 query，这里能从 query 找回分享，避免落入默认故事）
  const sharePayload = window.ShareCode.extractFromLocation(location);
  if (sharePayload) {
    let shared = null;
    let sharedBgmUrl = null;
    if (window.ShareCode.isCloudPayload(sharePayload)) {
      // v2 云端快照（带照片/视频/BGM）：从云数据库+云存储完整还原
      const shareId = window.ShareCloud.shareIdFromHash(sharePayload);
      if (shareId) {
        try {
          const r = await window.ShareCloud.getShareWorld(shareId);
          shared = r.world;
          sharedBgmUrl = r.bgmUrl;
        } catch (e) {
          console.warn("云端分享拉取失败", e);
          const note = document.getElementById("shared-note");
          if (note) {
            note.textContent = window.I18N.t("viewer.notFound");
          }
        }
      }
    } else {
      // v1 纯文字分享（旧链接，兼容）
      try {
        shared = await window.ShareCode.decode(sharePayload);
      } catch (e) {
        console.warn("分享数据解析失败", e);
      }
    }
    if (shared && Array.isArray(shared.memories) && shared.memories.length) {
      // 分享负载自带原故事的完整布局（回忆位置 + 路长）时直接用，
      // 接收方看到的初始位置与角色和原故事完全一致；旧链接则按当前版本重排。
      const hasLayout =
        shared.worldLength > 0 &&
        shared.memories.every((m) => typeof m.x === 'number' && m.x >= 0);
      const config = hasLayout
        ? { ...window.GAME_CONFIG, worldLength: shared.worldLength }
        : window.StoryStore.layoutWorld(shared.memories);
      document.body.classList.add("shared-viewer");
      stage.dataset.world = "shared";
      stage.dataset.shared = "1";
      window.SHARED_TITLE = shared.title || "";
      const note = document.getElementById("shared-note");
      if (note) {
        note.textContent = window.I18N.t("viewer.note", {
          title: shared.title || "",
        });
      }
      window.UI.setStartTitle(shared.title || "");
      if (sharedBgmUrl) window.AUDIO.setCustomBGM(sharedBgmUrl);
      window.GameBoot(config, shared.memories, "shared", shared.gender || "male");
      return;
    }
  }

  stage.dataset.world = window.StoryStore.getActiveWorldId();
  // 开始页标题 = 当前选中的故事（点击哪个故事的「游玩」就显示哪个）
  const activeWorld =
    stage.dataset.world && stage.dataset.world !== "default"
      ? window.StoryStore.getWorld(stage.dataset.world)
      : null;
  window.UI.setStartTitle(
    activeWorld && activeWorld.title
      ? activeWorld.title
      : window.I18N.t("worlds.builtin"),
  );
  let loaded = null;
  try {
    loaded = await window.StoryStore.loadActiveWorld();
  } catch (e) {
    console.warn("加载自定义世界失败，使用内置故事", e);
  }
  if (loaded) {
    stage.dataset.world = loaded.id;
    // 每个故事可以有自己的背景音乐（没有则用内置程序化抒情 BGM）
    if (loaded.bgm) {
      window.AUDIO.setCustomBGM(loaded.bgm);
    }
    window.GameBoot(loaded.config, loaded.memories, loaded.id, loaded.gender);
  } else {
    window.GameBoot(
      window.GAME_CONFIG,
      window.MEMORIES,
      "default",
      window.GAME_SETTINGS.getGender(),
    );
  }
})();

// 同标签页分享链接（仅 hash 变化不会重载页面）：
// 分享负载与当前模式不一致时整页刷新（加链接→只读模式，清链接→回普通模式）
window.addEventListener("hashchange", () => {
  const hasShare = !!window.ShareCode.extractFromHash(location.hash);
  const inShared = document.body.classList.contains("shared-viewer");
  if (hasShare !== inShared) location.reload();
});
