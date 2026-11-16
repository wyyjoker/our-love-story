import { describe, expect, it } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { createDefaultSaveData } from '../assets/scripts/infrastructure/SaveService';
import { loadConfigBundle, validateConfig } from '../assets/scripts/config/ConfigRepository';
import { FixedRandomService } from '../assets/scripts/infrastructure/RandomService';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';
import { MergeEngine } from '../assets/scripts/core/merge/mergeEngine';

const chestId = (level: number) => level === 1 ? 'treasure_chest' : `treasure_chest_0${level}`;
function fixture(roll=0) {
  const values=new Map<string,string>(),clock=new FakeClockService(1_000_000);
  const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
  const open=()=>createGameContext({storage,clock,random:new FixedRandomService([roll]),deterministic:true,saveDebounceMs:0});
  return {values,clock,open};
}
describe('mergeable treasure chests', () => {
  it('merges each matching level without free discovery coins or recursive chest drops', () => {
    const f=fixture(0), g=f.open(); let discoveryEvents=0; g.bus.on('DISCOVERY_CHANGED',()=>{discoveryEvents++;});
    for(let level=1;level<5;level++) {
      g.debugClearBoard();const beforeCoins=g.player.coins, beforeInbox=g.rewardInbox.length;
      g.board.placeAt(0,chestId(level));g.board.placeAt(1,chestId(level));
      expect(g.dropItem(0,1)).toMatchObject({ok:true,kind:'MERGE',resultDefinitionId:chestId(level+1)});
      expect(g.isItemDiscovered(chestId(level+1))).toBe(true);expect(g.player.coins).toBe(beforeCoins);
      expect(g.rewardInbox).toHaveLength(beforeInbox);expect(g.board.getBoard().cells.filter((cell)=>cell.item)).toHaveLength(1);
    }
    expect(discoveryEvents).toBe(0);
    g.debugClearBoard();g.board.placeAt(0,chestId(5));g.board.placeAt(1,chestId(5));
    expect(g.dropItem(0,1)).toMatchObject({ok:true,kind:'SWAP'});expect(g.board.getBoard().cells.filter((cell)=>cell.item)).toHaveLength(2);
    const engine=new MergeEngine(g.bundle.catalog);
    for(let level=1;level<=5;level++) expect(engine.canMerge({uid:'wild',definitionId:'wildcard'},{uid:'chest',definitionId:chestId(level)})).toBe(false);
  });
  it.each([[1,2],[2,4],[3,8],[4,16],[5,32]])('opens level %i into %i items, with unique UIDs and safe overflow', (level,count) => {
    const f=fixture(),g=f.open();g.debugClearBoard();const chest=g.board.placeAt(0,chestId(level))!;const wallet={coins:g.player.coins,energy:g.player.energy,diamonds:g.player.diamonds};
    const result=g.useBoardItem(0,chest.uid);expect(result.ok).toBe(true);if(!result.ok)return;
    expect(result.loot).toHaveLength(count);expect(new Set(result.loot!.map((entry)=>entry.uid)).size).toBe(count);
    for(const entry of result.loot!) {
      expect(['coin','energy','diamond']).toContain(g.bundle.catalog.get(entry.definitionId)?.chainId);
      if(entry.cellIndex===null) expect(g.rewardInbox.some((item)=>item.uid===entry.uid)).toBe(true);
      else expect(g.board.getBoard().cells[entry.cellIndex].item?.uid).toBe(entry.uid);
    }
    expect(result.loot!.filter((entry)=>entry.cellIndex===null)).toHaveLength(Math.max(0,count-9));
    expect({coins:g.player.coins,energy:g.player.energy,diamonds:g.player.diamonds}).toEqual(wallet);
    expect(g.useBoardItem(0,chest.uid)).toEqual({ok:false,reason:'INVALID'});
    const restored=f.open(); expect(restored.rewardInbox).toHaveLength(Math.max(0,count-9));
    const recovered=[...restored.board.getBoard().cells.flatMap((cell)=>cell.item?[cell.item.uid]:[]),...restored.rewardInbox.map((item)=>item.uid)];
    expect(new Set(recovered)).toEqual(new Set(result.loot!.map((entry)=>entry.uid)));
  });
  it('keeps the original first-tier distribution while high-tier tables offer stronger items', () => {
    const low=fixture(.999).open();low.debugClearBoard();low.board.placeAt(0,chestId(1));const lowResult=low.useBoardItem(0);
    expect(lowResult.ok&&lowResult.loot?.every((i)=>i.definitionId==='diamond_01')).toBe(true);
    const high=fixture(.999).open();high.debugClearBoard();high.board.placeAt(0,chestId(5));const highResult=high.useBoardItem(0);
    expect(highResult.ok&&highResult.loot?.every((i)=>i.definitionId==='diamond_03')).toBe(true);
  });
  it('splits a level 2 chest into two level 1 chests without awarding anything', () => {
    const g=fixture().open();g.debugClearBoard();g.board.placeAt(0,chestId(2));const before={coins:g.player.coins,scissors:g.play.state.scissors};
    expect(g.playAction('split','0')).toEqual({ok:true});
    expect(g.board.getBoard().cells.flatMap((cell)=>cell.item?[cell.item.definitionId]:[])).toEqual([chestId(1),chestId(1)]);
    expect(g.play.state.scissors).toBe(before.scissors-1);expect(g.player.coins).toBe(before.coins);expect(g.rewardInbox).toHaveLength(0);
  });
  it('keeps old level 1 chest UIDs on board, warehouse and inbox without a save version change', () => {
    const f=fixture(),b=loadConfigBundle(),old=createDefaultSaveData(b.game,f.clock.now());
    const version=old.version;old.board[0].item={uid:'old_board',definitionId:chestId(1)};
    old.play.warehouse=[{uid:'old_storage',definitionId:chestId(1)}];old.rewardInbox=[{uid:'old_inbox',definitionId:chestId(1)}];
    f.values.set(b.game.saveKey,JSON.stringify(old));const g=f.open();expect(g.buildSaveData().version).toBe(version);
    expect(g.board.getBoard().cells[0].item?.uid).toBe('old_board');expect(g.play.state.warehouse[0].uid).toBe('old_storage');expect(g.rewardInbox[0].uid).toBe('old_inbox');
    expect(g.playAction('withdraw','old_storage')).toEqual({ok:true});expect(g.claimInboxItem('old_inbox')).toEqual({ok:true});
    const result=g.useBoardItem(0,'old_board');expect(result.ok&&result.loot?.length).toBe(2);
    const reloaded=f.open(),ids=reloaded.board.getBoard().cells.flatMap((cell)=>cell.item?[cell.item.uid]:[]);
    expect(ids).toContain('old_storage');expect(ids).toContain('old_inbox');
  });
  it('rejects invalid chest chains and recursive loot in configuration', () => {
    const base=loadConfigBundle();
    const brokenLevels=structuredClone(base.game);brokenLevels.rewards.chestLevels[4].loot=[{itemId:'treasure_chest',weight:1}];
    expect(validateConfig({...base,game:brokenLevels}).some((issue)=>issue.level==='error'&&issue.message.includes('Treasure chest rewards'))).toBe(true);
    const brokenCount=structuredClone(base.game);brokenCount.rewards.chestLevels[4].count=33;
    expect(validateConfig({...base,game:brokenCount}).some((issue)=>issue.level==='error'&&issue.message.includes('Treasure chest rewards'))).toBe(true);
    const invalidItems=base.items.map((item)=>item.id===chestId(5)?{...item,maxLevel:false}:item);
    expect(validateConfig({...base,items:invalidItems}).some((issue)=>issue.level==='error'&&issue.message.includes('Treasure chest chain'))).toBe(true);
  });
});
