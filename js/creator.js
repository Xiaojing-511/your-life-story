/* ============================================================
 * 《林间拾忆》「make your life story…」创作器
 *
 * 流程：收集素材（打字/语音）→ AI 生成回忆（GLM）→ 编辑（文字/
 * 图标/颜色/照片/视频）→ 一键生成并游玩；支持多世界保存、反复
 * 修改、重新生成、导出/导入。
 * ============================================================ */
window.Creator = (() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]));

  /* ---------- 状态 ---------- */
  let phase = 'collect'; // collect | edit
  let editingWorldId = null; // 正在编辑的世界（null = 新建）
  let currentTitle = '';
  let currentName = '';
  let currentOrigin = 'ai';
  let currentMaterial = {};
  let memories = []; // [{ id, title, emoji, color, text[], _img, _vid }]
  let busy = false;
  let storyMenuOpen = false; // 右上角故事切换菜单是否展开
  let returnToGame = false; // 从游戏内打开的界面，关闭后回到游戏而非开始页
  let currentMode = 'manual'; // 创作模式：ai（智能生成）/ manual（手动创作）
  let currentBGM = null; // 当前编辑故事的背景音乐（Blob，null = 用内置旋律）
  let currentGender = 'male'; // 当前编辑故事的角色（male / female）

  // 分享链接打开的只读体验模式：禁止创作/管理
  function isViewer() {
    return document.body.classList.contains('shared-viewer');
  }

  function msg(text, type) {
    const el = $('creator-msg');
    el.textContent = text || '';
    el.className = 'creator-msg' + (type ? ' ' + type : '');
  }
  function setBusy(v, text) {
    busy = v;
    const el = $('creator-msg');
    if (v) {
      el.textContent = text || '';
      el.className = 'creator-msg busy';
    }
    document.querySelectorAll('#creator-screen button').forEach((b) => {
      b.disabled =
        (v && !b.classList.contains('creator-close')) ||
        b.classList.contains('perm-disabled');
    });
  }

  /* ================= 打开 / 关闭 ================= */
  function open() {
    if (isViewer()) return; // 分享链接的只读体验模式：禁止进入创作器
    window.AUDIO.unlock();
    editingWorldId = null;
    currentOrigin = 'ai';
    currentName = window.StoryStore.getUser().name || '';
    currentMaterial = {};
    currentTitle = '';
    currentBGM = null;
    currentGender = 'male';
    memories = [];
    syncBGMUI();
    syncGenderUI();
    $('c-name').value = currentName;
    $('c-life').value = '';
    $('c-count').value = '5';
    msg('');
    currentMode = defaultMode();
    renderMode();
    $('creator-collect').classList.remove('hidden');
    $('creator-edit').classList.add('hidden');
    $('worlds-screen').classList.add('hidden');
    $('settings-screen').classList.add('hidden');
    $('creator-screen').classList.remove('hidden');
    window.UI.hideAllScreens();
  }

  function close() {
    $('creator-screen').classList.add('hidden');
    $('worlds-screen').classList.add('hidden');
    window.UI.showStart();
  }

  // 从游戏内打开的界面关闭后：回到游戏（安静暂停 → 恢复行走）
  function returnFromGameUI() {
    returnToGame = false;
    storyMenuOpen = false;
    $('story-menu').classList.add('hidden');
    $('creator-screen').classList.add('hidden');
    $('worlds-screen').classList.add('hidden');
    $('settings-screen').classList.add('hidden');
    // 从开始页打开的管理界面：关闭后回到开始页；游戏内则恢复行走
    const stage = document.getElementById('stage');
    if (stage && stage.classList.contains('prestart')) {
      window.UI.showStart();
    } else if (window.GameHooks) {
      window.GameHooks.resume();
    }
  }

  /* ================= 创作模式：智能生成 / 手动创作 ================= */
  // 默认模式：配过 API Key → 智能生成；没配过 → 手动创作（非技术用户开箱即用）
  function defaultMode() {
    const stored = window.AI.getMode();
    if (stored) return stored;
    return window.AI.hasKey() ? 'ai' : 'manual';
  }

  function setMode(mode) {
    currentMode = mode;
    window.AI.setMode(mode);
    renderMode();
  }

  function renderMode() {
    document.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === currentMode);
    });
    $('collect-ai').classList.toggle('hidden', currentMode !== 'ai');
    $('collect-manual').classList.toggle('hidden', currentMode !== 'manual');
    const tip = $('mode-tip');
    if (tip) {
      tip.textContent =
        currentMode === 'ai'
          ? window.I18N.t('creator.modeTip.ai')
          : window.I18N.t('creator.modeTip.manual');
    }
    const regen = $('btn-regenerate');
    if (regen) regen.classList.toggle('hidden', currentMode !== 'ai');
    const back = $('btn-back-material');
    if (back) {
      back.textContent = currentMode === 'ai'
        ? window.I18N.t('creator.backMaterial')
        : window.I18N.t('creator.back');
    }
    updateAIStatus();
  }

  // AI 状态提示（大白话，非技术用户也能看懂）
  function updateAIStatus() {
    const el = $('ai-status');
    if (!el) return;
    if (currentMode !== 'ai') {
      el.textContent = '';
      el.className = 'ai-status';
      return;
    }
    const s = window.AI.getSettings();
    if (s.key) {
      el.textContent = window.I18N.t('creator.aiStatus.ok', { model: s.model });
      el.className = 'ai-status ok';
    } else {
      el.textContent = window.I18N.t('creator.aiStatus.warn');
      el.className = 'ai-status warn';
    }
  }

  function openAISettings() {
    const d = $('ai-settings-details');
    if (d) d.open = true;
  }

  /* ================= 右上角「用户」故事切换 ================= */
  function openStoryMenu() {
    renderStoryMenu();
    storyMenuOpen = true;
    $('story-menu').classList.remove('hidden');
    if (window.GameHooks) window.GameHooks.pauseQuietly();
  }
  function closeStoryMenu() {
    if (!storyMenuOpen) return false;
    storyMenuOpen = false;
    $('story-menu').classList.add('hidden');
    if (window.GameHooks) window.GameHooks.resume();
    return true;
  }
  function toggleStoryMenu() {
    storyMenuOpen ? closeStoryMenu() : openStoryMenu();
  }

  function renderStoryMenu() {
    const active = window.StoryStore.getActiveWorldId();
    const user = window.StoryStore.getUser();
    const head = document.querySelector('#story-menu .story-menu-head');
    if (head) {
      head.textContent = user && user.name
        ? window.I18N.t('menu.headName', { name: user.name })
        : window.I18N.t('menu.head');
    }
    const list = $('story-menu-list');
    list.innerHTML = '';
    list.appendChild(
      storyMenuItem('default', window.I18N.t('worlds.builtin'), '', active === 'default'),
    );
    const worlds = window.StoryStore.listWorlds().sort((a, b) => b.updatedAt - a.updatedAt);
    for (const meta of worlds) {
      list.appendChild(
        storyMenuItem(
          meta.id,
          meta.title || window.I18N.t('title.mine'),
          window.I18N.t('menu.meta', { n: meta.count || 0 }),
          active === meta.id,
        ),
      );
    }
    if (!worlds.length) {
      const hint = document.createElement('div');
      hint.className = 'story-menu-empty';
      hint.textContent = window.I18N.t('menu.empty');
      list.appendChild(hint);
    }
  }

  function storyMenuItem(id, title, sub, current) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'story-menu-item' + (current ? ' current' : '');
    b.innerHTML =
      `<span class="smi-title">${esc(title)}</span>` +
      (sub ? `<span class="smi-sub">${esc(sub)}</span>` : '') +
      (current ? `<span class="smi-cur">${window.I18N.t('menu.current')}</span>` : '');
    b.addEventListener('click', () => {
      closeStoryMenu();
      if (current) return;
      window.StoryStore.setActiveWorld(id);
      location.reload();
    });
    return b;
  }

  // 返回 true 表示 Esc 已被处理（关闭了菜单/游戏内界面）
  function handleEscape() {
    if (storyMenuOpen) return closeStoryMenu();
    if (returnToGame) {
      returnFromGameUI();
      return true;
    }
    return false;
  }

  /* ================= 收集素材（表单） ================= */
  function collectForm() {
    currentName = $('c-name').value.trim();
    // 一个按时间顺序的大输入框，AI 自己负责整理分类
    currentMaterial = { life: $('c-life').value.trim() };
  }
  function fillForm() {
    $('c-name').value = currentName;
    const m = currentMaterial || {};
    $('c-life').value =
      (typeof m.life === 'string' ? m.life : '') ||
      // 兼容旧版分类素材：按人生阶段顺序拼接回来
      ['childhood', 'school', 'love', 'work', 'loss', 'other']
        .map((k) => (m[k] || '').trim())
        .filter(Boolean)
        .join('\n');
    $('c-count').value = String(Math.max(3, Math.min(8, memories.length || 5)));
  }

  /* ================= AI 生成 ================= */
  async function generate({ keepWorld } = {}) {
    collectForm();
    const count = Math.max(3, Math.min(8, parseInt($('c-count').value, 10) || 5));
    setBusy(true, window.I18N.t('creator.busyGen'));
    try {
      persistAiForm(); // 填了 Key 直接生成也会记住（全局设置）
      const res = await window.AI.generateMemories({
        name: currentName,
        material: currentMaterial,
        count,
      });
      currentTitle = res.title;
      currentOrigin = 'ai';
      memories = res.memories.map((m) => ({
        id: window.StoryStore.uuid(),
        title: m.title,
        emoji: m.emoji,
        color: m.color,
        text: [...m.text],
        _img: null,
        _vid: null,
      }));
      if (!keepWorld) editingWorldId = null;
      enterEdit();
    } catch (e) {
      if (/api\s*key|key/i.test(e.message)) {
        msg(window.I18N.t('creator.errNoKey'), 'err');
        openAISettings();
      } else {
        msg(window.I18N.t('creator.errGen', { msg: e.message }), 'err');
      }
    }
    setBusy(false);
  }

  async function regenerate() {
    collectForm();
    $('c-count').value = String(Math.max(3, memories.length || 5));
    await generate({ keepWorld: true });
  }

  // 手动创作：直接进入编辑，不需要任何配置
  function startManual() {
    setMode('manual');
    collectForm();
    currentOrigin = 'manual';
    currentTitle = currentName
      ? window.I18N.t('title.of', { name: currentName })
      : window.I18N.t('title.mine');
    memories = [blankMemory()];
    editingWorldId = null;
    enterEdit();
  }

  function blankMemory() {
    return {
      id: window.StoryStore.uuid(),
      title: window.I18N.t('creator.emptyTitle'),
      emoji: '🍃',
      color: window.AI.PALETTE[0],
      text: [window.I18N.t('creator.emptyText')],
      _img: null,
      _vid: null,
    };
  }

  /* ================= 编辑阶段 ================= */
  // 每个故事自己的角色：显示选中状态
  function syncGenderUI() {
    document.querySelectorAll('.gen-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.gender === currentGender);
    });
  }
  // 每个故事自己的背景音乐：显示当前状态
  function syncBGMUI() {
    const nameEl = $('world-bgm-name');
    const removeBtn = $('btn-world-bgm-remove');
    if (currentBGM) {
      const nm = currentBGM.name || currentBGM.type || 'audio';
      nameEl.textContent = window.I18N.t('creator.bgmSet', { name: nm });
      if (removeBtn) removeBtn.classList.remove('hidden');
    } else {
      nameEl.textContent = '';
      if (removeBtn) removeBtn.classList.add('hidden');
    }
  }
  function bindWorldBGM() {
    const up = $('btn-world-bgm');
    const file = $('world-bgm-file');
    if (up && file) {
      up.addEventListener('click', () => file.click());
      file.addEventListener('change', async () => {
        const f = file.files[0];
        file.value = '';
        if (!f) return;
        if (!/^audio\//.test(f.type)) {
          window.UI.toast(window.I18N.t('creator.bgmErr', { msg: 'not audio' }));
          return;
        }
        if (f.size > 20 * 1024 * 1024) {
          window.UI.toast(window.I18N.t('creator.bgmTooBig', { size: (f.size / 1048576).toFixed(1) }));
          return;
        }
        currentBGM = f;
        syncBGMUI();
        window.UI.toast(window.I18N.t('creator.bgmSetToast'));
      });
    }
    const remove = $('btn-world-bgm-remove');
    if (remove) {
      remove.addEventListener('click', () => {
        currentBGM = null;
        syncBGMUI();
        window.UI.toast(window.I18N.t('creator.bgmRemovedToast'));
      });
    }
  }

  function enterEdit() {
    phase = 'edit';
    $('creator-collect').classList.add('hidden');
    $('creator-edit').classList.remove('hidden');
    $('c-world-title').value = currentTitle || '';
    renderEdit();
  }

  function backToCollect() {
    phase = 'collect';
    fillForm();
    renderMode();
    $('creator-edit').classList.add('hidden');
    $('creator-collect').classList.remove('hidden');
    msg('');
  }

  function renderEdit() {
    const list = $('creator-mem-list');
    const editingNote = editingWorldId
      ? window.I18N.t('creator.editNote.existing')
      : window.I18N.t('creator.editNote.new');
    $('creator-edit-note').textContent = editingNote;
    list.innerHTML = '';
    memories.forEach((m, i) => {
      const card = document.createElement('div');
      card.className = 'mem-edit-card';
      card.dataset.i = String(i);
      const colorOpts = window.AI.PALETTE.map(
        (c) => `<option value="${c}"${c === m.color ? ' selected' : ''}>${c}</option>`,
      ).join('');
      const T = window.I18N.t;
      card.innerHTML = `
        <div class="mem-edit-head">
          <span class="mem-no">#${i + 1}</span>
          <input class="mem-edit-title" value="${esc(m.title)}" placeholder="${T('creator.titlePh')}" maxlength="20">
          <input class="mem-edit-emoji" value="${esc(m.emoji)}" maxlength="4" size="2" title="emoji">
          <select class="mem-edit-color" title="${T('creator.color')}">${colorOpts}</select>
          <button class="mem-btn" data-act="up" title="${T('creator.up')}">↑</button>
          <button class="mem-btn" data-act="down" title="${T('creator.down')}">↓</button>
          <button class="mem-btn mem-del" data-act="del" title="${T('creator.del')}">✕</button>
        </div>
        <div class="mem-edit-texts">
          ${m.text
            .map(
              (p, pi) => `
            <div class="mem-text-row">
              <textarea class="mem-text-input" data-pi="${pi}" rows="2" maxlength="160" placeholder="${T('creator.textPh')}">${esc(p)}</textarea>
              <button class="mem-btn" data-act="text-del" data-pi="${pi}" title="${T('creator.delPara')}">✕</button>
            </div>`,
            )
            .join('')}
          <button class="mem-btn mem-text-add" data-act="text-add">${T('creator.addPara')}</button>
        </div>
        <div class="mem-edit-assets">
          <button class="mem-btn" data-act="img">${T('creator.img')}</button>
          <button class="mem-btn" data-act="vid">${T('creator.vid')}</button>
          <button class="mem-btn perm-disabled" disabled title="${T('creator.aiImg')}">${T('creator.aiImg')}</button>
          <div class="mem-asset-preview"></div>
        </div>`;
      list.appendChild(card);
      updatePreview(card, m);
    });
  }

  function updatePreview(card, m) {
    const box = card.querySelector('.mem-asset-preview');
    box.innerHTML = '';
    if (m._img) {
      const url = URL.createObjectURL(m._img);
      const img = document.createElement('img');
      img.src = url;
      img.className = 'mem-preview-img';
      const del = document.createElement('button');
      del.className = 'mem-btn';
      del.textContent = window.I18N.t('creator.removeImg');
      del.dataset.act = 'asset-del';
      del.dataset.kind = 'img';
      box.append(img, del);
    }
    if (m._vid) {
      const url = URL.createObjectURL(m._vid);
      const v = document.createElement('video');
      v.src = url;
      v.controls = true;
      v.muted = true;
      v.className = 'mem-preview-vid';
      const del = document.createElement('button');
      del.className = 'mem-btn';
      del.textContent = window.I18N.t('creator.removeVid');
      del.dataset.act = 'asset-del';
      del.dataset.kind = 'vid';
      box.append(v, del);
    }
  }

  /* ---------- 编辑事件（委托） ---------- */
  function bindEditEvents() {
    const list = $('creator-mem-list');
    list.addEventListener('input', (e) => {
      const card = e.target.closest('.mem-edit-card');
      if (!card) return;
      const m = memories[+card.dataset.i];
      if (!m) return;
      if (e.target.classList.contains('mem-edit-title')) m.title = e.target.value;
      else if (e.target.classList.contains('mem-edit-emoji')) m.emoji = e.target.value;
      else if (e.target.classList.contains('mem-edit-color')) m.color = e.target.value;
      else if (e.target.classList.contains('mem-text-input')) m.text[+e.target.dataset.pi] = e.target.value;
    });
    list.addEventListener('click', (e) => {
      const card = e.target.closest('.mem-edit-card');
      if (!card) return;
      const i = +card.dataset.i;
      const m = memories[i];
      if (!m) return;
      const act = e.target.dataset.act;
      if (act === 'up') {
        if (i > 0) {
          [memories[i - 1], memories[i]] = [memories[i], memories[i - 1]];
          renderEdit();
        }
      } else if (act === 'down') {
        if (i < memories.length - 1) {
          [memories[i], memories[i + 1]] = [memories[i + 1], memories[i]];
          renderEdit();
        }
      } else if (act === 'del') {
        memories.splice(i, 1);
        renderEdit();
      } else if (act === 'text-del') {
        m.text.splice(+e.target.dataset.pi, 1);
        renderEdit();
      } else if (act === 'text-add') {
        m.text.push('');
        renderEdit();
        const rows = card.querySelectorAll('.mem-text-input');
        rows[rows.length - 1].focus();
      } else if (act === 'img') {
        pickFile(m, card, 'image/*', 0, 'img');
      } else if (act === 'vid') {
        pickFile(m, card, 'video/*', 15 * 1024 * 1024, 'vid');
      } else if (act === 'asset-del') {
        if (e.target.dataset.kind === 'img') m._img = null;
        else m._vid = null;
        updatePreview(card, m);
      }
    });
  }

  function pickFile(m, card, accept, maxSize, kind) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept;
    inp.addEventListener('change', async () => {
      const f = inp.files[0];
      if (!f) return;
      if (maxSize && f.size > maxSize) {
        window.UI.toast(
          window.I18N.t('creator.fileTooBig', {
            size: (f.size / 1048576).toFixed(1),
            max: Math.round(maxSize / 1048576),
          }),
        );
        return;
      }
      try {
        if (kind === 'img') {
          m._img = await compressImage(f);
        } else {
          m._vid = f;
        }
        updatePreview(card, m);
      } catch (err) {
        window.UI.toast(window.I18N.t('creator.fileErr', { msg: err.message }));
      }
    });
    inp.click();
  }

  // 照片压缩：超过 1280px 等比缩小，转 JPEG（PNG 大图也会被转小）
  async function compressImage(file) {
    if (!file.type.startsWith('image/')) throw new Error(window.I18N.t('creator.errNotImage'));
    if (file.type === 'image/gif' || file.size < 300 * 1024) return file;
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error(window.I18N.t('creator.errImageDecode')));
        i.src = url;
      });
      const max = 1280;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      const blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.82));
      return blob || file;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /* ================= 保存 ================= */
  async function save(play) {
    if (busy) return;
    if (!memories.length) {
      msg(window.I18N.t('creator.errNoMem'), 'err');
      return;
    }
    setBusy(true, play ? window.I18N.t('creator.busyPlay') : window.I18N.t('creator.busySaving'));
    try {
      const worldId = editingWorldId || window.StoryStore.uuid();
      const title =
        $('c-world-title').value.trim() ||
        currentTitle ||
        (currentName
          ? window.I18N.t('title.of', { name: currentName })
          : window.I18N.t('title.mine'));
      const cleaned = memories.map((m) => ({
        id: m.id || window.StoryStore.uuid(),
        title: (m.title || '').trim() || window.I18N.t('creator.emptyTitle'),
        emoji: m.emoji || '🍃',
        color: window.AI.PALETTE.includes(m.color) ? m.color : '#d4a24e',
        text: (m.text || []).map((s) => s.trim()).filter(Boolean),
      }));
      if (!cleaned.length) {
        msg(window.I18N.t('creator.errNoValid'), 'err');
        setBusy(false);
        return;
      }
      const config = window.StoryStore.layoutWorld(cleaned); // 重排 x 与路长
      const world = {
        id: worldId,
        title,
        name: currentName,
        origin: currentOrigin || 'ai',
        mode: currentMode, // 这个故事用 AI 还是手写（编辑页可切换，保存后记住）
        material: currentMaterial,
        config,
        memories: cleaned.map((m) => ({ ...m, image: null, video: null })),
      };
      const srcById = {};
      memories.forEach((m) => {
        srcById[m.id] = m;
      });
      for (const m of world.memories) {
        const src = srcById[m.id] || {};
        if (src._img) {
          await window.StoryStore.putAsset(worldId, m.id, 'image', src._img);
          m.image = 'image';
        } else {
          await window.StoryStore.deleteAsset(worldId, m.id, 'image');
        }
        if (src._vid) {
          await window.StoryStore.putAsset(worldId, m.id, 'video', src._vid);
          m.video = 'video';
        } else {
          await window.StoryStore.deleteAsset(worldId, m.id, 'video');
        }
      }
      // 每个故事的角色
      world.gender = currentGender;
      // 每个故事的背景音乐
      if (currentBGM) {
        await window.StoryStore.putWorldBGM(worldId, currentBGM);
        world.bgm = true;
      } else {
        await window.StoryStore.deleteWorldBGM(worldId);
        world.bgm = false;
      }
      window.StoryStore.saveWorld(world);
      if (currentName) window.StoryStore.setUserName(currentName);
      window.StoryStore.setActiveWorld(worldId);
      editingWorldId = worldId; // 后续保存都更新这个世界
      if (play) {
        location.reload();
        return;
      }
      msg(window.I18N.t('creator.savedOk'), 'ok');
      window.UI.toast(window.I18N.t('creator.savedToast'));
    } catch (e) {
      msg(window.I18N.t('creator.errSave', { msg: e.message }), 'err');
    }
    setBusy(false);
  }

  /* ================= 编辑已保存的世界 ================= */
  async function openWorld(id) {
    const w = window.StoryStore.getWorld(id);
    if (!w) return;
    editingWorldId = id;
    currentTitle = w.title || '';
    currentName = w.name || '';
    currentOrigin = w.origin || 'manual';
    currentMode = w.mode === 'ai' || w.mode === 'manual' ? w.mode : defaultMode();
    currentMaterial = w.material || {};
    memories = (w.memories || []).map((m) => ({
      id: m.id,
      title: m.title,
      emoji: m.emoji,
      color: m.color,
      text: [...(m.text || [])],
      _img: null,
      _vid: null,
      imageMarker: m.image === 'image',
      videoMarker: m.video === 'video',
    }));
    for (const m of memories) {
      if (m.imageMarker) {
        const a = await window.StoryStore.getAsset(id, m.id, 'image');
        if (a) m._img = a.blob;
      }
      if (m.videoMarker) {
        const a = await window.StoryStore.getAsset(id, m.id, 'video');
        if (a) m._vid = a.blob;
      }
    }
    // 加载这个故事的角色与背景音乐
    currentGender = w.gender === 'female' ? 'female' : 'male';
    syncGenderUI();
    currentBGM = null;
    if (w.bgm === true) {
      const a = await window.StoryStore.getWorldBGM(id);
      if (a && a.blob) currentBGM = a.blob;
    }
    syncBGMUI();
    renderMode(); // 按这个故事的 mode 恢复 AI/手动切换
    enterEdit();
  }

  /* ================= 我的游戏 ================= */
  function showWorlds() {
    if (isViewer()) return; // 只读体验模式：没有「我的游戏」
    window.AUDIO.unlock();
    $('creator-screen').classList.add('hidden');
    $('settings-screen').classList.add('hidden');
    $('worlds-screen').classList.remove('hidden');
    window.UI.hideAllScreens();
    renderWorlds();
  }

  function renderWorlds() {
    const list = $('worlds-list');
    const active = window.StoryStore.getActiveWorldId();
    list.innerHTML = '';

    // 内置旅程（它也是一个故事：角色在这里配置，而不是在开始页）
    const builtinG = window.GAME_SETTINGS.getGender();
    const builtinCard = worldCard({
      title: window.I18N.t('worlds.builtin'),
      meta: window.I18N.t('worlds.builtinMeta', { n: window.MEMORIES.length }),
      active: active === 'default',
      actions: [
        { label: window.I18N.t('worlds.play'), fn: () => { window.StoryStore.setActiveWorld('default'); location.reload(); } },
      ],
    });
    const gRow = document.createElement('div');
    gRow.className = 'world-gender';
    gRow.innerHTML =
      `<span class="world-gender-label">${esc(window.I18N.t('worlds.gender'))}</span>` +
      `<button type="button" class="gender-btn gender-btn-sm${builtinG === 'male' ? ' active' : ''}" data-g="male">${esc(window.I18N.t('gender.male'))}</button>` +
      `<button type="button" class="gender-btn gender-btn-sm${builtinG === 'female' ? ' active' : ''}" data-g="female">${esc(window.I18N.t('gender.female'))}</button>`;
    gRow.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-g]');
      if (!btn) return;
      window.GAME_SETTINGS.setGender(btn.dataset.g === 'female' ? 'female' : 'male');
      renderWorlds();
    });
    const builtinActs = builtinCard.querySelector('.world-card-actions');
    builtinCard.insertBefore(gRow, builtinActs);
    list.appendChild(builtinCard);

    // 用户的世界
    const worlds = window.StoryStore
      .listWorlds()
      .sort((a, b) => b.updatedAt - a.updatedAt);
    if (!worlds.length) {
      const empty = document.createElement('p');
      empty.className = 'worlds-empty';
      empty.textContent = window.I18N.t('worlds.empty');
      list.appendChild(empty);
    }
    for (const meta of worlds) {
      const w = window.StoryStore.getWorld(meta.id);
      const date = new Date(meta.updatedAt);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const originText = (w && w.origin === 'ai')
        ? window.I18N.t('worlds.originAi')
        : window.I18N.t('worlds.originManual');
      list.appendChild(
        worldCard({
          title: meta.title || window.I18N.t('title.mine'),
          meta: window.I18N.t('worlds.meta', { n: meta.count || 0, origin: originText, date: dateStr }),
          active: active === meta.id,
          actions: [
            { label: window.I18N.t('worlds.play'), fn: () => { window.StoryStore.setActiveWorld(meta.id); location.reload(); } },
            { label: window.I18N.t('worlds.edit'), fn: () => { $('worlds-screen').classList.add('hidden'); window.Creator.openWorld(meta.id); } },
            { label: window.I18N.t('worlds.share'), fn: () => showShareDialog(meta.id) },
            { label: window.I18N.t('worlds.export'), fn: () => exportWorld(meta.id) },
            { label: window.I18N.t('worlds.delete'), fn: () => { if (confirm(window.I18N.t('worlds.confirmDel', { title: meta.title }))) { window.StoryStore.deleteWorld(meta.id); renderWorlds(); } } },
          ],
        }),
      );
    }
  }

  function worldCard({ title, meta, active, actions }) {
    const div = document.createElement('div');
    div.className = 'world-card';
    const head = document.createElement('div');
    head.className = 'world-card-head';
    head.innerHTML = `<span class="world-card-title">${esc(title)}</span>${active ? `<span class="world-card-current">${window.I18N.t('worlds.current')}</span>` : ''}`;
    const metaEl = document.createElement('div');
    metaEl.className = 'world-card-meta';
    metaEl.textContent = meta;
    const acts = document.createElement('div');
    acts.className = 'world-card-actions';
    for (const a of actions) {
      const b = document.createElement('button');
      b.className = 'btn-ghost small';
      b.textContent = a.label;
      b.addEventListener('click', a.fn);
      acts.appendChild(b);
    }
    div.append(head, metaEl, acts);
    return div;
  }

  async function exportWorld(id) {
    try {
      const json = await window.StoryStore.exportWorld(id);
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const w = window.StoryStore.getWorld(id);
      a.download = ((w && w.title) || 'your-life-story').replace(/[\\/:*?"<>|]/g, '_') + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      window.UI.toast(window.I18N.t('export.ok'));
    } catch (e) {
      window.UI.toast(window.I18N.t('export.err', { msg: e.message }));
    }
  }

  /* ================= 分享 ================= */
  async function showShareDialog(worldId) {
    const w = window.StoryStore.getWorld(worldId);
    if (!w) return;
    try {
      const payload = await window.ShareCode.encode(w);
      const url = window.ShareCode.makeShareUrl(payload);
      $('share-url').value = url;
      const sys = $('btn-share-system');
      if (sys) sys.classList.toggle('hidden', !navigator.share);
      $('worlds-screen').classList.add('hidden');
      $('settings-screen').classList.add('hidden');
      $('share-screen').classList.remove('hidden');
      window.I18N.applyStatic();
    } catch (e) {
      alert(window.I18N.t('share.fail', { msg: e.message }));
    }
  }
  function closeShareDialog() {
    $('share-screen').classList.add('hidden');
    $('worlds-screen').classList.remove('hidden');
    renderWorlds();
  }
  async function copyShareUrl() {
    const input = $('share-url');
    const url = input.value;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        input.focus();
        input.select();
        document.execCommand('copy');
      }
      const b = $('btn-share-copy');
      const old = b.textContent;
      b.textContent = window.I18N.t('share.copied');
      setTimeout(() => { b.textContent = old; }, 1600);
    } catch (e) {
      input.focus();
      input.select();
    }
  }
  function systemShare() {
    const url = $('share-url').value;
    if (navigator.share) {
      navigator.share({ title: 'your life story', url }).catch(() => {});
    }
  }

  async function onImport(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const w = await window.StoryStore.importWorld(await f.text());
      window.UI.toast(window.I18N.t('import.ok', { title: w.title || window.I18N.t('title.mine') }));
      renderWorlds();
    } catch (err) {
      alert(window.I18N.t('import.err', { msg: err.message }));
    }
  }

  /* ================= AI 设置 ================= */
  function persistAiForm() {
    return window.AI.saveSettings({
      key: $('ai-key').value.trim(),
      model: $('ai-model').value.trim() || 'glm-4-flash',
      base: $('ai-base').value.trim() || 'https://open.bigmodel.cn/api/paas/v4',
    });
  }
  function saveAiSettings() {
    persistAiForm();
    updateAIStatus();
    window.UI.toast(window.I18N.t('creator.settingsSaved'));
  }
  async function testAi() {
    saveAiSettings();
    msg(window.I18N.t('creator.testing'));
    try {
      const r = await window.AI.testConnection();
      msg(
        r
          ? window.I18N.t('creator.testOk', { r })
          : window.I18N.t('creator.testOk', { r: 'ok' }),
        'ok',
      );
    } catch (e) {
      msg(window.I18N.t('creator.testFail', { msg: e.message }), 'err');
    }
    updateAIStatus();
  }

  /* ================= 全局设置（右上角 ⚙️） ================= */
  function openSettings() {
    const s = window.AI.getSettings();
    $('set-ai-key').value = s.key;
    $('set-ai-model').value = s.model;
    $('set-ai-base').value = s.base;
    const m = $('settings-msg');
    m.textContent = '';
    m.className = 'creator-msg';
    $('creator-screen').classList.add('hidden');
    $('worlds-screen').classList.add('hidden');
    $('share-screen').classList.add('hidden');
    $('settings-screen').classList.remove('hidden');
    window.UI.hideAllScreens();
  }
  function saveGlobalSettings() {
    window.AI.saveSettings({
      key: $('set-ai-key').value.trim(),
      model: $('set-ai-model').value.trim() || 'glm-4-flash',
      base: $('set-ai-base').value.trim() || 'https://open.bigmodel.cn/api/paas/v4',
    });
    window.UI.toast(window.I18N.t('creator.settingsSaved'));
  }
  async function testGlobalAi() {
    saveGlobalSettings();
    const m = $('settings-msg');
    m.textContent = window.I18N.t('creator.testing');
    m.className = 'creator-msg busy';
    try {
      const r = await window.AI.testConnection();
      m.textContent = window.I18N.t('creator.testOk', { r: r || 'ok' });
      m.className = 'creator-msg ok';
    } catch (e) {
      m.textContent = window.I18N.t('creator.testFail', { msg: e.message });
      m.className = 'creator-msg err';
    }
  }

  /* ================= 语音输入 ================= */
  function initVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    document.querySelectorAll('.mic-btn').forEach((btn) => {
      if (!SR) {
        btn.disabled = true;
        btn.classList.add('perm-disabled');
        btn.title = window.I18N.t('voice.unsupported');
        return;
      }
      btn.addEventListener('click', () => {
        window.AUDIO.unlock();
        if (btn._rec) {
          btn._rec.stop();
          return;
        }
        const rec = new SR();
        btn._rec = rec;
        rec.lang = window.I18N.isEn() ? 'en-US' : 'zh-CN';
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        const ta = document.getElementById(btn.dataset.target);
        rec.onresult = (e) => {
          const t = Array.from(e.results).map((r) => r[0].transcript).join('');
          if (t) ta.value = (ta.value ? ta.value.replace(/\s+$/, '') + '。' : '') + t;
        };
        const stop = () => {
          btn.classList.remove('recording');
          btn._rec = null;
        };
        rec.onend = stop;
        rec.onerror = stop;
        btn.classList.add('recording');
        try {
          rec.start();
        } catch (e) {
          stop();
        }
      });
    });
  }

  /* ================= 初始化 ================= */
  function init() {
    // 开始页入口（结尾屏按钮 id=btn-make-story，开始页按钮 id=btn-make-story-start）
    $('btn-make-story').addEventListener('click', open);
    $('btn-make-story-start').addEventListener('click', open);
    $('btn-worlds').addEventListener('click', showWorlds);
    // 右上角「用户」故事切换
    $('btn-story-switch').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleStoryMenu();
    });
    $('story-menu-manage').addEventListener('click', () => {
      returnToGame = true;
      storyMenuOpen = false;
      $('story-menu').classList.add('hidden');
      showWorlds();
    });
    $('story-menu-make').addEventListener('click', () => {
      returnToGame = true;
      storyMenuOpen = false;
      $('story-menu').classList.add('hidden');
      open();
    });
    // 右上角 ⚙️ 全局设置
    $('story-menu-settings').addEventListener('click', () => {
      returnToGame = true;
      storyMenuOpen = false;
      $('story-menu').classList.add('hidden');
      openSettings();
    });
    $('settings-close').addEventListener('click', () => {
      if (returnToGame) returnFromGameUI();
      else close();
    });
    $('btn-settings-save').addEventListener('click', saveGlobalSettings);
    $('btn-settings-test').addEventListener('click', testGlobalAi);
    document.addEventListener('click', (e) => {
      if (storyMenuOpen && !e.target.closest('#story-switch')) closeStoryMenu();
    });
    // 关闭
    $('creator-close').addEventListener('click', () => {
      if (returnToGame) returnFromGameUI();
      else close();
    });
    $('worlds-close').addEventListener('click', () => {
      if (returnToGame) returnFromGameUI();
      else close();
    });
    // 收集
    $('btn-ai-generate').addEventListener('click', () => {
      setMode('ai');
      generate({ keepWorld: false });
    });
    $('btn-manual-start').addEventListener('click', startManual);
    // 模式切换（收集页 + 编辑页都有）
    document.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });
    // 编辑
    $('btn-play').addEventListener('click', () => save(true));
    $('btn-save-draft').addEventListener('click', () => save(false));
    $('btn-regenerate').addEventListener('click', regenerate);
    $('btn-add-memory').addEventListener('click', () => {
      memories.push(blankMemory());
      renderEdit();
    });
    $('btn-back-material').addEventListener('click', backToCollect);
    bindEditEvents();
    bindWorldBGM();
    // 故事角色（男/女）
    document.querySelectorAll('.gen-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentGender = btn.dataset.gender === 'female' ? 'female' : 'male';
        syncGenderUI();
      });
    });
    // AI 设置
    const s = window.AI.getSettings();
    $('ai-key').value = s.key;
    $('ai-model').value = s.model;
    $('ai-base').value = s.base;
    $('btn-ai-save').addEventListener('click', saveAiSettings);
    $('btn-ai-test').addEventListener('click', testAi);
    // 语音
    initVoice();
    // 我的游戏
    $('btn-worlds-new').addEventListener('click', open);
    $('btn-worlds-import').addEventListener('click', () => $('worlds-import-input').click());
    $('worlds-import-input').addEventListener('change', onImport);
    // 分享对话框
    $('share-close').addEventListener('click', closeShareDialog);
    $('btn-share-copy').addEventListener('click', copyShareUrl);
    $('btn-share-system').addEventListener('click', systemShare);
  }

  init();

  return {
    open,
    openWorld,
    showWorlds,
    close,
    closeStoryMenu,
    handleEscape,
  };
})();
