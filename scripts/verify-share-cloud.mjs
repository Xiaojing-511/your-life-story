#!/usr/bin/env node
/* ============================================================
 * 《林间拾忆》云端分享 E2E 验证（headless Chrome + mock 后端）
 *
 * 覆盖链路：
 *  1. 作者页：写入一个带照片的世界 → 「我的游戏」→ 分享
 *     （走 ShareCloud mock 上传）→ 得到 #share=s3.<id> 链接
 *  2. 接收页：打开该链接（?mock=1#share=s3.<id>）
 *     → 进入只读体验模式 → Start → 走到第一段回忆
 *     → #memory-art 里 <img> 加载自 mock 服务器且真实可见
 *  3. 断言无 JS 异常
 *
 * 依赖：仓库根目录跑；需要本机 Chrome：
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
 * ============================================================ */
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';

const ROOT = process.cwd();
const CHROME = process.env.CHROME ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP_PORT = 8090;
const MOCK_PORT = 8091;
const CDP_PORT = 9223;
const APP = `http://127.0.0.1:${APP_PORT}`;
const MOCK = `http://127.0.0.1:${MOCK_PORT}/mock-share`;
const MOCK_DIR = process.env.MOCK_DIR || path.join(os.tmpdir(), 'mls-mock-e2e');
const PROFILE = '/tmp/mls-cdp-share-e2e';

