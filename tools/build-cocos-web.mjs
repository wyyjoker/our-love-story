import {spawnSync} from 'node:child_process';
import {closeSync,existsSync,mkdirSync,openSync,readFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {applyStartupBranding} from './startup-branding.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
try {
  const {values}=parseArgs({options:{creator:{type:'string'}}});
  const creator=values.creator??process.env.COCOS_CREATOR??'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe';
  if(!existsSync(creator))throw Error('找不到 Creator 3.8.8，请通过 --creator 指定。');
  mkdirSync(join(root,'temp'),{recursive:true});
  const logPath=join(root,'temp/cocos-web-build.log');
  const log=openSync(logPath,'w');
  const started=Date.now();
  const env={...process.env}; delete env.ELECTRON_RUN_AS_NODE;
  let result;
  try {result=spawnSync(creator,['--project',root,'--build','platform=web-mobile;debug=false'],
    {cwd:root,windowsHide:true,stdio:['ignore',log,log],timeout:300000,env});}
  finally {closeSync(log);}
  console.log(readFileSync(logPath,'utf8').split(/\r?\n/).slice(-12).join('\n'));
  if(result.error)throw result.error;
  if(![0,36].includes(result.status))throw Error(`Creator 构建失败，退出码 ${result.status}`);
  const branding=await applyStartupBranding(root,join(root,'build/web-mobile'),'web-mobile',{notBefore:started});
  console.log(`Web Mobile 构建成功（Creator ${result.status}），小屋启动图 ${branding.imageBytes} 字节。`);
  console.log(`日志：${logPath}；尚未运行界面验收。`);
} catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
