import { describe, expect, it } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { FixedRandomService } from '../assets/scripts/infrastructure/RandomService';
import { createDefaultSaveData } from '../assets/scripts/infrastructure/SaveService';
import { loadConfigBundle } from '../assets/scripts/config/ConfigRepository';
function fixture(roll=0) {
 const values=new Map<string,string>(); const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};
 const open=()=>createGameContext({storage,deterministic:true,random:new FixedRandomService([roll]),saveDebounceMs:0}); return {values,open};
}
describe('discovery requires acquisition or real merge', () => {
 it('starts with only owned starter base known; generated level 1 stays known after consuming and restart without merge reward', () => {
  const f=fixture(),g=f.open();
  expect(g.isItemDiscovered('coffee_01')).toBe(true);
  for(const id of ['flower_01','fruit_01','sugar_01']) expect(g.isItemDiscovered(id)).toBe(false);
  g.debugAddXp(50);g.debugClearBoard();let fakeRewards=0;g.bus.on('DISCOVERY_CHANGED',()=>{fakeRewards++;}); const coins=g.player.coins;
  expect(g.spawnFromGenerator('orange_tree').ok).toBe(true); expect(g.isItemDiscovered('fruit_01')).toBe(true);
  expect(fakeRewards).toBe(0);expect(g.player.coins).toBe(coins);
  g.debugClearBoard();expect(f.open().isItemDiscovered('fruit_01')).toBe(true);
 });
 it('does not reveal higher tiers merely generated or loaded', () => {
  const f=fixture(0.99),g=f.open();g.debugAddXp(150);g.debugClearBoard();
  expect(g.spawnFromGenerator('flower_basket')).toMatchObject({ok:true,itemDefinitionId:'flower_03'});
  expect(g.isItemDiscovered('flower_03')).toBe(false); expect(g.isItemDiscovered('flower_02')).toBe(false); expect(g.isItemDiscovered('flower_01')).toBe(false);
  expect(f.open().isItemDiscovered('flower_03')).toBe(false);
 });
 it('records base items from loot, inbox bonus and split without pretending they were merged', () => {
  const f=fixture(),g=f.open();g.debugClearBoard();let rewards=0;g.bus.on('DISCOVERY_CHANGED',()=>{rewards++;});
  g.board.placeAt(0,'treasure_chest'); expect(g.useBoardItem(0).ok).toBe(true);
  expect(g.isItemDiscovered('coin_01')).toBe(true);expect(rewards).toBe(0);
  g.debugClearBoard();g.board.placeAt(0,'sugar_02');expect(g.isItemDiscovered('sugar_01')).toBe(false);
  expect(g.playAction('split','0').ok).toBe(true);expect(g.isItemDiscovered('sugar_01')).toBe(true);expect(g.isItemDiscovered('sugar_02')).toBe(false);expect(rewards).toBe(0);
  const h=fixture().open();h.debugAddXp(50);h.claimLevelReward(2);h.mergeGenerators('coffee_machine',1);h.debugClearBoard();
  for(const cell of h.board.getBoard().cells) if(!cell.locked&&cell.index!==0) h.board.placeAt(cell.index,'coffee_01');
  expect(h.isItemDiscovered('wildcard')).toBe(false);expect(h.spawnFromGenerator('coffee_machine').ok).toBe(true);
  expect(h.rewardInbox.some((i)=>i.definitionId==='wildcard')).toBe(true);expect(h.isItemDiscovered('wildcard')).toBe(true);
 });
 it('retains old held and recorded discoveries without awarding coins', () => {
  const f=fixture(), b=loadConfigBundle(),old=createDefaultSaveData(b.game,0);old.version=5;
  old.board=Array.from({length:81},(_,index)=>({index,item:index===0?{uid:'old',definitionId:'flower_02'}:undefined}));
  old.play.warehouse=[{uid:'old_base',definitionId:'fruit_01'}];old.rewardInbox=[{uid:'old_inbox',definitionId:'sugar_01'}];old.player.coins=33;
  f.values.set(b.game.saveKey,JSON.stringify(old)); const g=f.open();
  for(const id of ['flower_02','fruit_01','sugar_01'])expect(g.isItemDiscovered(id)).toBe(true);
  expect(g.player.coins).toBe(33);expect(f.open().player.coins).toBe(33);
 });
});
