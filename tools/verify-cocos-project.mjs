#!/usr/bin/env node
/**
 * Static Cocos project verification (NOT a substitute for Creator build).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function check(cond, message) {
  if (!cond) errors.push(message);
}

check(exists('assets'), 'assets/ missing');
check(exists('package.json'), 'package.json missing');
check(exists('assets/scenes/Game.scene'), 'Game.scene missing');
check(exists('assets/scripts/ui/cocos/GameBootstrap.ts'), 'GameBootstrap.ts missing');

const bootstrap = exists('assets/scripts/ui/cocos/GameBootstrap.ts')
  ? read('assets/scripts/ui/cocos/GameBootstrap.ts')
  : '';
check(bootstrap.includes("from 'cc'") || bootstrap.includes('from "cc"'), 'GameBootstrap must import cc');
check(bootstrap.includes('extends Component'), 'GameBootstrap must extend Component');
check(bootstrap.includes('@ccclass'), 'GameBootstrap must use @ccclass');
check(bootstrap.includes('onLoad'), 'GameBootstrap must implement onLoad');
check(bootstrap.includes('onDestroy'), 'GameBootstrap must implement onDestroy');

check(exists('assets/scripts/platform/cocos/CocosStorageAdapter.ts'), 'CocosStorageAdapter missing');
check(exists('assets/scripts/platform/cocos/CocosSafeArea.ts'), 'CocosSafeArea missing');
check(exists('assets/scripts/platform/cocos/CocosLifecycleAdapter.ts'), 'CocosLifecycleAdapter missing');

// Core purity: no cc imports in core/gameplay
for (const dir of ['assets/scripts/core', 'assets/scripts/gameplay']) {
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith('.ts')) {
        const text = fs.readFileSync(p, 'utf8');
        if (/from ['"]cc['"]/.test(text)) {
          errors.push(`cc import in pure layer: ${path.relative(root, p)}`);
        }
      }
    }
  };
  if (exists(dir)) walk(path.join(root, dir));
}

if (exists('assets/scenes/Game.scene.meta')) {
  // ok when Creator generated
} else {
  warnings.push('Game.scene.meta missing (Creator will generate on import)');
}

// EventBus off support
const bus = read('assets/scripts/events/GameEventBus.ts');
check(/\boff\b/.test(bus), 'GameEventBus must support off()');
check(/\bon\b/.test(bus) && bus.includes('emit'), 'GameEventBus must support on()/emit()');
check(bus.includes('GameEventMap'), 'GameEventBus must stay typed (GameEventMap)');

const summary = {
  ok: errors.length === 0,
  errors,
  warnings,
  note: 'Static verification only — does not replace Cocos Creator import/build.',
};

console.log(JSON.stringify(summary, null, 2));
if (errors.length > 0) process.exitCode = 1;
