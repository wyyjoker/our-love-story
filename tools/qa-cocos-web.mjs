/** Run the actual Creator Web Mobile client in an isolated headless Chrome. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(root, 'build/web-mobile');
const chromePath = process.env.COCOS_QA_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
assert.ok(fs.existsSync(path.join(buildDir, 'index.html')), 'Build Web Mobile with Creator first');
assert.ok(fs.existsSync(chromePath), 'Set COCOS_QA_CHROME to a Chrome/Chromium executable');
assert.equal(typeof WebSocket, 'function', 'Use Node.js 22 or newer');
const output = path.join(root, 'temp', `cocos-ui-qa-${new Date().toISOString().replaceAll(/[:.]/g, '-')}`);
fs.mkdirSync(output, { recursive: true });
const profile = path.join(output, 'browser-profile');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const checks = [];
const exceptions = [];
function digestBuild(directory) {
  const hash = createHash('sha256');
  const walk = (folder) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(file);
      else { hash.update(path.relative(directory, file).replaceAll('\\', '/')); hash.update(fs.readFileSync(file)); }
    }
  };
  walk(directory); return hash.digest('hex');
}
const testedBuildDigest = digestBuild(buildDir);
const passed = (name) => { checks.push(name); console.log(`[cocos-ui] PASS ${name}`); };

// Fixtures use the production domain/configuration rather than a duplicate engine.
const compiled = await build({ stdin: { contents: `
  export {createGameContext} from './assets/scripts/gameplay/GameContext';
  export {loadConfigBundle} from './assets/scripts/config/ConfigRepository';
`, resolveDir: root }, bundle: true, platform: 'node', format: 'esm', write: false });
const domain = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const bundle = domain.loadConfigBundle();
const initial = domain.createGameContext({ deterministic: true }).buildSaveData();
const key = bundle.game.saveKey;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const requested = decodeURIComponent(url.pathname);
  const file = requested === '/qa-photo.png' ? path.join(root, 'assets/game_art/generator_sheet.png')
    : path.resolve(buildDir, '.' + (requested === '/' ? '/index.html' : requested));
  if (requested !== '/qa-photo.png' && !file.startsWith(buildDir + path.sep)) { res.writeHead(403).end(); return; }
  try {
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json',
      '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.wasm': 'application/wasm' };
    res.setHeader('Content-Type', types[path.extname(file)] ?? 'application/octet-stream');
    res.end(fs.readFileSync(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const chrome = spawn(chromePath, ['--headless=new', '--no-first-run', '--disable-extensions',
  '--enable-unsafe-swiftshader', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
{ windowsHide: true, stdio: 'ignore' });
let ws;
let send;
try {
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 60 && !fs.existsSync(portFile); i++) await wait(250);
  assert.ok(fs.existsSync(portFile), 'Headless Chrome did not expose its debug port');
  const port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]);
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
  const target = pages.find((page) => page.type === 'page');
  assert.ok(target, 'Headless Chrome page missing');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const m = JSON.parse(event.data);
    if (m.id) {
      const p = pending.get(m.id); if (!p) return;
      clearTimeout(p.timer); pending.delete(m.id);
      if (m.error) p.reject(Error(m.error.message)); else p.resolve(m.result);
    }
    if (m.method === 'Runtime.exceptionThrown') exceptions.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  });
  send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id;
    const timer = setTimeout(() => { pending.delete(n); reject(Error(`CDP timeout: ${method}`)); }, 20000);
    pending.set(n, { resolve, reject, timer }); ws.send(JSON.stringify({ id: n, method, params }));
  });
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const app = "cc.director.getScene().getChildByName('GameRoot').getComponent('GameBootstrap')";
  const ready = async () => {
    for (let i = 0; i < 80; i++) {
      try { if (await ev(`typeof cc !== 'undefined' && ${app}?.game?.bootState==='READY'`)) return; } catch { /* new document */ }
      await wait(250);
    }
    throw Error('Cocos client did not reach READY');
  };
  const load = async (suffix = '') => { await send('Page.navigate', { url: origin + '/' + suffix }); await wait(400); await ready(); await wait(1000); };
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.join(output, `${name}.png`), Buffer.from(r.data, 'base64'));
  };
  const active = (name) => ev(`(()=>{let yes=false;const walk=n=>{if(n.name===${JSON.stringify(name)}&&n.activeInHierarchy)yes=true;n.children.forEach(walk)};walk(cc.director.getScene());return yes})()`);
  const labels = () => ev("(()=>{const s=[];const walk=n=>{const l=n.getComponent(cc.Label);if(l&&n.activeInHierarchy)s.push(l.string);n.children.forEach(walk)};walk(cc.director.getScene());return s})()");
  const coords = (name, index = 0) => ev(`(()=>{const found=[];const walk=n=>{if(n.name===${JSON.stringify(name)}&&n.activeInHierarchy)found.push(n);n.children.forEach(walk)};walk(cc.director.getScene());const n=found[${index}];if(!n)throw Error('Missing '+${JSON.stringify(name)});const p=n.worldPosition,v=cc.view.getVisibleSize();return{x:(p.x+v.width/2)*innerWidth/v.width,y:(v.height/2-p.y)*innerHeight/v.height}})()`);
  const tap = async (name, index = 0) => {
    const p = await coords(name, index);
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...p, id: 1 }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(400);
  };
  const gesture = async (from, to, cancel = false) => {
    const a = await coords('Cell_' + from), b = typeof to === 'number' ? await coords('Cell_' + to) : to;
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...a, id: 1 }] });
    for (let i = 1; i <= 6; i++) {
      await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x - a.x) * i / 6, y: a.y + (b.y - a.y) * i / 6, id: 1 }] }); await wait(35);
    }
    await send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] }); await wait(450);
  };
  const seed = async (mutate) => {
    const data = structuredClone(initial); data.savedAt = Date.now(); data.player.lastEnergyAt = Date.now(); mutate(data);
    await ev(`localStorage.setItem(${JSON.stringify(key)},${JSON.stringify(JSON.stringify(data))});true`);
    await send('Page.reload'); await wait(400); await ready(); await wait(600);
  };
  const cells = () => ev(`${app}.game.board.getBoard().cells`);
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await load(); await shot('cover'); await tap('EnterGame');
  assert.ok(await active('TutorialGesture')); await tap('GenBtn', 0); assert.ok(await active('TutorialGesture')); await shot('drag-guide');
  await gesture(0, 1); assert.equal((await cells())[1].item.definitionId, 'coffee_02');
  await tap('OrderCard', 0); assert.equal(await ev(`${app}.game.life.state.stats.orders`), 1);
  assert.equal(await ev(`${app}.game.player.coins`), 20);
  assert.equal(await ev("(()=>{let c=0;const walk=n=>{if(n.name==='Toast'&&n.activeInHierarchy)c++;n.children.forEach(walk)};walk(cc.director.getScene());return c})()"), 1);
  await shot('merge'); passed('new-player guide, touch merge and single order delivery/feedback');
  await seed((d) => {
    d.tutorial = { generatorClicked: true, firstMergeCompleted: true, firstOrderCompleted: true, firstOrderHintShown: true };
    d.board = Array.from({ length: 81 }, (_, index) => ({ index, ...(index < 5 ? { item: { uid: 'gesture_' + index, definitionId: ['coffee_01', 'coffee_01', 'flower_01', 'coffee_08', 'coffee_08'][index] } } : {}) }));
  });
  await tap('EnterGame'); await gesture(0, 9); assert.equal((await cells())[9].item.definitionId, 'coffee_01');
  await gesture(9, 2); assert.equal((await cells())[9].item.definitionId, 'flower_01');
  const beforeCancel = await cells(); await gesture(2, { x: 3, y: 200 }); assert.deepEqual(await cells(), beforeCancel);
  await gesture(2, { x: 190, y: 450 }, true); assert.deepEqual(await cells(), beforeCancel);
  await gesture(3, 4); assert.ok((await labels()).some((s) => s.includes('最高等级'))); assert.equal(await ev(`${app}.view.board.drag`), null);
  passed('move, swap, outside release, system cancellation and maximum-level feedback');
  await seed((d) => { d.player.level = 3; d.player.xp = 150; d.player.unlockedChainIds.push('flower'); });
  await tap('EnterGame'); assert.ok((await labels()).includes('Lv.2')); await tap('ClaimLevelReward');
  assert.ok((await labels()).includes('花篮 已解锁')); await shot('level3');
  await tap('ClaimLevelReward'); assert.ok((await labels()).includes('Lv.4')); await tap('ClaimLevelReward');
  assert.deepEqual(await ev(`${app}.game.life.state.claimedLevelRewards`), [2, 3, 4]);
  assert.equal(await ev(`${app}.game.player.coins`), 320); assert.equal(await ev(`${app}.game.player.hearts`), 62);
  passed('Lv2-3-4 reward queue, exact rewards and no pending repeat');
  await seed((d) => { d.life.photoPaths = Array.from({ length: 6 }, (_, i) => origin + (i === 5 ? '/missing-photo.png' : '/qa-photo.png?' + i)); });
  await tap('EnterGame'); await tap('Button_回忆'); await tap('Button_拍照留念'); await tap('Button_下一页');
  assert.ok((await labels()).includes('留念 5')); assert.ok((await labels()).some((s) => s.includes('照片暂时无法读取')));
  await tap('Button_', 0); assert.ok((await labels()).includes('留念 5 / 6')); await shot('photo-detail'); await tap('Button_关闭');
  await tap('Button_合成'); await ev("window.qaSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('qa quota')};true");
  await tap('GenBtn', 0); assert.ok(await active('StorageNotice')); await shot('save-failed');
  await ev('Storage.prototype.setItem=window.qaSet;true'); await tap('ConfirmStorageNotice'); assert.equal(await active('StorageNotice'), false);
  assert.equal(await ev(`JSON.parse(localStorage.getItem(${JSON.stringify(key)})).life.stats.spawns`), 1);
  passed('six photos, failed-photo explanation, large preview and failed-save retry');
  await ev(`window.qaGet=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(k===${JSON.stringify(key)})throw Error('qa read');return window.qaGet.call(this,k)};true`);
  await ev('new Promise(resolve=>cc.director.loadScene("Game",()=>setTimeout(()=>resolve(true),700)))');
  assert.ok(await active('RetryBoot')); await shot('read-failed');
  await ev('Storage.prototype.getItem=window.qaGet;true'); await tap('RetryBoot'); await ready(); await tap('EnterGame');
  const goodSave = await ev(`localStorage.getItem(${JSON.stringify(key)})`);
  await ev(`localStorage.setItem(${JSON.stringify(key)},'{broken');true`);
  await ev('new Promise(resolve=>cc.director.loadScene("Game",()=>setTimeout(()=>resolve(true),700)))'); await tap('EnterGame');
  assert.ok((await labels()).some((s) => s.includes('原始数据已备份'))); await shot('corrupt-save-notice');
  await ev(`localStorage.setItem(${JSON.stringify(key)},${JSON.stringify(goodSave)});true`);
  passed('read failure blocks overwrites, retry re-enters and corrupt-save recovery is visible');
  const normalBefore = await ev(`localStorage.getItem(${JSON.stringify(key)})`);
  await load('?preview=lv12'); await tap('EnterGame'); assert.ok((await labels()).includes('320 / 600')); await shot('demo-merge');
  await tap('GenBtn', 0); assert.equal(await ev(`localStorage.getItem(${JSON.stringify(key)})`), normalBefore);
  await load('?preview=lv12'); await tap('EnterGame'); assert.equal(await ev(`${app}.game.player.energy`), 86);
  await tap('Button_家园'); await shot('demo-home'); await tap('Button_任务'); await tap('Button_合成');
  assert.equal(await ev(`${app}.view.lifePages.currentPage`), 'home'); assert.ok(await active('Wishes')); await tap('Button_关闭');
  passed('isolated/resettable Lv12 demonstration and modal input blocking');
  await load();
  for (const mode of ['empty', 'partial', 'full']) {
    const ids = mode === 'empty' ? [] : mode === 'partial' ? ['sofa', 'bed', 'rose_arch'] : bundle.furniture.map((f) => f.id);
    await seed((d) => { d.player.level = 18; d.player.xp = 7650; d.life.claimedLevelRewards = Array.from({ length: 17 }, (_, i) => i + 2); d.life.ownedFurnitureIds = ids; d.life.placedFurnitureIds = [...ids]; d.life.unlockedMemoryIds = bundle.memories.map((m) => m.id); });
    await tap('EnterGame'); await tap('Button_家园');
    for (const [room, title] of [['living', '客厅'], ['bedroom', '卧室'], ['garden', '花园']]) {
      await tap('Button_' + title); await shot(`home-${room}-${mode}`);
      const actual = await ev("(()=>{const a=[];const walk=n=>{if(n.name.startsWith('Placed_')&&n.activeInHierarchy)a.push(n.name.slice(7));n.children.forEach(walk)};walk(cc.director.getScene());return a.sort()})()");
      assert.deepEqual(actual, bundle.furniture.filter((f) => f.room === room && ids.includes(f.id)).map((f) => f.id).sort());
    }
  }
  passed('all three rooms empty, partly furnished and fully furnished');
  await tap('Button_回忆'); await shot('album'); await tap('Button_翻开日记 ›');
  for (let i = 1; i < 10; i++) await tap('Button_下一页');
  assert.ok((await labels()).includes('2026 年 10 月 3 日')); await shot('wedding-diary');
  for (const [width, height] of [[320, 568], [375, 667], [430, 932]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true }); await wait(500);
    await ev('cc.sys.getSafeAreaRect=()=>new cc.Rect(0,68,750,cc.view.getVisibleSize().height-218);true');
    await ev('new Promise(resolve=>cc.director.loadScene("Game",()=>setTimeout(()=>resolve(true),700)))');
    await tap('EnterGame'); await shot('merge-' + width); await tap('Button_回忆'); await shot('album-' + width);
  }
  passed('ten diary chapters and 320/375/430 portrait layouts with simulated safe areas');
  await send('Network.setCacheDisabled', { cacheDisabled: true }); await send('Network.setBlockedURLs', { urls: ['*/assets/game_art/*'] });
  await load('?preview=lv12'); await tap('EnterGame');
  const fallback = await labels(); assert.ok(fallback.includes('咖1'));
  const requiredNames = await ev(`(()=>{const g=${app}.game;return g.orders.getOrders().flatMap(o=>o.requirements.map(r=>g.bundle.catalog.get(r.itemId).displayName))})()`);
  for (const name of requiredNames) assert.ok(fallback.includes(name), 'Missing fallback: ' + name);
  await gesture(0, 1); assert.equal((await cells())[1].item.definitionId, 'coffee_02'); await shot('art-failure');
  passed('readable board/order fallback and working merge when art downloads fail');
  assert.deepEqual(exceptions, []);
  passed('no uncaught Cocos runtime exception during all checks');
} catch (error) {
  fs.writeFileSync(path.join(output, 'failure.txt'), String(error.stack ?? error));
  process.exitCode = 1; console.error(error);
} finally {
  if (digestBuild(buildDir) !== testedBuildDigest) { process.exitCode = 1; exceptions.push('Web Mobile build changed during the checks'); }
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: process.exitCode !== 1, checks, exceptions,
    testedBuildDigest, version: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version, output }, null, 2));
  ws?.close(); chrome.kill(); server.close();
  console.log(`[cocos-ui] Evidence: ${output}`);
}
