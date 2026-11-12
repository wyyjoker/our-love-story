/** Import the 28 built-in image_gen results without changing their composition. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const spec = JSON.parse(fs.readFileSync(path.join(root, 'docs/story_art_prompts_1_0_1.json'), 'utf8'));
const memoriesFile = path.join(root, 'assets/resources/config/memories.json');
const memories = JSON.parse(fs.readFileSync(memoriesFile, 'utf8'));
assert.equal(spec.prompts.length, memories.length);
const imported = [];
for (const p of spec.prompts) {
  const job = JSON.parse(fs.readFileSync(path.join(root, 'local/story-art-jobs', `${String(p.index).padStart(2, '0')}-${p.id}.json`), 'utf8'));
  assert.equal(job.id, p.id);
  const editPath = path.join(root, 'local/story-art-edits', `${p.id}.json`);
  const edit = fs.existsSync(editPath) ? JSON.parse(fs.readFileSync(editPath, 'utf8')) : undefined;
  const selected = edit ?? job;
  const source = selected.sourcePath ?? /as (.+?\.png) by default/.exec(selected.output_hint)?.[1];
  assert.ok(source && fs.existsSync(source), `Generated source missing: ${p.id}`);
  const data = await sharp(source).rotate().resize(640, 640, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#fff8ef' }).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  const info = await sharp(data).metadata();
  assert.equal(info.width, 640);
  assert.equal(info.height, 640);
  const destination = path.join(root, 'assets/game_art', p.filename);
  fs.writeFileSync(destination, data);
  const memory = memories.find((m) => m.id === p.id);
  assert.ok(memory);
  memory.art = p.filename.replace(/\.jpg$/, '');
  memory.artMode = 'cover';
  memory.artFocusY = p.cropFocusY ?? 0.18;
  memory.artLabel = '故事插画';
  delete memory.artColumns;
  delete memory.artRows;
  imported.push({ index: p.index, id: p.id, title: p.title, asset: `assets/game_art/${p.filename}`,
    width: info.width, height: info.height, bytes: data.length,
    sha256: createHash('sha256').update(data).digest('hex'), source: source.replaceAll('\\', '/'),
    ...(edit ? { correction: edit.reason } : {}) });
  console.log(`${p.index}/28 ${p.filename}: ${data.length} bytes`);
}
assert.equal(new Set(imported.map((p) => p.sha256)).size, memories.length, 'Every chapter must have distinct artwork');
fs.writeFileSync(memoriesFile, JSON.stringify(memories, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'docs/story_art_manifest_1_0_1.json'), JSON.stringify({
  mode: spec.mode, createdAt: new Date().toISOString(), description: 'AI-generated fictional story illustrations; not personal photographs',
  count: imported.length, totalBytes: imported.reduce((n, p) => n + p.bytes, 0), assets: imported,
}, null, 2) + '\n');
// A review-only contact sheet; runtime uses the 28 individual files above.
const cell = 220, gutter = 10, columns = 4, rows = Math.ceil(imported.length / columns);
const tiles = [];
for (const p of imported) {
  const left = (p.index - 1) % columns * (cell + gutter) + gutter;
  const top = Math.floor((p.index - 1) / columns) * (cell + 30) + gutter;
  tiles.push({ input: await sharp(path.join(root, p.asset)).resize(cell, cell).toBuffer(), left, top });
  const svg = `<svg width="220" height="24"><text x="5" y="18" font-family="Microsoft YaHei" font-size="12" fill="#724b46">${String(p.index).padStart(2, '0')} ${p.title.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</text></svg>`;
  tiles.push({ input: Buffer.from(svg), left, top: top + cell });
}
await sharp({ create: { width: columns * (cell + gutter) + gutter, height: rows * (cell + 30) + gutter, channels: 3, background: '#fff8ef' } })
  .composite(tiles).jpeg({ quality: 90 }).toFile(path.join(root, 'temp/story-art-contact.jpg'));
console.log('Imported all chapter assets. Let Creator generate their metadata; no UUIDs are created by this script.');
