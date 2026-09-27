import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import sharp from 'sharp';

if (!process.argv[2]) throw new Error('Usage: node tools/optimize-art.mjs <original-png-directory> [output-directory]');
const sourceDir = resolve(process.argv[2]);
const outputDir = resolve(process.argv[3] ?? 'temp/art-optimized');
if (!existsSync(sourceDir) || sourceDir === outputDir) {
  throw new Error('Provide an existing source directory and a different output directory.');
}
mkdirSync(outputDir, { recursive: true });

let originalBytes = 0;
let optimizedBytes = 0;
for (const file of readdirSync(sourceDir).filter((name) => name.endsWith('.png'))) {
  const source = join(sourceDir, file);
  const metadata = await sharp(source).metadata();
  const target = join(outputDir, `${basename(file, '.png')}.${metadata.hasAlpha ? 'png' : 'jpg'}`);
  if (metadata.hasAlpha) {
    await sharp(source).png({ palette: true, quality: 90, effort: 8 }).toFile(target);
  } else {
    await sharp(source).jpeg({ quality: 85, mozjpeg: true }).toFile(target);
  }
  const before = statSync(source).size;
  const after = statSync(target).size;
  originalBytes += before;
  optimizedBytes += after;
  console.log(`${file} -> ${basename(target)}: ${before} -> ${after} bytes`);
}
console.log(`Total: ${originalBytes} -> ${optimizedBytes} bytes (${Math.round(100 * (1 - optimizedBytes / originalBytes))}% smaller)`);