const children = [];
function spawnBg(cmd, args, opts = {}) {
  const c = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  let out = '';
  c.stdout.on('data', (d) => { out += d; });
  c.stderr.on('data', (d) => { out += d; });
  c._out = () => out;
  children.push(c);
  return c;
}
function killAll() {
  for (const c of children) { try { c.kill('SIGKILL'); } catch (e) { /* */ } }
}
process.on('exit', killAll);
process.on('SIGINT', () => { killAll(); process.exit(130); });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- PNG 生成（1x1 红色像素，真实可解码） ---------- */
function makePng(w = 1, h = 1) {
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8bit RGB
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0;
    for (let x = 0; x < w; x++) {
      raw[y * (1 + w * 3) + 1 + x * 3] = 255;
      raw[y * (1 + w * 3) + 2 + x * 3] = 60;
      raw[y * (1 + w * 3) + 3 + x * 3] = 60;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const PNG_B64 = makePng().toString('base64');

/* ---------- CDP 极简客户端 ---------- */
async function newTarget(url) {
  const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  if (!r.ok) throw new Error('chrome /json/new 失败: ' + r.status);
  return r.json();
}
async function cdpConnect(t) {
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws error')); });
  let seq = 0;
  const pend = new Map();
  const errors = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id) {
      const p = pend.get(m.id);
      if (p) { pend.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
    } else if (m.method === 'Runtime.consoleAPICalled') {
      if (m.params.type === 'error' || m.params.type === 'assert') {
        errors.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
      }
    } else if (m.method === 'Runtime.exceptionThrown') {
      errors.push((m.params.exceptionDetails.exception?.description) || m.params.exceptionDetails.text || 'exception');
    } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      errors.push(m.params.entry.text);
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++seq;
    pend.set(id, { resolve: res, reject: rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails.exception?.description || r.exceptionDetails.text;
      throw new Error('evaluate 异常: ' + d);
    }
    return r.result.value;
  };
  const waitFor = async (expr, timeout = 20000, interval = 250, label = expr) => {
    const t0 = Date.now();
    let last;
    while (Date.now() - t0 < timeout) {
      try { last = await evaluate(expr); if (last) return last; } catch (e) { last = e.message; }
      await sleep(interval);
    }
    throw new Error('超时等待: ' + label + ' (last=' + String(last).slice(0, 300) + ')');
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');
  return { ws, send, evaluate, waitFor, errors };
}

const results = [];
function check(name, cond, detail = '') {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  —  ' + detail : ''}`);
}
const assertEqual = (a, b, name) => check(name, a === b, `期望=${JSON.stringify(b)} 实际=${JSON.stringify(a)}`);

async function main() {
  // 清理并启动服务
  await fs.rm(MOCK_DIR, { recursive: true, force: true });
  await fs.rm(PROFILE, { recursive: true, force: true });
  const staticSrv = spawnBg('python3', ['-m', 'http.server', String(APP_PORT), '--bind', '127.0.0.1'], { cwd: ROOT });
  const mockSrv = spawnBg('node', ['scripts/mock-share-server.mjs', String(MOCK_PORT)], { cwd: ROOT, env: { ...process.env, MOCK_DIR } });
  await sleep(800);
  const chrome = spawnBg(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    `--user-data-dir=${PROFILE}`,
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    `--remote-debugging-port=${CDP_PORT}`, 'about:blank',
  ]);
  // 等 CDP 就绪
  for (let i = 0; i < 40; i++) {
    try { await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`); break; } catch (e) { await sleep(250); }
  }

  /* ========== 作者页 A：造一个有照片的世界并分享 ========== */
  const a = await cdpConnect(await newTarget(`${APP}/?mock=1`));
  await a.waitFor("document.readyState === 'complete' && !!window.GameBoot", 15000, 300, '作者页加载');

  // 写入世界（localStorage + IndexedDB 照片）
  await a.evaluate(`
    (async () => {
      const bin = atob(${JSON.stringify(PNG_B64)});
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'image/png' });
      const world = {
        id: 'e2e-w', title: 'E2E 云端故事', name: 'Tester',
        origin: 'manual', gender: 'female',
        memories: [{ id: 'e2e-m1', title: '回到童年', emoji: '🌻', color: '#e07b8a', text: ['第一段回忆。', '第二段回忆。'], image: 'image' }],
      };
      window.StoryStore.saveWorld(world);
      await window.StoryStore.putAsset('e2e-w', 'e2e-m1', 'image', blob);
      return world.id;
    })()
  `);
  check('作者页：写入世界成功', true);

  // 打开「我的游戏」并点该世界的「分享」
  await a.evaluate("document.getElementById('btn-worlds').click(); true");
  await a.waitFor("!!document.querySelector('.world-card')", 8000, 200, '我的游戏列表');
  const card = await a.evaluate(`(() => {
    const cards = [...document.querySelectorAll('.world-card')];
    const c = cards.find((x) => (x.querySelector('.world-card-title')?.textContent || '').includes('E2E 云端故事'));
    if (!c) return null;
    const btn = [...c.querySelectorAll('button')].find((b) => b.textContent.includes('分享') && !b.textContent.includes('已分享'));
    if (!btn) return null;
    btn.click();
    return 'clicked';
  })()`);
  check('作者页：点世界卡的「分享」', card === 'clicked', String(card));

  // 等分享链接生成（mock 上传 + finalize）
  const url = await a.waitFor(
    "document.getElementById('share-url') && document.getElementById('share-url').value.startsWith('http') ? document.getElementById('share-url').value : ''",
    25000, 300, '生成云端分享链接',
  );
  check('作者页：得到分享链接', /#share=s3\.[A-Za-z0-9]+/.test(url), url);
  check('作者页：链接同时带 ?share=（中间页丢 hash 后仍能找回）', url.indexOf('?share=s3.') >= 0, url);
  const shareId = /#share=s3\.([A-Za-z0-9]+)/.exec(url)[1];

  /* ========== 接收页 C：只带 ?share=（模拟中间页丢 hash 的恢复路径） ========== */
  const cPage = await cdpConnect(await newTarget(`${APP}/?mock=1&share=s3.${shareId}`));
  await cPage.waitFor("document.body.classList.contains('shared-viewer')", 20000, 300, 'query 分享进入只读体验模式');
  check('接收页：?share= 无 hash 也能进入只读体验模式', true);
  const cNote = await cPage.evaluate("(document.getElementById('shared-note') || {}).textContent || ''");
  check('接收页：query 分享显示来源', cNote.includes('E2E 云端故事'), cNote);
  const cStage = await cPage.evaluate("(document.getElementById('stage') || {}).dataset.world || ''");
  check('接收页：世界为 shared（不会落入默认故事）', cStage === 'shared', cStage);
  const cErr = cPage.errors.filter((s) => !s.includes('favicon') && !s.includes('Autoplay'));
  check('接收页 C：无 JS 异常', cErr.length === 0, cErr.slice(0, 3).join(' | '));

  /* ========== 接收页 B：打开链接，只读体验，走到回忆看图片 ========== */
  const b = await cdpConnect(await newTarget(`${APP}/?mock=1#share=s3.${shareId}`));
  await b.waitFor("document.body.classList.contains('shared-viewer')", 20000, 300, '进入只读体验模式');
  check('接收页：进入只读体验模式', true);

  const note = await b.evaluate("(document.getElementById('shared-note') || {}).textContent || ''");
  check('接收页：显示分享来源', note.includes('E2E 云端故事'), note);

  // Start → 开始走
  await b.evaluate("document.getElementById('btn-start').click(); true");
  await b.waitFor("!document.getElementById('stage').classList.contains('prestart')", 5000, 200, '开始游戏');
  // 按住空格走（直到进入第一段回忆）
  await b.evaluate("window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true })); true");
  await b.waitFor(
    "!document.getElementById('memory-screen').classList.contains('hidden')",
    15000, 300, '走到第一段回忆（弹层出现）',
  );
  await b.evaluate("window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true })); true");
  check('接收页：触发回忆弹层', true);

  // 关键断言：回忆里的 <img> 来自 mock 服务器且真实加载完成
  const imgInfo = await b.waitFor(`(() => {
    const img = document.querySelector('#memory-art img');
    if (!img) return null;
    return { src: img.src, complete: img.complete, naturalWidth: img.naturalWidth };
  })()`, 10000, 250, '回忆配图渲染');
  check('接收页：回忆出现 <img>', !!imgInfo && !!imgInfo.src, imgInfo && imgInfo.src);
  check(
    '接收页：图片来自 mock 服务器',
    !!imgInfo && imgInfo.src.startsWith(`http://127.0.0.1:${MOCK_PORT}/files/${shareId}/`),
    imgInfo && imgInfo.src,
  );
  check(
    '接收页：图片真实加载可见',
    !!imgInfo && imgInfo.complete === true && imgInfo.naturalWidth > 0,
    `complete=${imgInfo && imgInfo.complete} naturalWidth=${imgInfo && imgInfo.naturalWidth}`,
  );

  // 弹层文案也应来自快照
  const memTitle = await b.evaluate("(document.getElementById('memory-title') || {}).textContent || ''");
  check('接收页：回忆标题来自快照', memTitle.includes('回到童年'), memTitle);

  // JS 异常检查（接收页的浏览器控制台）
  const aErrors = a.errors.filter((s) => !s.includes('favicon') && !s.includes('Autoplay'));
  const bErrors = b.errors.filter((s) => !s.includes('favicon') && !s.includes('Autoplay'));
  check('作者页：无 JS 异常', aErrors.length === 0, aErrors.slice(0, 3).join(' | '));
  check('接收页：无 JS 异常', bErrors.length === 0, bErrors.slice(0, 3).join(' | '));

  /* 收尾输出 */
  const failed = results.filter((r) => !r.pass);
  console.log(`\n结果：${results.length - failed.length}/${results.length} 通过`);
  if (failed.length) {
    console.log('失败项：');
    for (const f of failed) console.log('  ✗', f.name, '—', f.detail);
  }
  // 显式退出（清掉 CDP WebSocket 句柄，避免进程挂住）
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error('E2E 失败：', e && e.message);
  console.error('--- 静态服务日志 ---\n' + (children[0] && children[0]._out()));
  console.error('--- mock 服务日志 ---\n' + (children[1] && children[1]._out()));
  process.exit(1);
});
