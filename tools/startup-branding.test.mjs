import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import vm from 'node:vm';
import sharp from 'sharp';
import { applyStartupBranding } from './startup-branding.mjs';

async function fixture(t, platform) {
  const root = mkdtempSync(join(tmpdir(), 'love-brand-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const build = join(root, 'out'); mkdirSync(join(build, 'src'), { recursive: true });
  mkdirSync(join(root, 'assets/game_art'), { recursive: true });
  cpSync(resolve('build-templates/startup'), join(root, 'build-templates/startup'), { recursive: true });
  await sharp({ create: { width: 420, height: 700, channels: 3, background: '#e7d8c5' } }).jpeg().toFile(join(root, 'assets/game_art/cover_background.jpg'));
  writeFileSync(join(build, 'src/settings.json'), JSON.stringify({ splashScreen: { totalTime: 2000, logo: { type: 'default' }, background: { type: 'default' } }, untouched: 17 }));
  if (platform === 'wechatgame') {
    writeFileSync(join(build, 'first-screen.js'), 'default Cocos');
    writeFileSync(join(build, 'game.js'), "const firstScreen = require('./first-screen'); firstScreen.start(); firstScreen.end();");
  } else {
    writeFileSync(join(build, 'index.html'), "<html><head><title>Cocos Creator</title></head><body><script>System.import('./index.js').catch(function(err) { console.error(err); })</script></body></html>");
    writeFileSync(join(build, 'index.js'), 'function launch(engine) { return application.init(engine); } function fail(err) { console.error(err); }');
  }
  return { root, build };
}

test('wechat branding has bounded image, no default logo or fake progress and works across lifecycle', async (t) => {
  const {root, build} = await fixture(t, 'wechatgame');
  const result = await applyStartupBranding(root, build, 'wechatgame', {notBefore: Date.now()});
  assert.ok(result.imageBytes > 0 && result.imageBytes <= 30 * 1024);
  const settings = JSON.parse(readFileSync(join(build, 'src/settings.json'), 'utf8'));
  assert.equal(settings.splashScreen.totalTime, 0); assert.equal(settings.splashScreen.logo.type, 'none'); assert.equal(settings.untouched, 17);
  const script = readFileSync(join(build, 'first-screen.js'), 'utf8');
  assert.doesNotMatch(script, /slogan\.png|logo\.png|drawProgressBar/);
  const gl = new Proxy({}, { get: (_, key) => key === 'getShaderParameter' || key === 'getProgramParameter' ? () => true : key === 'getAttribLocation' ? () => 0 : () => ({}) });
  const module = { exports: {} }; class Image { set src(_) { queueMicrotask(() => this.onload()); } }
  const canvas = { width: 360, height: 640, getContext: () => gl };
  const ctx = { module, Image, canvas, window: { canvas }, requestAnimationFrame: () => 1, cancelAnimationFrame: () => {}, Float32Array, Promise, Error };
  vm.runInNewContext(script, ctx);
  await module.exports.start('default', 'default', 'false'); await module.exports.setProgress(0.4); await module.exports.end();
  await applyStartupBranding(root, build, 'wechatgame');
});

test('web overlay waits for rendered frame, handles errors, and stays idempotent', async (t) => {
  const {root, build} = await fixture(t, 'web-mobile');
  await applyStartupBranding(root, build, 'web-mobile');
  const html = readFileSync(join(build, 'index.html'), 'utf8'), entry = readFileSync(join(build, 'index.js'), 'utf8');
  assert.match(html, /<title>我们的浪漫小屋<\/title>/); assert.match(html, /love-loading/);
  assert.match(entry, /EVENT_AFTER_DRAW/); assert.match(entry, /__loveLoadingError/); assert.doesNotMatch(entry, /init\(engine\)\.then/);
  let callback; const app = { init() {} };
  const engine = { director: { once: (_event, handler) => { callback = handler; } }, Director: { EVENT_AFTER_DRAW: 'after' } };
  vm.runInNewContext(entry + '; launch(engine);', { application: app, engine, window: { __loveLoadingReady() {}, __loveLoadingError() {} }, console });
  assert.equal(typeof callback, 'function');
  assert.doesNotMatch(html, /\d+%/);
  const settings = JSON.parse(readFileSync(join(build, 'src/settings.json'), 'utf8')); assert.equal(settings.splashScreen.totalTime, 0);
  const script = readFileSync(join(build, 'love-loading.js'), 'utf8');
  let removed = false; const message = { textContent: '' }, overlay = { remove() { removed = true; } };
  const window = { addEventListener() {} };
  vm.runInNewContext(script, { window, document: { getElementById: (id) => id === 'love-loading' ? overlay : message }, setTimeout: () => 1, clearTimeout() {} });
  assert.equal(removed, false); window.__loveLoadingError(); assert.match(message.textContent, /失败/); window.__loveLoadingReady(); assert.equal(removed, true);
  await applyStartupBranding(root, build, 'web-mobile');
  assert.equal(readFileSync(join(build, 'index.html'), 'utf8'), html); assert.equal(readFileSync(join(build, 'index.js'), 'utf8'), entry);
});

test('fails closed for stale or incompatible build without altering files', async (t) => {
  const {root, build} = await fixture(t, 'web-mobile'); const htmlPath = join(build, 'index.html');
  const old = readFileSync(htmlPath, 'utf8'); utimesSync(htmlPath, 1, 1);
  await assert.rejects(applyStartupBranding(root, build, 'web-mobile', {notBefore: Date.now()}), /不是本次生成/);
  assert.equal(readFileSync(htmlPath, 'utf8'), old);
  writeFileSync(join(build, 'index.js'), 'unexpected bootstrap');
  await assert.rejects(applyStartupBranding(root, build, 'web-mobile'), /启动接口/);
  assert.equal(readFileSync(htmlPath, 'utf8'), old);
});
