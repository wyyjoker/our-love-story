import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareWechatBuild } from './prepare-wechat-build.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'love-wechat-build-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'tools'));
  mkdirSync(join(root, 'build/wechatgame'), { recursive: true });
  writeFileSync(join(root, 'tools/wechat-build.json'), JSON.stringify({
    platform: 'wechatgame', bundleConfigs: [{ name: 'game_art' }],
    packages: { wechatgame: { appid: '', orientation: 'portrait' } },
  }));
  return root;
}

test('retains selected AppID when generated output is overwritten with sample ID', (t) => {
  const root = fixture(t);
  const project = join(root, 'build/wechatgame/project.config.json');
  writeFileSync(project, JSON.stringify({ appid: 'wx1111111111111111' }));
  prepareWechatBuild(root);
  writeFileSync(project, JSON.stringify({ appid: 'wx6ac3f5090a6b99c5' }));
  const prepared = prepareWechatBuild(root);
  assert.equal(prepared.appid, 'wx1111111111111111');
  const config = JSON.parse(readFileSync(prepared.configPath, 'utf8'));
  assert.deepEqual(config.bundleConfigs, [{ name: 'game_art' }]);
  assert.equal(config.packages.wechatgame.orientation, 'portrait');
});

test('explicit AppID replaces local account and remains selected next time', (t) => {
  const root = fixture(t);
  prepareWechatBuild(root, 'wx1111111111111111');
  prepareWechatBuild(root, 'wx2222222222222222');
  assert.equal(prepareWechatBuild(root).appid, 'wx2222222222222222');
});

test('rejects missing, malformed, and sample AppIDs without changing saved selection', (t) => {
  const root = fixture(t);
  assert.throws(() => prepareWechatBuild(root), /AppID/);
  prepareWechatBuild(root, 'wx1111111111111111');
  for (const appid of ['', 'not-an-appid', 'wx6ac3f5090a6b99c5']) {
    assert.throws(() => prepareWechatBuild(root, appid), /AppID/);
  }
  assert.equal(prepareWechatBuild(root).appid, 'wx1111111111111111');
});
