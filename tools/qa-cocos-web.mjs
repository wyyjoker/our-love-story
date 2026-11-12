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
  const artState = (name) => ev(`(()=>{let n;const walk=v=>{if(v.name===${JSON.stringify(name)}&&v.activeInHierarchy)n=v;v.children.forEach(walk)};walk(cc.director.getScene());const f=n?.getComponent(cc.Sprite)?.spriteFrame;return f&&{textureId:f.texture._uuid,width:f.texture.width,height:f.texture.height,rectWidth:f.rect.width,rectHeight:f.rect.height,rectY:f.rect.y}})()`);
  const waitForArt = async (name) => {
    for (let i = 0; i < 40; i++) { const frame = await artState(name); if (frame) return frame; await wait(100); }
    throw Error(`Missing story artwork: ${name}`);
  };
  const labels = () => ev("(()=>{const s=[];const walk=n=>{const l=n.getComponent(cc.Label);if(l&&n.activeInHierarchy)s.push(l.string);n.children.forEach(walk)};walk(cc.director.getScene());return s})()");
  const coords = (name, index = 0) => ev(`(()=>{const found=[];const walk=n=>{if(n.name===${JSON.stringify(name)}&&n.activeInHierarchy)found.push(n);n.children.forEach(walk)};walk(cc.director.getScene());const n=found[${index}];if(!n)throw Error('Missing '+${JSON.stringify(name)});const p=n.worldPosition,v=cc.view.getVisibleSize();return{x:(p.x+v.width/2)*innerWidth/v.width,y:(v.height/2-p.y)*innerHeight/v.height}})()`);
  const tap = async (name, index = 0) => {
    const p = await coords(name, index);
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...p, id: 1 }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(400);
  };
  const openAdventure = async (chapter, replay = false) => {
    for (let page = 0; page < Math.ceil(bundle.adventures.length / 3); page++) {
      if (await active('Adventure_' + chapter.id)) break;
      await tap('HubNext');
    }
    await tap((replay ? 'AdventureReplay_' : 'AdventureOpen_') + chapter.id);
  };
  const solvePuzzle = async (chapter) => {
    const puzzle = chapter.puzzle;
    if (puzzle.kind === 'find') {
      for (const spot of puzzle.hotspots) await tap('Clue_' + spot.id);
      for (const digit of puzzle.solution) await tap('PuzzleDigit_' + digit);
    } else if (puzzle.kind === 'sequence') {
      for (const id of puzzle.solution) await tap('Letter_' + id);
    } else {
      for (let index = 0; index < puzzle.ports.length; index++) {
        for (let turn = 0; turn < (puzzle.solution[index] - puzzle.initial[index] + 4) % 4; turn++) await tap('Circuit_' + index);
      }
    }
    await tap('PuzzleCheck');
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
  await load();
  assert.ok((await labels()).some((text) => text.includes('2023.09.08')));
  await shot('cover'); await tap('EnterGame');
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
  assert.ok((await labels()).some((text) => text.includes(`/ ${bundle.memories.length} 页`)));
  const storyTextures = new Set();
  for (let i = 0; i < bundle.memories.length; i++) {
    if (i > 0) await tap('Button_下一页');
    const frame = await waitForArt('DiaryIllustration');
    assert.equal(frame.width, 640, `Chapter ${i + 1} has the wrong artwork`);
    assert.equal(frame.height, 640);
    assert.ok(Math.abs(frame.rectY - (640 - frame.rectHeight) * (bundle.memories[i].artFocusY ?? 0.2)) < 0.001,
      `Chapter ${i + 1} should use its configured crop focus`);
    assert.ok(frame.textureId);
    storyTextures.add(frame.textureId);
    await tap('DiaryIllustration');
    assert.ok(await active('StoryArtDetail'));
    const full = await waitForArt('StoryArtFull');
    assert.equal(full.textureId, frame.textureId);
    assert.equal(full.rectWidth, 640, 'Full artwork must not be cropped');
    assert.equal(full.rectHeight, 640);
    if ([0, 12, 27].includes(i)) await shot(`story-art-${String(i + 1).padStart(2, '0')}`);
    await tap('Button_关闭');
    assert.ok(!(await active('StoryArtDetail')));
  }
  assert.equal(storyTextures.size, bundle.memories.length, 'Every chapter must use its own illustration');
  passed(`${bundle.memories.length} distinct story illustrations loaded with uncropped full-size previews`);
  assert.ok((await labels()).includes('2026 年 10 月 3 日')); await shot('wedding-diary');
  for (const [width, height] of [[320, 568], [375, 667], [430, 932]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true }); await wait(500);
    await ev('cc.sys.getSafeAreaRect=()=>new cc.Rect(0,68,750,cc.view.getVisibleSize().height-218);true');
    await ev('new Promise(resolve=>cc.director.loadScene("Game",()=>setTimeout(()=>resolve(true),700)))');
    await tap('EnterGame'); await shot('merge-' + width); await tap('Button_回忆'); await shot('album-' + width);
    if (width === 375) {
      await tap('Button_心动日记');
      const longChapter = bundle.memories.findIndex((memory) => memory.id === 'winter_portraits');
      for (let i = 0; i < longChapter; i++) await tap('Button_下一页');
      const scrollState = () => ev("(()=>{let v;const walk=n=>{if(n.name==='DiaryTextViewport'&&n.activeInHierarchy)v=n;n.children.forEach(walk)};walk(cc.director.getScene());const s=v.getComponent(cc.ScrollView);return{offset:s.getScrollOffset().y,max:s.getMaxScrollOffset().y}})()");
      const before = await scrollState();
      const compactArt = await waitForArt('DiaryIllustration');
      assert.ok(Math.abs(compactArt.rectY - (640 - compactArt.rectHeight) * bundle.memories[longChapter].artFocusY) < 0.001);
      assert.ok(compactArt.rectY < 40, 'Compact winter portrait should retain the tops of their heads');
      assert.ok(before.max > 10, 'Long diary should overflow the compact viewport');
      const p = await coords('DiaryTextViewport');
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y + 17, id: 1 }] });
      for (let i = 1; i <= 6; i++) {
        await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y + 17 - 34 * i / 6, id: 1 }] }); await wait(45);
      }
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(450);
      assert.ok((await scrollState()).offset > before.offset + 5, 'Diary body should respond to touch scrolling');
      await ev("(()=>{const walk=n=>{if(n.name==='DiaryTextViewport'&&n.activeInHierarchy)n.getComponent(cc.ScrollView).scrollToBottom(0);n.children.forEach(walk)};walk(cc.director.getScene());return true})()");
      await wait(100); await shot('diary-scroll-bottom-375');
      await tap('Button_下一页');
      assert.ok(Math.abs((await scrollState()).offset) < 1, 'Changing chapters should reset reading to the top');
    }
  }
  passed(`${bundle.memories.length} diary chapters, compact touch scrolling and 320/375/430 portrait layouts with simulated safe areas`);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await load();
  const grownUp = (d) => {
    d.player.level = 18; d.player.xp = 7650;
    d.life.claimedLevelRewards = Array.from({ length: 17 }, (_, i) => i + 2);
    d.tutorial = { generatorClicked: true, firstMergeCompleted: true, firstOrderCompleted: true };
  };
  const playProgress = (id) => ev(`${app}.game.play.progress(${JSON.stringify(id)})`);
  await seed((d) => { grownUp(d); d.board = Array.from({ length: 81 }, (_, index) => ({ index,
    ...(index < 2 ? { item: { uid: 'tool_' + index, definitionId: index === 0 ? 'coffee_03' : 'coffee_01' } } : {}) })); });
  await tap('EnterGame'); await tap('OpenTools'); await shot('toolbox');
  const toolEnergy = await ev(`${app}.game.player.energy`);
  await tap('Store_0'); assert.equal((await cells())[0].item, undefined);
  assert.equal(await ev(`${app}.game.play.state.warehouse.length`), 1);
  await tap('Warehouse_0'); assert.equal((await cells())[0].item.uid, 'tool_0');
  await tap('Split_0'); assert.equal((await cells())[0].item.definitionId, 'coffee_02');
  assert.equal((await cells())[2].item.definitionId, 'coffee_02');
  assert.equal(await ev(`${app}.game.play.state.scissors`), bundle.game.toolbox.startingScissors - 1);
  assert.equal(await ev(`${app}.game.player.energy`), toolEnergy);
  const blockedBoard = await cells(); await gesture(0, 2); assert.deepEqual(await cells(), blockedBoard);
  await tap('PlayClose'); await tap('Cell_0'); assert.ok(await active('PlayOverlay')); await tap('PlayClose');
  await tap('Button_任务'); await tap('Button_今日约会 · 剧情与解谜 ›'); await tap('AdventureOpen_zhoushan'); await tap('AdventureToMerge');
  assert.equal(await ev(`${app}.view.lifePages.currentPage`), 'merge'); assert.ok(!(await active('Wishes')));
  passed('touch inventory transfer, item-tap shortcut, scissors value conservation and modal input blocking');

  await seed((d) => { grownUp(d); const needs = bundle.adventures.flatMap((c) => c.steps.flatMap((s) => s.requirements.flatMap((r) => Array(r.count).fill(r.itemId))));
    d.board = Array.from({ length: 81 }, (_, index) => ({ index, ...(index < needs.length ? { item: { uid: 'date_' + index, definitionId: needs[index] } } : {}) })); });
  await tap('EnterGame'); await tap('OpenAdventure'); await shot('adventure-hub');
  await tap('AdventureOpen_namsan'); assert.ok(await active('Adventure_zhoushan'));
  await tap('AdventureOpen_zhoushan'); await shot('adventure-order');
  await tap('AdventureDeliver'); await tap('AdventureDeliver');
  assert.equal((await playProgress('zhoushan')).step, 2);
  await tap('Clue_invitation'); await tap('Clue_calendar');
  await tap('PuzzleDigit_9'); await tap('PuzzleCheck'); assert.equal((await playProgress('zhoushan')).outcome, 'playing');
  for (let i = 0; i < 3; i++) await tap('PuzzleHint');
  await tap('PuzzleReset'); await tap('PuzzleDigit_0'); await tap('PlayClose');
  await send('Page.reload'); await wait(400); await ready(); await wait(800); await tap('EnterGame');
  await tap('OpenAdventure'); await tap('AdventureOpen_zhoushan');
  assert.equal((await playProgress('zhoushan')).code, '0'); assert.equal((await playProgress('zhoushan')).found.length, 2);
  assert.equal((await playProgress('zhoushan')).hints, 3);
  await tap('Clue_note'); for (const digit of ['9', '0', '8']) await tap('PuzzleDigit_' + digit);
  await shot('puzzle-zhoushan'); await tap('PuzzleCheck'); await tap('AdventureClaim');
  assert.equal((await playProgress('zhoushan')).claimed, true);
  await tap('AdventureMemory'); assert.equal(await ev(`${app}.view.lifePages.currentPage`), 'memories');
  await tap('Button_合成');
  passed('two-stage story delivery, free wrong attempts and hints, clue/code persistence and gifted memory reading');

  await tap('OpenAdventure'); await tap('AdventureOpen_love_letters'); await tap('AdventureDeliver'); await tap('AdventureDeliver');
  for (const id of ['you', 'like', 'tell', 'me']) await tap('Letter_' + id);
  await tap('PuzzleCheck'); assert.equal((await playProgress('love_letters')).outcome, 'playing');
  await tap('PuzzleReset');
  for (const id of ['me', 'tell', 'like', 'you']) await tap('Letter_' + id);
  await shot('puzzle-letters'); await tap('PuzzleCheck'); await tap('AdventureClaim');
  await tap('AdventureBack'); await tap('AdventureOpen_namsan'); await tap('AdventureDeliver'); await tap('AdventureDeliver');
  await tap('Circuit_0');
  assert.equal((await playProgress('namsan')).rotations[0], 2);
  await tap('PlayClose'); await send('Page.reload'); await wait(400); await ready(); await wait(800); await tap('EnterGame');
  await tap('OpenAdventure'); await tap('AdventureOpen_namsan'); assert.equal((await playProgress('namsan')).rotations[0], 2);
  await tap('PuzzleReset'); for (let i = 0; i < 9; i++) for (let k = 0; k < 3; k++) await tap('Circuit_' + i);
  await shot('puzzle-namsan'); await tap('PuzzleCheck'); await tap('AdventureClaim');
  for (const chapter of bundle.adventures.slice(3)) {
    await tap('AdventureBack'); await openAdventure(chapter);
    await shot('adventure-order-' + chapter.id);
    for (const step of chapter.steps) await tap('AdventureDeliver');
    await solvePuzzle(chapter);
    assert.equal((await playProgress(chapter.id)).outcome, 'solved');
    await shot('puzzle-' + chapter.id); await tap('AdventureClaim');
    assert.equal((await playProgress(chapter.id)).claimed, true);
  }
  assert.ok(bundle.adventures.every((c) => c.reward.coins > 0));
  assert.equal(await ev(`${app}.game.player.coins`), bundle.adventures.reduce((n, c) => n + c.reward.coins, 0));
  assert.equal(await ev(`${app}.game.play.state.scissors`), bundle.game.toolbox.startingScissors + bundle.adventures.reduce((n, c) => n + c.reward.scissors, 0));
  await tap('PlayClose'); await tap('Button_家园'); await shot('home-souvenirs');
  assert.ok(await active('Souvenir_zhoushan')); assert.ok(await active('Souvenir_namsan'));
  await tap('Button_卧室'); assert.ok(await active('Souvenir_love_letters')); await tap('Souvenir_love_letters');
  assert.equal(await ev(`${app}.view.lifePages.currentPage`), 'memories');
  passed('letter ordering and reciprocal circuit puzzles, rotation persistence, exact one-time rewards and interactive home souvenirs');

  await tap('Button_合成'); await tap('OpenAdventure');
  const replayChapter = bundle.adventures[0];
  const replayAssets = `(()=>{const g=${app}.game,p=g.player;return JSON.stringify({coins:p.coins,hearts:p.hearts,energy:p.energy,xp:p.xp,level:p.level,chapters:g.play.state.chapters,scissors:g.play.state.scissors})})()`;
  const earned = await ev(replayAssets);
  await openAdventure(replayChapter, true); await tap('Clue_invitation'); await tap('PuzzleDigit_0'); await tap('PlayClose');
  await send('Page.reload'); await wait(400); await ready(); await wait(800); await tap('EnterGame');
  await tap('OpenAdventure'); await openAdventure(replayChapter, true);
  assert.equal(await ev(`${app}.game.play.replayProgress('zhoushan').code`), '0');
  await tap('PuzzleReset'); await solvePuzzle(replayChapter);
  assert.ok((await labels()).includes('练习完成，无重复奖励'));
  assert.deepEqual(JSON.parse(await ev(replayAssets)), JSON.parse(earned));
  assert.equal(await ev(`${app}.game.playAction('claim','zhoushan').reason`), 'ALREADY_CLAIMED');
  await shot('replay-completed'); await tap('ReplayAgain'); assert.ok(await active('PuzzleCheck')); await tap('PlayClose');
  passed('free replay persists independently and cannot reissue story rewards');

  await seed((d) => { grownUp(d); }); await tap('EnterGame'); await tap('OpenAdventure'); await tap('SmallDateOpen');
  const firstDate = await ev(`${app}.game.play.smallDateOrder().template.id`);
  const noItemsCoins = await ev(`${app}.game.player.coins`);
  await tap('SmallDateDeliver');
  assert.equal(await ev(`${app}.game.play.smallDateOrder().completed`), 0);
  assert.equal(await ev(`${app}.game.player.coins`), noItemsCoins);
  await tap('PlayClose'); await send('Page.reload'); await wait(400); await ready(); await wait(800); await tap('EnterGame');
  await tap('OpenAdventure'); await tap('SmallDateOpen');
  assert.equal(await ev(`${app}.game.play.smallDateOrder().template.id`), firstDate);
  let expectedDateCoins = noItemsCoins;
  const dateEnergy = await ev(`${app}.game.player.energy`), dateScissors = await ev(`${app}.game.play.state.scissors`);
  const seenDates = new Set();
  for (let round = 0; round < 5; round++) {
    const current = await ev(`${app}.game.play.smallDateOrder().template`); seenDates.add(current.id);
    await ev(`(()=>{const g=${app}.game;g.debugClearBoard();for(const r of ${JSON.stringify(current.requirements)})for(let n=0;n<r.count;n++)g.debugSpawn(r.itemId);return true})()`);
    await tap('PlayClose'); await tap('OpenAdventure'); await tap('SmallDateOpen');
    assert.ok((await labels()).some((text) => text.includes(`金币 +${current.rewardCoins}`)
      && text.includes(`爱心 +${current.rewardHearts}`) && text.includes(`经验 +${current.rewardXp}`)));
    if (round === 0) await shot('small-date-ready');
    expectedDateCoins += current.rewardCoins; await tap('SmallDateDeliver');
    assert.equal(await ev(`${app}.game.play.smallDateOrder().completed`), round + 1);
    assert.equal(await ev(`${app}.game.player.coins`), expectedDateCoins);
  }
  assert.ok(seenDates.size >= 4);
  assert.equal(await ev(`${app}.game.player.energy`), dateEnergy);
  assert.equal(await ev(`${app}.game.play.state.scissors`), dateScissors);
  await shot('repeatable-small-date'); await tap('PlayClose');
  await send('Page.reload'); await wait(400); await ready(); await wait(800); await tap('EnterGame');
  assert.equal(await ev(`${app}.game.play.smallDateOrder().completed`), 5);
  passed('repeatable small dates rotate, reject missing ingredients, pay exact rewards and persist');

  await seed((d) => {
    d.player.xp = 45;
    d.tutorial = { generatorClicked: true, firstMergeCompleted: true, firstOrderCompleted: true, firstOrderHintShown: true };
    const needs = bundle.smallDates.find((date) => date.minLevel === 1).requirements.flatMap((r) => Array(r.count).fill(r.itemId));
    d.board = Array.from({ length: 81 }, (_, index) => ({ index, ...(index < needs.length ? { item: { uid: 'small_level_' + index, definitionId: needs[index] } } : {}) }));
  });
  await tap('EnterGame'); await tap('OpenAdventure'); await tap('SmallDateOpen'); await tap('SmallDateDeliver');
  assert.equal(await ev(`${app}.game.player.level`), 2);
  assert.ok(await active('LevelUpView'));
  await tap('ClaimLevelReward');
  assert.ok(!(await active('LevelUpView'))); assert.ok(await active('SmallDateDeliver'));
  assert.equal(await ev(`${app}.game.play.smallDateOrder().completed`), 1);
  await tap('SmallDateBack'); assert.ok(await active('SmallDateEntry')); await tap('PlayClose');
  passed('small-date level-up reward closes cleanly and returns to the updated date');

  await seed((d) => { grownUp(d); d.play.chapters.zhoushan = { step: 2, found: [], selected: [], rotations: [], code: '', hints: 0, outcome: 'playing', claimed: false }; });
  await tap('EnterGame'); await tap('OpenAdventure'); await tap('AdventureOpen_zhoushan');
  await tap('PuzzleSkip'); await tap('PuzzleSkipCancel'); assert.equal((await playProgress('zhoushan')).outcome, 'playing');
  await tap('PuzzleSkip'); await tap('PuzzleSkipConfirm'); await tap('AdventureClaim');
  assert.equal((await playProgress('zhoushan')).outcome, 'skipped');
  assert.equal(await ev(`${app}.game.playAction('claim','zhoushan').reason`), 'ALREADY_CLAIMED');
  await tap('PlayClose');
  passed('optional skip confirmation, cancellation and no repeated reward');
  for (const [width, height] of [[320, 568], [375, 667]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
    await seed((d) => { grownUp(d); }); await tap('EnterGame'); await tap('OpenTools'); await shot('toolbox-' + width); await tap('PlayClose');
    await tap('OpenAdventure'); await shot('adventure-hub-' + width); await tap('PlayClose');
    for (let i = 0; i < bundle.adventures.length; i++) {
      await seed((d) => { grownUp(d); bundle.adventures.forEach((c, j) => { d.play.chapters[c.id] = { step: c.steps.length, found: [], selected: [], rotations: [], code: '', hints: 0,
        outcome: j < i ? 'solved' : 'playing', claimed: j < i }; }); });
      await tap('EnterGame'); await tap('OpenAdventure'); await openAdventure(bundle.adventures[i]);
      const bounds = await ev("(()=>{let n;const w=v=>{if(v.name==='PlayPanel'&&v.activeInHierarchy)n=v;v.children.forEach(w)};w(cc.director.getScene());const t=n.getComponent('cc.UITransform')??n._uiProps.uiTransformComp;if(!t)throw Error('PlayPanel transform missing');const b=t.getBoundingBoxToWorld(),v=cc.view.getVisibleSize();return{top:(v.height/2-b.yMax)*innerHeight/v.height,bottom:(v.height/2-b.yMin)*innerHeight/v.height}})()");
      assert.ok(bounds.top >= -1 && bounds.bottom <= height + 1, 'Play panel outside portrait viewport');
      await shot(`puzzle-${bundle.adventures[i].id}-${width}`); await tap('PlayClose');
    }
  }
  passed('320/375 touch-safe inventory, paged story hub and all six puzzle layouts');
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
