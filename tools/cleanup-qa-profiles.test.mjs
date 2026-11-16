import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
const base=resolve('temp');mkdirSync(base,{recursive:true});
const script=resolve('tools/cleanup-qa-profiles.ps1');
function fixture(){
 const root=mkdtempSync(join(base,'cleanup-test-'));
 const files={'AGENTS.md':'test project','temp/cocos-ui-qa-old/browser-profile/Cache/temporary':'temporary cache','temp/cocos-ui-qa-old/result.json':'evidence','temp/unrelated/browser-profile/personal':'keep','assets/source.png':'source','releases/old.zip':'release'};
 for(const [name,value] of Object.entries(files)){const file=join(root,name);mkdirSync(resolve(file,'..'),{recursive:true});writeFileSync(file,value);}
 return root;
}
function run(root,apply=false){
 const report=join(root,'report.json');const result=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',script,'-ProjectRoot',root,'-ReportPath',report,...apply?['-Apply']:[]],{encoding:'utf8',windowsHide:true});
 assert.equal(result.status,0,result.stderr+result.stdout);return JSON.parse(readFileSync(report,'utf8').replace(/^\uFEFF/,''));
}
function dispose(root){const full=resolve(root);assert.ok(full.startsWith(base+sep)&&full.slice(base.length+1).startsWith('cleanup-test-'));rmSync(full,{recursive:true,force:true});}
test('QA cleanup defaults to report and removes only isolated browser profiles when applied',()=>{
 const root=fixture();try{
  const dry=run(root);assert.equal(dry.apply,false);assert.equal(dry.freedBytes,0);assert.equal(dry.profileCount,1);assert.ok(existsSync(join(root,'temp/cocos-ui-qa-old/browser-profile')));
  const done=run(root,true);assert.equal(done.deletedCount,1);assert.equal(done.freedBytes,15);assert.ok(!existsSync(join(root,'temp/cocos-ui-qa-old/browser-profile')));
  for(const file of ['temp/cocos-ui-qa-old/result.json','temp/unrelated/browser-profile/personal','assets/source.png','releases/old.zip'])assert.ok(existsSync(join(root,file)),file);
 }finally{dispose(root);}
});
test('QA cleanup keeps tracked browser profiles',()=>{
 const root=fixture();try{
  for(const args of [['init','--quiet'],['add','temp/cocos-ui-qa-old/browser-profile/Cache/temporary']])assert.equal(spawnSync('git',['-C',root,...args],{windowsHide:true}).status,0);
  const done=run(root,true);assert.equal(done.freedBytes,0);assert.equal(done.records[0].status,'tracked_skipped');assert.ok(existsSync(join(root,'temp/cocos-ui-qa-old/browser-profile')));
 }finally{dispose(root);}
});
test('QA cleanup refuses a root without project instructions',()=>{
 const root=fixture();try{
  rmSync(join(root,'AGENTS.md'));const result=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',script,'-ProjectRoot',root,'-Apply'],{encoding:'utf8',windowsHide:true});
  assert.notEqual(result.status,0);assert.ok(existsSync(join(root,'temp/cocos-ui-qa-old/browser-profile')));
 }finally{dispose(root);}
});
