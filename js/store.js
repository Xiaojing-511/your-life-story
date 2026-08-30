/* ============================================================
 * 《林间拾忆》数据存储层
 *
 * 设计说明：
 *  - 纯本地存储（无后端）：每个浏览器环境 = 一个用户
 *    （localStorage key `mls-user` 里存一个随机 userId 作为身份）
 *  - 世界列表/元信息：localStorage `mls-worlds`
 *  - 世界完整数据（回忆文本、配置，不含二进制）：localStorage `mls-world:<id>`
 *  - 照片/视频等二进制资产：IndexedDB `mls-assets`
 *    （localStorage 只有 ~5MB，放不下视频，所以二进制走 IndexedDB）
 *  - 活动世界：localStorage `mls-active`（'default' = 内置故事）
 *  - 支持导出/导入世界为 JSON（照片内嵌为 dataURL，视频不内嵌）
 * ============================================================ */
window.StoryStore = (() => {
  'use strict';

  const LS = {
    user: 'mls-user',
    worlds: 'mls-worlds', // { v: 1, worlds: [{ id, title, createdAt, updatedAt, origin, count }] }
    active: 'mls-active', // 'default' 或 worldId
    worldPrefix: 'mls-world:',
  };
  const DB_NAME = 'mls-assets';
  const DB_VER = 1;
  const STORE = 'assets';

  const uuid = () =>
    crypto.randomUUID
      ? crypto.randomUUID()
      : 'u-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);

  const lsGet = (k, fb) => {
    try {
      const s = localStorage.getItem(k);
      return s ? JSON.parse(s) : fb;
    } catch (e) {
      return fb;
    }
  };
  const lsSet = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
      console.warn('localStorage 写入失败', e);
    }
  };

  /* ================= 用户身份 ================= */
  function ensureUser() {
    let u = lsGet(LS.user, null);
    if (!u || !u.userId) {
      u = {
        userId: uuid(),
        name: '',
        createdAt: Date.now(),
      };
      lsSet(LS.user, u);
    }
    return u;
  }
  function getUser() {
    return ensureUser();
  }
  function setUserName(name) {
    const u = ensureUser();
    u.name = (name || '').slice(0, 20);
    lsSet(LS.user, u);
    return u;
  }

  /* ================= 世界元信息 ================= */
  function listWorlds() {
    return lsGet(LS.worlds, { v: 1, worlds: [] }).worlds || [];
  }
  function saveWorldMeta(meta) {
    const d = lsGet(LS.worlds, { v: 1, worlds: [] });
    const i = d.worlds.findIndex((w) => w.id === meta.id);
    if (i >= 0) d.worlds[i] = meta;
    else d.worlds.push(meta);
    lsSet(LS.worlds, d);
  }
  function removeWorldMeta(id) {
    const d = lsGet(LS.worlds, { v: 1, worlds: [] });
    d.worlds = d.worlds.filter((w) => w.id !== id);
    lsSet(LS.worlds, d);
  }

  /* ================= 世界数据（JSON 部分） ================= */
  function saveWorld(world) {
    world.v = 1;
    world.updatedAt = Date.now();
    if (!world.createdAt) world.createdAt = world.updatedAt;
    if (!world.id) world.id = uuid();
    lsSet(LS.worldPrefix + world.id, world);
    saveWorldMeta({
      id: world.id,
      title: world.title || '我的人生',
      createdAt: world.createdAt,
      updatedAt: world.updatedAt,
      origin: world.origin || 'manual',
      count: (world.memories || []).length,
    });
    return world;
  }
  function getWorld(id) {
    return lsGet(LS.worldPrefix + id, null);
  }
  function deleteWorld(id) {
    localStorage.removeItem(LS.worldPrefix + id);
    removeWorldMeta(id);
    deleteWorldAssets(id);
    if (getActiveWorldId() === id) setActiveWorld('default');
  }

  /* ================= 活动世界 ================= */
  function getActiveWorldId() {
    return localStorage.getItem(LS.active) || 'default';
  }
  function setActiveWorld(id) {
    localStorage.setItem(LS.active, id || 'default');
  }

  /* ================= IndexedDB 二进制资产 ================= */
  let dbPromise = null;
  function db() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VER);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(STORE)) {
            req.result.createObjectStore(STORE, { keyPath: 'key' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }
  const idbPut = (rec) =>
    db().then(
      (d) =>
        new Promise((resolve, reject) => {
          const t = d.transaction(STORE, 'readwrite');
          t.objectStore(STORE).put(rec);
          t.oncomplete = () => resolve();
          t.onerror = () => reject(t.error);
        }),
    );
  const idbGet = (key) =>
    db().then(
      (d) =>
        new Promise((resolve, reject) => {
          const t = d.transaction(STORE, 'readonly');
          const r = t.objectStore(STORE).get(key);
          r.onsuccess = () => resolve(r.result || null);
          r.onerror = () => reject(r.error);
        }),
    );
  const idbDelete = (key) =>
    db().then(
      (d) =>
        new Promise((resolve, reject) => {
          const t = d.transaction(STORE, 'readwrite');
          t.objectStore(STORE).delete(key);
          t.oncomplete = () => resolve();
          t.onerror = () => reject(t.error);
        }),
    );
  const idbDeletePrefix = (prefix) =>
    db().then(
      (d) =>
        new Promise((resolve, reject) => {
          const t = d.transaction(STORE, 'readwrite');
          const s = t.objectStore(STORE);
          const cur = s.openCursor();
          cur.onsuccess = () => {
            const c = cur.result;
            if (c) {
              if (String(c.key).startsWith(prefix)) c.delete();
              c.continue();
            }
          };
          t.oncomplete = () => resolve();
          t.onerror = () => reject(t.error);
        }),
    );

  const assetKey = (worldId, memId, kind) => `${worldId}:${memId}:${kind}`;

  async function putAsset(worldId, memId, kind, blob) {
    await idbPut({
      key: assetKey(worldId, memId, kind),
      worldId,
      memId,
      kind,
      blob,
      mime: blob.type,
      size: blob.size,
      at: Date.now(),
    });
  }
  async function getAsset(worldId, memId, kind) {
    return idbGet(assetKey(worldId, memId, kind));
  }
  async function deleteAsset(worldId, memId, kind) {
    await idbDelete(assetKey(worldId, memId, kind));
  }
  async function deleteWorldAssets(worldId) {
    await idbDeletePrefix(worldId + ':');
  }

  /* ================= 每个故事的背景音乐（按世界存储） ================= */
  async function putWorldBGM(worldId, blob) {
    await putAsset(worldId, 'bgm', 'bgm', blob);
  }
  async function getWorldBGM(worldId) {
    return getAsset(worldId, 'bgm', 'bgm');
  }
  async function deleteWorldBGM(worldId) {
    await deleteAsset(worldId, 'bgm', 'bgm');
  }

  /* ================= 加载活动世界（供游戏启动） ================= */
  // 返回 { id, title, origin, config, memories, bgm }（二进制已换成 objectURL，
  // bgm 为这个世界自定义的背景音乐 Blob，没有则为 null），
  // 活动世界为内置时返回 null（游戏用默认数据）。
  async function loadActiveWorld() {
    const id = getActiveWorldId();
    if (!id || id === 'default') return null;
    const w = getWorld(id);
    if (!w || !Array.isArray(w.memories)) return null;
    const memories = [];
    for (const m of w.memories) {
      const mem = { ...m, text: [...(m.text || [])] };
      if (m.image === 'image') {
        const a = await getAsset(id, m.id, 'image');
        mem.image = a ? URL.createObjectURL(a.blob) : null;
      }
      if (m.video === 'video') {
        const a = await getAsset(id, m.id, 'video');
        if (a) mem.video = { url: URL.createObjectURL(a.blob), poster: mem.image || undefined };
        else mem.video = null;
      }
      memories.push(mem);
    }
    let bgm = null;
    if (w.bgm === true) {
      const a = await getWorldBGM(id);
      if (a && a.blob) bgm = a.blob;
    }
    return {
      id,
      title: w.title || '我的人生',
      origin: w.origin || 'manual',
      gender: w.gender === 'female' ? 'female' : 'male',
      // 路长始终按当前记忆段数重算（x 位置不变，只保证结尾路不会太长）
      config: layoutWorld(memories),
      memories,
      bgm,
    };
  }

  /* ================= 布局：回忆位置与路长 ================= */
  // 让 AI 不输出 x/id，位置由程序按时间线顺序均匀排布（AI 输出更可控）。
  // 路长按记忆段数决定：最后一幕之后只留一小段「结尾步行」，
  // 避免记忆少时后面拖着长长的空路。
  function layoutWorld(memories) {
    const n = Math.max(0, memories.length);
    const speed = (window.GAME_CONFIG && window.GAME_CONFIG.walkSpeed) || 180;
    const step = Math.min(950, Math.max(700, Math.floor(7200 / Math.max(1, n))));
    memories.forEach((m, i) => {
      m.x = 400 + i * step;
    });
    const lastX = n > 0 ? 400 + (n - 1) * step : 0;
    const tail = Math.round(speed * 3); // 最后一幕后的结尾步行（约 3 秒）
    const worldLength = Math.max(1600, lastX + tail + 60);
    return { ...window.GAME_CONFIG, worldLength };
  }

  /* ================= 导出 / 导入 ================= */
  const blobToDataURL = (blob) =>
    new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  const dataURLToBlob = (dataURL) => {
    const [head, b64] = dataURL.split(',');
    const mime = /data:(.*?);/.exec(head)[1];
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  };

  // 照片以内嵌 dataURL 导出（压缩后很小）；视频不内嵌（体积太大），导出时会跳过并标记。
  async function exportWorld(id) {
    const w = getWorld(id);
    if (!w) return null;
    const out = JSON.parse(JSON.stringify(w));
    for (const m of out.memories) {
      if (m.image === 'image') {
        const a = await getAsset(id, m.id, 'image');
        if (a) m.image = await blobToDataURL(a.blob);
        else m.image = null;
      }
      if (m.video === 'video') {
        m.video = null;
        m._videoSkipped = true;
      }
    }
    out.exportedAt = Date.now();
    return JSON.stringify(out);
  }

  async function importWorld(json) {
    let w;
    try {
      w = JSON.parse(json);
    } catch (e) {
      throw new Error(window.I18N.t('import.errJson'));
    }
    if (!w || !Array.isArray(w.memories)) throw new Error(window.I18N.t('import.errData'));
    if (!w.id) w.id = uuid();
    if (!w.createdAt) w.createdAt = Date.now();
    for (const m of w.memories) {
      if (!m.id) m.id = uuid();
      m.text = Array.isArray(m.text) ? m.text.filter((t) => typeof t === 'string') : [];
      if (typeof m.image === 'string' && m.image.startsWith('data:')) {
        const blob = dataURLToBlob(m.image);
        await putAsset(w.id, m.id, 'image', blob);
        m.image = 'image';
      } else if (m.image !== 'image') {
        m.image = null;
      }
      m.video = m.video === 'video' ? 'video' : null;
      if (m.video === 'video' && w.origin === undefined) {
        // 兼容旧导出：没有资产时降级为无视频
        m.video = null;
      }
    }
    if (!w.config) w.config = { ...window.GAME_CONFIG };
    w.origin = w.origin || 'manual';
    saveWorld(w);
    return w;
  }

  return {
    uuid,
    getUser,
    setUserName,
    listWorlds,
    saveWorld,
    getWorld,
    deleteWorld,
    getActiveWorldId,
    setActiveWorld,
    putAsset,
    getAsset,
    deleteAsset,
    deleteWorldAssets,
    putWorldBGM,
    getWorldBGM,
    deleteWorldBGM,
    loadActiveWorld,
    layoutWorld,
    exportWorld,
    importWorld,
  };
})();
