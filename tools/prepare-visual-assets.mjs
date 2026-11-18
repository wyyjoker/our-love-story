import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'docs/visuals/2026_11_17_watercolor/production_sources');
const manifest=JSON.parse(await fs.readFile(path.join(source,'manifest.json'),'utf8'));
const result=[];
for(const entry of manifest.assets) {
  if(!/^[a-z0-9_]+\.png$/.test(entry.file)||!/^[a-z0-9_]+\.(png|jpg)$/.test(entry.asset))throw Error('Invalid asset filename');
  const input=path.join(source,entry.file),output=path.join(root,'assets/game_art',entry.asset);
  const original=await sharp(input).metadata();
  if(entry.transparent!==false&&!original.hasAlpha)throw Error(`Transparent production sprite expected: ${entry.file}`);
  const pipeline=sharp(input).resize(entry.width,entry.height,{fit:'inside',withoutEnlargement:true});
  if(entry.asset.endsWith('.jpg'))await pipeline.jpeg({quality:88,mozjpeg:true}).toFile(output);
  else await pipeline.png({compressionLevel:9,palette:entry.palette,colours:256,quality:90,dither:.35}).toFile(output);
  const compressed=await sharp(output).metadata(),stat=await fs.stat(output);
  if(entry.transparent!==false&&!compressed.hasAlpha)throw Error(`Transparency lost: ${entry.asset}`);
  result.push({file:entry.asset,width:compressed.width,height:compressed.height,bytes:stat.size});
}
console.log(JSON.stringify({assets:result,totalBytes:result.reduce((sum,asset)=>sum+asset.bytes,0)},null,2));
