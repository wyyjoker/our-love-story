import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const buildDir = resolve(process.argv[2] ?? 'build/wechatgame');
const manifestPath = join(buildDir, 'game.json');
if (!existsSync(manifestPath)) throw new Error(`WeChat build missing: ${manifestPath}`);

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const roots = (manifest.subpackages ?? []).map(({ root }) => {
  if (typeof root !== 'string' || !root.trim()) throw new Error('Invalid subpackage root');
  const fullPath = resolve(buildDir, root);
  if (!fullPath.startsWith(`${buildDir}${sep}`) || !existsSync(fullPath)) {
    throw new Error(`Subpackage root missing or outside build: ${root}`);
  }
  return fullPath;
});
if (!roots.some((root) => root.endsWith(`${sep}game_art`))) {
  throw new Error('game_art is not listed as a WeChat subpackage');
}

function bytesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).reduce((sum, entry) => {
    const path = join(directory, entry.name);
    return sum + (entry.isDirectory() ? bytesUnder(path) : statSync(path).size);
  }, 0);
}

let mainBytes = 0;
function countMain(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (roots.some((root) => path === root || path.startsWith(`${root}${sep}`))) continue;
    if (entry.isDirectory()) countMain(path);
    else mainBytes += statSync(path).size;
  }
}
countMain(buildDir);
const limit = 4_000_000;
console.log(`Main package: ${mainBytes.toLocaleString()} / ${limit.toLocaleString()} bytes`);
for (const root of roots) console.log(`${relative(buildDir, root)}: ${bytesUnder(root).toLocaleString()} bytes`);
if (mainBytes >= limit) throw new Error('WeChat main package is 4 MB or larger');
