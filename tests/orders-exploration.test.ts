import { describe, expect, it } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { loadConfigBundle, validateConfig } from '../assets/scripts/config/ConfigRepository';
import { createDefaultSaveData } from '../assets/scripts/infrastructure/SaveService';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';
import { generateOrder } from '../assets/scripts/core/order/orders';
import type { ActiveOrder } from '../assets/scripts/core/types';
function fixture() {
 const values=new Map<string,string>(), clock=new FakeClockService(1_000_000);
 const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};
 const open=()=>createGameContext({storage,clock,deterministic:true,saveDebounceMs:0}); return {values,clock,open};
}
describe('short orders and direct exploration',()=>{
 it('offers one or two items from early levels, with exactly 30% two-item orders',()=>{
  const b=loadConfigBundle();
  for(const level of [1,5,6,10,11,18]) {
   let two=0;
   for(let i=0;i<100;i++){
    const roll=(i+.5)/100;
    const order=generateOrder({player:{level,unlockedChainIds:['coffee','flower','dessert','gift','fruit']},templates:b.orders,catalog:b.catalog,recentOrderIds:[],minItemLevel:2,maxItemLevel:5,limitedChainIds:['fruit'],random:{next:()=>roll,pickIndex:(n)=>n-1},id:`${level}_${i}`})!;
    const count=order.requirements.reduce((sum,r)=>sum+r.count,0);expect(count).toBeGreaterThanOrEqual(1);expect(count).toBeLessThanOrEqual(2);
    expect(order.requirements.length).toBeLessThanOrEqual(2);if(count===2)two++;
    const cost=order.requirements.reduce((sum,r)=>sum+r.count*2**(b.catalog.get(r.itemId)!.level-1),0);
    expect(order.rewardCoins).toBe(Math.ceil(cost*(1.2+.6*(Math.min(18,level)-1)/17)));
   }
   expect(two).toBe(30);
  }
  expect(b.smallDates.every((date)=>date.requirements.reduce((sum,r)=>sum+r.count,0)<=2)).toBe(true);
  expect(validateConfig(b).filter((issue)=>issue.level==='error')).toEqual([]);
 });
 it('normalizes old oversized orders without changing UID, promised rewards or board assets across restart',()=>{
  const f=fixture(),b=loadConfigBundle(),data=createDefaultSaveData(b.game,f.clock.now());data.player.level=6;data.player.xp=750;
  const old:ActiveOrder={uid:'legacy_order',templateId:'legacy',requirements:[{itemId:'coffee_02',count:2},{itemId:'flower_02',count:1}],rewardCoins:70,rewardXp:20,rewardHearts:3};
  data.activeOrders[0]=old;data.board[0].item={uid:'keep_item',definitionId:'coffee_01'};data.player.coins=123;
  f.values.set(b.game.saveKey,JSON.stringify(data));const g=f.open(),current=g.orders.getOrders()[0];
  expect(current).toMatchObject({uid:'legacy_order',rewardCoins:70,rewardXp:20,rewardHearts:3,requirements:[{itemId:'coffee_02',count:2}]});
  expect(g.board.getBoard().cells[0].item?.uid).toBe('keep_item');expect(g.player.coins).toBe(123);expect(g.orders.getOrders()).toHaveLength(6);
  expect(f.open().orders.getOrders()[0]).toEqual(current);
 });
 it('preserves reachable low-level two-item orders and promised rewards across restart',()=>{
  const f=fixture(),b=loadConfigBundle(),data=createDefaultSaveData(b.game,f.clock.now());
  data.activeOrders[0]={uid:'old',templateId:'old',requirements:[{itemId:'coffee_02',count:2}],rewardCoins:32,rewardXp:14,rewardHearts:5};
  f.values.set(b.game.saveKey,JSON.stringify(data));const g=f.open();expect(g.orders.getOrders()[0]).toMatchObject({uid:'old',requirements:[{itemId:'coffee_02',count:2}],rewardCoins:32});
 });
 it('opens a later chapter at Lv1 and requires actual puzzle completion before claiming',()=>{
  const f=fixture(),g=f.open();g.debugClearBoard();
  const chapter=g.bundle.adventures.find((c)=>c.id==='love_letters')!;
  expect(g.play.progress('zhoushan').claimed).toBe(false);expect(g.play.isAvailable(chapter.id)).toBe(true);
  expect(g.play.progress(chapter.id).step).toBe(chapter.steps.length);expect(g.playAction('claim',chapter.id)).toEqual({ok:false,reason:'NOT_READY'});
  expect(chapter.puzzle.kind).toBe('sequence'); if(chapter.puzzle.kind!=='sequence')return;
  for(const tile of chapter.puzzle.solution)expect(g.puzzleAction(chapter.id,'select',tile).ok).toBe(true);
  expect(g.playAction('solve',chapter.id)).toEqual({ok:true});expect(g.playAction('claim',chapter.id)).toEqual({ok:true});
  expect(g.playAction('claim',chapter.id)).toEqual({ok:false,reason:'ALREADY_CLAIMED'});
  const h=f.open();expect(h.play.progress(chapter.id).claimed).toBe(true);expect(h.play.progress('zhoushan').claimed).toBe(false);
 });
 it('migrates an unfinished preparation step to the puzzle without inventing a solved reward',()=>{
  const f=fixture(),b=loadConfigBundle(),data=createDefaultSaveData(b.game,f.clock.now());
  data.player.coins=55;data.play.chapters.zhoushan={step:1,claimed:false,found:['calendar'],selected:[],rotations:[],code:'9',hints:1,outcome:'playing'};
  f.values.set(b.game.saveKey,JSON.stringify(data));const g=f.open();
  expect(g.play.progress('zhoushan')).toMatchObject({step:2,claimed:false,found:['calendar'],code:'9',hints:1,outcome:'playing'});
  expect(g.playAction('claim','zhoushan')).toEqual({ok:false,reason:'NOT_READY'});expect(g.player.coins).toBe(55);
  expect(g.puzzleAction('zhoushan','digit','0').ok).toBe(true);expect(f.open().play.progress('zhoushan').code).toBe('90');
 });
});
