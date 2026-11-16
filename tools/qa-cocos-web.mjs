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
const tempRoot = path.join(root, 'temp');
fs.mkdirSync(tempRoot, { recursive: true });
const output = fs.mkdtempSync(path.join(tempRoot, `cocos-ui-qa-${new Date().toISOString().replaceAll(/[:.]/g, '-')}-`));
const profile = path.join(output, 'browser-profile');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const checks = [];
const exceptions = [];
const scope = process.env.COCOS_QA_FOCUS ?? 'full';
assert.ok(['full', 'timeline', 'postfresh', 'late', 'tail', 'level2', 'artfailure', 'polish', 'boardfill', 'chestflow', 'delivery', 'customer_tools', 'tools_only', 'systems', 'firstuse'].includes(scope), 'Unknown COCOS_QA_FOCUS');
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
const boardSize = bundle.game.board.rows * bundle.game.board.columns;
const boardColumns = bundle.game.board.columns;

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
  let port = 0;
  for (let retry = 0; retry < 60; retry++) {
    try { port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]); if (port > 0) break; }
    catch (error) { if (!['EBUSY','EACCES','ENOENT'].includes(error.code)) throw error; }
    await wait(100);
  }
  assert.ok(port > 0, 'Chrome debug port did not become readable');
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
    // Presentation-only: keep debug profiler counters out of the evidence, never alter gameplay state.
    await ev('cc.profiler?.hideStats?.();true');
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.join(output, `${name}.png`), Buffer.from(r.data, 'base64'));
  };
  const active = (name) => ev(`(()=>{let yes=false;const walk=n=>{if(n.name===${JSON.stringify(name)}&&n.activeInHierarchy)yes=true;n.children.forEach(walk)};walk(cc.director.getScene());return yes})()`);
  const artState = (name) => ev(`(()=>{let n;const walk=v=>{if(v.name===${JSON.stringify(name)}&&v.activeInHierarchy)n=v;v.children.forEach(walk)};walk(cc.director.getScene());const f=n?.getComponent(cc.Sprite)?.spriteFrame;return f&&{textureId:f.texture._uuid,width:f.texture.width,height:f.texture.height,rectWidth:f.rect.width,rectHeight:f.rect.height,rectX:f.rect.x,rectY:f.rect.y}})()`);
  const waitForArt = async (name) => {
    for (let i = 0; i < 40; i++) { const frame = await artState(name); if (frame) return frame; await wait(100); }
    throw Error(`Missing story artwork: ${name}`);
  };
  const labels = () => ev("(()=>{const s=[];const walk=n=>{const l=n.getComponent(cc.Label);if(l&&n.activeInHierarchy)s.push(l.string);n.children.forEach(walk)};walk(cc.director.getScene());return s})()");
  const coords = (name, index = 0) => ev(`(()=>{const found=[];const walk=n=>{if(n.name===${JSON.stringify(name)}&&n.activeInHierarchy)found.push(n);n.children.forEach(walk)};walk(cc.director.getScene());const n=found[${index}];if(!n)throw Error('Missing '+${JSON.stringify(name)});const p=n.worldPosition,v=cc.view.getVisibleSize();return{x:(p.x+v.width/2)*innerWidth/v.width,y:(v.height/2-p.y)*innerHeight/v.height}})()`);
  const tap = async (name, index = 0) => {
    if (name === 'ClaimLevelReward') for (let retry=0; retry<25 && !await active(name);retry++) await wait(80);
    const p = await coords(name, index);
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...p, id: 1 }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(400);
    if (['OrderCard','ClaimButton','ClaimLevelReward'].includes(name)) for(let retry=0;retry<25 && await ev(`${app}.view.deliveries.size > 0 || ${app}.view.levelRewardInFlight`);retry++) await wait(70);
  };
  const dragItemToBackpack = async (index) => {
    const start = await coords('Cell_'+index), end = await coords('BackpackDropIcon');
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...start,id:19}]});
    for(let i=1;i<=8;i++) { await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(end.x-start.x)*i/8,y:start.y+(end.y-start.y)*i/8,id:19}]}); await wait(24); }
    await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await wait(450);
  };
  const swipeRewardViewport = async (direction, touchId, targetY) => {
    const area = await ev(`(()=>{let n;const walk=v=>{if(v.name==='RewardsViewport'&&v.activeInHierarchy)n=v;v.children.forEach(walk)};walk(cc.director.getScene());const t=n.getComponent('cc.UITransform')??n._uiProps.uiTransformComp,p=n.worldPosition,v=cc.view.getVisibleSize(),hw=t.width*Math.abs(n.worldScale.x)/2,hh=t.height*Math.abs(n.worldScale.y)/2;return{left:(p.x-hw+v.width/2)*innerWidth/v.width,right:(p.x+hw+v.width/2)*innerWidth/v.width,top:(v.height/2-p.y-hh)*innerHeight/v.height,bottom:(v.height/2-p.y+hh)*innerHeight/v.height}})()`);
    const x = area.left + Math.min(22, (area.right - area.left) * 0.08);
    const height = area.bottom - area.top;
    const start = direction < 0 ? area.bottom - height * 0.20 : area.top + height * 0.20;
    const distance = Math.min(150, height * 0.55, Math.max(32, Math.abs(targetY - (area.top + area.bottom) / 2)));
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: start, id: touchId }] });
    for (let i = 1; i <= 10; i++) {
      await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: start + direction * distance * i / 10, id: touchId }] });
      await wait(16);
    }
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    let prior = Number.NaN, stable = 0;
    for (let i = 0; i < 20; i++) {
      await wait(100);
      const offset = await ev(`(()=>{let n;const w=v=>{if(v.name==='RewardsViewport'&&v.activeInHierarchy)n=v;v.children.forEach(w)};w(cc.director.getScene());return n.getComponent(cc.ScrollView).getScrollOffset().y})()`);
      stable = Math.abs(offset - prior) < 0.5 ? stable + 1 : 0;
      if (stable >= 2) break; prior = offset;
    }
  };
  // Locate a reward row by its visible text, then scroll it into the viewport by real touch.
  const rewardRowAction = async (caption, detail = '') => {
    await tap('RewardsTab_supplies');
    const scrollTrace = [];
    for (let attempt = 0; attempt < 20; attempt++) {
      const target = await ev(`(()=>{let viewport, row; const walk=n=>{if(n.name==='RewardsViewport'&&n.activeInHierarchy)viewport=n;if(n.name==='RewardRow'&&n.activeInHierarchy&&n.getComponentsInChildren(cc.Label).some(l=>l.string===${JSON.stringify(caption)})&&(!${JSON.stringify(detail)}||n.getComponentsInChildren(cc.Label).some(l=>l.string.includes(${JSON.stringify(detail)}))))row=n;n.children.forEach(walk)};walk(cc.director.getScene());if(!viewport||!row)return null;const v=cc.view.getVisibleSize(),p=row.getChildByName('Action')?.worldPosition,t=viewport.getComponent('cc.UITransform')??viewport._uiProps.uiTransformComp,vp=viewport.worldPosition,hh=t.height*Math.abs(viewport.worldScale.y)/2;if(!p)return null;return {x:(p.x+v.width/2)*innerWidth/v.width,y:(v.height/2-p.y)*innerHeight/v.height,top:(v.height/2-vp.y-hh)*innerHeight/v.height,bottom:(v.height/2-vp.y+hh)*innerHeight/v.height}})()`);
      assert.ok(target, `Missing reward row ${caption}`);
      scrollTrace.push(target);
      if (target.y > target.top + 10 && target.y < target.bottom - 10) {
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: target.x, y: target.y, id: 4 }] });
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(400); return;
      }
      const direction = target.y >= target.bottom - 10 ? -1 : 1;
      await swipeRewardViewport(direction, 4, target.y);
    }
    fs.writeFileSync(path.join(output, 'reward-scroll-failure.json'), JSON.stringify({ caption, detail, scrollTrace }, null, 2));
    await shot('reward-scroll-failure');
    throw Error(`Cannot touch-scroll to ${caption}`);
  };
  const useReward = async (id) => {
    const item = bundle.items.find((entry) => entry.id === id); assert.ok(item);
    await rewardRowAction(item.displayName); if(item.chainId==='treasure_chest'){assert.ok(!(await active('ConfirmConsume')));await wait(1700);await tap('OpenTools');}else await tap('ConfirmUse');
  };
  const clearFreshSupplies = async () => {
    const board = await cells();
    if (board.some((cell) => !cell.locked && !cell.item)) return;
    const usable = board.find((cell) => cell.item && ['treasure_chest', 'coin_01', 'coin_02', 'coin_03', 'diamond_01', 'diamond_02', 'diamond_03', 'energy_01', 'energy_02', 'energy_03'].includes(cell.item.definitionId));
    if (!usable) return;
    await tap('Cell_'+usable.index); await wait(1700);
    freshPathActions.push(`use supply ${usable.item.definitionId}`);
  };
  const openAdventure = async (chapter, replay = false) => {
    const pageSize = await ev(`${app}.view.playPages.hubPageSize`);
    assert.ok(pageSize >= 1, 'Journey hub page size missing');
    for (let page = 0; page < Math.ceil(bundle.adventures.length / pageSize); page++) {
      if (await active('Adventure_' + chapter.id)) break;
      await tap('HubNext');
    }
    await tap((replay ? 'AdventureReplay_' : 'AdventureOpen_') + chapter.id);
  };
  const solvePuzzle = async (chapter) => {
    const puzzle = await ev(`${app}.game.play.puzzleDefinition(${JSON.stringify(chapter.id)}).puzzle`);
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
  const scrollDown = async (name) => {
    const state = () => ev(`(()=>{let n;const walk=v=>{if(v.name===${JSON.stringify(name)}&&v.activeInHierarchy)n=v;v.children.forEach(walk)};walk(cc.director.getScene());const s=n.getComponent(cc.ScrollView),t=n.getComponent('cc.UITransform')??n._uiProps.uiTransformComp,p=n.worldPosition,v=cc.view.getVisibleSize();return{offset:s.getScrollOffset().y,max:s.getMaxScrollOffset().y,x:(p.x+v.width/2)*innerWidth/v.width,y:(v.height/2-p.y)*innerHeight/v.height,height:t.height*Math.abs(n.worldScale.y)*innerHeight/v.height}})()`);
    for (let attempt = 0; attempt < 16; attempt++) {
      const s = await state(); if (s.offset >= s.max - 4) return;
      const start = { x: s.x, y: s.y + s.height * .34, id: 2 };
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
      for (let step = 1; step <= 10; step++) {
        await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...start, y: start.y - s.height * .68 * step / 10 }] });
        await wait(20);
      }
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(400);
    }
    const s = await state();
    if (s.offset < s.max - 4) {
      fs.writeFileSync(path.join(output, `scroll-failure-${name}.json`), JSON.stringify(s, null, 2));
      await shot('scroll-failure-' + name);
    }
    assert.ok(s.offset >= s.max - 4, `Could not touch-scroll ${name} to its end: ${JSON.stringify(s)}`);
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
  const freshPathActions = [];
  const ensureItem = async (itemId, count = 1) => {
    const target = bundle.items.find((item) => item.id === itemId);
    assert.ok(target, `Unknown fresh-play target ${itemId}`);
    const generatorIndex = bundle.generators.findIndex((generator) => generator.chainId === target.chainId);
    const generator = bundle.generators[generatorIndex];
    assert.ok(generator, `Missing generator for ${itemId}`);
    for (let guard = 0; guard < 220; guard += 1) {
      const board = await cells();
      if (board.filter((cell) => cell.item?.definitionId === itemId).length >= count) return;
      const groups = new Map();
      for (const cell of board) {
        if (!cell.item) continue;
        const definition = bundle.items.find((item) => item.id === cell.item.definitionId);
        if (!definition || definition.chainId !== target.chainId || definition.level >= target.level) continue;
        const group = groups.get(definition.id) ?? [];
        group.push({ index: cell.index, level: definition.level }); groups.set(definition.id, group);
      }
      const pair = [...groups.values()].filter((group) => group.length >= 2)
        .sort((a, b) => a[0].level - b[0].level)[0];
      if (pair) {
        await gesture(pair[0].index, pair[1].index);
        freshPathActions.push(`merge ${bundle.items.find((item) => item.id === board[pair[0].index].item.definitionId)?.displayName ?? itemId}`);
        continue;
      }
      await clearFreshSupplies();
      const playerLevel = await ev(`${app}.game.player.level`);
      assert.ok(generator.unlockLevel <= playerLevel, `Generator ${generator.id} is still locked at Lv.${playerLevel}`);
      const energy = await ev(`${app}.game.player.energy`);
      assert.ok(energy >= generator.energyCost, `Energy blocker: ${energy} left while preparing ${itemId}`);
      for (let cooldownGuard = 0; cooldownGuard < 4; cooldownGuard++) {
        const status = await ev(`${app}.game.getGeneratorStatus(${JSON.stringify(generator.id)})`);
        const remaining = status?.remainingCooldownMs ?? 0;
        if (remaining <= 0) break;
        const delay = Math.min(30_000, remaining + 120);
        freshPathActions.push(`wait ${Math.ceil(delay / 1000)}s for ${generator.id} cooldown`);
        await wait(delay);
      }
      assert.equal((await ev(`${app}.game.getGeneratorStatus(${JSON.stringify(generator.id)})`))?.remainingCooldownMs ?? 0, 0,
        `Generator ${generator.id} cooldown did not finish`);
      if (generator.id === 'orange_tree') {
        const status = await ev(`${app}.game.getGeneratorStatus('orange_tree')`);
        assert.ok(status?.charges > 0, `Orange tree is recovering while preparing ${itemId}`);
        await tap('GeneratorOrangeTree');
      } else await tap('GenBtn', generatorIndex);
      freshPathActions.push(`spawn ${generator.id}`);
    }
    throw Error(`Unable to prepare ${count} × ${itemId} through normal UI actions`);
  };
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const checkBoardFill = async () => {
    const g = await ev(`(()=>{let paper;const cells=[];const walk=n=>{if(n.activeInHierarchy){if(n.name==='BoardPaper')paper=n;const m=/^Cell_([0-9]+)$/.exec(n.name);if(m)cells[+m[1]]=n;}n.children.forEach(walk)};walk(cc.director.getScene());const box=n=>{const t=n?.getComponent('cc.UITransform')??n?._uiProps.uiTransformComp;if(!t)return null;const ps=[[-t.anchorX*t.width,-t.anchorY*t.height],[(1-t.anchorX)*t.width,(1-t.anchorY)*t.height]].map(([x,y])=>t.convertToWorldSpaceAR(new cc.Vec3(x,y,0)));return{xMin:Math.min(...ps.map(p=>p.x)),xMax:Math.max(...ps.map(p=>p.x)),yMin:Math.min(...ps.map(p=>p.y)),yMax:Math.max(...ps.map(p=>p.y))}};return{paper:box(paper),cells:cells.map(box)}})()`);
    assert.ok(g.paper && g.cells.length===boardSize && g.cells.every(Boolean), 'All 42 board cells and paper must be visible');
    const cols=bundle.game.board.columns, rows=bundle.game.board.rows;
    for(let row=0;row<rows;row++) {
      const first=g.cells[row*cols], last=g.cells[row*cols+cols-1];
      const left=first.xMin-g.paper.xMin, right=g.paper.xMax-last.xMax;
      assert.ok(left>=-0.5 && left<=12.5 && right>=-0.5 && right<=12.5, `Board row ${row} does not fill paper: left=${left}, right=${right}`);
      for(let col=1;col<cols;col++) { const prev=g.cells[row*cols+col-1], cur=g.cells[row*cols+col], gap=cur.xMin-prev.xMax;
        assert.ok(gap>=-0.5 && gap<=12.5, `Horizontal cell gap ${row},${col}: ${gap}`); }
    }
    for(let row=1;row<rows;row++) for(let col=0;col<cols;col++) { const prev=g.cells[(row-1)*cols+col], cur=g.cells[row*cols+col], gap=prev.yMin-cur.yMax;
      assert.ok(gap>=-0.5 && gap<=12.5, `Vertical cell gap ${row},${col}: ${gap}`); }
    return g;
  };
  if (scope === 'firstuse') {
    await load();
    const fixture = (d,items,hints=[]) => {
      d.player.level=2;d.player.xp=50;d.player.energy=150;d.player.maxEnergy=150;d.life.claimedLevelRewards=[2];d.rewardInbox=[];d.play.warehouse=[];
      d.tutorial={generatorClicked:true,firstMergeCompleted:true,firstOrderCompleted:true,firstOrderHintShown:true,firstUseHints:hints};
      const rule=bundle.game.board.unlocks.find(rule=>rule.level===2);
      const positions=Array.from({length:rule.rows},(_,row)=>Array.from({length:rule.columns},(_,col)=>row*boardColumns+col)).flat();
      d.board=Array.from({length:boardSize},(_,index)=>{const item=items[positions.indexOf(index)];return{index,...(item?{item:{uid:'first_use_'+index,definitionId:item}}:{})}});
    };
    const bubble = () => ev(`${app}.view.tutorial.node.getChildByName('Bubble').active`);
    const hintText = () => ev(`${app}.view.tutorial.node.getChildByName('Bubble').getComponentInChildren(cc.Label).string`);
    await seed(d=>fixture(d,Array(6).fill('coffee_01')));
    await wait(6400);assert.deepEqual(await ev(`${app}.game.tutorial.firstUseHints`),[],'Cover must not silently consume a first-use hint');
    await tap('EnterGame');assert.ok(await bubble());assert.ok((await hintText()).includes('背包'));await shot('firstuse-backpack');
    const source=(await ev(`${app}.game.getFirstUseGuide()`)).sourceIndex;const uid=(await cells())[source].item.uid;
    await dragItemToBackpack(source);assert.ok((await ev(`${app}.game.tutorial.firstUseHints`)).includes('backpack'));
    assert.ok(!(await bubble()));await tap('BoardBackpackButton');await tap('Warehouse_0');assert.ok((await cells()).some(c=>c.item?.uid===uid));await tap('PlayClose');
    await send('Page.reload');await wait(400);await ready();await tap('EnterGame');assert.ok(!(await bubble()));
    passed('backpack guide waits for entry, accepts real drag, clears on completion and never returns after restart');

    await seed(d=>fixture(d,['coffee_02','scissors_02']));await tap('EnterGame');assert.ok((await hintText()).includes('剪刀'));await shot('firstuse-scissors');
    await gesture(1,0);assert.ok((await ev(`${app}.game.tutorial.firstUseHints`)).includes('scissors'));assert.equal((await cells())[1].item.remainingUses,2);assert.ok(!(await bubble()));
    passed('scissors guide clears immediately on a successful split without spending another charge');

    await seed(d=>fixture(d,['treasure_chest']));await tap('EnterGame');assert.ok((await hintText()).includes('宝箱'));await shot('firstuse-chest');await tap('DismissHint');
    assert.ok(!(await bubble()));assert.equal((await cells())[0].item.definitionId,'treasure_chest');
    await send('Page.reload');await wait(400);await ready();await tap('EnterGame');assert.ok(!(await bubble()));
    await tap('Cell_0');assert.ok((await ev(`${app}.game.tutorial.firstUseHints`)).includes('chest'));assert.ok((await cells()).some(c=>c.item&&c.item.definitionId!=='treasure_chest'));
    passed('chest guide dismisses across restart without opening the chest; real tap still opens random supplies');

    await seed(d=>fixture(d,['coffee_02','scissors_02']));await tap('EnterGame');await wait(3400);await ev(`${app}.view.renderAll();true`);await wait(3000);
    assert.ok(!(await bubble()));assert.ok((await ev(`${app}.game.tutorial.firstUseHints`)).includes('scissors'));assert.equal((await cells())[1].item.definitionId,'scissors_02');
    passed('optional guides expire after six seconds and routine redraws do not restart their timer');

    await seed(d=>{fixture(d,['fruit_01','coffee_01'],['backpack','scissors','chest']);d.activeOrders[0].requirements=[{itemId:'fruit_01',count:1},{itemId:'coffee_01',count:1}];});
    await tap('EnterGame');await waitForArt('CustomerAvatar');await wait(400);
    const early=(await ev(`${app}.game.orders.getOrders()`))[0];assert.equal(early.requirements.length,2);await shot('firstuse-early-orange-order');
    await tap('ClaimButton');assert.notEqual((await ev(`${app}.game.orders.getOrders()`))[0].uid,early.uid);
    await send('Page.reload');await wait(400);await ready();await tap('EnterGame');assert.equal((await ev(`${app}.game.orders.getOrders()`)).length,3);
    passed('Lv2 mixed coffee and orange order keeps both requirements, delivers and persists without replacement UI');
    assert.deepEqual(exceptions,[]);
  } else   if (scope === 'customer_tools' || scope === 'tools_only') {
    const mature=d=>{d.player.level=18;d.player.xp=7650;d.player.energy=500;d.player.coins=1000;d.life.claimedLevelRewards=Array.from({length:17},(_,i)=>i+2);d.tutorial={generatorClicked:true,firstMergeCompleted:true,firstOrderCompleted:true,firstOrderHintShown:true};};
    const fill=(items)=>Array.from({length:boardSize},(_,index)=>({index,...(items[index]?{item:{uid:'new_tool_'+index,definitionId:items[index]}}:{})}));
    const dragToBackpack=async index=>{const a=await coords('Cell_'+index),b=await coords('BackpackDropIcon');await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:9}]});for(let i=1;i<=8;i++){await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/8,y:a.y+(b.y-a.y)*i/8,id:9}]});await wait(25);}await shot('backpack-drag-hover');await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await wait(450);};
    if (scope !== 'tools_only') for(const [width,height] of [[320,568],[375,812],[430,932]]){
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await load();
      await seed(d=>{mature(d);d.board=fill(['coffee_01','flower_01']);d.activeOrders[0].requirements=[{itemId:'coffee_01',count:1},{itemId:'flower_01',count:1}];});await tap('EnterGame');await waitForArt('CustomerAvatar');await waitForArt('NavSymbol');await waitForArt('GeneratorArt');
      assert.equal(await active('OrderRefreshMenuButton'),false);assert.equal(await active('OrderRefreshConfirm'),false);
      const geometry=await ev(`(()=>{let card;const w=n=>{if(!card&&n.name==='OrderCard'&&n.activeInHierarchy)card=n;n.children.forEach(w)};w(cc.director.getScene());const r=n=>{const t=n.getComponent('cc.UITransform')??n._uiProps.uiTransformComp,p=n.worldPosition;return{x0:p.x-t.width/2,x1:p.x+t.width/2,y0:p.y-t.height/2,y1:p.y+t.height/2,w:t.width,h:t.height}};return{card:r(card),person:r(card.getChildByName('CustomerAvatar')),claim:r(card.getChildByName('ClaimButton')),items:[0,1].map(i=>r(card.getChildByName('Required_'+i)))}})()`);
      assert.ok(geometry.person.h>=geometry.card.h*.48&&geometry.person.w>=geometry.card.w*.32,'Customer must be the large main subject');
      for(const req of geometry.items){assert.ok(req.x0>=geometry.person.x1-1,'Requested objects must sit beside the customer');assert.ok(req.y0>=geometry.claim.y1+2,'Goods and delivery button must not overlap');}
      const nav=await ev(`(()=>{const frames=[];const w=n=>{if(n.name==='NavSymbol'&&n.activeInHierarchy){const f=n.getComponent(cc.Sprite)?.spriteFrame;if(f)frames.push([f.texture._uuid,f.rect.x,f.rect.y].join(':'))}n.children.forEach(w)};w(cc.director.getScene());return frames})()`);assert.equal(new Set(nav).size,4,'Four distinct illustrated navigation icons');
      await shot('customer-layout-'+width);passed('customer-led side-by-side orders and illustrated navigation at '+width);
    }
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await load();
    await seed(d=>{mature(d);d.board=fill(['coffee_03','coffee_01']);d.play.warehouse=[];d.play.scissors=2;});await tap('EnterGame');await waitForArt('BackpackDropIcon');
    const storedUid=(await cells())[0].item.uid;await dragToBackpack(0);
    assert.equal(await ev(`${app}.view.playPages.isOpen`),false,'Dragging to backpack must store without opening another page');assert.equal((await cells())[0].item,undefined);assert.equal(await ev(`${app}.game.play.state.warehouse[0].uid`),storedUid);
    await tap('BoardBackpackButton');
    assert.equal(await ev(`${app}.view.playPages.screen`),'tools');
    assert.ok(!(await active('Split_0')));await tap('TakeScissors');await tap('TakeScissors');assert.equal(await ev(`${app}.game.play.state.scissors`),0);await shot('physical-scissors-backpack');await tap('PlayClose');
    const tools=(await cells()).flatMap(c=>c.item?.definitionId==='scissors_01'?[c.index]:[]);assert.equal(tools.length,2);await gesture(tools[0],tools[1]);const merged=(await cells())[tools[1]].item;assert.equal(merged.definitionId,'scissors_02');assert.equal(merged.remainingUses,3);
    await tap('BoardBackpackButton');await tap('Warehouse_0');await tap('PlayClose');await gesture(tools[1],0);assert.equal((await cells())[tools[1]].item.remainingUses,2);assert.equal((await cells()).filter(c=>c.item?.definitionId==='coffee_02').length,2);await shot('scissors-drag-split');
    await dragToBackpack(tools[1]);assert.equal(await ev(`${app}.game.play.state.warehouse[0].remainingUses`),2);await send('Page.reload');await wait(400);await ready();await tap('EnterGame');assert.equal(await ev(`${app}.game.play.state.warehouse[0].remainingUses`),2);assert.equal(await ev(`${app}.game.play.state.scissors`),0);
    passed('drag into backpack, take finite scissors, merge, drag to split and store worn tools across restart');
    await seed(d=>{mature(d);d.board=fill(['coffee_01']);d.play.warehouse=Array.from({length:bundle.game.toolbox.warehouseSlots},(_,i)=>({uid:'full_pack_'+i,definitionId:'coffee_01'}));});await tap('EnterGame');const fullBefore=await cells();await dragToBackpack(0);assert.deepEqual(await cells(),fullBefore);assert.equal(await ev(`${app}.game.play.state.warehouse.length`),bundle.game.toolbox.warehouseSlots);
    await seed(d=>{mature(d);d.board=fill(Array.from({length:42},(_,i)=>i===0?'scissors_02':i===1?'coffee_02':'coffee_01'));d.board[0].item.remainingUses=1;});await tap('EnterGame');const spent=(await cells())[0].item.uid;await gesture(0,1);assert.ok(!(await cells()).some(c=>c.item?.uid===spent));assert.equal((await cells()).filter(c=>c.item).length,42);
    passed('full backpack rejects without loss and final scissors charge works on a full board');
    assert.deepEqual(exceptions,[]);
  } else if (scope === 'delivery') {
    const rawTap = async (name, index=0) => { const p=await coords(name,index); await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]}); await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await wait(35); };
    const fixture = d => { d.player.level=18;d.player.xp=7650;d.player.coins=100;d.player.hearts=10;
      d.life.claimedLevelRewards=Array.from({length:17},(_,i)=>i+2);d.tutorial={generatorClicked:true,firstMergeCompleted:true,firstOrderCompleted:true,firstOrderHintShown:true};
      d.board=Array.from({length:boardSize},(_,index)=>({index,...(index<3?{item:{uid:'delivery_'+index,definitionId:'coffee_01'}}:{})}));
      d.activeOrders.forEach((o,i)=>{o.requirements=[{itemId:'coffee_01',count:1}];o.rewardCoins=20+i;o.rewardXp=10;o.rewardHearts=2;}); };
    const shownCoins=()=>ev(`(()=>{let n;const w=v=>{if(v.name==='CoinsValue')n=v;v.children.forEach(w)};w(cc.director.getScene());return n.getComponent(cc.Label).string})()`);
    for(const [width,height] of [[320,568],[375,812],[430,932]]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await load();await seed(fixture);await tap('EnterGame');await waitForArt('Art');
      assert.ok(await active('OrderReadyHalo'));assert.equal(await active('OrderRefreshMenuButton'),false);assert.equal(await active('OrderRefreshFreeButton'),false);
      await waitForArt('Art'); await waitForArt('CustomerAvatar'); await wait(200); await shot('delivery-ready-'+width); const before=await ev(`${app}.game.buildSaveData()`); const oldUid=before.activeOrders[0].uid;
      await rawTap('ClaimButton',0);assert.equal(await ev(`${app}.game.life.state.stats.orders`),before.life.stats.orders+1);
      assert.equal(await ev(`${app}.game.player.coins`),120);assert.equal(await shownCoins(),'100','Wallet display waits for the actual flight arrival');
      assert.ok(await active('DeliveredItemFlight'));assert.ok(await active('OrderDeliveryEffects'));assert.equal(await active('LevelUpView'),false);
      await rawTap('ClaimButton',0);assert.equal(await ev(`${app}.game.life.state.stats.orders`),before.life.stats.orders+1,'Same slot cannot deliver twice while transitioning');
      await wait(130);await shot('delivery-flight-'+width);await wait(150);await shot('delivery-received-'+width);
      await wait(850);assert.equal(await active('OrderDeliveryEffects'),false);assert.equal(await shownCoins(),'120');
      assert.equal(await ev(`${app}.view.deliveries.size`),0);assert.notEqual(await ev(`${app}.game.orders.getOrders()[0].uid`),oldUid);
      assert.ok(!(await labels()).some(v=>v.includes('订单交付成功')),'Delivery uses visual rewards instead of a text wall');
      await shot('delivery-arrived-'+width);
      passed('delivery sequence, exact one-time rewards, arrival counters and no replacement controls at '+width);
    }
    await seed(fixture);await tap('EnterGame');await rawTap('ClaimButton',0);await rawTap('ClaimButton',1);
    assert.equal(await ev(`${app}.view.deliveries.size`),2);assert.equal(await ev(`${app}.game.player.coins`),141);
    await tap('Button_家园');await wait(500);assert.equal(await active('OrderDeliveryEffects'),false);assert.equal(await ev(`${app}.view.deliveries.size`),0);
    assert.equal(await shownCoins(),'141');await send('Page.reload');await wait(400);await ready();await tap('EnterGame');assert.equal(await ev(`${app}.game.player.coins`),141);
    passed('parallel slots, page cancellation and restart preserve committed rewards');
    await seed(d=>{d.player.level=1;d.player.xp=49;d.life.claimedLevelRewards=[];d.board=Array.from({length:boardSize},(_,index)=>({index,...(index===0?{item:{uid:'level_delivery',definitionId:'coffee_01'}}:{})}));d.activeOrders[0].requirements=[{itemId:'coffee_01',count:1}];d.activeOrders[0].rewardXp=10;d.tutorial={generatorClicked:true,firstMergeCompleted:true,firstOrderCompleted:true,firstOrderHintShown:true};});
    await tap('EnterGame');await rawTap('ClaimButton',0);assert.equal(await active('LevelUpView'),false,'Level-up must wait for delivery');await wait(1100);assert.ok(await active('LevelUpView'));await shot('delivery-level-up');
    await tap('ClaimLevelReward');await wait(550);assert.equal(await active('LevelRewardEffects'),false);assert.equal(await ev(`${app}.view.levelRewardInFlight`),false);
    passed('level-up follows delivery and claim payout finishes without locking gameplay');
    await seed(fixture);await tap('EnterGame');await rawTap('ClaimButton',0);await send('Page.reload');await wait(400);await ready();await tap('EnterGame');assert.equal(await ev(`${app}.game.player.coins`),120);assert.equal(await active('OrderDeliveryEffects'),false);
    passed('restart during delivery preserves rewards without replaying an unfinished effect');
    await seed(d=>{fixture(d);d.discoveredItemIds=['coffee_01'];d.claimedDiscoveryIds=[];});await tap('EnterGame');await gesture(0,1);
    assert.ok(await active('DiscoveryReward'));assert.equal(await ev(`${app}.game.player.coins`),100+bundle.game.rewards.discoveryCoins);
    const noticeBounds=await ev(`(()=>{let card,dock;const w=n=>{if(n.name==='DiscoveryCard'&&n.activeInHierarchy)card=n;if(n.name==='GeneratorDock'&&n.activeInHierarchy)dock=n;n.children.forEach(w)};w(cc.director.getScene());const rect=n=>{const t=n.getComponent('cc.UITransform')??n._uiProps.uiTransformComp,p=n.worldPosition;return{bottom:p.y-t.height/2,top:p.y+t.height/2}};return{card:rect(card),dock:rect(dock)}})()`);
    assert.ok(noticeBounds.card.bottom>noticeBounds.dock.top,'Discovery must not cover generator controls');
    assert.ok(!(await labels()).some(t=>t.includes('准备好啦！')),'Date readiness stays in its objective bar');
    await shot('delivery-discovery');await wait(1700);assert.equal(await active('DiscoveryReward'),false);
    passed('first discovery uses an illustrated non-blocking card and still pays exactly once');
    assert.equal(exceptions.length,0);
  } else if (scope === 'chestflow') {
    const mature = d => { d.player.level=18; d.player.xp=7650; d.player.energy=500; d.player.diamonds=50; d.player.coins=1000;
      d.life.claimedLevelRewards=Array.from({length:17},(_,i)=>i+2); d.tutorial={generatorClicked:true,firstMergeCompleted:true,firstOrderCompleted:true,firstOrderHintShown:true}; };
    const boardWith = (items) => Array.from({length:boardSize},(_,index)=>({index,...(items[index]?{item:{uid:`chest_fixture_${index}`,definitionId:items[index]}}:{})}));
    const intersects=(a,b)=>a&&b&&Math.min(a.xMax,b.xMax)-Math.max(a.xMin,b.xMin)>0.5&&Math.min(a.yMax,b.yMax)-Math.max(a.yMin,b.yMin)>0.5;
    for (const [width,height] of [[320,568],[375,812],[430,932]]) for(const variant of ['ready','unready','urgent']) {
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true}); await load();
      const needs=variant==='urgent'?['coffee_01','flower_01']:['coffee_01'];
      await seed(d=>{mature(d);d.board=boardWith(needs);d.activeOrders[0].requirements=needs.map(itemId=>({itemId,count:variant==='unready'?2:1}));
        if(variant==='urgent')d.activeOrders[0].urgentUntil=Date.now()+1_200_000;});
      await ev(`cc.sys.getSafeAreaRect=()=>{const v=cc.view.getVisibleSize(),bottom=Math.min(50,v.height*.05),top=Math.min(80,v.height*.08);return new cc.Rect(0,bottom,v.width,v.height-bottom-top)};true`);
      await ev('new Promise(resolve=>cc.director.loadScene("Game",()=>setTimeout(()=>resolve(true),700)))'); await tap('EnterGame');
      const layout=await ev(`(()=>{let n;const w=v=>{if(!n&&v.name==='OrderCard'&&v.activeInHierarchy)n=v;v.children.forEach(w)};w(cc.director.getScene());const rect=v=>{if(!v||!v.activeInHierarchy)return null;const t=v.getComponent('cc.UITransform')??v._uiProps.uiTransformComp,p=v.worldPosition,z=v.worldScale;return{xMin:p.x-t.width*Math.abs(z.x)*t.anchorX,xMax:p.x+t.width*Math.abs(z.x)*(1-t.anchorX),yMin:p.y-t.height*Math.abs(z.y)*t.anchorY,yMax:p.y+t.height*Math.abs(z.y)*(1-t.anchorY)}};const c=n.getChildByName('ClaimButton');return {card:rect(n),claim:rect(c),text:c?.getComponentsInChildren(cc.Label).map(l=>l.string),menu:rect(n.getChildByName('OrderRefreshMenuButton')),items:[0,1,2].map(i=>rect(n.getChildByName('Required_'+i)))}})()`);
      if(variant==='unready')assert.equal(layout.claim,null,'Unready order must hide its delivery button');else {assert.ok(layout.claim&&Math.abs((layout.claim.xMin+layout.claim.xMax-layout.card.xMin-layout.card.xMax)/2)<2,'Delivery button should be centered');
      assert.ok(layout.text.some(t=>t.includes('交付订单')), 'Delivery button needs a clear label');
      assert.ok(!intersects(layout.claim,layout.menu)&&!intersects(layout.claim,layout.menu),'Delivery and the customer header must remain separate');
      for(const item of layout.items.filter(Boolean))assert.ok(!intersects(layout.claim,item),'Delivery must not cover item requirements');}
      await shot(`order-${variant}-${width}`); const before=await ev(`${app}.game.orders.getOrders()[0].uid`);
      if(variant==='ready'){for(let i=0;i<30 && !await ev(`${app}.view.feedback.clips.has('sfx_order')`);i++)await wait(100);
        await ev(`(()=>{const f=${app}.view.feedback;window.__qaOrderSound=[];window.__qaSoundOriginal=f.source.playOneShot;f.source.playOneShot=function(c,v){window.__qaOrderSound.push({name:c.name,url:c.nativeUrl});return window.__qaSoundOriginal.call(this,c,v)};return true})()`);}
      await tap(variant==='unready'?'OrderCard':'ClaimButton',0);const after=await ev(`${app}.game.orders.getOrders()[0].uid`);
      if(variant==='unready')assert.equal(after,before,'Unready order cannot deliver');else assert.notEqual(after,before,'Ready order must deliver through its button');
      if(variant==='ready'){const sounds=await ev('window.__qaOrderSound');assert.ok(sounds.some(v=>v.name==='sfx_order'||v.url?.includes('sfx_order')),'Real delivery must trigger its own order sound');await ev(`${app}.view.feedback.source.playOneShot=window.__qaSoundOriginal;true`);}
    }
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await load();
    const limit=bundle.generators.find(g=>g.id==='coffee_machine').streakCooldown.uses;assert.equal(limit,60,'Configured consecutive-use limit must be 60');
    await seed(d=>{mature(d);d.board=boardWith([]);d.generatorCooldowns={coffee_machine:{streak:limit-2,cooldownStartedAt:null}};});await tap('EnterGame');
    let status=await ev(`${app}.game.getGeneratorStatus('coffee_machine')`);assert.equal(status.streak,limit-2);assert.equal(status.streakLimit,limit);
    await tap('GenBtn',0);status=await ev(`${app}.game.getGeneratorStatus('coffee_machine')`);assert.equal(status.streak,limit-1);assert.equal(status.remainingCooldownMs,0,'Cooldown must not start early');
    await tap('GenBtn',0);status=await ev(`${app}.game.getGeneratorStatus('coffee_machine')`);assert.ok(status.remainingCooldownMs>0,'Configured final use starts cooldown'); assert.ok((await labels()).some(v=>v.includes('/'+limit)), 'Generator cooldown counter must show configured streak limit');
    const blocked=await cells();const diamondsBeforeRestore=await ev(`${app}.game.player.diamonds`);await tap('GenBtn',0);assert.deepEqual(await cells(),blocked,'Cooldown blocks extra production');
    assert.ok(await active('GeneratorRestoreOverlay'),'Cooldown must offer explicit restore');await tap('GeneratorRestoreCancel');assert.equal(await ev(`${app}.game.player.diamonds`),diamondsBeforeRestore);
    await tap('GenBtn',0);await tap('GeneratorRestoreConfirm');assert.equal(await ev(`${app}.game.player.diamonds`),diamondsBeforeRestore-2);assert.equal((await ev(`${app}.game.getGeneratorStatus('coffee_machine')`)).remainingCooldownMs,0);
    const currentOrders=await ev(`${app}.game.orders.getOrders()`);for(const order of currentOrders)assert.ok(order.requirements.reduce((sum,r)=>sum+r.count,0)<=2,'Orders may need at most two items in total');
    passed('order delivery controls across three sizes and configured generator streak limit');
    for(let index=0;index<bundle.adventures.length;index++){
      const chapter=bundle.adventures[index];await seed(d=>{mature(d);d.board=boardWith(['coffee_01','flower_01']);});await tap('EnterGame');const beforeAdventure=await cells();await tap('OpenAdventure');
      for(let page=0;page<Math.floor(index/2);page++)await tap('HubNext');await tap('AdventureOpen_'+chapter.id);
      assert.ok(await active('PuzzleCheck'),`Level-eligible chapter ${chapter.id} must open its puzzle directly without prior claims or delivery`);
      assert.deepEqual(await cells(),beforeAdventure,`Opening ${chapter.id} must not consume board items`);
    }
    passed('all six level-eligible adventures open directly without consuming items or claiming earlier chapters');
    await seed(d=>{mature(d);d.board=boardWith([]);d.generatorCharges={...d.generatorCharges,orange_tree:{charges:10,lastRecoveryAt:Date.now(),capacity:10}};});await tap('EnterGame');
    const dock=await coords('GeneratorDockViewport');await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:dock.x+95,y:dock.y,id:7}]});
    for(let i=1;i<=10;i++){await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:dock.x+95-i*18,y:dock.y,id:7}]});await wait(25)}await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await wait(450);
    const energy=await ev(`${app}.game.player.energy`);status=await ev(`${app}.game.getGeneratorStatus('orange_tree')`);assert.ok(status.maxCharges>=10);assert.equal(status.charges,10);
    for(let i=0;i<10;i++){await tap('GeneratorOrangeTree');assert.equal((await ev(`${app}.game.getGeneratorStatus('orange_tree')`)).charges,9-i);assert.equal(await ev(`${app}.game.player.energy`),energy)}
    const fruitBoard=await cells();assert.equal(fruitBoard.filter(c=>c.item?.definitionId.startsWith('fruit_')).length,10);await tap('GeneratorOrangeTree');assert.deepEqual(await cells(),fruitBoard);assert.equal((await ev(`${app}.game.getGeneratorStatus('orange_tree')`)).charges,0);
    assert.ok(await active('GeneratorRestoreOverlay'));const orangeDiamonds=await ev(`${app}.game.player.diamonds`);await tap('GeneratorRestoreCancel');assert.equal(await ev(`${app}.game.player.diamonds`),orangeDiamonds);
    await tap('GeneratorOrangeTree');await tap('GeneratorRestoreConfirm');assert.equal(await ev(`${app}.game.player.diamonds`),orangeDiamonds-5);assert.equal((await ev(`${app}.game.getGeneratorStatus('orange_tree')`)).charges,10);
    await seed(d=>{mature(d);d.player.diamonds=0;d.board=boardWith([]);d.generatorCharges={...d.generatorCharges,orange_tree:{charges:0,lastRecoveryAt:Date.now(),capacity:10}};});await tap('EnterGame');
    const noMoneyDock=await coords('GeneratorDockViewport');await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:noMoneyDock.x+95,y:noMoneyDock.y,id:7}]});
    for(let i=1;i<=10;i++){await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:noMoneyDock.x+95-i*18,y:noMoneyDock.y,id:7}]});await wait(25)}await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await wait(450);
    await tap('GeneratorOrangeTree');await tap('GeneratorRestoreConfirm');assert.equal(await ev(`${app}.game.player.diamonds`),0);assert.equal((await ev(`${app}.game.getGeneratorStatus('orange_tree')`)).charges,0,'Insufficient diamonds must not restore charges');
    passed('orange tree ten free touch picks, exhausted rejection and explicit paid restore');
    await seed(d=>{mature(d);d.board=boardWith([]);});await tap('EnterGame');await tap('OpenTools');await tap('GeneratorWorkshopButton');
    const purchaseQuote=await ev(`${app}.game.getGeneratorPurchaseQuote('coffee_machine')`),beforePurchase=await ev(`${app}.game.player.coins`);
    await tap('GeneratorPurchaseButton');assert.equal(await ev(`${app}.game.player.coins`),beforePurchase-purchaseQuote.cost);assert.equal((await ev(`${app}.game.getGeneratorStatus('coffee_machine')`)).inventory[0],2);
    await tap('GeneratorTab_upgrade');let mergeCoords=await coords('GeneratorMergeButton_1'),viewportCoords=await coords('GeneratorWorkshopViewport');
    if(mergeCoords.y>viewportCoords.y+30){await scrollDown('GeneratorWorkshopViewport');}await tap('GeneratorMergeButton_1');
    assert.equal((await ev(`${app}.game.getGeneratorStatus('coffee_machine')`)).level,2);await tap('GeneratorWorkshopCloseButton');
    for(let i=0;i<8;i++)await tap('GenBtn',0);const levelTwoItems=(await cells()).filter(c=>c.item).map(c=>c.item.definitionId);
    assert.ok(levelTwoItems.some(id=>id.startsWith('coffee_')));assert.ok(levelTwoItems.filter(id=>id.startsWith('coffee_')).every(id=>bundle.items.find(item=>item.id===id).level>=2),'Level 2 generator must not produce level 1 main-chain items');
    passed('purchase and merge generators through the workshop with level-appropriate main output');
    const machine=bundle.generators.find(g=>g.id==='coffee_machine'); const levels=machine.upgrade?.maxLevel ?? 8;
    assert.ok(levels>=8,'Generator must support eight levels');
    await seed(d=>{mature(d);d.board=boardWith([]);d.generatorInventory={...d.generatorInventory,coffee_machine:Array.from({length:levels},(_,i)=>i===levels-1?1:0)};});await tap('EnterGame');
    const maxMachine=await ev(`${app}.game.getGeneratorStatus('coffee_machine')`);assert.equal(maxMachine.level,levels);
    for(let i=0;i<10;i++)await tap('GenBtn',0);const generated=(await cells()).filter(c=>c.item).map(c=>c.item.definitionId);
    assert.ok(generated.some(id=>id.startsWith('coffee_')),'Highest machine must produce its main chain');
    for(const id of generated.filter(id=>id.startsWith('coffee_'))){const item=bundle.items.find(v=>v.id===id);assert.ok(item.level>=levels && item.level<=levels+2,`Highest machine generated out-of-range ${id}`)}
    await seed(d=>{mature(d);d.board=boardWith(['coffee_12','coffee_12']);});await tap('EnterGame');await gesture(0,1);const maxAfter=await cells();assert.deepEqual(new Set(maxAfter.slice(0,2).map(c=>c.item?.uid)),new Set(['chest_fixture_0','chest_fixture_1']),'Level 12 must keep both original UIDs');assert.ok(maxAfter.slice(0,2).every(c=>c.item?.definitionId==='coffee_12'),'Level 12 items must not merge');
    passed('highest generator main output respects its level and level-12 items do not merge');
    const ids=['treasure_chest','treasure_chest_02','treasure_chest_03','treasure_chest_04','treasure_chest_05'];
    for(let level=0;level<5;level++){
      await seed(d=>{mature(d);d.board=boardWith([ids[level],ids[level]]);});await tap('EnterGame');
      for(let i=0;i<30;i++){if(await ev(`(()=>{let c;const w=n=>{if(n.name==='Cell_0'&&n.activeInHierarchy)c=n;n.children.forEach(w)};w(cc.director.getScene());return !!c?.getChildByName('ItemView')?.getChildByName('ItemArt')?.getComponent(cc.Sprite)?.spriteFrame})()`))break;await wait(100)}
      assert.ok(await ev(`(()=>{let c;const w=n=>{if(n.name==='Cell_0'&&n.activeInHierarchy)c=n;n.children.forEach(w)};w(cc.director.getScene());return !!c?.getChildByName('ItemView')?.getChildByName('ItemArt')?.getComponent(cc.Sprite)?.spriteFrame})()`),`Chest level ${level+1} must show artwork`);
      await gesture(0,1);const after=await cells();if(level<4)assert.equal(after[1].item?.definitionId,ids[level+1],`Chest level ${level+1} merges upward`);else {assert.deepEqual(new Set(after.slice(0,2).map(c=>c.item?.uid)),new Set(['chest_fixture_0','chest_fixture_1']));assert.ok(after.slice(0,2).every(c=>c.item?.definitionId===ids[level]),'Highest chest must not merge')}
    }
    for(let level=0;level<5;level++){
      await seed(d=>{mature(d);d.board=boardWith([ids[level]]);});await tap('EnterGame');const before=await ev(`({coins:${app}.game.player.coins,diamonds:${app}.game.player.diamonds})`);
      await tap('Cell_0');assert.ok(await active('ChestOpenBurst') && await active('OpenedChest') && await active('ChestLootSummary'),'Opening must animate and summarize loot');await wait(1800);assert.equal(await active('ChestOpenBurst'),false,'Chest opening animation must be removed');let state=await cells();const loot=state.filter(c=>c.item&&c.item.uid!=='chest_fixture_0');
      assert.equal(loot.length,bundle.game.rewards.chestLevels[level].count,`Level ${level+1} must place configured loot`);
      assert.ok(loot.every(c=>/^(coin|energy|diamond)_/.test(c.item.definitionId)),'Chest produces coin/energy/diamond bottles');
      assert.equal(state.some(c=>c.item?.uid==='chest_fixture_0'),false,'Chest consumed on direct tap');
      assert.deepEqual(await ev(`({coins:${app}.game.player.coins,diamonds:${app}.game.player.diamonds})`),before,'Opening costs no coins or diamonds');
      assert.equal((await ev(`${app}.game.useBoardItem(0,'chest_fixture_0')`)).ok,false,'Consumed UID cannot open twice');
      assert.deepEqual(await cells(),state);await shot(`chest-open-${level+1}`);
    }
    await seed(d=>{mature(d);d.board=boardWith(Array.from({length:boardSize},(_,i)=>i===0?ids[4]:'coffee_01'));});await tap('EnterGame');await tap('Cell_0');await wait(1100);
    const overflow=await ev(`${app}.game.rewardInbox`);assert.equal(overflow.length,bundle.game.rewards.chestLevels[4].count-1,'Full board puts excess loot in recovery inbox');
    const idsBefore=overflow.map(i=>i.uid);await send('Page.reload');await wait(400);await ready();await wait(800);await tap('EnterGame');assert.deepEqual((await ev(`${app}.game.rewardInbox`)).map(i=>i.uid),idsBefore,'Recovery inbox preserves reward UIDs across restart');
    passed('five chest levels merge, open by touch, reject reused UID and preserve overflow');
    for(const chain of ['coin','energy','diamond']) for(const level of [1,2,3,4,5]){
      const id=`${chain}_0${level}`,definition=bundle.items.find(item=>item.id===id);assert.ok(definition,`Missing ${id}`);
      await seed(d=>{mature(d);d.player.energy=d.player.maxEnergy;d.board=boardWith([id]);});await tap('EnterGame');
      const before=await ev(`({coins:${app}.game.player.coins,energy:${app}.game.player.energy,diamonds:${app}.game.player.diamonds})`);
      await tap('Cell_0');assert.equal(await active('ConfirmConsume'),false,`${id} should be used directly`);assert.equal(await active('RewardsOverlay'),false,`${id} must not require exchange panel`);
      const after=await ev(`({coins:${app}.game.player.coins,energy:${app}.game.player.energy,diamonds:${app}.game.player.diamonds})`),field=chain==='coin'?'coins':chain==='diamond'?'diamonds':'energy';
      assert.equal(after[field],before[field]+definition.useValue,`${id} must grant its configured value`);
      if(chain==='energy')assert.ok(after.energy>await ev(`${app}.game.player.maxEnergy`),'Energy rewards may overflow cap');
      assert.ok(!(await cells()).some(c=>c.item?.uid==='chest_fixture_0'),`${id} must be consumed`);
      assert.equal((await ev(`${app}.game.useBoardItem(0,'chest_fixture_0')`)).ok,false,`${id} cannot be consumed twice`);
      assert.deepEqual(await ev(`({coins:${app}.game.player.coins,energy:${app}.game.player.energy,diamonds:${app}.game.player.diamonds})`),after);
    }
    for(const chain of ['coin','energy','diamond'])for(const level of [3,4,5]){
      const id=`${chain}_0${level}`;await seed(d=>{mature(d);d.board=boardWith([id,id]);});await tap('EnterGame');await gesture(0,1);const result=await cells();
      if(level<5)assert.equal(result[1].item?.definitionId,`${chain}_0${level+1}`,`${id} must merge to next level`);
      else {assert.deepEqual(new Set(result.slice(0,2).map(c=>c.item?.uid)),new Set(['chest_fixture_0','chest_fixture_1']));assert.ok(result.slice(0,2).every(c=>c.item?.definitionId===id),'Level 5 supplies cannot merge');}
    }
    assert.deepEqual(exceptions,[]);passed('all 15 supply levels use directly once with configured rewards and level 5 merge ceiling');
  } else if (scope === 'boardfill') {
    const mouseDrag = async (from,to) => { const a=await coords('Cell_'+from),b=typeof to==='number'?await coords('Cell_'+to):to;
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',...a}); await send('Input.dispatchMouseEvent',{type:'mousePressed',...a,button:'left',buttons:1,clickCount:1});
      for(let i=1;i<=6;i++){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:a.x+(b.x-a.x)*i/6,y:a.y+(b.y-a.y)*i/6,button:'left',buttons:1});await wait(35)}
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',...b,button:'left',buttons:0,clickCount:1});await wait(450); };
    for(const [width,height] of [[320,568],[375,812],[430,932]]) for(const mode of ['touch','mouse']) {
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
      await send('Emulation.setTouchEmulationEnabled',{enabled:mode==='touch',maxTouchPoints:5});
      await load(); await seed(d=>{d.player.level=18;d.player.xp=7650;d.life.claimedLevelRewards=Array.from({length:17},(_,i)=>i+2);
        d.tutorial={generatorClicked:true,firstMergeCompleted:true,firstOrderCompleted:true,firstOrderHintShown:true};
        d.board=Array.from({length:boardSize},(_,index)=>({index,...(index<3?{item:{uid:'fill_'+index,definitionId:index===2?'flower_01':'coffee_01'}}:{})}));});
      await ev(`cc.sys.getSafeAreaRect=()=>{const v=cc.view.getVisibleSize(),bottom=Math.min(50,v.height*.05),top=Math.min(80,v.height*.08);return new cc.Rect(0,bottom,v.width,v.height-bottom-top)};true`);
      await ev('new Promise(resolve=>cc.director.loadScene("Game",()=>setTimeout(()=>resolve(true),700)))');await tap('EnterGame');
      await checkBoardFill(); await shot(`boardfill-${width}-${mode}`);
      const drag=mode==='touch'?gesture:mouseDrag;
      await drag(0,1); let state=await cells(); assert.equal(state[1].item?.definitionId,'coffee_02',`${mode} merge`);assert.notEqual(state[0].item?.uid,'fill_0',`${mode} merged source UID must be consumed`);
      const mergedUid=state[1].item.uid; await drag(1,2);state=await cells();assert.equal(state[2].item?.uid,mergedUid,`${mode} swap merged item`);assert.equal(state[1].item?.uid,'fill_2',`${mode} swap source UID`);
      await drag(2,5);state=await cells();assert.equal(state[5].item?.uid,mergedUid,`${mode} move to edge column`);
      await drag(5,boardSize-1);state=await cells();assert.equal(state[boardSize-1].item?.uid,mergedUid,`${mode} move to final cell`);
      const before=await cells();await drag(boardSize-1,{x:2,y:2});assert.deepEqual(await cells(),before,`${mode} outside release must cancel`);
      await seed(d=>{d.tutorial={generatorClicked:true,firstMergeCompleted:true,firstOrderCompleted:true,firstOrderHintShown:true};d.board=Array.from({length:boardSize},(_,index)=>({index,...(index===0?{item:{uid:'locked_source',definitionId:'coffee_01'}}:{})}));});
      await tap('EnterGame');const lockedState=await cells(), source=lockedState.find(c=>c.item?.uid==='locked_source'), locked=lockedState.find(c=>c.locked&&!c.item);
      assert.ok(source&&!source.locked&&locked,'Fixture needs an open item and a locked cell');await drag(source.index,locked.index);assert.deepEqual(await cells(),lockedState,`${mode} cannot drop into locked cell`);
    }
    assert.deepEqual(exceptions,[]);passed('board fill, adjacent cells, touch/mouse merge, swap, edge and last-cell moves, outside release and locked drop at 320/375/430');
  } else if (scope === 'polish') {
    const assertSelected = async (title) => {
      const selected = await ev(`(()=>{let nav;const w=n=>{if(n.name==='Navigation'&&n.activeInHierarchy)nav=n;n.children.forEach(w)};w(cc.director.getScene());return nav.children.filter(n=>n.name.startsWith('Button_')&&n.getChildByName('NavigationSelection')?.activeInHierarchy).map(n=>n.name)})()`);
      assert.deepEqual(selected, ['Button_' + title], `Navigation selection must follow ${title}`);
    };
    const navGeometry = () => ev(`(()=>{let nav,safe,dock,summary,cell;const w=n=>{if(n.activeInHierarchy){if(n.name==='Navigation')nav=n;if(n.name==='SafeArea')safe=n;if(n.name==='GeneratorDock')dock=n;if(n.name==='BoardSummary')summary=n;if(n.name==='Cell_0')cell=n}n.children.forEach(w)};w(cc.director.getScene());const rect=n=>{if(!n)return null;const t=n.getComponent('cc.UITransform')??n._uiProps.uiTransformComp;if(!t)return null;const x0=-t.anchorX*t.width,x1=(1-t.anchorX)*t.width,y0=-t.anchorY*t.height,y1=(1-t.anchorY)*t.height;const p=[[x0,y0],[x0,y1],[x1,y0],[x1,y1]].map(([x,y])=>t.convertToWorldSpaceAR(new cc.Vec3(x,y,0)));return {xMin:Math.min(...p.map(v=>v.x)),xMax:Math.max(...p.map(v=>v.x)),yMin:Math.min(...p.map(v=>v.y)),yMax:Math.max(...p.map(v=>v.y))}};const buttons=nav.children.filter(n=>n.name.startsWith('Button_')).map(n=>({name:n.name,box:rect(n),label:rect(n.getChildByName('NavigationCaption')),icon:rect(n.getChildByName('NavigationIcon')?.getChildByName('NavSymbol'))}));const v=cc.view.getVisibleSize();return{safe:rect(safe),nav:rect(nav),dock:rect(dock),summary:rect(summary),cell:rect(cell),buttons,scaleX:innerWidth/v.width,scaleY:innerHeight/v.height}})()`);
    const within = (a,b) => !!a && !!b && a.xMin>=b.xMin-1 && a.xMax<=b.xMax+1 && a.yMin>=b.yMin-1 && a.yMax<=b.yMax+1;
    const intersects = (a,b) => !!a && !!b && Math.min(a.xMax,b.xMax)-Math.max(a.xMin,b.xMin)>0.5 && Math.min(a.yMax,b.yMax)-Math.max(a.yMin,b.yMin)>0.5;
    for (const [width, height] of [[320,568],[375,812],[430,932]]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
      await load(); await seed((d) => { d.player.level = 18; d.player.xp = 7650; d.player.energy = 50; d.player.diamonds = 30; d.player.hearts = 37;
        d.life.claimedLevelRewards = Array.from({length:17},(_,i)=>i+2); d.life.ownedFurnitureIds=['sofa']; d.life.placedFurnitureIds=['sofa']; d.life.unlockedMemoryIds=bundle.memories.slice(0,4).map(m=>m.id);
        const needs = ['coffee_01','flower_01'];
        d.board = Array.from({length: boardSize}, (_,index)=>({index, ...(index < needs.length ? {item:{uid:`polish_${index}`,definitionId:needs[index]}} : {})}));
        d.activeOrders[0].requirements = needs.map((itemId)=>({itemId,count:1}));
        d.activeOrders[0].urgentUntil = Date.now() + 20 * 60 * 1000;
        d.discoveredItemIds = [...needs]; d.tutorial={generatorClicked:true,firstMergeCompleted:true,firstOrderCompleted:true,firstOrderHintShown:true}; });
      // Simulate asymmetric notch and home-indicator insets while preserving UI state.
      await ev(`cc.sys.getSafeAreaRect=()=>{const v=cc.view.getVisibleSize(),bottom=Math.min(50,v.height*.05),top=Math.min(80,v.height*.08);return new cc.Rect(0,bottom,v.width,v.height-bottom-top)};true`);
      await ev('new Promise(resolve=>cc.director.loadScene("Game",()=>setTimeout(()=>resolve(true),700)))'); await tap('EnterGame');
      assert.equal(await ev(`${app}.game.config.board.rows`), 7); assert.equal(await ev(`${app}.game.config.board.columns`), 6);
      await assertSelected('合成'); await checkBoardFill(); const geo = await navGeometry();
      assert.equal(geo.buttons.length,4); assert.ok(within(geo.nav,geo.safe),'Navigation must stay inside safe area');
      assert.ok(geo.dock && !intersects(geo.nav,geo.dock),'Navigation must not overlap generator dock');
      for (const button of geo.buttons) {
        assert.ok(within(button.box,geo.safe) && within(button.label,geo.safe) && within(button.icon,geo.safe), `${button.name} content must fit safe area`);
        assert.ok((button.box.yMax-button.box.yMin)*geo.scaleY >= 43, `${button.name} touch target too small`);
      }
      assert.ok(geo.cell && (geo.cell.xMax-geo.cell.xMin)*geo.scaleX >= 26, 'Board cell visually too small');
      assert.ok(geo.summary, 'Board goal row must be visible');
      const goalText = await ev(`(()=>{let n;const w=v=>{if(v.name==='BoardGoalText'&&v.activeInHierarchy)n=v;v.children.forEach(w)};w(cc.director.getScene());const l=n?.getComponent(cc.Label);l?.updateRenderData(true);return l&&{text:l.string,size:l.actualFontSize??l.fontSize,scale:Math.abs(n.worldScale.y)}})()`);
      assert.ok(goalText?.text && goalText.size*goalText.scale*geo.scaleY>=7.5, 'Board objective text must remain readable');
      const resources = await ev(`(()=>{const out={};const w=n=>{if(n.activeInHierarchy&&['HeartsValue','DiamondsValue','LevelCard','Resources','Title'].includes(n.name)){const t=n.getComponent('cc.UITransform')??n._uiProps.uiTransformComp,p=n.worldPosition,z=n.worldScale;out[n.name]={parent:n.parent?.name,text:n.getComponent(cc.Label)?.string??null,xMin:p.x-t.width*Math.abs(z.x)*t.anchorX,xMax:p.x+t.width*Math.abs(z.x)*(1-t.anchorX),yMin:p.y-t.height*Math.abs(z.y)*t.anchorY,yMax:p.y+t.height*Math.abs(z.y)*(1-t.anchorY)}}n.children.forEach(w)};w(cc.director.getScene());return out})()`);
      assert.equal(resources.HeartsValue.parent,'LevelHearts'); assert.equal(resources.HeartsValue.text,'37');
      assert.equal(resources.DiamondsValue.parent,'Resources'); assert.equal(resources.DiamondsValue.text,'30');
      assert.ok(resources.LevelCard.xMax < resources.Resources.xMin, 'Hearts and diamonds must occupy separate status regions');
      await tap('diamondsPlus'); assert.ok(await active('RewardsOverlay'),'Diamond control must open the supply panel'); await tap('CloseRewards');
      assert.ok((await labels()).some((value)=>value === '0/6'),'Backpack count must be visible');
      await tap('BoardBackpackButton'); assert.ok(await active('PlayOverlay'),'Backpack shortcut must open the backpack');
      assert.ok((await labels()).some(v=>v.includes('收纳 0/6')), 'Backpack panel must show empty capacity'); await shot(`polish-backpack-empty-${width}`);
      const bagLayout=await ev(`(()=>{let panel;const w=n=>{if(n.name==='PlayPanel'&&n.activeInHierarchy)panel=n;n.children.forEach(w)};w(cc.director.getScene());const t=panel.getComponent('cc.UITransform')??panel._uiProps.uiTransformComp,v=cc.view.getVisibleSize();return{height:t.height*Math.abs(panel.worldScale.y)/v.height*innerHeight,y:panel.worldPosition.y,slots:panel.children.filter(n=>n.name.startsWith('Warehouse_')).length}})()`);
      assert.ok(bagLayout.height<=height*.7 && bagLayout.y<0 && bagLayout.slots===6,'Backpack must be a compact bottom drawer with six slots');
      assert.equal(await active('Store_0'),false); await tap('PlayClose'); await dragItemToBackpack(0); await tap('BoardBackpackButton'); assert.ok((await labels()).some(v=>v.includes('收纳 1/6')), 'Backpack panel must update capacity after storing'); await shot(`polish-backpack-stored-${width}`); await tap('PlayClose'); assert.ok((await labels()).some((value)=>value === '1/6'));
      await tap('BoardBackpackButton'); await tap('Warehouse_0'); assert.ok((await labels()).some(v=>v.includes('收纳 0/6')), 'Backpack panel must update capacity after withdrawal'); await tap('PlayClose'); assert.ok((await labels()).some((value)=>value === '0/6'));
      await tap('DailyCheckInButton'); assert.ok(await active('RewardsOverlay') && await active('CheckInClaim'),'Top sign-in shortcut must open the check-in tab');
      const rewardGeometry = () => ev(`(()=>{const names=['RewardsViewport','RewardsTab_checkin','RewardsTab_daily','RewardsTab_supplies','RewardsTab_collection','CheckInClaim','CheckInDay_7'],out={};const w=n=>{if(n.activeInHierarchy&&names.includes(n.name)){const t=n.getComponent('cc.UITransform')??n._uiProps.uiTransformComp,p=n.worldPosition,z=n.worldScale;out[n.name]={xMin:p.x-t.width*Math.abs(z.x)*t.anchorX,xMax:p.x+t.width*Math.abs(z.x)*(1-t.anchorX),yMin:p.y-t.height*Math.abs(z.y)*t.anchorY,yMax:p.y+t.height*Math.abs(z.y)*(1-t.anchorY)}}n.children.forEach(w)};w(cc.director.getScene());return out})()`);
      let rewardsGeo = await rewardGeometry();
      for (const tab of ['checkin','daily','supplies','collection']) assert.ok(!intersects(rewardsGeo.RewardsViewport,rewardsGeo['RewardsTab_'+tab]), 'Rewards tabs must not overlap the scroll viewport');
      assert.ok(within(rewardsGeo.CheckInClaim,rewardsGeo.RewardsViewport), 'Today sign-in claim must be visible without scrolling');
      for (let i=0; i<8 && !within(rewardsGeo.CheckInDay_7,rewardsGeo.RewardsViewport); i++) { await swipeRewardViewport(-1, 31+i, height); rewardsGeo = await rewardGeometry(); }
      assert.ok(within(rewardsGeo.CheckInDay_7,rewardsGeo.RewardsViewport), 'Seventh sign-in day must be fully visible after touch scrolling');
      await tap('CloseRewards');
      const card = await ev(`(()=>{let n;const w=v=>{if(!n&&v.name==='OrderCard'&&v.activeInHierarchy)n=v;v.children.forEach(w)};w(cc.director.getScene());const box=v=>{if(!v)return null;const t=v.getComponent('cc.UITransform')??v._uiProps.uiTransformComp,p=v.worldPosition,z=v.worldScale;return{xMin:p.x-t.width*Math.abs(z.x)*t.anchorX,xMax:p.x+t.width*Math.abs(z.x)*(1-t.anchorX),yMin:p.y-t.height*Math.abs(z.y)*t.anchorY,yMax:p.y+t.height*Math.abs(z.y)*(1-t.anchorY)}};return{claim:box(n.getChildByName('ClaimButton')),menu:box(n.getChildByName('OrderRefreshMenuButton')),avatar:box(n.getChildByName('CustomerAvatar')),urgent:box(n.getChildByName('OrderUrgentBadge')),countdown:box(n.getChildByName('OrderUrgentCountdown')),items:[0,1].map(i=>{const r=n.getChildByName('Required_'+i),a=r.getChildByName('Art');return{box:box(r),sprite:!!a.getComponent(cc.Sprite)?.spriteFrame,labels:r.getComponentsInChildren(cc.Label).filter(l=>l.node.activeInHierarchy).map(l=>({text:l.string,size:l.fontSize,scale:Math.abs(l.node.worldScale.y)}))}})}})()`);
      assert.ok(await active('OrderUrgentBadge') && await active('OrderUrgentCountdown'), 'Urgent order must show its badge and countdown');
      assert.ok(!intersects(card.urgent,card.countdown), 'Urgent badge and countdown overlap');
      assert.ok(!intersects(card.claim,card.menu)&&!intersects(card.claim,card.menu),'Order delivery and refresh controls overlap');
      for (const item of card.items) {
        assert.ok(!intersects(item.box,card.claim) && !intersects(item.box,card.avatar) && !intersects(item.box,card.urgent) && !intersects(item.box,card.countdown), `Order requirements overlap header or delivery control: ${JSON.stringify({item:item.box,claim:card.claim,avatar:card.avatar,urgent:card.urgent,countdown:card.countdown})}`);
        assert.ok(item.sprite && item.labels.some((l)=>/1\s*\/\s*1/.test(l.text)), 'Both order requirements must show icon and quantity');
        const count = item.labels.find((l)=>/1\s*\/\s*1/.test(l.text));
        assert.ok(count.size*count.scale*geo.scaleY>=8, 'Order quantity font is too small');
      }
      await shot(`polish-merge-${width}`);
      await tap('Button_回忆'); await assertSelected('回忆'); await waitForArt('Illustration'); await shot(`polish-memories-${width}`);
      const memoryTargets=await ev(`(()=>{const sizes=[];const w=n=>{if(n.name.startsWith('MemoryTab_')&&n.activeInHierarchy)sizes.push((n.getComponent('cc.UITransform')??n._uiProps.uiTransformComp).height);n.children.forEach(w)};w(cc.director.getScene());return sizes})()`);assert.ok(memoryTargets.length===4 && memoryTargets.every(h=>h>=104),'Compact memory tabs must retain their original touch area');
      await tap('Button_任务'); await assertSelected('任务'); assert.ok(await active('Wishes')); await tap('Button_关闭');
      assert.equal(await ev(`${app}.view.lifePages.currentPage`),'memories'); await assertSelected('回忆');
      await tap('Button_家园'); await assertSelected('家园'); await tap('Button_任务'); await assertSelected('任务'); await tap('Button_关闭');
      assert.equal(await ev(`${app}.view.lifePages.currentPage`),'home'); await assertSelected('家园');
      await shot(`layout-home-${width}`); await tap('HomeWishNote'); assert.ok(await active('Wishes')); await tap('Button_关闭');
      await tap('Button_调整位置'); await tap('Placed_sofa'); assert.ok(await active('FurnitureTransformControls'));
      const furnitureGeo = await ev(`(()=>{const names=['FurnitureTransformControls','Navigation','HomeActions','SafeArea'];const out={};const w=n=>{if(n.activeInHierarchy&&names.includes(n.name)){const t=n.getComponent('cc.UITransform')??n._uiProps.uiTransformComp,p=n.worldPosition,z=n.worldScale;out[n.name]={xMin:p.x-t.width*Math.abs(z.x)*t.anchorX,xMax:p.x+t.width*Math.abs(z.x)*(1-t.anchorX),yMin:p.y-t.height*Math.abs(z.y)*t.anchorY,yMax:p.y+t.height*Math.abs(z.y)*(1-t.anchorY)}}n.children.forEach(w)};w(cc.director.getScene());return out})()`);
      assert.ok(within(furnitureGeo.FurnitureTransformControls,furnitureGeo.SafeArea),'Furniture controls outside safe area');
      assert.ok(!intersects(furnitureGeo.FurnitureTransformControls,furnitureGeo.Navigation) && !intersects(furnitureGeo.FurnitureTransformControls,furnitureGeo.HomeActions),'Furniture controls must not overlap navigation or home actions');
      await shot(`polish-furniture-${width}`); await tap('Button_完成布置'); await tap('Button_布置家具');
      assert.ok(await active('FurnitureCatalog')); await shot(`layout-furniture-catalog-${width}`); await tap('Button_关闭');
      await tap('Button_合成'); await assertSelected('合成');
      await tap('DailyCheckInButton'); assert.ok(await active('RewardsOverlay')); await shot(`polish-rewards-checkin-${width}`);
      assert.ok(await active('CheckInClaim')); await tap('RewardsTab_daily'); assert.ok(await active('DailyTask_orders_3')); await shot(`polish-rewards-daily-${width}`);
      await tap('RewardsTab_supplies'); assert.ok(await active('RewardRow')); await shot(`polish-rewards-supplies-${width}`);
      await tap('RewardsTab_collection'); assert.ok(await active('Collection_coffee')); await shot(`polish-rewards-collection-${width}`);
      await tap('GeneratorWorkshopButton'); assert.ok(await active('GeneratorWorkshopPanel')); await shot(`polish-generator-${width}`); await tap('GeneratorWorkshopCloseButton');
      await tap('OpenTools'); await tap('OpenTodayJournal'); assert.ok(await active('JournalOverlay')); await shot(`polish-journal-${width}`); await tap('JournalClose');
      await tap('Cell_0'); assert.ok(await active('ItemGuideOverlay')); await shot(`polish-guide-${width}`); await tap('ItemGuideClose');
      await tap('OpenTools'); await tap('BackpackButton'); assert.ok(await active('PlayOverlay')); await tap('PlayClose');
      await tap('SettingsButton'); assert.ok(await active('SettingsOverlay')); await shot(`polish-settings-${width}`); await tap('SettingsClose');
    }
    assert.deepEqual(exceptions, []); passed('polish: four navigation states, safe areas, tabbed menus and furniture controls at 320/375/430');
  } else if (scope === 'artfailure') {
    await send('Network.setCacheDisabled', { cacheDisabled: true }); await send('Network.setBlockedURLs', { urls: ['*/assets/game_art/*'] });
    await load('?preview=lv12'); await tap('EnterGame');
    const fallback = await labels(); assert.ok(fallback.includes('咖1'));
    const requiredNames = await ev(`(()=>{const g=${app}.game;return g.orders.getOrders().flatMap(o=>o.requirements.map(r=>g.bundle.catalog.get(r.itemId).displayName))})()`);
    for (const name of requiredNames) assert.ok(fallback.includes(name), 'Missing fallback: ' + name);
    await gesture(0, 1); assert.equal((await cells())[1].item.definitionId, 'coffee_02'); await shot('art-failure');
    assert.deepEqual(exceptions, []); passed('art failure fallback preserves readable board/orders and touch merging');
  } else if (scope === 'level2') {
    await load(); await seed((d) => { d.player.level = 2; d.player.xp = 50; d.life.claimedLevelRewards = []; });
    await tap('EnterGame'); assert.ok((await labels()).includes('阳光橘树 已解锁'));
    const image = await waitForArt('UnlockedGenerator'); assert.ok(image.width > 0 && image.height > 0, 'Orange-tree sprite must have a loaded texture');
    await shot('level2-orange-unlock'); await tap('ClaimLevelReward');
    assert.ok(!(await active('LevelUpView'))); passed('Lv2 reward shows the orange tree Chinese name and actual art');
    assert.deepEqual(exceptions, []);
  } else if (scope === 'timeline') {
    // Isolated seeded regression, deliberately not a fresh-save gameplay proof.
    await load(); await seed((d) => {
      d.player.level = 18; d.player.xp = 7650;
      d.life.claimedLevelRewards = Array.from({ length: 17 }, (_, i) => i + 2);
      d.life.unlockedMemoryIds = bundle.memories.map((memory) => memory.id);
      for (const chapter of bundle.adventures) d.play.chapters[chapter.id] = {
        step: chapter.steps.length, found: [], selected: [], rotations: [], code: '', hints: 0, outcome: 'solved', claimed: true,
      };
    });
    await tap('EnterGame'); await tap('Button_回忆'); await tap('MemoryTab_timeline'); await shot('timeline-top');
    await scrollDown('MemoryTimelineViewport'); await shot('timeline-bottom');
    await tap('TimelineEntry_' + bundle.adventures[bundle.adventures.length - 1].memoryId);
    await tap('WeddingLetterReplay'); assert.ok(await active('WeddingEndingOverlay'));
    await tap('WeddingEndingContinueHome'); assert.equal(await ev(`${app}.view.lifePages.currentPage`), 'home');
    passed('focused seeded timeline touch-scroll, final memory, wedding reread and home exit');
    assert.deepEqual(exceptions, []);
  } else {
  let orderLayoutIssues = [];
  const grownUp = (d) => {
    d.player.level = 18; d.player.xp = 7650;
    d.life.claimedLevelRewards = Array.from({ length: 17 }, (_, i) => i + 2);
    d.tutorial = { generatorClicked: true, firstMergeCompleted: true, firstOrderCompleted: true };
  };
  if (scope === 'full') {
  const freshRunStarted = Date.now();
  await load();
  assert.ok((await labels()).some((text) => text.includes('2023.09.08')));
  assert.ok(await active('EntryCover'));
  assert.ok(!(await ev(`(()=>{const a=[...document.querySelectorAll('img')].filter(e=>e.offsetWidth&&e.offsetHeight);return a.some(e=>/cocos|splash/i.test((e.src||'')+' '+(e.alt||'')))})()`)), 'Default engine logo is visible');
  await shot('cover'); await tap('EnterGame');
  const freshBoard = await cells();
  assert.equal(freshBoard.length, boardSize);
  assert.equal(freshBoard.filter((c) => !c.locked).length, 9);
  assert.deepEqual(freshBoard.filter((c) => !c.locked).map((c) => c.index), [0,1,2,boardColumns,boardColumns+1,boardColumns+2,2*boardColumns,2*boardColumns+1,2*boardColumns+2]);
  await tap('SettingsButton'); assert.ok(await active('SettingsOverlay'));
  await tap('SoundToggle'); await tap('VibrationToggle');
  assert.deepEqual(await ev(`${app}.game.preferences`), { soundEnabled: false, vibrationEnabled: false });
  assert.deepEqual(await ev(`JSON.parse(localStorage.getItem(${JSON.stringify(key)})).preferences`), { soundEnabled: false, vibrationEnabled: false });
  await tap('SettingsClose'); await tap('SettingsButton'); await tap('SoundToggle'); await tap('VibrationToggle'); await tap('SettingsClose');
  assert.deepEqual(await ev(`${app}.game.preferences`), { soundEnabled: true, vibrationEnabled: true });
  await ev(`(()=>{window.__qaFeedback={audio:0,vibrate:0,volume:0}; const source=${app}.view.feedback.source;
    window.__qaAudioOriginal=source.playOneShot; source.playOneShot=function(clip,volume){window.__qaFeedback.audio++;window.__qaFeedback.volume=volume;return window.__qaAudioOriginal.call(this,clip,volume)};
    Object.defineProperty(navigator,'vibrate',{configurable:true,writable:true,value:()=>{window.__qaFeedback.vibrate++;return true}});return true})()`);
  for (let i = 0; i < 30 && !await ev(`${app}.view.feedback.clips.has('sfx_merge')`); i++) await wait(100);
  await tap('SettingsButton'); await tap('PreviewFeedback');
  const feedback = await ev('window.__qaFeedback');
  assert.ok(feedback.audio >= 1 && feedback.vibrate >= 1 && feedback.volume >= 0.7, 'Preview must invoke sound and vibration');
  await ev(`(()=>{window.__qaOldWx=globalThis.wx;window.__qaNative={events:[],vibrations:[],players:[]};
    globalThis.wx={createInnerAudioContext(){const q=window.__qaNative,p={src:'',volume:0,obeyMuteSwitch:true,
      stop(){q.events.push('stop')},play(){q.events.push('play')},destroy(){},onError(){}};q.players.push(p);return p},
      vibrateShort(v){window.__qaNative.vibrations.push(v)}};return true})()`);
  await tap('PreviewFeedback'); const nativeFeedback = await ev('window.__qaNative');
  assert.ok(nativeFeedback.players[0]?.src && nativeFeedback.players[0].volume > 0.5 && nativeFeedback.players[0].obeyMuteSwitch === false);
  assert.deepEqual(nativeFeedback.events.slice(-2), ['stop', 'play']);
  assert.equal(nativeFeedback.vibrations.at(-1)?.type, 'medium');
  await tap('SoundToggle'); await tap('VibrationToggle'); const mutedNative = await ev('JSON.stringify(window.__qaNative)');
  await tap('PreviewFeedback'); assert.equal(await ev('JSON.stringify(window.__qaNative)'), mutedNative, 'Muted preview must not play or vibrate');
  await tap('SoundToggle'); await tap('VibrationToggle');
  await ev('globalThis.wx=window.__qaOldWx;true');
  await tap('SettingsClose');
  await ev(`${app}.view.feedback.source.playOneShot=window.__qaAudioOriginal;true`);
  assert.ok((await labels()).some((text) => text.includes('晨间咖啡')));
  assert.ok(await active('TutorialGesture')); await tap('GenBtn', 0); freshPathActions.push('spawn opening coffee item'); assert.ok(await active('TutorialGesture')); await shot('drag-guide');
  await tap('Cell_0'); assert.ok(await active('ItemGuideOverlay'));
  assert.ok((await labels()).some((text) => text.includes('咖啡机')));
  assert.ok((await labels()).some((text) => text.includes('合成链')));
  const future = bundle.items.find((item) => item.id === 'coffee_08');
  assert.ok(!(await labels()).includes(future.displayName));
  assert.equal(await ev(`(()=>{let n;const walk=v=>{if(v.name==='ItemGuide_coffee_08'&&v.activeInHierarchy)n=v;v.children.forEach(walk)};walk(cc.director.getScene());return !!n?.getChildByName('ItemGuideIcon')?.getComponent(cc.Sprite)?.spriteFrame})()`), false);
  await tap('ItemGuideClose');
  await ev("window.__hapticCalls=0;Object.defineProperty(navigator,'vibrate',{configurable:true,writable:true,value:()=>{window.__hapticCalls++;return true}});true");
  assert.equal(await ev(`${app}.view.feedback.clips.has('sfx_merge')`), true);
  await gesture(0, 1); freshPathActions.push('merge coffee_01 pair into coffee_02');
  assert.equal((await cells())[1].item.definitionId, 'coffee_02');
  assert.ok(await ev('window.__hapticCalls>0'));
  assert.ok((await labels()).some((text) => text.includes('交付订单')));
  assert.ok(!(await labels()).some((t) => t.includes('还差一点') || t.includes('下午茶')));
  const orderIcon = await ev(`(()=>{let n;const w=v=>{if(!n&&v.name==='OrderCard'&&v.activeInHierarchy)n=v;v.children.forEach(w)};w(cc.director.getScene());const a=n?.getChildByName('Required_0')?.getChildByName('Art');const t=a&&(a.getComponent('cc.UITransform')??a._uiProps.uiTransformComp);return t&&{width:t.width,height:t.height,hasSprite:!!a.getComponent(cc.Sprite)?.spriteFrame}})()`);
  assert.ok(orderIcon?.hasSprite && orderIcon.width >= 40 && orderIcon.height >= 40, `Order required item icon must be visible and enlarged: ${JSON.stringify(orderIcon)}`);
  const orderBounds = await ev(`(()=>{let card;const w=n=>{if(!card&&n.name==='OrderCard'&&n.activeInHierarchy)card=n;n.children.forEach(w)};w(cc.director.getScene());const box=name=>{const n=card?.getChildByName(name);const t=n&&(n.getComponent('cc.UITransform')??n._uiProps.uiTransformComp);if(!t)return null;const b=t.getBoundingBoxToWorld();return{xMin:b.xMin,xMax:b.xMax,yMin:b.yMin,yMax:b.yMax}};return {claim:box('ClaimButton'),menu:box('OrderRefreshMenuButton'),required:box('Required_0'),avatar:box('CustomerAvatar')}})()`);
  const overlaps = (a, b) => a && b && Math.min(a.xMax, b.xMax) - Math.max(a.xMin, b.xMin) > 0.5 && Math.min(a.yMax, b.yMax) - Math.max(a.yMin, b.yMin) > 0.5;
  assert.ok(orderBounds.claim && orderBounds.required && orderBounds.avatar && !await active('OrderRefreshMenuButton'), 'Order layout shows the customer without replacement controls');
  orderLayoutIssues = [];
  if (overlaps(orderBounds.claim, orderBounds.menu) || overlaps(orderBounds.claim, orderBounds.menu)) orderLayoutIssues.push('Claim button overlaps refresh controls');
  if (overlaps(orderBounds.required, orderBounds.avatar)) orderLayoutIssues.push('Requirement area overlaps customer portrait');
  if (orderLayoutIssues.length) { fs.writeFileSync(path.join(output, 'order-layout-failure.json'), JSON.stringify({ orderBounds, orderLayoutIssues }, null, 2)); await shot('order-layout-failure'); }
  assert.deepEqual(orderLayoutIssues, [], 'Order layout overlaps detected');

  await tap('OrderCard', 0); freshPathActions.push('deliver first coffee order');
  assert.equal(await ev(`${app}.game.life.state.stats.orders`), 1);
  assert.equal(await ev(`${app}.game.player.coins`), initial.activeOrders[0].rewardCoins + bundle.game.rewards.discoveryCoins);
  assert.ok(await active('OrderDeliveryEffects') || !(await ev(`${app}.view.deliveries.size`)), 'Delivery has a visual sequence and finishes cleanly');
  await wait(750);
  await shot('merge'); passed('fresh-save target, item guide, persistent toggles and touch order delivery');

  await tap('OpenAdventure');
  assert.ok((await labels()).some((value) => value.includes('旅程 0/6') && value.includes('推荐')));
  await tap('AdventureOpen_love_letters');
  const lockedJourneyToast = await ev(`${app}.view.toast.current.getComponentInChildren(cc.Label).string`);
  assert.ok(lockedJourneyToast.startsWith('开启条件：') && lockedJourneyToast.includes('达到 Lv.3（当前 Lv.1）')
    && !lockedJourneyToast.includes('先完成并珍藏上一章'));
  await tap('PlayClose');
  passed('six-chapter journey shows its recommendation and level locks without a previous-chapter prerequisite');

  // First-15-minute fresh-save route: all changes below use visible touch/drag UI; ev() only observes state.
  const dateRequirements = await ev(`(()=>{const o=${app}.game.play.smallDateOrder();return o.template.requirements})()`);
  for (const requirement of dateRequirements) await ensureItem(requirement.itemId, requirement.count);
  await tap('OpenAdventure'); await tap('SmallDateOpen');
  assert.equal(await ev(`${app}.game.play.smallDateOrder().ready`), true);
  const firstDateId = await ev(`${app}.game.play.smallDateOrder().template.id`);
  await tap('SmallDateDeliver');
  assert.equal(await ev(`${app}.game.play.state.smallDate.completed`), 1);
  freshPathActions.push(`deliver first small date ${firstDateId}`);
  await tap('PlayClose');

  const firstChapter = bundle.adventures.find((chapter) => chapter.id === 'zhoushan');
  assert.ok(firstChapter, 'Fresh route requires the opening chapter');
  const chapterBoardBefore = await cells();
  await tap('OpenAdventure'); await tap('AdventureOpen_zhoushan');
  assert.ok(await active('PuzzleCheck')); assert.deepEqual(await cells(), chapterBoardBefore, 'Opening the first puzzle must not consume board items');
  freshPathActions.push('open first chapter puzzle directly');
  await solvePuzzle(firstChapter);
  assert.equal(await ev(`${app}.game.play.progress('zhoushan').outcome`), 'solved');
  assert.ok(await active('PuzzleSuccessBurst'));
  await shot('first15-puzzle-success'); await wait(800); await tap('AdventureClaim');
  assert.equal(await ev(`${app}.game.play.progress('zhoushan').claimed`), true);
  assert.ok((await labels()).some((value) => value.includes('下一章尚未解锁') && value.includes('达到 Lv.3')));
  freshPathActions.push('solve and claim opening chapter'); await tap('JourneyContinue');
  assert.equal(await ev(`${app}.view.lifePages.currentPage`), 'merge');
  assert.ok(!(await active('PlayOverlay')));

  let naturalOrders = 1;
  let lv3OrderIndex = 0;
  for (let guard = 0; guard < 24 && await ev(`${app}.game.player.level`) < 3; guard += 1) {
    const activeOrders = await ev(`(()=>{const g=${app}.game;return g.orders.getOrders().map((order,index)=>({index,uid:order.uid,rewardXp:order.rewardXp,requirements:order.requirements,ready:g.board.getOrderProgress(order).ready}))})()`);
    if (!activeOrders.length) {
      const diagnostics = await ev(`(()=>{const g=${app}.game;return {player:g.player,save:g.buildSaveData(),unlocked:g.player.unlockedChainIds}})()`);
      fs.writeFileSync(path.join(output, 'fresh-orders-empty.json'), JSON.stringify(diagnostics, null, 2));
      await shot('fresh-orders-empty');
    }
    assert.ok(activeOrders.length, 'Fresh route ran out of active orders');
    const estimateCost = (order) => order.requirements.reduce((sum, requirement) => {
      const definition = bundle.items.find((item) => item.id === requirement.itemId);
      return sum + requirement.count * 2 ** Math.max(0, (definition?.level ?? 1) - 1);
    }, 0);
    const readyOrder = activeOrders.find((order) => order.ready);
    const chosen = readyOrder ?? [...activeOrders].sort((a, b) =>
      b.rewardXp / estimateCost(b) - a.rewardXp / estimateCost(a))[0];
    for (const requirement of chosen.requirements) await ensureItem(requirement.itemId, requirement.count);
    await tap('OrderCard', chosen.index); naturalOrders += 1;
    freshPathActions.push(`deliver order ${chosen.uid}`);
    if (await ev(`${app}.game.player.level`) >= 3) { lv3OrderIndex = naturalOrders; break; }
    for (let reward = 0; reward < 8 && await active('LevelUpView'); reward += 1) {
      await tap('ClaimLevelReward'); await wait(200);
    }
  }
  assert.ok(await ev(`${app}.game.player.level`) >= 3, 'Lv3 was not reached from a fresh save');
  assert.ok((await cells()).filter((c) => !c.locked).length >= 16, 'Lv3 should open at least a 4×4 board');
  assert.ok(await ev(`${app}.game.player.unlockedChainIds.includes('flower')`), 'Lv3 did not unlock the flower chain');
  let sawLv3Reward = false;
  for (let reward = 0; reward < 10 && await active('LevelUpView'); reward += 1) {
    if ((await labels()).some((value) => value.includes('花篮 已解锁'))) {
      sawLv3Reward = true; await shot('first15-lv3-unlock');
    }
    await tap('ClaimLevelReward'); await wait(200);
  }
  assert.ok(sawLv3Reward, 'Lv3 unlock reward card was not shown');
  const first15Metrics = await ev(`(()=>{const g=${app}.game;return{level:g.player.level,xp:g.player.xp,energy:g.player.energy,spawns:g.life.state.stats.spawns,merges:g.life.state.stats.merges,orders:g.life.state.stats.orders,dates:g.play.state.smallDate.completed,chapter:g.play.progress('zhoushan')}})()`);
  const first15Evidence = { elapsedMs: Date.now() - freshRunStarted, naturalOrders, lv3OrderIndex, actions: freshPathActions, metrics: first15Metrics, uiOnlyActions: true };
  assert.ok(first15Evidence.elapsedMs < 15 * 60 * 1000, 'Fresh route exceeded fifteen minutes of wall time');
  fs.writeFileSync(path.join(output, 'first15-fresh-save.json'), JSON.stringify(first15Evidence, null, 2));
  passed(`fresh save reached first date, chapter puzzle and Lv3 in ${(first15Evidence.elapsedMs / 1000).toFixed(1)}s (${freshPathActions.length} documented actions)`);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 700, deviceScaleFactor: 1, mobile: true });
  await send('Page.reload'); await wait(400); await ready(); await wait(700); await tap('EnterGame');
  assert.ok(await active('BoardSummary'));
  const compactObjective = await ev(`(()=>{let label;const w=n=>{if(n.name==='BoardGoalText'&&n.activeInHierarchy)label=n.getComponent(cc.Label)?.string;n.children.forEach(w)};w(cc.director.getScene());return{label,title:${app}.game.play.smallDateOrder()?.template.title}})()`);
  assert.ok(compactObjective.label && (!compactObjective.title || compactObjective.label.includes(compactObjective.title)), 'Compact objective must show the current date title');
  await shot('compact-objective');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await wait(500);
  passed('compact 16:9 board keeps the current date objective visible');

  await seed((d) => {
    d.tutorial = { generatorClicked: true, firstMergeCompleted: true, firstOrderCompleted: true, firstOrderHintShown: true };
    d.player.level = 18; d.player.xp = 7650; d.life.claimedLevelRewards = Array.from({ length: 17 }, (_, i) => i + 2);
    d.board = Array.from({ length: boardSize }, (_, index) => ({ index, ...(index < 5 ? { item: { uid: 'gesture_' + index, definitionId: ['coffee_01', 'coffee_01', 'flower_01', 'coffee_12', 'coffee_12'][index] } } : {}) }));
  });
  await tap('EnterGame'); await gesture(0, 9); assert.equal((await cells())[9].item.definitionId, 'coffee_01');
  await gesture(9, 2); assert.equal((await cells())[9].item.definitionId, 'flower_01');
  const beforeCancel = await cells(); await gesture(2, { x: 3, y: 200 }); assert.deepEqual(await cells(), beforeCancel);
  await gesture(2, { x: 190, y: 450 }, true); assert.deepEqual(await cells(), beforeCancel);
  await gesture(3, 4); assert.ok((await labels()).some((s) => s.includes('最高等级'))); assert.equal(await ev(`${app}.view.board.drag`), null);
  passed('move, swap, outside release, system cancellation and maximum-level feedback');
  await seed((d) => { d.player.level = 3; d.player.xp = 150; d.player.unlockedChainIds.push('flower'); });
  await tap('EnterGame'); assert.ok((await labels()).includes('Lv.2'));
  assert.ok((await labels()).includes('阳光橘树 已解锁')); await waitForArt('UnlockedGenerator'); await shot('level2-orange-unlock'); await tap('ClaimLevelReward');
  assert.ok((await labels()).includes('花篮 已解锁')); await shot('level3');
  await tap('ClaimLevelReward'); assert.ok((await labels()).includes('Lv.4')); await tap('ClaimLevelReward');
  assert.deepEqual(await ev(`${app}.game.life.state.claimedLevelRewards`), [2, 3, 4]);
  assert.equal(await ev(`${app}.game.player.coins`), 320); assert.equal(await ev(`${app}.game.player.hearts`), 62);
  passed('Lv2-3-4 reward queue, exact rewards and no pending repeat');
  await seed((d) => { d.life.photoPaths = Array.from({ length: 6 }, (_, i) => origin + (i === 5 ? '/missing-photo.png' : '/qa-photo.png?' + i)); });
  await tap('EnterGame'); await tap('Button_回忆'); await tap('MemoryTab_photos'); await tap('Button_下一页');
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
  assert.ok((await labels()).some((s) => s.includes('原始数据已备份') || s.includes('已从可用备份恢复进度')), 'Corrupt save must report backup recovery or preserved original'); await shot('corrupt-save-notice');
  await ev(`localStorage.setItem(${JSON.stringify(key)},${JSON.stringify(goodSave)});true`);
  passed('read failure blocks overwrites, retry re-enters and corrupt-save recovery is visible');
  const normalBefore = await ev(`localStorage.getItem(${JSON.stringify(key)})`);
  await load('?preview=lv12'); await tap('EnterGame'); assert.ok((await labels()).includes('320 / 600')); await shot('demo-merge');
  await tap('GenBtn', 0); assert.equal(await ev(`localStorage.getItem(${JSON.stringify(key)})`), normalBefore);
  await load('?preview=lv12'); await tap('EnterGame'); assert.equal(await ev(`${app}.game.player.energy`), 86);
  await tap('Button_家园'); await shot('demo-home'); await tap('Button_任务'); await tap('Button_合成');
  assert.equal(await ev(`${app}.view.lifePages.currentPage`), 'home'); assert.ok(await active('Wishes')); await tap('Button_关闭');
  passed('isolated/resettable Lv12 demonstration and modal input blocking');
  }
  await load();
  if (scope !== 'late' && scope !== 'tail' && scope !== 'systems') {
  for (const mode of ['empty', 'partial', 'full']) {
    const ids = mode === 'empty' ? [] : mode === 'partial' ? ['sofa', 'bed', 'rose_arch'] : bundle.furniture.map((f) => f.id);
    await seed((d) => { d.player.level = 18; d.player.xp = 7650; d.life.claimedLevelRewards = Array.from({ length: 17 }, (_, i) => i + 2); d.life.ownedFurnitureIds = ids; d.life.placedFurnitureIds = [...ids]; d.life.unlockedMemoryIds = bundle.memories.map((m) => m.id); });
    await tap('EnterGame'); await tap('Button_家园');
    const roomTextures = new Set();
    const furnitureFrames = new Set();
    for (const [room, title] of [['living', '客厅'], ['bedroom', '卧室'], ['garden', '花园'], ['study', '书房'], ['terrace', '露台'], ['pool', '泳池']]) {
      if (room === 'study') await tap('Button_›');
      await tap('Button_' + title);
      const backdrops = { living: 'HomeBackdropLiving', bedroom: 'HomeBackdropBedroom', garden: 'HomeBackdropGarden', study: 'HomeBackdropStudy', terrace: 'HomeBackdropTerrace', pool: 'HomeBackdropPool' };
      roomTextures.add((await waitForArt(backdrops[room])).textureId); await shot(`home-${room}-${mode}`);
      const actual = await ev("(()=>{const a=[];const walk=n=>{if(n.name.startsWith('Placed_')&&n.activeInHierarchy)a.push(n.name.slice(7));n.children.forEach(walk)};walk(cc.director.getScene());return a.sort()})()");
      assert.deepEqual(actual, bundle.furniture.filter((f) => f.room === room && ids.includes(f.id)).map((f) => f.id).sort());
      if (mode === 'full') for (const id of actual) {
        const frame = await waitForArt('Placed_' + id);
        furnitureFrames.add([frame.textureId, frame.rectX, frame.rectY, frame.rectWidth, frame.rectHeight].join(':'));
      }
    }
    assert.equal(roomTextures.size, 6, 'Rooms must use six distinct backgrounds');
    if (mode === 'full') assert.equal(furnitureFrames.size, 30, 'Every furniture item needs its own artwork cell');
  }
  passed('six rooms empty, partly furnished and fully furnished with distinct backgrounds');
  await tap('Button_回忆'); await shot('album'); await tap('Button_翻开日记 ›');
  assert.ok((await labels()).some((text) => text.includes(`/ ${bundle.memories.length} 页`)));
  const storyTextures = new Set();
  for (let i = 0; i < bundle.memories.length; i++) {
    if (i > 0) await tap('Button_下一页');
    const frame = await waitForArt('DiaryIllustration');
    assert.ok(frame.width > 0 && frame.height > 0, `Chapter ${i + 1} has the wrong artwork`);
    assert.ok(Math.abs(frame.rectY - (frame.height - frame.rectHeight) * (bundle.memories[i].artFocusY ?? 0.2)) < 0.001,
      `Chapter ${i + 1} should use its configured crop focus`);
    assert.ok(frame.textureId);
    storyTextures.add(frame.textureId);
    await tap('DiaryIllustration');
    assert.ok(await active('StoryArtDetail'));
    const full = await waitForArt('StoryArtFull');
    assert.equal(full.textureId, frame.textureId);
    assert.equal(full.rectWidth, full.width, 'Full artwork must not be cropped');
    assert.equal(full.rectHeight, full.height);
    if ([0, 12, 27].includes(i)) await shot(`story-art-${String(i + 1).padStart(2, '0')}`);
    await tap('Button_关闭');
    assert.ok(!(await active('StoryArtDetail')));
  }
  assert.equal(storyTextures.size, bundle.memories.length, 'Every chapter must use its own illustration');
  passed(`${bundle.memories.length} distinct story illustrations loaded with uncropped full-size previews`);
  await tap('MemoryTab_diary');
  for (let i = 0; i < bundle.memories.findIndex((m) => m.id === 'anniversary'); i++) await tap('Button_下一页');
  assert.ok((await labels()).includes('2026 年 10 月 3 日'));
  assert.ok(!(await active('WeddingLetterReplay')), 'Purchasing the memory must not bypass the wedding chapter ending gate');
  await shot('wedding-diary');
  for (const [width, height] of [[320, 568], [375, 667], [430, 932]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true }); await wait(500);
    await ev('cc.sys.getSafeAreaRect=()=>new cc.Rect(0,68,750,cc.view.getVisibleSize().height-218);true');
    await ev('new Promise(resolve=>cc.director.loadScene("Game",()=>setTimeout(()=>resolve(true),700)))');
    await tap('EnterGame'); await shot('merge-' + width); await tap('Button_回忆'); await shot('album-' + width);
    if (width === 375) {
      await tap('MemoryTab_diary');
      const longChapter = bundle.memories.findIndex((memory) => memory.id === 'winter_portraits');
      for (let i = 0; i < longChapter; i++) await tap('Button_下一页');
      const scrollState = () => ev("(()=>{let v;const walk=n=>{if(n.name==='DiaryTextViewport'&&n.activeInHierarchy)v=n;n.children.forEach(walk)};walk(cc.director.getScene());const s=v.getComponent(cc.ScrollView);return{offset:s.getScrollOffset().y,max:s.getMaxScrollOffset().y}})()");
      const before = await scrollState();
      const compactArt = await waitForArt('DiaryIllustration');
      assert.ok(Math.abs(compactArt.rectY - (compactArt.height - compactArt.rectHeight) * bundle.memories[longChapter].artFocusY) < 0.001);
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
  const playProgress = (id) => ev(`${app}.game.play.progress(${JSON.stringify(id)})`);
  await seed((d) => { grownUp(d); d.board = Array.from({ length: boardSize }, (_, index) => ({ index,
    ...(index < 2 ? { item: { uid: 'tool_' + index, definitionId: index === 0 ? 'coffee_03' : 'coffee_01' } } : {}) })); });
  await tap('EnterGame'); await tap('Cell_0'); await tap('ItemGuideTools'); await shot('toolbox');
  const toolEnergy = await ev(`${app}.game.player.energy`);
  assert.equal(await active('Store_0'),false); await tap('PlayClose'); await dragItemToBackpack(0); await tap('BoardBackpackButton'); assert.equal((await cells())[0].item, undefined);
  assert.equal(await ev(`${app}.game.play.state.warehouse.length`), 1);
  await tap('Warehouse_0'); assert.equal((await cells())[0].item.uid, 'tool_0');
  await tap('TakeScissors');
  const scissorCell=(await cells()).findIndex(c=>c.item?.definitionId==='scissors_01');assert.ok(scissorCell>=0);
  const blockedBoard = await cells(); await gesture(0, 2); assert.deepEqual(await cells(), blockedBoard);
  await tap('PlayClose');await gesture(scissorCell,0);assert.equal((await cells())[0].item.definitionId,'coffee_02');
  await tap('BoardBackpackButton');
  assert.equal((await cells())[2].item.definitionId, 'coffee_02');
  assert.equal(await ev(`${app}.game.play.state.scissors`), bundle.game.toolbox.startingScissors - 1);
  assert.equal(await ev(`${app}.game.player.energy`), toolEnergy);
  await tap('PlayClose'); await tap('Cell_0'); assert.ok(await active('ItemGuideOverlay'));
  await tap('ItemGuideTools'); assert.ok(await active('PlayOverlay')); await tap('PlayClose');
  await tap('Button_任务'); await tap('Button_今日约会 · 剧情与解谜 ›'); await tap('AdventureOpen_zhoushan'); assert.ok(await active('PuzzleCheck')); await tap('PlayClose');
  assert.ok(await active('Wishes'), 'Closing adventure returns to the task page'); await tap('Button_关闭');
  assert.equal(await ev(`${app}.view.lifePages.currentPage`), 'merge'); assert.ok(!(await active('Wishes')));
  passed('touch inventory transfer, item-guide tool shortcut, scissors value conservation and modal input blocking');

  await seed((d) => { grownUp(d); const needs = bundle.adventures.flatMap((c) => c.steps.flatMap((s) => s.requirements.flatMap((r) => Array(r.count).fill(r.itemId))));
    d.board = Array.from({ length: boardSize }, (_, index) => ({ index, ...(index < needs.length ? { item: { uid: 'date_' + index, definitionId: needs[index] } } : {}) })); });
  await tap('EnterGame'); await tap('OpenAdventure'); await shot('adventure-hub');
  await openAdventure(bundle.adventures.find((chapter) => chapter.id === 'namsan'));
  assert.ok(await active('PuzzleCheck')); await tap('AdventureBack');
  const puzzleBoardBefore = await cells(); await openAdventure(bundle.adventures[0]); await shot('adventure-order');
  assert.deepEqual(await cells(),puzzleBoardBefore,'Chapter opening must not consume requirements');
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
  await shot('puzzle-zhoushan'); await tap('PuzzleCheck'); assert.ok(await active('PuzzleSuccessBurst'));
  await wait(800); assert.ok(!(await active('PuzzleSuccessBurst'))); await tap('AdventureClaim');
  assert.equal((await playProgress('zhoushan')).claimed, true);
  await tap('AdventureMemory'); assert.equal(await ev(`${app}.view.lifePages.currentPage`), 'memories');
  await tap('Button_合成');
  passed('direct story puzzle opening, free wrong attempts and hints, clue/code persistence and gifted memory reading');

  await tap('OpenAdventure'); await tap('AdventureOpen_love_letters'); assert.ok(await active('PuzzleCheck'));
  for (const id of ['you', 'like', 'tell', 'me']) await tap('Letter_' + id);
  await tap('PuzzleCheck'); assert.equal((await playProgress('love_letters')).outcome, 'playing');
  await tap('PuzzleReset');
  for (const id of ['me', 'tell', 'like', 'you']) await tap('Letter_' + id);
  await shot('puzzle-letters'); await tap('PuzzleCheck'); await tap('AdventureClaim');
  await tap('AdventureBack'); await tap('AdventureOpen_namsan'); assert.ok(await active('PuzzleCheck'));
  await tap('Circuit_0');
  assert.equal((await playProgress('namsan')).rotations[0], 2);
  await tap('PlayClose'); await send('Page.reload'); await wait(400); await ready(); await wait(800); await tap('EnterGame');
  await tap('OpenAdventure'); await tap('AdventureOpen_namsan'); assert.equal((await playProgress('namsan')).rotations[0], 2);
  await tap('PuzzleReset'); for (let i = 0; i < 9; i++) for (let k = 0; k < 3; k++) await tap('Circuit_' + i);
  await shot('puzzle-namsan'); await tap('PuzzleCheck'); await tap('AdventureClaim');
  for (const chapter of bundle.adventures.slice(3)) {
    await tap('AdventureBack'); await openAdventure(chapter);
    await shot('adventure-order-' + chapter.id);
    assert.ok(await active('PuzzleCheck'));
    await solvePuzzle(chapter);
    assert.equal((await playProgress(chapter.id)).outcome, 'solved');
    await shot('puzzle-' + chapter.id); await tap('AdventureClaim');
    assert.equal((await playProgress(chapter.id)).claimed, true);
  }
  assert.ok(bundle.adventures.every((c) => c.reward.coins > 0));
  assert.equal(await ev(`${app}.game.player.coins`), bundle.adventures.reduce((n, c) => n + c.reward.coins, 0));
  assert.equal(await ev(`${app}.game.play.state.scissors`), bundle.game.toolbox.startingScissors + bundle.adventures.reduce((n, c) => n + c.reward.scissors, 0));
  assert.ok(await active('WeddingEndingOverlay'));
  assert.ok((await labels()).includes('专属信待填写'));
  assert.ok(!(await active('PlayOverlay')));
  await shot('wedding-ending-placeholder'); await tap('WeddingEndingTimeline');
  assert.ok(await active('MemoryTimelineViewport'));
  const unlockedIds = await ev(`${app}.game.life.state.unlockedMemoryIds`);
  const blockedMemory = bundle.memories.find((memory, index) => index > 0 && !unlockedIds.includes(memory.id) && !unlockedIds.includes(bundle.memories[index - 1].id));
  assert.ok(blockedMemory);
  assert.ok(!(await labels()).includes(blockedMemory.diary));
  const timelineHearts = await ev(`${app}.game.player.hearts`);
  await tap('TimelineEntry_' + blockedMemory.id);
  assert.equal(await ev(`${app}.game.player.hearts`), timelineHearts);
  assert.ok(await active('MemoryTimelineViewport'));
  await tap('TimelineEntry_' + bundle.memories[0].id);
  assert.equal(await ev(`${app}.view.lifePages.memoryTab`), 'diary');
  await tap('MemoryTab_timeline'); await scrollDown('MemoryTimelineViewport'); await shot('memory-timeline-bottom');
  await tap('TimelineEntry_' + bundle.adventures[bundle.adventures.length - 1].memoryId);
  await tap('WeddingLetterReplay'); assert.ok(await active('WeddingEndingOverlay'));
  await tap('WeddingEndingClose');
  // Explicit synthetic copy fixture after the UI-only fresh route; never personal content or a save migration.
  await ev(`${app}.game.config.couple.gift={title:'QA 配置标题',salutation:'测试称呼',body:${JSON.stringify(Array.from({ length: 14 }, (_, i) => `测试段落 ${i + 1}：这是滚动与排版验收用的中性文字，不是专属信正文。`).join('\n\n'))},signoff:'测试落款',signature:'QA'};true`);
  await tap('WeddingLetterReplay'); await scrollDown('WeddingLetterBodyViewport'); await shot('wedding-letter-scroll');
  assert.ok((await labels()).includes('QA 配置标题'));
  await tap('WeddingEndingContinueHome');
  assert.equal(await ev(`${app}.view.lifePages.currentPage`), 'home');
  assert.ok(!(await active('WeddingEndingOverlay')));
  await shot('home-souvenirs');
  passed('wedding ending is gated, rereadable and scrollable, with a locked-safe timeline and a real home exit');
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

  for (const chapter of bundle.adventures) {
    await tap('OpenAdventure'); await openAdventure(chapter, true);
    if (chapter.id !== replayChapter.id) {
      assert.equal(await ev(`${app}.game.play.puzzleDefinition(${JSON.stringify(chapter.id)}).variantId`), 'classic');
      await solvePuzzle(chapter); await tap('ReplayAgain');
    }
    const variant = await ev(`${app}.game.play.puzzleDefinition(${JSON.stringify(chapter.id)})`);
    assert.notEqual(variant.variantId, 'classic', 'Replay did not rotate to its extra variant');
    assert.ok((await labels()).includes(variant.instruction), 'Replay UI instruction does not match the active variant');
    await tap('PuzzleHint'); await tap('PuzzleHint');
    if (chapter.id === replayChapter.id) {
      const partial = await ev(`${app}.game.play.replayProgress(${JSON.stringify(chapter.id)})`);
      await tap('PlayClose'); await send('Page.reload'); await wait(400); await ready(); await wait(800); await tap('EnterGame');
      await tap('OpenAdventure'); await openAdventure(chapter, true);
      assert.deepEqual(await ev(`${app}.game.play.replayProgress(${JSON.stringify(chapter.id)})`), partial);
      assert.equal(await ev(`${app}.game.play.replaySummary(${JSON.stringify(chapter.id)}).started`), 2);
    }
    await tap('PuzzleReset'); await solvePuzzle(chapter);
    const summary = await ev(`${app}.game.play.replaySummary(${JSON.stringify(chapter.id)})`);
    assert.equal(summary.started, 2); assert.equal(summary.solved, 2); assert.equal(summary.skipped, 0);
    assert.equal(summary.totalHints, 2); assert.equal(summary.bestSolvedHints, 0);
    assert.deepEqual(JSON.parse(await ev(replayAssets)), JSON.parse(earned));
    await shot('replay-variant-' + chapter.id);
    await tap('ReplayAgain'); await tap('PuzzleSkip'); await tap('PuzzleSkipConfirm');
    const skipped = await ev(`${app}.game.play.replaySummary(${JSON.stringify(chapter.id)})`);
    assert.equal(skipped.started, 3); assert.equal(skipped.solved, 2); assert.equal(skipped.skipped, 1);
    assert.ok((await labels()).includes('练习已跳过，无重复奖励'));
    assert.deepEqual(JSON.parse(await ev(replayAssets)), JSON.parse(earned));
    await tap('PlayClose');
  }
  passed('six replay variants render their own clues, survive reload, solve correctly and record free practice results');

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
  const dateRounds = bundle.smallDates.length + 1;
  for (let round = 0; round < dateRounds; round++) {
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
  assert.equal(seenDates.size, bundle.smallDates.length);
  assert.equal(await ev(`${app}.game.player.energy`), dateEnergy);
  assert.equal(await ev(`${app}.game.play.state.scissors`), dateScissors);
  await shot('repeatable-small-date'); await tap('PlayClose');
  await send('Page.reload'); await wait(400); await ready(); await wait(800); await tap('EnterGame');
  assert.equal(await ev(`${app}.game.play.smallDateOrder().completed`), dateRounds);
  passed('repeatable small dates rotate, reject missing ingredients, pay exact rewards and persist');

  await seed((d) => {
    d.player.xp = 45;
    d.tutorial = { generatorClicked: true, firstMergeCompleted: true, firstOrderCompleted: true, firstOrderHintShown: true };
    const needs = bundle.smallDates.find((date) => date.minLevel === 1).requirements.flatMap((r) => Array(r.count).fill(r.itemId));
    d.board = Array.from({ length: boardSize }, (_, index) => ({ index, ...(index < needs.length ? { item: { uid: 'small_level_' + index, definitionId: needs[index] } } : {}) }));
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
    await seed((d) => { grownUp(d); d.board[0].item = { uid: 'compact_tool', definitionId: 'coffee_01' }; }); await tap('EnterGame'); await tap('Cell_0'); await tap('ItemGuideTools'); await shot('toolbox-' + width); await tap('PlayClose');
    await tap('OpenAdventure'); await shot('adventure-hub-' + width);
    const touchSize = async (name) => ev(`(()=>{let n;const w=v=>{if(v.name===${JSON.stringify(name)}&&v.activeInHierarchy)n=v;v.children.forEach(w)};w(cc.director.getScene());const t=n.getComponent('cc.UITransform')??n._uiProps.uiTransformComp;const b=t.getBoundingBoxToWorld(),v=cc.view.getVisibleSize();return{width:b.width*innerWidth/v.width,height:b.height*innerHeight/v.height}})()`);
    assert.ok((await touchSize('JourneyNextStep')).height >= 43, 'Journey CTA too small for compact touch');
    await tap('JourneyNextStep'); assert.ok(await active('PuzzleCheck')); await tap('PlayClose');
    for (let i = 0; i < bundle.adventures.length; i++) {
      await seed((d) => { grownUp(d); bundle.adventures.forEach((c, j) => { d.play.chapters[c.id] = { step: j <= i ? c.steps.length : 0, found: [], selected: [], rotations: [], code: '', hints: 0,
        outcome: j < i ? 'solved' : 'playing', claimed: j < i }; }); });
      await tap('EnterGame'); await tap('OpenAdventure'); await openAdventure(bundle.adventures[i]);
      const bounds = await ev("(()=>{let n;const w=v=>{if(v.name==='PlayPanel'&&v.activeInHierarchy)n=v;v.children.forEach(w)};w(cc.director.getScene());const t=n.getComponent('cc.UITransform')??n._uiProps.uiTransformComp;if(!t)throw Error('PlayPanel transform missing');const b=t.getBoundingBoxToWorld(),v=cc.view.getVisibleSize();return{top:(v.height/2-b.yMax)*innerHeight/v.height,bottom:(v.height/2-b.yMin)*innerHeight/v.height}})()");
      assert.ok(bounds.top >= -1 && bounds.bottom <= height + 1, 'Play panel outside portrait viewport');
      await shot(`puzzle-${bundle.adventures[i].id}-${width}`);
      await tap('PuzzleSkip'); await tap('PuzzleSkipConfirm'); await tap('AdventureClaim');
      if (i + 1 < bundle.adventures.length) {
        for (const name of ['JourneyContinue', 'AdventureReplay', 'AdventureMemory', 'JourneyHome']) {
          assert.ok((await touchSize(name)).height >= 43, `${name} too small for compact touch`);
        }
        await shot(`journey-completed-${i}-${width}`); await tap('JourneyContinue');
        assert.ok(await active('PuzzleCheck'), 'Next chapter CTA did not open its puzzle');
        await tap('PlayClose');
      } else {
        assert.ok(await active('WeddingEndingOverlay'));
        for (const name of ['WeddingEndingTimeline', 'WeddingEndingContinueHome']) {
          assert.ok((await touchSize(name)).height >= 43, `${name} too small for compact wedding touch`);
        }
        await shot(`wedding-ending-${width}`); await tap('WeddingEndingTimeline');
        assert.ok((await touchSize('MemoryTab_timeline')).height >= 43);
        await scrollDown('MemoryTimelineViewport'); await shot(`memory-timeline-${width}`);
        await tap('TimelineEntry_' + bundle.adventures[i].memoryId); await tap('WeddingLetterReplay');
        await tap('WeddingEndingContinueHome');
        assert.equal(await ev(`${app}.view.lifePages.currentPage`), 'home');
        assert.ok(!(await active('PlayOverlay'))); assert.ok(!(await active('WeddingEndingOverlay')));
      }
    }
  }
  passed('320/375 journey recommendation and completed CTAs are touchable and lead to the next chapter/home');
  passed('320/375 touch inventory, paged story hub and all six puzzle layouts');
  await seed((d) => {
    grownUp(d); d.version = 4; d.preferences = { soundEnabled: false, vibrationEnabled: false };
    d.player.coins = 321; d.player.hearts = 123;
    d.play.chapters.zhoushan = { step: 2, found: ['invitation', 'calendar', 'note'], selected: [], rotations: [], code: '0908', hints: 0, outcome: 'solved', claimed: true };
    d.play.replays.zhoushan = { found: ['invitation'], selected: [], rotations: [], code: '0', hints: 1, outcome: 'playing' };
    delete d.play.replayStats;
  });
  await tap('EnterGame'); if (await active('ConfirmStorageNotice')) await tap('ConfirmStorageNotice');
  assert.equal(await ev(`${app}.game.buildSaveData().version`), bundle.game.saveVersion);
  assert.deepEqual(await ev(`${app}.game.preferences`), { soundEnabled: false, vibrationEnabled: false });
  await tap('OpenAdventure'); await openAdventure(bundle.adventures[0], true);
  assert.equal(await ev(`${app}.game.play.puzzleDefinition('zhoushan').variantId`), 'classic');
  assert.equal(await ev(`${app}.game.play.replayProgress('zhoushan').code`), '0');
  assert.equal(await ev(`${app}.game.play.replaySummary('zhoushan').started`), 1);
  assert.equal(await ev(`${app}.game.play.replaySummary('zhoushan').legacyHistoryIncomplete`), true);
  await tap('PuzzleReset'); await solvePuzzle(bundle.adventures[0]);
  const migratedSummary = await ev(`${app}.game.play.replaySummary('zhoushan')`);
  assert.equal(migratedSummary.solved, 1);
  assert.equal(await ev(`${app}.game.player.coins`), 321); assert.equal(await ev(`${app}.game.player.hearts`), 123);
  await tap('PlayClose'); await send('Page.reload'); await wait(400); await ready(); await wait(800); await tap('EnterGame');
  assert.deepEqual(await ev(`${app}.game.play.replaySummary('zhoushan')`), migratedSummary);
  assert.deepEqual(await ev(`${app}.game.preferences`), { soundEnabled: false, vibrationEnabled: false });
  passed('v4 migration preserves current replay, claimed rewards and muted settings without recounting practice results');

  }
  const revealOrangeTree = async () => {
    const p = await coords('GeneratorDockViewport');
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x + 95, y: p.y, id: 7 }] });
    for (let i = 1; i <= 10; i++) {
      await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x + 95 - i * 18, y: p.y, id: 7 }] });
      await wait(25);
    }
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(450);
    const location = await coords('GeneratorOrangeTree');
    assert.ok(location.x > 0 && location.x < 390, 'Orange tree must be in the touch viewport after horizontal swipe');
  };
  if (scope !== 'late' && scope !== 'tail') {
  // Starting at eleven prior picks is an isolated fixture; the twelfth and rejected pick use real touches.
  await seed((d) => { d.generatorCooldowns = { coffee_machine: { streak: bundle.generators.find((g) => g.id === 'coffee_machine').streakCooldown.uses - 1, cooldownStartedAt: null } };
    d.board = Array.from({ length: boardSize }, (_, index) => ({ index }));
    d.tutorial = { generatorClicked: true, firstMergeCompleted: true, firstOrderCompleted: true, firstOrderHintShown: true }; });
  await tap('EnterGame'); const cooldownEnergy = await ev(`${app}.game.player.energy`);
  await tap('GenBtn', 0);
  const runningCooldown = await ev(`${app}.game.getGeneratorStatus('coffee_machine')`);
  assert.ok(runningCooldown.remainingCooldownMs > 0 && runningCooldown.remainingCooldownMs <= runningCooldown.cooldownMs);
  await tap('OpenTools'); await tap('GeneratorWorkshopButton');
  assert.ok(await active('GeneratorCooldownLabel')); assert.ok(await active('GeneratorCooldownProgress'));
  await tap('GeneratorWorkshopCloseButton');
  const boardBeforeBlockedPick = await cells(); await tap('GenBtn', 0);
  assert.deepEqual(await cells(), boardBeforeBlockedPick); if(await active('GeneratorRestoreCancel')) await tap('GeneratorRestoreCancel');
  assert.equal(await ev(`${app}.game.player.energy`), cooldownEnergy - bundle.generators.find((g) => g.id === 'coffee_machine').energyCost);
  await send('Page.reload'); await wait(400); await ready(); await wait(800); await tap('EnterGame');
  const resumedCooldown = await ev(`${app}.game.getGeneratorStatus('coffee_machine')`);
  assert.ok(resumedCooldown.remainingCooldownMs > 0 && resumedCooldown.remainingCooldownMs < runningCooldown.remainingCooldownMs);
  passed('configured generator use limit starts visible cooldown, rejects extra pick and persists across restart');

  // Upgrade two identical generators and use the enhanced action through the workshop.
  await seed((d) => { d.generatorInventory = { ...d.generatorInventory, coffee_machine: [2, 0, 0] };
    d.board = Array.from({ length: boardSize }, (_, index) => ({ index }));
    d.tutorial = { generatorClicked: true, firstMergeCompleted: true, firstOrderCompleted: true, firstOrderHintShown: true }; });
  await tap('EnterGame'); await tap('OpenTools'); await tap('GeneratorWorkshopButton'); assert.ok(await active('GeneratorWorkshopPanel'));
  await tap('GeneratorTab_upgrade'); if ((await coords('GeneratorMergeButton_1')).y > (await coords('GeneratorWorkshopViewport')).y+30) await scrollDown('GeneratorWorkshopViewport'); await tap('GeneratorMergeButton_1');
  let coffeeMachine = await ev(`${app}.game.getGeneratorStatus('coffee_machine')`);
  assert.equal(coffeeMachine.level, 2); assert.deepEqual(coffeeMachine.inventory, [0, 1, ...Array(coffeeMachine.maxLevel - 2).fill(0)]);
  await tap('GeneratorWorkshopCloseButton'); await send('Page.reload'); await wait(400); await ready(); await wait(800); await tap('EnterGame');
  coffeeMachine = await ev(`${app}.game.getGeneratorStatus('coffee_machine')`); assert.equal(coffeeMachine.level, 2);
  await tap('OpenTools'); await tap('GeneratorWorkshopButton'); await tap('GeneratorTab_output'); assert.ok(await active('GeneratorBoostButton'));
  const machineEnergy = await ev(`${app}.game.player.energy`); const machineItems = (await cells()).filter((c) => c.item).length;
  await tap('GeneratorBoostButton');
  assert.equal(await ev(`${app}.game.player.energy`), machineEnergy - coffeeMachine.boostEnergyCost);
  assert.equal((await cells()).filter((c) => c.item).length, machineItems + 1);
  if (await active('GeneratorWorkshopCloseButton')) await tap('GeneratorWorkshopCloseButton');
  passed('generator workshop merges two machines, persists level and spends boosted energy on an actual spawn');

  // Exercise a full tree at Lv18, then a separate Lv2 offline-recovery fixture.
  const orangeIndex = bundle.generators.findIndex((generator) => generator.id === 'orange_tree');
  assert.ok(orangeIndex >= 0, 'Orange tree is absent from generator configuration');
  const orangeStatus = () => ev(`${app}.game.getGeneratorStatus('orange_tree')`);
  await seed((d) => {
    d.player.level = 18; d.player.xp = 7650; d.life.claimedLevelRewards = Array.from({length:17},(_,i)=>i+2);
    d.tutorial = { generatorClicked: true, firstMergeCompleted: true, firstOrderCompleted: true, firstOrderHintShown: true };
    d.board = Array.from({ length: boardSize }, (_, index) => ({ index }));
    d.generatorCharges = { ...d.generatorCharges, orange_tree: { charges: 10, capacity: 10, lastRecoveryAt: Date.now() } };
  });
  await tap('EnterGame');
  assert.ok(await active('GeneratorOrangeTree'));
  await revealOrangeTree();
  assert.ok(await active('GeneratorCharges'));
  const orangeEnergy = await ev(`${app}.game.player.energy`);
  const initialOrange = await orangeStatus();
  assert.deepEqual([initialOrange.unlocked, initialOrange.charges, initialOrange.maxCharges], [true, 10, 10]);
  for (let expected = 9; expected >= 0; expected--) {
    await tap('GeneratorOrangeTree');
    assert.equal((await orangeStatus()).charges, expected);
    assert.equal(await ev(`${app}.game.player.energy`), orangeEnergy, 'Picking oranges must not consume energy');
  }
  const fruitItems = (await cells()).filter((cell) => cell.item?.definitionId.startsWith('fruit_'));
  assert.equal(fruitItems.length, 10, 'Each available pick produces one fruit');
  assert.ok((await orangeStatus()).nextRecoveryMs > 0);
  await tap('GeneratorOrangeTree');
  assert.equal((await orangeStatus()).charges, 0);
  assert.equal(await ev(`${app}.game.player.energy`), orangeEnergy);
  assert.ok(await active('GeneratorRestoreOverlay'), 'Exhausted tree should offer recovery'); await tap('GeneratorRestoreCancel');
  const visibleRecovery = await ev(`(()=>{let tree;const w=n=>{if(n.name==='GeneratorOrangeTree'&&n.activeInHierarchy)tree=n;n.children.forEach(w)};w(cc.director.getScene());return tree?.getComponentsInChildren(cc.Label).filter(l=>l.node.activeInHierarchy).map(l=>l.string)??[]})()`);
  assert.ok(visibleRecovery.some(text=>/\d{2}:\d{2}/.test(text)), 'Orange-tree card must visibly show its live recovery countdown');
  const firstFruit = fruitItems[0];
  for (let i = 0; i < 40; i++) {
    if (await ev(`(()=>{let n;const w=v=>{if(v.name==='Cell_${firstFruit.index}'&&v.activeInHierarchy)n=v;v.children.forEach(w)};w(cc.director.getScene());return !!n?.getChildByName('ItemView')?.getChildByName('ItemArt')?.getComponent(cc.Sprite)?.spriteFrame})()`)) break;
    await wait(100);
  }
  assert.equal(await ev(`(()=>{let n;const w=v=>{if(v.name==='Cell_${firstFruit.index}'&&v.activeInHierarchy)n=v;v.children.forEach(w)};w(cc.director.getScene());return !!n?.getChildByName('ItemView')?.getChildByName('ItemArt')?.getComponent(cc.Sprite)?.spriteFrame})()`), true, 'Picked fruit must display its artwork');
  await send('Page.reload'); await wait(400); await ready(); await wait(800); await tap('EnterGame');
  assert.equal((await orangeStatus()).charges, 0, 'Spent orange-tree charges must persist after restart');
  await seed((d) => {
    d.player.level = 2; d.player.xp = 50; d.life.claimedLevelRewards = [2];
    d.generatorCharges = { ...d.generatorCharges, orange_tree: { charges: 0, capacity: 10, lastRecoveryAt: Date.now() - 1_210_000 } };
    d.tutorial = { generatorClicked: true, firstMergeCompleted: true, firstOrderCompleted: true, firstOrderHintShown: true };
  });
  await tap('EnterGame'); assert.equal((await orangeStatus()).charges, 2, 'Twenty minutes offline should recover two picks');
  assert.ok((await orangeStatus()).nextRecoveryMs > 0 && (await orangeStatus()).nextRecoveryMs <= 600_000);
  await send('Page.reload'); await wait(400); await ready(); await wait(800); await tap('EnterGame');
  assert.equal((await orangeStatus()).charges, 2, 'Offline recharge must survive a second restart');
  const beforeOrangeEnergy = await ev(`${app}.game.player.energy`);
  await revealOrangeTree(); await tap('GeneratorOrangeTree'); assert.equal((await orangeStatus()).charges, 1);
  assert.equal(await ev(`${app}.game.player.energy`), beforeOrangeEnergy);
  passed('orange tree touch picks use charges rather than energy, explain exhaustion and recover offline across restart');

  await seed((d) => { grownUp(d); d.board[0].item = { uid: 'fruit_guide_fixture', definitionId: 'fruit_01' };
    d.discoveredItemIds = [...d.discoveredItemIds, ...Array.from({ length: 12 }, (_, i) => `fruit_${String(i+1).padStart(2,'0')}`)]; });
  await tap('EnterGame'); await tap('Cell_0');
  const fruitFrames = new Set();
  for (let level = 1; level <= 12; level++) {
    const id = `fruit_${String(level).padStart(2,'0')}`;
    let frame;
    for (let tries = 0; tries < 40; tries++) {
      frame = await ev(`(()=>{let n;const w=v=>{if(v.name==='ItemGuide_${id}'&&v.activeInHierarchy)n=v;v.children.forEach(w)};w(cc.director.getScene());const f=n?.getChildByName('ItemGuideIcon')?.getComponent(cc.Sprite)?.spriteFrame;return f&&[f.texture._uuid,f.rect.x,f.rect.y,f.rect.width,f.rect.height]})()`);
      if (frame) break; await wait(100);
    }
    assert.ok(frame, `Missing fruit atlas frame ${id}`); fruitFrames.add(frame.join(':'));
  }
  assert.equal(fruitFrames.size, 12, 'All twelve fruit levels must have distinct atlas frames');
  await tap('ItemGuideClose'); passed('fruit guide displays twelve distinct discovered atlas entries');

  }
  if (scope !== 'tail') {
  // Enter text and choose a genuine local image through the browser's file chooser.
  await seed((d) => { d.player.energy = d.player.maxEnergy; d.journal = { entries: [], lastRewardDay: null };
    d.tutorial = { generatorClicked: true, firstMergeCompleted: true, firstOrderCompleted: true, firstOrderHintShown: true }; });
  await tap('EnterGame'); await tap('OpenTools'); await shot('rewards-panel-final'); await tap('OpenTodayJournal'); assert.ok(await active('JournalOverlay'));
  const journalText = '今天的日记：一起把小屋布置得更温暖。';
  await tap('JournalEditor'); await send('Input.insertText', { text: journalText });
  await tap('JournalFinishEditing'); // Finish editing through the visible keyboard control.
  await send('Page.setInterceptFileChooserDialog', { enabled: true });
  await tap('JournalChoosePhoto');
  const doc = await send('DOM.getDocument', { depth: -1 });
  const input = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[type=file]' });
  assert.ok(input.nodeId, 'Photo chooser must create a file input');
  await send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [path.join(root, 'assets/game_art/cover_background.jpg')] });
  await waitForArt('JournalPhotoArt'); await shot('journal-edit-final');
  const editorBounds = await ev(`(()=>{let n;const w=v=>{if(v.name==='JournalEditor'&&v.activeInHierarchy)n=v;v.children.forEach(w)};w(cc.director.getScene());const editor=n?.getComponent('cc.EditBox');const rect=node=>{const t=node.getComponent('cc.UITransform')??node._uiProps.uiTransformComp,p=node.worldPosition,s=node.worldScale;return{xMin:p.x-t.anchorX*t.width*Math.abs(s.x),xMax:p.x+(1-t.anchorX)*t.width*Math.abs(s.x),yMin:p.y-t.anchorY*t.height*Math.abs(s.y),yMax:p.y+(1-t.anchorY)*t.height*Math.abs(s.y)}};return{field:rect(n),text:rect(editor.textLabel.node),value:editor.textLabel.string}})()`);
  assert.ok(editorBounds.value.includes(journalText), 'Editor text must render after leaving the field');
  assert.ok(editorBounds.text.xMin >= editorBounds.field.xMin - 1 && editorBounds.text.xMax <= editorBounds.field.xMax + 1 && editorBounds.text.yMin >= editorBounds.field.yMin - 1 && editorBounds.text.yMax <= editorBounds.field.yMax + 1, 'Journal text must remain inside its editor frame');

  const journalBefore = await ev(`(()=>{const p=${app}.game.player;return {energy:p.energy,maxEnergy:p.maxEnergy}})()`);
  await tap('JournalSave'); const journal = await ev(`${app}.game.getTodayJournal()`);
  assert.equal(journal.text, journalText); assert.ok(journal.photoPath.startsWith('data:image/'));
  assert.equal(await ev(`${app}.game.player.energy`), journalBefore.energy + journalBefore.maxEnergy);
  await tap('JournalSave'); assert.equal(await ev(`${app}.game.player.energy`), journalBefore.energy + journalBefore.maxEnergy);
  await tap('JournalClose'); await send('Page.reload'); await wait(400); await ready(); await wait(800); await tap('EnterGame');
  await tap('OpenTools'); await tap('OpenTodayJournal');
  const restoredJournal = await ev(`${app}.game.getTodayJournal()`); assert.equal(restoredJournal.text, journalText);
  await tap('JournalHistory_' + restoredJournal.day); assert.ok(await active('JournalReadOverlay'));
  assert.ok((await labels()).some((value) => value.includes(journalText)));
  await waitForArt('JournalReadPhoto'); await tap('JournalReadClose'); await tap('JournalClose');
  await send('Page.setInterceptFileChooserDialog', { enabled: false });
  passed('personal journal real text/photo input, overflow reward once and restored readable history');

  if (scope === 'late') {
    await seed((d) => { d.preferences = { soundEnabled: true, vibrationEnabled: true }; });
    await tap('EnterGame'); await tap('SettingsButton');
    for (let i = 0; i < 30 && !await ev(`${app}.view.feedback.clips.has('sfx_merge')`); i++) await wait(100);
    await ev(`(()=>{window.__qaOldWx=globalThis.wx;window.__qaNative={events:[],vibrations:[],players:[]};
      globalThis.wx={createInnerAudioContext(){const q=window.__qaNative,p={src:'',volume:0,obeyMuteSwitch:true,
        stop(){q.events.push('stop')},play(){q.events.push('play')},destroy(){},onError(){}};q.players.push(p);return p},
        vibrateShort(v){window.__qaNative.vibrations.push(v)}};return true})()`);
    await tap('PreviewFeedback'); const nativeFeedback = await ev('window.__qaNative');
    assert.ok(nativeFeedback.players[0]?.src && nativeFeedback.players[0].volume > 0.5 && nativeFeedback.players[0].obeyMuteSwitch === false);
    assert.deepEqual(nativeFeedback.events.slice(-2), ['stop', 'play']); assert.equal(nativeFeedback.vibrations.at(-1)?.type, 'medium');
    await tap('SoundToggle'); await tap('VibrationToggle'); const mutedNative = await ev('JSON.stringify(window.__qaNative)');
    await tap('PreviewFeedback'); assert.equal(await ev('JSON.stringify(window.__qaNative)'), mutedNative);
    await tap('SoundToggle'); await tap('VibrationToggle'); await ev('globalThis.wx=window.__qaOldWx;true'); await tap('SettingsClose');
    passed('WeChat-native mocked audio and vibration preview honors both mute settings');
  }

  // An existing urgent deadline must survive reload and expire without another multiplier.
  await seed((d) => { grownUp(d); const order = d.activeOrders[0];
    order.urgentBaseCoins = 11; order.rewardCoins = 22; order.urgentBaseXp = 7; order.rewardXp = 14; order.urgentBaseHearts = 3; order.rewardHearts = 6; order.urgentUntil = Date.now() + 12_000; });
  await tap('EnterGame'); assert.ok(await active('OrderUrgentBadge')); assert.ok(await active('OrderUrgentCountdown')); await shot('urgent-order-final');
  const urgentOrder = (await ev(`${app}.game.orders.getOrders()`))[0];
  assert.equal(urgentOrder.rewardCoins, 22); assert.equal(urgentOrder.rewardXp, 14); assert.equal(urgentOrder.rewardHearts, 6); const urgentDeadline = urgentOrder.urgentUntil;
  await send('Page.reload'); await wait(400); await ready(); await wait(800); await tap('EnterGame');
  assert.equal((await ev(`${app}.game.orders.getOrders()`))[0].urgentUntil, urgentDeadline);
  for (let i = 0; i < 20; i++) {
    if ((await ev(`${app}.game.orders.getOrders()`))[0].urgentUntil == null) break;
    await wait(750);
  }
  const expired = (await ev(`${app}.game.orders.getOrders()`))[0];
  assert.equal(expired.rewardCoins, 11); assert.equal(expired.rewardXp, 7); assert.equal(expired.rewardHearts, 3); assert.equal(expired.urgentUntil ?? null, null);
  for (let i = 0; i < 8 && await active('OrderUrgentBadge'); i++) await wait(250);
  assert.equal(await active('OrderUrgentBadge'), false);
  await send('Page.reload'); await wait(400); await ready(); await wait(800); await tap('EnterGame');
  assert.equal((await ev(`${app}.game.orders.getOrders()`))[0].rewardCoins, 11);
  assert.equal((await ev(`${app}.game.orders.getOrders()`))[0].rewardXp, 7);
  assert.equal((await ev(`${app}.game.orders.getOrders()`))[0].rewardHearts, 3);
  passed('urgent order deadline survives restart, expires live and restores the original reward once');

  // Energy rewards may overflow the cap and remain intact after reload.
  await seed((d) => { d.player.energy = d.player.maxEnergy; d.board = Array.from({ length: boardSize }, (_, index) => ({ index,
    ...(index === 0 ? { item: { uid: 'energy_overflow', definitionId: 'energy_01' } } : {}) }));
    d.tutorial = { generatorClicked: true, firstMergeCompleted: true, firstOrderCompleted: true, firstOrderHintShown: true }; });
  await tap('EnterGame'); const overflowBefore = await ev(`${app}.game.player.energy`);
  await tap('OpenTools'); await useReward('energy_01'); await tap('CloseRewards');
  const overflowValue = await ev(`${app}.game.player.energy`);
  assert.equal(overflowValue, overflowBefore + bundle.items.find((item) => item.id === 'energy_01').useValue);
  await send('Page.reload'); await wait(400); await ready(); await wait(800); await tap('EnterGame');
  assert.equal(await ev(`${app}.game.player.energy`), overflowValue);
  passed('energy bottle can overflow the cap and survives restart without clipping');

  // Two-item order uses a saved fixture; fulfillment is performed by touch.
  await seed((d) => {
    grownUp(d);
    const needed = ['coffee_01', 'flower_01'];
    d.board = Array.from({ length: boardSize }, (_, index) => ({ index,
      ...(index < needed.length ? { item: { uid: `triple_${index}`, definitionId: needed[index] } } : {}) }));
    d.activeOrders[0].requirements = needed.map((itemId) => ({ itemId, count: 1 }));
  });
  await tap('EnterGame');
  const tripleUid = await ev(`${app}.game.orders.getOrders()[0].uid`);
  assert.ok(await active('Required_0') && await active('Required_1'));
  const tripleVisual = await ev(`(()=>{let card;const w=n=>{if(!card&&n.name==='OrderCard'&&n.activeInHierarchy)card=n;n.children.forEach(w)};w(cc.director.getScene());const b=n=>{const t=n&&(n.getComponent('cc.UITransform')??n._uiProps.uiTransformComp);if(!t)return null;const r=t.getBoundingBoxToWorld();return{xMin:r.xMin,xMax:r.xMax,yMin:r.yMin,yMax:r.yMax}};return{claim:b(card.getChildByName('ClaimButton')),menu:b(card.getChildByName('OrderRefreshMenuButton')),requirements:[0,1].map(i=>{const n=card.getChildByName('Required_'+i),a=n?.getChildByName('Art');return{box:b(n),sprite:!!a?.getComponent(cc.Sprite)?.spriteFrame,labels:n?.getComponentsInChildren(cc.Label).map(l=>l.string)}})}})()`);
  const tripleOverlap = (a,b) => a&&b&&Math.min(a.xMax,b.xMax)-Math.max(a.xMin,b.xMin)>0.5&&Math.min(a.yMax,b.yMax)-Math.max(a.yMin,b.yMin)>0.5;
  assert.ok(tripleVisual.requirements.every((item) => item.sprite && item.labels.some((text) => /1\s*\/\s*1/.test(text))), 'Two requirements must each show their item and quantity');
  assert.ok(!tripleOverlap(tripleVisual.claim,tripleVisual.menu) && !tripleOverlap(tripleVisual.claim,tripleVisual.menu), 'Two-item order claim must not cover refresh controls');
  assert.ok((await labels()).some((text) => text.includes('交付订单')));
  await tap('OrderCard', 0);
  assert.ok(!(await ev(`${app}.game.orders.getOrders().map((order) => order.uid)`)).includes(tripleUid));
  assert.ok(!(await cells()).some((cell) => cell.item?.uid?.startsWith('triple_')));
  passed('two-item order shows both requirements and delivers both by touch');

  const beforeRemovedRefresh = await ev(`${app}.game.buildSaveData()`);
  assert.equal(await active('OrderRefreshMenuButton'), false);assert.equal(await active('OrderRefreshFreeButton'), false);assert.equal(await active('OrderRefreshDiamondButton'), false);
  assert.deepEqual(await ev(`${app}.game.refreshOrder(${JSON.stringify(beforeRemovedRefresh.activeOrders[0].uid)},'diamond')`), {ok:false,reason:'DISABLED'});
  assert.equal(await ev(`${app}.game.player.diamonds`), beforeRemovedRefresh.player.diamonds);
  passed('manual order replacement has no entry point and legacy calls cannot spend diamonds');

  const tapRewardContent = async (name) => {
    if (name.startsWith('DailyTask_') || name.startsWith('DailyTaskClaim_')) { if (!await active(name)) await tap('RewardsTab_daily'); }
    if (name.startsWith('Collection_') || name.startsWith('CollectionClaim_')) { if (!await active(name)) await tap('RewardsTab_collection'); }
    for (let attempt = 0; attempt < 20; attempt++) {
      const state = await ev(`(()=>{let viewport,target;const w=n=>{if(n.name==='RewardsViewport'&&n.activeInHierarchy)viewport=n;if(n.name===${JSON.stringify(name)}&&n.activeInHierarchy)target=n;n.children.forEach(w)};w(cc.director.getScene());if(!viewport||!target)return null;const p=target.worldPosition,t=viewport.getComponent('cc.UITransform')??viewport._uiProps.uiTransformComp,vp=viewport.worldPosition,v=cc.view.getVisibleSize(),hh=t.height*Math.abs(viewport.worldScale.y)/2;return{x:(p.x+v.width/2)*innerWidth/v.width,y:(v.height/2-p.y)*innerHeight/v.height,top:(v.height/2-vp.y-hh)*innerHeight/v.height,bottom:(v.height/2-vp.y+hh)*innerHeight/v.height}})()`);
      assert.ok(state, `Missing reward content ${name}`);
      if (state.y > state.top + 10 && state.y < state.bottom - 10) {
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: state.x, y: state.y, id: 8 }] });
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(400); return;
      }
      const direction = state.y >= state.bottom - 10 ? -1 : 1;
      await swipeRewardViewport(direction, 8, state.y);
    }
    throw Error(`Cannot touch-scroll to ${name}`);
  };

  // Collection fixture unlocks one complete chain; reward must be claimed by real touch only once.
  await seed((d) => { d.discoveredItemIds = bundle.items.filter((item) => item.chainId === 'coffee').map((item) => item.id);
    d.claimedCollectionIds = []; d.tutorial = { generatorClicked: true, firstMergeCompleted: true, firstOrderCompleted: true, firstOrderHintShown: true }; });
  await tap('EnterGame'); const capBeforeCollection = await ev(`${app}.game.player.maxEnergy`);
  const collection = (await ev(`${app}.game.getCollectionProgress()`)).find((item) => item.chainId === 'coffee');
  assert.equal(collection.ready, true); assert.equal(collection.energyBonus, bundle.game.collection.energyPerChain);
  await tap('OpenTools'); await tapRewardContent('CollectionClaim_coffee');
  assert.equal(await ev(`${app}.game.player.maxEnergy`), capBeforeCollection + collection.energyBonus);
  await tapRewardContent('CollectionClaim_coffee');
  assert.equal(await ev(`${app}.game.player.maxEnergy`), capBeforeCollection + collection.energyBonus);
  await tap('CloseRewards'); await send('Page.reload'); await wait(400); await ready(); await wait(800); await tap('EnterGame');
  assert.equal(await ev(`${app}.game.player.maxEnergy`), capBeforeCollection + collection.energyBonus);
  assert.equal((await ev(`${app}.game.getCollectionProgress()`)).find((item) => item.chainId === 'coffee').claimed, true);
  passed('completed collection grants permanent energy cap once and persists across restart');

  // Isolated near-complete progress; a real merge and delivery complete all three daily goals.
  const qaBusinessDay = Math.floor((Date.now() + 28_800_000) / 86_400_000);
  await seed((d) => {
    grownUp(d); d.player.energy = 60;
    d.board = Array.from({ length: boardSize }, (_, index) => ({ index,
      ...(index < 2 ? { item: { uid: `daily_merge_${index}`, definitionId: 'coffee_01' } } : {}) }));
    d.activeOrders[0].requirements = [{ itemId: 'coffee_02', count: 1 }];
    d.dailyTasks = { day: qaBusinessDay, targetItemId: 'coffee_02', progress: { orders_3: 2, merges_10: 9, specific_2: 1 }, claimedIds: [] };
  });
  await tap('EnterGame'); await gesture(0, 1);
  let daily = await ev(`${app}.game.getDailyTasks()`);
  assert.equal(daily.tasks.find((task) => task.id === 'merges_10').progress, 10);
  assert.equal(daily.tasks.find((task) => task.id === 'specific_2').progress, 2);
  await tap('OrderCard', 0); daily = await ev(`${app}.game.getDailyTasks()`);
  assert.ok(daily.tasks.every((task) => task.ready), 'Real merge and delivery should complete all daily goals');
  await tap('OpenTools'); await tap('RewardsTab_daily');
  for (const task of daily.tasks) {
    assert.ok(await active(`DailyTask_${task.id}`));
    assert.ok(await ev(`(()=>{let n;const w=v=>{if(v.name===${JSON.stringify('DailyTask_' + task.id)}&&v.activeInHierarchy)n=v;v.children.forEach(w)};w(cc.director.getScene());return n?.getComponentsInChildren(cc.Label).some(l=>l.string.includes(${JSON.stringify(task.progress + '/' + task.target)}))??false})()`));
    const before = await ev(`(()=>{const p=${app}.game.player;return {coins:p.coins,diamonds:p.diamonds}})()`);
    await tapRewardContent(`DailyTaskClaim_${task.id}`);
    const after = await ev(`(()=>{const p=${app}.game.player;return {coins:p.coins,diamonds:p.diamonds}})()`);
    assert.equal(after.coins, before.coins + task.reward.coins); assert.equal(after.diamonds, before.diamonds + task.reward.diamonds);
    await tapRewardContent(`DailyTaskClaim_${task.id}`);
    assert.deepEqual(await ev(`(()=>{const p=${app}.game.player;return {coins:p.coins,diamonds:p.diamonds}})()`), after);
  }
  await tap('CloseRewards'); await send('Page.reload'); await wait(400); await ready(); await wait(800); await tap('EnterGame');
  daily = await ev(`${app}.game.getDailyTasks()`); assert.ok(daily.tasks.every((task) => task.claimed));
  await seed((d) => { grownUp(d); d.dailyTasks = { day: qaBusinessDay - 1, targetItemId: 'coffee_02',
    progress: { orders_3: 3, merges_10: 10, specific_2: 2 }, claimedIds: ['orders_3', 'merges_10', 'specific_2'] }; });
  await tap('EnterGame'); daily = await ev(`${app}.game.getDailyTasks()`);
  assert.equal(daily.day, qaBusinessDay); assert.ok(daily.tasks.every((task) => task.progress === 0 && !task.claimed));
  await tap('OpenTools'); await tap('RewardsTab_daily'); for (const task of daily.tasks) assert.ok(await active(`DailyTask_${task.id}`)); await tap('CloseRewards');
  passed('daily task progress from real actions, one-time claims, restart persistence and UTC+8 next-day reset');


  // Version 6 had 48 cells: retain occupied old cells, lock unrelated empty cells,
  // and put items from the six removed cells into the persistent inbox.
  await seed((d) => { d.version = 6; d.player.level = 1; d.player.xp = 0; d.legacyBoardEntitlement = true;
    d.retainedOpenCellIndices = [];
    d.board = Array.from({ length: 48 }, (_, index) => ({ index,
      ...([0, 4, 41, 46].includes(index) ? { item: { uid: `v6_sparse_${index}`, definitionId: 'coffee_01' } } : {}) })); });
  await tap('EnterGame'); if (await active('ConfirmStorageNotice')) await tap('ConfirmStorageNotice');
  const sparse = await cells(); assert.equal(sparse.length, boardSize);
  assert.ok(!sparse[4].locked && !sparse[41].locked && sparse[5].locked);
  assert.equal(sparse[4].item.uid, 'v6_sparse_4'); assert.equal(sparse[41].item.uid, 'v6_sparse_41');
  assert.ok((await ev(`${app}.game.rewardInbox`)).some((item) => item.uid === 'v6_sparse_46'));
  assert.equal(sparse.filter((cell) => !cell.locked).length, 11);
  passed('v6 sparse migration preserves occupied rights and overflow while unrelated empty cells stay locked');

  // Isolated v5 migration: all legacy UIDs and preferences must survive the smaller board.
  await seed((d) => {
    d.version = 5; d.player.level = 1; d.preferences = { soundEnabled: false, vibrationEnabled: false };
    d.board = Array.from({ length: 81 }, (_, index) => ({ index, item: { uid: `legacy_${index}`, definitionId: 'coffee_01' } }));
    d.life.unlockedMemoryIds = ['letters', 'anniversary'];
  });
  await tap('EnterGame'); if (await active('ConfirmStorageNotice')) await tap('ConfirmStorageNotice');
  const migrated = await ev(`(()=>{const g=${app}.game;return{board:g.board.getBoard().cells,inbox:g.rewardInbox,prefs:g.preferences,memories:g.life.state.unlockedMemoryIds}})()`);
  assert.equal(migrated.board.length, boardSize); assert.ok(migrated.board.every((c) => !c.locked));
  assert.equal(migrated.board.filter((c) => c.item).length, boardSize);
  assert.equal(migrated.inbox.length, 81 - boardSize);
  assert.deepEqual(new Set([...migrated.board.map((c) => c.item.uid), ...migrated.inbox.map((i) => i.uid)]), new Set(Array.from({ length: 81 }, (_, i) => `legacy_${i}`)));
  assert.deepEqual(migrated.prefs, { soundEnabled: false, vibrationEnabled: false });
  for (const id of ['zhoushan_bonfire', 'marriage_registration', 'wedding_thanksgiving']) assert.ok(migrated.memories.includes(id));
  passed('v5 migration retains all 81 UIDs, legacy board entitlement, memory rights and preferences');

  // Real touch merges: discovery awards coins only for the first successful synthesis.
  await seed((d) => { grownUp(d); d.board = Array.from({ length: boardSize }, (_, index) => ({ index,
    ...(index < 4 ? { item: { uid: `discovery_${index}`, definitionId: 'coffee_01' } } : {}) })); });
  await tap('EnterGame'); const coinsBeforeDiscovery = await ev(`${app}.game.player.coins`);
  await gesture(0, 1); assert.equal(await ev(`${app}.game.player.coins`), coinsBeforeDiscovery + bundle.game.rewards.discoveryCoins);
  await gesture(2, 3); assert.equal(await ev(`${app}.game.player.coins`), coinsBeforeDiscovery + bundle.game.rewards.discoveryCoins);
  assert.equal(await ev(`${app}.game.isItemDiscovered('coffee_02')`), true);
  passed('first successful synthesis awards discovery coins once');
  await seed((d) => { grownUp(d); d.board[0].item = { uid: 'owned_future', definitionId: 'coffee_08' }; });
  await tap('EnterGame');
  for (let i = 0; i < 30; i++) { if (await ev(`(()=>{let n;const w=v=>{if(v.name==='Cell_0'&&v.activeInHierarchy)n=v;v.children.forEach(w)};w(cc.director.getScene());return !!n?.getChildByName('ItemView')?.getChildByName('ItemArt')?.getComponent(cc.Sprite)?.spriteFrame})()`)) break; await wait(100); }
  assert.equal(await ev(`(()=>{let n;const w=v=>{if(v.name==='Cell_0'&&v.activeInHierarchy)n=v;v.children.forEach(w)};w(cc.director.getScene());return !!n?.getChildByName('ItemView')?.getChildByName('ItemArt')?.getComponent(cc.Sprite)?.spriteFrame})()`), true, 'Actual held item should remain visible');
  await tap('Cell_0'); assert.ok((await labels()).includes('？？？'));
  assert.ok(!(await labels()).includes(bundle.items.find((item) => item.id === 'coffee_08').displayName)); await tap('ItemGuideClose');
  passed('held high-level item remains visible while its undiscovered guide stays secret');

  // Reward interactions use the actual panel, confirmation and touch scrolling.
  await seed((d) => { grownUp(d); d.player.energy = 50; d.player.diamonds = 20;
    d.board = Array.from({ length: boardSize }, (_, index) => ({ index, ...(index < 4 ? { item: { uid: `supply_${index}`,
      definitionId: ['treasure_chest', 'coin_01', 'energy_01', 'diamond_01'][index] } } : {}) })); });
  await tap('EnterGame'); await tap('DailyCheckInButton');
  const beforeCheckIn = await ev(`${app}.game.getCheckInStatus()`);
  await tap('CheckInClaim'); const afterCheckIn = await ev(`${app}.game.getCheckInStatus()`);
  assert.equal(afterCheckIn.claims, beforeCheckIn.claims + 1); await tap('CheckInClaim');
  assert.equal((await ev(`${app}.game.getCheckInStatus()`)).claims, afterCheckIn.claims);
  const beforeExchange = await ev(`(()=>{const p=${app}.game.player;return {energy:p.energy, diamonds:p.diamonds, maxEnergy:p.maxEnergy}})()`);
  await rewardRowAction(`补充 ${Math.min(bundle.game.rewards.exchangeOffers[0].energy, beforeExchange.maxEnergy - beforeExchange.energy)} 点体力`);
  const afterExchange = await ev(`(()=>{const p=${app}.game.player;return {energy:p.energy, diamonds:p.diamonds, maxEnergy:p.maxEnergy}})()`);
  assert.equal(afterExchange.diamonds, beforeExchange.diamonds - bundle.game.rewards.exchangeOffers[0].diamonds);
  assert.equal(afterExchange.energy, Math.min(beforeExchange.maxEnergy, beforeExchange.energy + bundle.game.rewards.exchangeOffers[0].energy));
  for (const id of ['coin_01', 'energy_01', 'diamond_01', 'treasure_chest']) {
    const before = await cells(); const existing = before.find((c) => c.item?.uid === `supply_${['treasure_chest','coin_01','energy_01','diamond_01'].indexOf(id)}`);
    assert.ok(existing, `Missing ${id} on board`); await useReward(id);
    assert.ok(!(await cells()).some((c) => c.item?.uid === existing.item.uid), `${id} was not consumed`);
  }
  await tap('CloseRewards');
  passed('touch check-in duplicate protection, diamond exchange and chest/coin/energy/diamond consumption');

  const currentDay = (await ev(`${app}.game.getCheckInStatus()`)).day;
  for (let day = 0; day < bundle.game.rewards.checkIn.length; day++) {
    await seed((d) => { grownUp(d); d.player.energy = 30; d.player.diamonds = 0;
      d.checkIn = { claims: day, lastClaimDay: currentDay - 1 }; });
    await tap('EnterGame'); await tap('DailyCheckInButton');
    const before = await ev(`(()=>{const p=${app}.game.player;return {coins:p.coins,energy:p.energy,diamonds:p.diamonds}})()`);
    await tap('CheckInClaim'); const reward = bundle.game.rewards.checkIn[day];
    const after = await ev(`(()=>{const p=${app}.game.player;return {coins:p.coins,energy:p.energy,diamonds:p.diamonds}})()`);
    assert.equal(after.coins, before.coins + reward.coins); assert.equal(after.diamonds, before.diamonds + reward.diamonds);
    assert.equal(after.energy, before.energy + reward.energy);
    await tap('CheckInClaim'); assert.deepEqual(await ev(`(()=>{const p=${app}.game.player;return {coins:p.coins,energy:p.energy,diamonds:p.diamonds}})()`), after);
  }
  passed('each of seven check-in rewards grants once per day');

  await seed((d) => { d.player.energy = d.player.maxEnergy - 1; d.player.diamonds = 20; d.tutorial = { generatorClicked: true, firstMergeCompleted: true, firstOrderCompleted: true }; });
  await tap('EnterGame'); await tap('OpenTools'); await rewardRowAction('补充 1 点体力', `消耗 ${bundle.game.rewards.exchangeOffers[0].diamonds} 钻石`);
  const once = await ev(`(()=>{const p=${app}.game.player;return {energy:p.energy,diamonds:p.diamonds,maxEnergy:p.maxEnergy}})()`);
  assert.equal(once.energy, once.maxEnergy); assert.equal(once.diamonds, 20 - bundle.game.rewards.exchangeOffers[0].diamonds);
  await rewardRowAction('体力已满', '使用一些体力后'); assert.ok(!(await labels()).some(text=>text.includes('补充 0 点体力')));
  assert.deepEqual(await ev(`(()=>{const p=${app}.game.player;return {energy:p.energy,diamonds:p.diamonds,maxEnergy:p.maxEnergy}})()`), once);
  passed('diamond exchange at full energy cannot deduct a second time');

  await seed((d) => { grownUp(d); d.board = Array.from({ length: boardSize }, (_, index) => ({ index,
    item: { uid: `full_${index}`, definitionId: index === 0 ? 'treasure_chest' : 'coffee_01' } })); });
  await tap('EnterGame'); await tap('OpenTools'); await useReward('treasure_chest');
  assert.equal((await ev(`${app}.game.rewardInbox`)).length, 1, 'Full board chest must preserve overflow');
  const inboxItem = (await ev(`${app}.game.rewardInbox`))[0];
  await rewardRowAction(bundle.items.find((item) => item.id === inboxItem.definitionId).displayName, '领取后放入');
  assert.equal((await ev(`${app}.game.rewardInbox`)).length, 1, 'Full board cannot discard recovered item');
  await tap('CloseRewards'); await gesture(1, 2); await clearFreshSupplies(); await tap('OpenTools');
  await rewardRowAction(bundle.items.find((item) => item.id === inboxItem.definitionId).displayName, '领取后放入');
  assert.equal((await ev(`${app}.game.rewardInbox`)).length, 0);
  assert.ok((await cells()).some((c) => c.item?.uid === inboxItem.uid)); await tap('CloseRewards');
  passed('full-board chest overflow remains in inbox until an open cell is available');

  }
  await seed((d) => { grownUp(d); d.life.unlockedMemoryIds = []; });
  await tap('EnterGame'); await tap('Button_回忆');
  for (const memory of bundle.memories.slice(0, 4)) {
    const displayed = await labels(); assert.ok(!displayed.includes(memory.title)); assert.ok(!displayed.includes(memory.dateLabel));
  }
  assert.equal((await artState('Illustration')) ?? null, null, 'Locked album must not render original artwork');
  await tap('MemoryTab_diary'); assert.equal((await artState('DiaryIllustration')) ?? null, null);
  assert.ok(!(await labels()).includes(bundle.memories[0].diary));
  await tap('MemoryTab_timeline'); await scrollDown('MemoryTimelineViewport');
  for (const memory of bundle.memories.slice(-3)) { assert.ok(!(await labels()).includes(memory.title)); assert.ok(!(await labels()).includes(memory.dateLabel)); }
  passed('locked album, diary and timeline hide personal text and original artwork');

  await seed((d) => { grownUp(d); d.player.hearts = 1000;
    d.life.unlockedMemoryIds = bundle.memories.slice(0, bundle.memories.findIndex((m) => m.id === 'anniversary')).map((m) => m.id); });
  await tap('EnterGame'); await tap('Button_回忆'); await tap('MemoryTab_timeline'); await scrollDown('MemoryTimelineViewport');
  for (const id of ['anniversary', 'marriage_registration', 'wedding_thanksgiving']) {
    const before = await ev(`${app}.game.player.hearts`); const memory = bundle.memories.find((m) => m.id === id);
    await tap('TimelineEntry_' + id); assert.equal(await ev(`${app}.game.player.hearts`), before - memory.heartCost);
    assert.ok((await ev(`${app}.game.life.state.unlockedMemoryIds`)).includes(id));
    await scrollDown('MemoryTimelineViewport');
  }
  passed('wedding, certificate and thanksgiving unlock independently through the timeline');

  await seed((d) => { grownUp(d); d.life.ownedFurnitureIds = ['sofa']; d.life.placedFurnitureIds = ['sofa']; });
  await tap('EnterGame'); await tap('Button_家园'); await tap('Button_调整位置'); await tap('Placed_sofa');
  assert.ok(await active('FurnitureSelection_sofa')); assert.ok(await active('FurnitureTransformControls')); await shot('furniture-controls-final');
  const furnitureUiBounds = await ev(`(()=>{const names=['FurnitureTransformControls','Navigation','HomeActions'];const found={};const w=n=>{if(names.includes(n.name)&&n.activeInHierarchy){const t=n.getComponent('cc.UITransform')??n._uiProps.uiTransformComp;const b=t.getBoundingBoxToWorld();found[n.name]={xMin:b.xMin,xMax:b.xMax,yMin:b.yMin,yMax:b.yMax}}n.children.forEach(w)};w(cc.director.getScene());const v=cc.view.getVisibleSize();return{found,screen:{xMin:-v.width/2,xMax:v.width/2,yMin:-v.height/2,yMax:v.height/2}}})()`);
  const boxes = furnitureUiBounds.found, rectOverlap = (a,b) => a&&b&&Math.min(a.xMax,b.xMax)-Math.max(a.xMin,b.xMin)>0.5&&Math.min(a.yMax,b.yMax)-Math.max(a.yMin,b.yMin)>0.5;
  assert.ok(boxes.FurnitureTransformControls && boxes.Navigation && boxes.HomeActions);
  assert.ok(!rectOverlap(boxes.FurnitureTransformControls, boxes.Navigation) && !rectOverlap(boxes.FurnitureTransformControls, boxes.HomeActions), 'Furniture controls must not cover navigation or home actions');
  assert.ok(boxes.FurnitureTransformControls.yMin >= furnitureUiBounds.screen.yMin - 1 && boxes.FurnitureTransformControls.yMax <= furnitureUiBounds.screen.yMax + 1, 'Furniture controls must remain onscreen');

  await tap('FurnitureScaleUp'); assert.equal((await ev(`${app}.game.life.state.furniturePositions.sofa`)).scale, 1.1);
  await tap('FurnitureScaleDown'); assert.equal((await ev(`${app}.game.life.state.furniturePositions.sofa`)).scale, 1);
  await tap('FurnitureScaleUp'); await tap('FurnitureRotateRight'); await tap('FurnitureFlipHorizontal');
  const adjusted = await ev(`${app}.game.life.state.furniturePositions.sofa`);
  assert.equal(adjusted.scale, 1.1); assert.equal(adjusted.rotation, -15); assert.equal(adjusted.flipped, true);
  const furnitureStart = await coords('Placed_sofa');
  await ev(`(()=>{window.__qaFurnitureTouch=[];let n;const w=v=>{if(v.name==='Placed_sofa'&&v.activeInHierarchy)n=v;v.children.forEach(w)};w(cc.director.getScene());for(const event of [cc.Node.EventType.TOUCH_START,cc.Node.EventType.TOUCH_MOVE,cc.Node.EventType.TOUCH_END,cc.Node.EventType.TOUCH_CANCEL])n.on(event,(e)=>window.__qaFurnitureTouch.push({event,code:e.getEventCode?.()}));return true})()`);
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...furnitureStart, id: 5 }] });
  for (let i = 1; i <= 8; i++) await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: furnitureStart.x + (385 - furnitureStart.x) * i / 8, y: furnitureStart.y + (100 - furnitureStart.y) * i / 8, id: 5 }] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(500);
  const moved = await ev(`${app}.game.life.state.furniturePositions.sofa`);
  assert.equal(moved.scale, 1.1); assert.equal(moved.rotation, -15); assert.equal(moved.flipped, true);
  if (!(Math.abs(moved.x - adjusted.x) > 0.01 || Math.abs(moved.y - adjusted.y) > 0.01)) {
    fs.writeFileSync(path.join(output, 'furniture-drag-failure.json'), JSON.stringify({ adjusted, moved, furnitureStart, events: await ev('window.__qaFurnitureTouch') }, null, 2));
    await shot('furniture-transform-final');
  }
  assert.ok(Math.abs(moved.x - adjusted.x) > 0.01 || Math.abs(moved.y - adjusted.y) > 0.01, 'Furniture must actually move after touch drag');
  await shot('furniture-transform-final');
  const spriteAngle = await ev(`(()=>{let n;const w=v=>{if(v.name==='Placed_sofa'&&v.activeInHierarchy)n=v;v.children.forEach(w)};w(cc.director.getScene());return n.eulerAngles.z})()`);
  assert.ok(Math.abs(((spriteAngle - moved.rotation + 540) % 360) - 180) < 0.01, 'Displayed furniture rotation must match its saved value');
  const bounds = await ev(`(()=>{let scene,sprite;const w=n=>{if(n.name==='HomeFurnitureScene'&&n.activeInHierarchy)scene=n;if(n.name==='Placed_sofa'&&n.activeInHierarchy)sprite=n;n.children.forEach(w)};w(cc.director.getScene());const b=n=>{const t=n.getComponent('cc.UITransform')??n._uiProps.uiTransformComp,x0=-t.anchorX*t.width,x1=(1-t.anchorX)*t.width,y0=-t.anchorY*t.height,y1=(1-t.anchorY)*t.height;const p=[[x0,y0],[x0,y1],[x1,y0],[x1,y1]].map(([x,y])=>t.convertToWorldSpaceAR(new cc.Vec3(x,y,0)));return{xMin:Math.min(...p.map(v=>v.x)),xMax:Math.max(...p.map(v=>v.x)),yMin:Math.min(...p.map(v=>v.y)),yMax:Math.max(...p.map(v=>v.y))}};return {a:b(sprite),c:b(scene)}})()`);
  if (!(bounds.a.xMin >= bounds.c.xMin - 1 && bounds.a.xMax <= bounds.c.xMax + 1 && bounds.a.yMin >= bounds.c.yMin - 1 && bounds.a.yMax <= bounds.c.yMax + 1)) { fs.writeFileSync(path.join(output, 'furniture-bounds-failure.json'), JSON.stringify(bounds, null, 2)); await shot('furniture-bounds-failure'); }
  assert.ok(bounds.a.xMin >= bounds.c.xMin - 1 && bounds.a.xMax <= bounds.c.xMax + 1 && bounds.a.yMin >= bounds.c.yMin - 1 && bounds.a.yMax <= bounds.c.yMax + 1, 'Rotated and scaled furniture must remain within room bounds');
  const cancelStart = await coords('Placed_sofa');
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...cancelStart, id: 6 }] });
  for (let i = 1; i <= 4; i++) await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cancelStart.x - i * 7, y: cancelStart.y + i * 3, id: 6 }] });
  await send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await wait(400);
  assert.deepEqual(await ev(`${app}.game.life.state.furniturePositions.sofa`), moved, 'Real OS cancellation must not save the drag');

  await send('Page.reload'); await wait(400); await ready(); await wait(800); await tap('EnterGame');
  assert.deepEqual(await ev(`${app}.game.life.state.furniturePositions.sofa`), moved);
  await tap('Button_家园'); await tap('Button_调整位置'); await tap('Placed_sofa'); await tap('FurnitureResetAll');
  assert.equal(await ev(`${app}.game.life.state.furniturePositions.sofa ?? null`), null);
  passed('furniture touch scale, rotation, flip and bounded drag persist across reload and restore together');

  await send('Network.setCacheDisabled', { cacheDisabled: true }); await send('Network.setBlockedURLs', { urls: ['*/assets/game_art/*'] });
  await load('?preview=lv12'); await tap('EnterGame');
  const fallback = await labels(); assert.ok(fallback.includes('咖1'));
  const requiredNames = await ev(`(()=>{const g=${app}.game;return g.orders.getOrders().flatMap(o=>o.requirements.map(r=>g.bundle.catalog.get(r.itemId).displayName))})()`);
  for (const name of requiredNames) assert.ok(fallback.includes(name), 'Missing fallback: ' + name);
  await gesture(0, 1); assert.equal((await cells())[1].item.definitionId, 'coffee_02'); await shot('art-failure');
  passed('readable board/order fallback and working merge when art downloads fail');
  assert.deepEqual(exceptions, []);
  passed('no uncaught Cocos runtime exception during all checks');
  }
} catch (error) {
  if (send) { try { const frame = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(output, 'failure-actual.png'), Buffer.from(frame.data, 'base64')); } catch { /* browser may already be closed */ } }
  fs.writeFileSync(path.join(output, 'failure.txt'), String(error.stack ?? error));
  process.exitCode = 1; console.error(error);
} finally {
  if (digestBuild(buildDir) !== testedBuildDigest) { process.exitCode = 1; exceptions.push('Web Mobile build changed during the checks'); }
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: process.exitCode !== 1, scope, checks, exceptions,
    testedBuildDigest, version: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version, output }, null, 2));
  ws?.close(); chrome.kill(); server.close();
  console.log(`[cocos-ui] Evidence: ${output}`);
}
