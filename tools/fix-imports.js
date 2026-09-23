const fs = require('fs');
const path = require('path');

function walk(d, a = []) {
  if (!fs.existsSync(d)) return a;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, a);
    else if (e.name.endsWith('.ts')) a.push(p);
  }
  return a;
}

const files = [...walk('assets/scripts'), ...walk('src')];
const pairs = [
  ["from '../../assets/scripts/core/", "from '../core/"],
  ["from '../../assets/scripts/infrastructure/", "from '../infrastructure/"],
  ["from '../../assets/scripts/events/", "from '../events/"],
  ["from '../../assets/scripts/gameplay/", "from '../gameplay/"],
  ["from '../../assets/scripts/config/", "from '../config/"],
  ["from '../../assets/resources/config/", "from '../resources/config/"],
  ['from "../../assets/scripts/core/', 'from "../core/'],
  ['from "../../assets/resources/config/', 'from "../resources/config/'],
  // web entry should point at assets/scripts
  ["from '../gameplay/GameContext'", "from '../../assets/scripts/gameplay/GameContext'"],
  ["from '../core/types'", "from '../../assets/scripts/core/types'"],
  ["from '../core/board/board'", "from '../../assets/scripts/core/board/board'"],
];

for (const f of files) {
  // Only apply web-entry redirects for src/web
  const isWeb = f.startsWith('src/');
  let t = fs.readFileSync(f, 'utf8');
  let o = t;
  for (const [a, b] of pairs) {
    if (!isWeb && b.includes('assets/scripts')) {
      // skip reverse web mappings for non-web
      if (a.startsWith("from '../")) continue;
    }
    t = t.split(a).join(b);
  }
  if (t !== o) {
    fs.writeFileSync(f, t);
    console.log('fixed', f);
  }
}

console.log('--- imports ---');
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  lines.forEach((l, i) => {
    if (l.includes('from ') && (l.includes("'") || l.includes('"'))) {
      if (/from ['"]/.test(l)) console.log(`${f}:${i + 1}: ${l.trim()}`);
    }
  });
}
