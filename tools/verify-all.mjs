#!/usr/bin/env node
/**
 * Cross-platform verify orchestration: test:core → lint:core → build:web → verify:cocos
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const npm = isWin ? 'npm.cmd' : 'npm';

const steps = [
  ['run', 'test:core'],
  ['run', 'lint:core'],
  ['run', 'build:web'],
  ['run', 'verify:cocos'],
];

let failed = 0;
for (const args of steps) {
  console.log(`\n=== npm ${args.join(' ')} ===`);
  const r = spawnSync(npm, args, {
    cwd: root,
    stdio: 'inherit',
    shell: isWin,
    windowsHide: true,
  });
  const code = r.status ?? 1;
  if (code !== 0) {
    failed += 1;
    console.error(`FAILED: npm ${args.join(' ')} (exit ${code})`);
    if (r.error) console.error(r.error);
    break;
  }
}

if (failed > 0) process.exitCode = 1;
else console.log('\nverify: ALL STEPS PASSED');
