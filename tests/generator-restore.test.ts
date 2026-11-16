import { describe, expect, it } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';
function fixture(){const data=new Map<string,string>(),clock=new FakeClockService(1_000_000);const storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);},removeItem:(k:string)=>{data.delete(k);}};const open=()=>createGameContext({storage,clock,deterministic:true,saveDebounceMs:0});return{open,clock};}
function exhaust(g:ReturnType<ReturnType<typeof fixture>['open']>,id:string,n:number){g.debugClearBoard();for(let i=0;i<n;i++){expect(g.spawnFromGenerator(id).ok).toBe(true);g.debugClearBoard();}}
describe('diamond generator restore',()=>{
 it('restores an exhausted normal generator exactly once, with synchronous reentry guarded',()=>{
  const f=fixture(),g=f.open();g.debugAddEnergy(200);exhaust(g,'coffee_machine',60);g.player.diamonds=4;
  expect(g.getGeneratorRestoreQuote('coffee_machine')).toMatchObject({ok:true,kind:'cooldown',cost:2,restoredUses:60});
  let nested:unknown;g.bus.on('GENERATOR_CHANGED',()=>{nested=g.restoreGenerator('coffee_machine');});
  expect(g.restoreGenerator('coffee_machine')).toMatchObject({ok:true,cost:2});expect(nested).toEqual({ok:false,reason:'IN_PROGRESS'});
  expect(g.player.diamonds).toBe(2);expect(g.getGeneratorStatus('coffee_machine')).toMatchObject({streak:0,remainingCooldownMs:0});
  expect(g.restoreGenerator('coffee_machine')).toEqual({ok:false,reason:'NOT_NEEDED'});expect(f.open().player.diamonds).toBe(2);
 });
 it('fills an empty tree for five diamonds, and leaves insufficient-balance state untouched',()=>{
  const f=fixture(),g=f.open();g.debugAddXp(50);exhaust(g,'orange_tree',10);const before=g.getGeneratorStatus('orange_tree');g.player.diamonds=4;
  expect(g.restoreGenerator('orange_tree')).toEqual({ok:false,reason:'NOT_ENOUGH_DIAMONDS'});expect(g.getGeneratorStatus('orange_tree')).toEqual(before);expect(g.player.diamonds).toBe(4);
  g.player.diamonds=5;expect(g.restoreGenerator('orange_tree')).toMatchObject({ok:true,kind:'charges',cost:5,restoredUses:10});
  expect(g.getGeneratorStatus('orange_tree')).toMatchObject({charges:10,nextRecoveryMs:null});expect(g.player.diamonds).toBe(0);
  expect(f.open().getGeneratorStatus('orange_tree')?.charges).toBe(10);
 });
 it('rechecks normal cooldown or naturally recovered tree after quote before charging',()=>{
  const f=fixture(),g=f.open();g.debugAddXp(50);g.debugAddEnergy(200);g.player.diamonds=20;
  exhaust(g,'coffee_machine',60);expect(g.getGeneratorRestoreQuote('coffee_machine').ok).toBe(true);f.clock.advance(g.getGeneratorStatus('coffee_machine')!.remainingCooldownMs);
  expect(g.restoreGenerator('coffee_machine')).toEqual({ok:false,reason:'NOT_NEEDED'});expect(g.player.diamonds).toBe(20);
  exhaust(g,'orange_tree',10);expect(g.getGeneratorRestoreQuote('orange_tree').ok).toBe(true);f.clock.advance(g.getGeneratorStatus('orange_tree')!.nextRecoveryMs!);
  expect(g.restoreGenerator('orange_tree')).toEqual({ok:false,reason:'NOT_NEEDED'});expect(g.player.diamonds).toBe(20);
 });
 it('rejects invalid, locked and not-exhausted generators without changing state',()=>{
  const g=fixture().open();g.player.diamonds=20;const before=g.buildSaveData();
  expect(g.restoreGenerator('missing')).toEqual({ok:false,reason:'NOT_FOUND'});
  expect(g.restoreGenerator('orange_tree')).toEqual({ok:false,reason:'LOCKED'});
  expect(g.restoreGenerator('coffee_machine')).toEqual({ok:false,reason:'NOT_NEEDED'});expect(g.buildSaveData()).toEqual(before);
 });
});
