import { describe, expect, it } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';
import { loadConfigBundle } from '../assets/scripts/config/ConfigRepository';
import { createDefaultSaveData } from '../assets/scripts/infrastructure/SaveService';

function fixture() {
 const values=new Map<string,string>(),clock=new FakeClockService(1_000_000);
 const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};
 const open=()=>createGameContext({storage,clock,deterministic:true,saveDebounceMs:0});return {values,open,clock};
}
describe('6 by 7 board and v7 migration',()=>{
 it('starts with exactly the upper-left 3 by 3 and opens all 42 at level 10',()=>{
  const g=fixture().open(),board=g.board.getBoard();
  expect([board.columns,board.rows,board.cells.length]).toEqual([6,7,42]);
  expect(board.cells.filter((c)=>!c.locked).map((c)=>c.index)).toEqual([0,1,2,6,7,8,12,13,14]);
  expect(g.board.getLockedUnlockLevel(41)).toBe(10);
  expect(g.board.placeAt(3,'coffee_01')).toBeNull(); expect(g.dropItem(0,3).ok).toBe(false);
  g.debugAddXp(2250); expect(g.player.level).toBe(10); expect(g.board.getBoard().cells.every((c)=>!c.locked)).toBe(true);
 });
 it('prevents swap, merge, split and withdraw into locked cells',()=>{
  const g=fixture().open();g.debugClearBoard();g.board.placeAt(0,'coffee_02');
  const hidden=g.board.getBoard().cells[3]; hidden.item={uid:'hidden',definitionId:'coffee_02'};
  expect(g.board.previewDrop(0,3)).toEqual({kind:'CANCEL'});expect(g.dropItem(0,3).ok).toBe(false);
  hidden.item.definitionId='flower_01';expect(g.board.previewDrop(0,3)).toEqual({kind:'CANCEL'});
  hidden.item.definitionId='coffee_02'; expect(g.playAction('split','3').ok).toBe(false); hidden.item=undefined;
  expect(g.playAction('store','0').ok).toBe(true);const stored=g.play.state.warehouse[0];
  for(const cell of g.board.getBoard().cells) if(!cell.locked&&!cell.item)g.board.placeAt(cell.index,'coffee_01');
  const beforeEnergy=g.player.energy;
  expect(g.spawnFromGenerator('coffee_machine')).toEqual({ok:false,reason:'BOARD_FULL'});
  expect(g.player.energy).toBe(beforeEnergy);
  expect(g.playAction('withdraw',stored.uid)).toEqual({ok:false,reason:'BOARD_FULL'});expect(g.play.state.warehouse[0].uid).toBe(stored.uid);
 });
 it('conserves a v6 48-cell save, opens only occupied outlying cells and preserves custom positions',()=>{
  const f=fixture(),b=loadConfigBundle(),old=createDefaultSaveData(b.game,f.clock.now());
  old.version=6;old.legacyBoardEntitlement=true;old.board=Array.from({length:48},(_,index)=>({index}));
  for(const index of [0,3,40,42,47])old.board[index].item={uid:`old_${index}`,definitionId:'coffee_03'};
  old.rewardInbox=[{uid:'old_inbox',definitionId:'flower_03'}];old.player.coins=91;old.player.energy=72;
  old.discoveredItemIds=['gift_07'];
  old.life.unlockedMemoryIds=['letters'];old.life.photoPaths=['wxfile://retained'];
  old.life.furniturePositions={sofa:{x:0.2,y:0.4,scale:1.2,rotation:45,flipped:true}};
  const raw=JSON.stringify(old);f.values.set(b.game.saveKey,raw);const g=f.open();
  expect(f.values.get(`${b.game.saveKey}:backup`)).toBe(raw);expect(g.board.getBoard().cells).toHaveLength(42);
  const ids=[...g.board.getBoard().cells.flatMap((cell)=>cell.item?[cell.item.uid]:[]),...g.rewardInbox.map((item)=>item.uid)];
  expect(ids.sort()).toEqual(['old_0','old_3','old_40','old_42','old_47','old_inbox'].sort());
  expect(g.board.getBoard().cells[3].locked).toBe(false);expect(g.board.getBoard().cells[40].locked).toBe(false);
  expect(g.board.getBoard().cells[4].locked).toBe(true);expect(g.board.getBoard().cells[41].locked).toBe(true);
  expect(g.life.state.furniturePositions.sofa).toEqual(old.life.furniturePositions.sofa);
  expect(g.life.state.photoPaths).toEqual(old.life.photoPaths);expect(g.player).toMatchObject({coins:91,energy:72});
  expect(g.isItemDiscovered('gift_07')).toBe(true);
  expect(g.dropItem(3,1).ok).toBe(true); const saved=f.open();
  expect(saved.board.getBoard().cells[3].locked).toBe(false);expect(saved.board.getBoard().cells[4].locked).toBe(true);
  expect(saved.buildSaveData().retainedOpenCellIndices).toContain(3);
 });
 it('does not retain empty legacy cells as permanently open',()=>{
  const f=fixture(),b=loadConfigBundle(),old=createDefaultSaveData(b.game,f.clock.now());
  old.version=6;old.legacyBoardEntitlement=true;old.board=Array.from({length:48},(_,index)=>({index}));
  f.values.set(b.game.saveKey,JSON.stringify(old));const g=f.open();
  expect(g.board.getBoard().cells.filter((cell)=>!cell.locked)).toHaveLength(9);
  expect(g.buildSaveData().retainedOpenCellIndices).toEqual([]);
 });
});
