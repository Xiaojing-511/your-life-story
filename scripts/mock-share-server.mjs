#!/usr/bin/env node
/* ============================================================
 * 《林间拾忆》本地 mock 分享服务（开发/自动化测试用）
 *
 * 模拟云端分享的 HTTP 契约，文件存本机临时目录，无需 CloudBase：
 *   PUT  /mock-share/upload?path=<cloudPath>      存媒体文件
 *   POST /mock-share/invoke                       云函数动作：
 *     finalize / get / revoke（契约与 cloud/functions/shareApi 一致）
 *   GET  /files/<shareId>/<rest>                   读媒体文件（模拟公网 URL）
 *
 * 用法：
 *   node scripts/mock-share-server.mjs [port]
 * 默认端口 8091，存储目录 MOCK_DIR（默认 os.tmpdir()/mls-mock-share）。
 * 网页端联调：把 js/site-config.js 的 cloud.mockBase 临时设为
 *   http://127.0.0.1:8091/mock-share
 * ============================================================ */
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PORT = Number(process.argv[2] || process.env.MOCK_PORT || 8091);
const HOST = '127.0.0.1';
const BASE = `http://${HOST}:${PORT}`;
const ROOT = process.env.MOCK_DIR || path.join(os.tmpdir(), 'mls-mock-share');
const DB_FILE = path.join(ROOT, 'db.json');

const MIME_EXT = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', img: 'image/png',
  mp4: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/quicktime',
  m4v: 'video/x-m4v', vid: 'video/mp4', bin: 'application/octet-stream',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', wav: 'audio/wav',
  weba: 'audio/webm', aud: 'audio/mpeg',
};

async function loadDb() {
  try { return JSON.parse(await fs.readFile(DB_FILE, 'utf8')); } catch (e) { return {}; }
}
async function saveDb(db) {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db));
}
const ok = (data) => Object.assign({ ok: true }, data);
const fail = (code, message) => ({ ok: false, code, message });

const json = (res, code, obj) => {
  cors(res);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
};
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-*');
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

function renderWorld(doc, shareId) {
  const base = `${BASE}/files/${shareId}`;
  const urlFor = (p) => {
    const rest = String(p || '').replace(/^shares\/[^/]+\//, '');
    return rest ? `${base}/${rest}` : null;
  };
  const memories = (doc.memories || []).map((m) => {
    const media = m.media || {};
    let image = media.image ? urlFor(media.image.path) : null;
    let video = null;
    if (media.video) {
      video = { url: urlFor(media.video.path), poster: image || undefined };
    }
    return {
      id: m.id || '',
      title: m.title || '',
      emoji: m.emoji || '🍃',
      color: m.color || '#d4a24e',
      x: typeof m.x === 'number' && m.x >= 0 ? m.x : null,
      text: Array.isArray(m.text) ? m.text : [],
      image,
      video,
    };
  });
  return {
    world: {
      title: doc.title || '',
      name: doc.name || '',
      origin: doc.origin || 'manual',
      gender: doc.gender === 'female' ? 'female' : 'male',
      worldLength: Number(doc.worldLength) > 0 ? Number(doc.worldLength) : 0,
      createdAt: doc.createdAt || 0,
      memories,
    },
    bgmUrl: doc.bgm ? urlFor(doc.bgm.path) : null,
  };
}

const server = http.createServer(async (req, res) => {
  cors(res);
  const u = new URL(req.url, BASE);
  try {
    /* CORS 预检 */
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }
    /* ---------- 上传媒体 ---------- */
    if (req.method === 'PUT' && u.pathname === '/mock-share/upload') {
      const cloudPath = u.searchParams.get('path') || '';
      if (!/^shares\/[A-Za-z0-9]+\//.test(cloudPath)) return json(res, 400, fail('badPath', 'cloudPath 不合法'));
      const [, shareId, rest] = /^shares\/([A-Za-z0-9]+)\/(.+)$/.exec(cloudPath);
      const filePath = path.join(ROOT, shareId, rest);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, await readBody(req));
      return json(res, 200, ok({ fileID: 'mock:' + cloudPath }));
    }

    /* ---------- 云函数动作 ---------- */
    if (req.method === 'POST' && u.pathname === '/mock-share/invoke') {
      const event = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      const action = event.action;
      const db = await loadDb();
      if (action === 'finalize') {
        const payload = event.payload;
        const shareId = String((payload && payload.shareId) || '');
        if (!/^[A-Za-z0-9]{6,32}$/.test(shareId)) return json(res, 400, fail('badPayload', 'shareId 不合法'));
        const exist = db[shareId];
        if (exist && exist.creatorUid && exist.creatorUid !== 'mock-user') {
          return json(res, 409, fail('exists', 'shareId 已被占用'));
        }
        db[shareId] = Object.assign({}, payload, { creatorUid: 'mock-user', state: 'active' });
        await saveDb(db);
        return json(res, 200, ok({ shareId }));
      }
      if (action === 'get') {
        const doc = db[String(event.shareId || '')];
        if (!doc || doc.state !== 'active') return json(res, 404, fail('notfound', '分享不存在或已被撤回'));
        return json(res, 200, ok(renderWorld(doc, doc.shareId)));
      }
      if (action === 'revoke') {
        const id = String(event.shareId || '');
        const doc = db[id];
        if (doc) {
          if (doc.creatorUid && doc.creatorUid !== 'mock-user') {
            return json(res, 403, fail('forbidden', '只能撤回自己创建的分享'));
          }
          await fs.rm(path.join(ROOT, id), { recursive: true, force: true });
          delete db[id];
          await saveDb(db);
        }
        return json(res, 200, ok({}));
      }
      return json(res, 400, fail('badAction', '未知操作'));
    }

    /* ---------- 读媒体文件（模拟公网 URL） ---------- */
    const fm = /^\/files\/([A-Za-z0-9]+)\/(.+)$/.exec(u.pathname);
    if (fm && req.method === 'GET') {
      const filePath = path.join(ROOT, fm[1], fm[2]);
      let buf;
      try { buf = await fs.readFile(filePath); } catch (e) {
        return json(res, 404, fail('notfound', '文件不存在'));
      }
      const ext = path.extname(fm[2]).slice(1).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_EXT[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      });
      return res.end(buf);
    }

    json(res, 404, fail('notfound', 'no such endpoint'));
  } catch (e) {
    json(res, 500, fail('sys', (e && e.message) || String(e)));
  }
});

await fs.mkdir(ROOT, { recursive: true });
server.listen(PORT, HOST, () => {
  console.log(`mock share server: ${BASE}/mock-share  (store: ${ROOT})`);
});
