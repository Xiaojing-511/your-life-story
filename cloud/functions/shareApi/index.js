/* ============================================================
 * 《林间拾忆》云端分享 · 云函数（部署名：shareApi）
 *
 * 职责（web 端通过 @cloudbase/js-sdk callFunction 调用）：
 *  - finalize：把分享快照（文字/布局/媒体清单 + fileID）存进
 *    云数据库 mls_shares（媒体二进制已由浏览器直传云存储）
 *  - get     ：接收方打开 #share=s3.<id> 时调用，把每个媒体
 *    fileID 换成临时公网 URL，返回可直接渲染的 world
 *  - revoke  ：作者撤回：删云存储文件 + 删数据库记录
 *
 * 依赖：@cloudbase/node-sdk（部署时按 package.json 自动安装）
 * 存储安全规则保持默认（仅创建者可读写）即可——写是浏览器匿名
 * 登录后直传自己的文件，读走本函数（管理员权限，绕过规则）。
 * ============================================================ */
const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();
const shares = db.collection('mls_shares');

const ok = (data) => Object.assign({ ok: true }, data);
const fail = (code, message) => ({ ok: false, code, message });

const CHUNK = 50; // deleteFile 单次上限约 50

function uidOf(context) {
  const auth = (context && context.auth) || {};
  return auth.uid || auth.openid || '';
}

async function doFinalize(payload) {
  if (!payload || payload.v !== 2) return fail('badPayload', 'payload 版本不正确');
  const shareId = String(payload.shareId || '');
  if (!/^[A-Za-z0-9]{6,32}$/.test(shareId)) return fail('badPayload', 'shareId 不合法');
  if (!Array.isArray(payload.memories) || payload.memories.length === 0) {
    return fail('badPayload', '缺少 memories');
  }
  const doc = Object.assign({}, payload, {
    state: 'active',
    createdAt: payload.createdAt || Date.now(),
    updatedAt: Date.now(),
  });
  // 同名覆盖保护：只允许同一位创作者覆盖自己的快照
  const exist = await shares.doc(shareId).get().catch(() => null);
  const old = exist && exist.data && exist.data[0];
  if (old && old.creatorUid && old.creatorUid !== doc.creatorUid) {
    return fail('exists', 'shareId 已被占用');
  }
  await shares.doc(shareId).set(doc);
  return ok({ shareId });
}

async function doGet(shareId) {
  if (!/^[A-Za-z0-9]{6,32}$/.test(String(shareId || ''))) {
    return fail('notfound', '分享不存在或已被撤回');
  }
  const exist = await shares.doc(shareId).get().catch(() => null);
  const doc = exist && exist.data && exist.data[0];
  if (!doc || doc.state !== 'active') return fail('notfound', '分享不存在或已被撤回');

  // 收集所有媒体 fileID → 换取临时公网 URL（一次批量请求）
  const ids = [];
  const memMap = [];
  for (const m of doc.memories || []) {
    const media = m.media || {};
    const row = { mem: m, imageId: null, videoId: null };
    if (media.image && media.image.fileID) { row.imageId = media.image.fileID; ids.push(media.image.fileID); }
    if (media.video && media.video.fileID) { row.videoId = media.video.fileID; ids.push(media.video.fileID); }
    memMap.push(row);
  }
  let bgmId = (doc.bgm && doc.bgm.fileID) || null;
  if (bgmId) ids.push(bgmId);

  const urlMap = {};
  if (ids.length) {
    const unique = Array.from(new Set(ids));
    const urlRes = await app.getTempFileURL({
      fileList: unique.map((fileID) => ({ fileID, maxAge: 7 * 86400 })),
    });
    for (const f of (urlRes.fileList || [])) {
      if (f && f.code === 'SUCCESS' && f.tempFileURL) urlMap[f.fileID] = f.tempFileURL;
    }
  }

  const memories = memMap.map(({ mem, imageId, videoId }) => {
    let image = null;
    if (imageId && urlMap[imageId]) image = urlMap[imageId];
    let video = null;
    if (videoId && urlMap[videoId]) {
      video = { url: urlMap[videoId], poster: image || undefined };
    }
    return {
      id: mem.id || '',
      title: mem.title || '',
      emoji: mem.emoji || '🍃',
      color: mem.color || '#d4a24e',
      x: typeof mem.x === 'number' && mem.x >= 0 ? mem.x : null,
      text: Array.isArray(mem.text) ? mem.text : [],
      image,
      video,
    };
  });

  const world = {
    title: doc.title || '',
    name: doc.name || '',
    origin: doc.origin || 'manual',
    gender: doc.gender === 'female' ? 'female' : 'male',
    worldLength: Number(doc.worldLength) > 0 ? Number(doc.worldLength) : 0,
    createdAt: doc.createdAt || 0,
    memories,
  };
  const bgmUrl = bgmId && urlMap[bgmId] ? urlMap[bgmId] : null;
  return ok({ world, bgmUrl });
}

async function doRevoke(shareId, uid) {
  if (!/^[A-Za-z0-9]{6,32}$/.test(String(shareId || ''))) return ok({});
  const exist = await shares.doc(shareId).get().catch(() => null);
  const doc = exist && exist.data && exist.data[0];
  if (!doc) return ok({}); // 已不存在，幂等成功
  if (doc.creatorUid && uid && doc.creatorUid !== uid) {
    return fail('forbidden', '只能撤回自己创建的分享');
  }
  const ids = [];
  for (const m of doc.memories || []) {
    const media = m.media || {};
    if (media.image && media.image.fileID) ids.push(media.image.fileID);
    if (media.video && media.video.fileID) ids.push(media.video.fileID);
  }
  if (doc.bgm && doc.bgm.fileID) ids.push(doc.bgm.fileID);
  const unique = Array.from(new Set(ids));
  for (let i = 0; i < unique.length; i += CHUNK) {
    await app.deleteFile({ fileList: unique.slice(i, i + CHUNK) }).catch(() => {});
  }
  await shares.doc(shareId).remove().catch(() => {});
  return ok({});
}

exports.main = async (event, context) => {
  const action = event && event.action;
  const uid = uidOf(context);
  try {
    if (action === 'finalize') {
      const p = Object.assign({}, event.payload, { creatorUid: uid });
      return await doFinalize(p);
    }
    if (action === 'get') return await doGet(event.shareId);
    if (action === 'revoke') return await doRevoke(event.shareId, uid);
    return fail('badAction', '未知操作');
  } catch (e) {
    return fail('sys', (e && e.message) || String(e));
  }
};
