import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const root=path.resolve(import.meta.dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/expansion_art_sources.json'),'utf8'));
const outputs=[];
for(const row of manifest){
  if(!/^[a-z][a-z0-9_]*$/.test(row.id))throw Error('Invalid art id');
  const isSheet=row.id.endsWith('_sheet') || row.id==='orange_tree';
  const target=path.join(root,'assets/game_art',row.id+(isSheet?'.png':'.jpg'));
  const source=path.resolve(row.source);
  if(!source.toLowerCase().startsWith('c:\\users\\mr.wang\\.codex\\generated_images\\'))throw Error('Unexpected source folder');
  let img=sharp(source);
  if(isSheet)img=img.resize({width:row.id==='orange_tree'?384:row.id==='pool_furniture_sheet'?1536:1024,withoutEnlargement:true}).png({palette:true,quality:92,effort:10,dither:.4});
  else if(row.id.startsWith('story_'))img=img.resize(640,640,{fit:'cover'}).jpeg({quality:77,mozjpeg:true});
  else img=img.resize(720,1280,{fit:'cover'}).jpeg({quality:76,mozjpeg:true});
  await img.toFile(target);
  const m=await sharp(target).metadata();
  outputs.push({id:row.id,file:path.relative(root,target).replaceAll('\\','/'),bytes:fs.statSync(target).size,width:m.width,height:m.height,alpha:m.hasAlpha});
}
fs.writeFileSync(path.join(root,'docs/expansion_art_manifest.json'),JSON.stringify(outputs,null,2)+'\n');
console.log(JSON.stringify(outputs,null,2));
