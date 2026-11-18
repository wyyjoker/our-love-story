import { describe, expect, it } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';
import { loadConfigBundle } from '../assets/scripts/config/ConfigRepository';
import { createDefaultSaveData } from '../assets/scripts/infrastructure/SaveService';

function fixture() {
  const clock = new FakeClockService(1_000_000), values = new Map<string,string>(), bundle = loadConfigBundle();
  const storage = {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
  const open = () => createGameContext({storage,clock,deterministic:true,saveDebounceMs:0});
  return {clock,values,bundle,open};
}
describe('one-time first-use guides', () => {
  it('keeps basic onboarding ahead of optional tools and waits until space is useful', () => {
    const g=fixture().open();g.debugClearBoard();g.debugSpawn('treasure_chest');expect(g.getFirstUseGuide()).toBeUndefined();
    g.tutorial.firstOrderCompleted=true;expect(g.getFirstUseGuide()).toMatchObject({hint:'chest',sourceIndex:0});
    g.debugClearBoard();for(let i=0;i<4;i++)g.debugSpawn('coffee_01');expect(g.getFirstUseGuide()).toBeUndefined();
    g.debugSpawn('coffee_01');expect(g.getFirstUseGuide()).toMatchObject({hint:'backpack'});
  });
  it('completes backpack on a successful store, persists, and does not mark a failed store', () => {
    const f=fixture(),g=f.open();g.tutorial.firstOrderCompleted=true;g.debugClearBoard();for(let i=0;i<6;i++)g.debugSpawn('coffee_01');
    expect(g.playAction('store','40').ok).toBe(false);expect(g.tutorial.firstUseHints).toBeUndefined();
    expect(g.playAction('store','0').ok).toBe(true);expect(g.getFirstUseGuide()).toBeUndefined();
    expect(f.open().tutorial.firstUseHints).toEqual(['backpack']);
  });
  it('completes scissors only after an actual split, without spending an extra charge', () => {
    const f=fixture(),g=f.open();g.tutorial.firstOrderCompleted=true;g.debugClearBoard();g.board.placeAt(0,'scissors_02');g.board.placeAt(1,'coffee_02');
    expect(g.getFirstUseGuide()).toEqual({hint:'scissors',sourceIndex:0,targetIndex:1});
    expect(g.dropItem(0,0).ok).toBe(false);expect(g.tutorial.firstUseHints).toBeUndefined();
    expect(g.dropItem(0,1)).toMatchObject({ok:true,kind:'SPLIT'});expect(g.board.getBoard().cells[0].item?.remainingUses).toBe(2);
    expect(f.open().tutorial.firstUseHints).toEqual(['scissors']);expect(g.getFirstUseGuide()).toBeUndefined();
  });
  it('guides inbox chests and marks opening rather than claiming or moving', () => {
    const f=fixture(),g=f.open();g.tutorial.firstOrderCompleted=true;g.debugClearBoard();g.debugAddXp(50);g.claimLevelReward(2);
    expect(g.getFirstUseGuide()).toEqual({hint:'chest'});expect(g.claimInboxItem(g.rewardInbox[0].uid).ok).toBe(true);
    expect(g.tutorial.firstUseHints).toBeUndefined();expect(g.getFirstUseGuide()).toMatchObject({hint:'chest',sourceIndex:0});
    expect(g.useBoardItem(0).ok).toBe(true);expect(g.getFirstUseGuide()).toBeUndefined();expect(f.open().tutorial.firstUseHints).toEqual(['chest']);
  });
  it('dismisses once across restart without granting rewards or changing inventory', () => {
    const f=fixture(),g=f.open();const before=g.buildSaveData();expect(g.acknowledgeFirstUseHint('backpack')).toEqual({ok:true});
    expect(g.acknowledgeFirstUseHint('backpack')).toEqual({ok:false,reason:'ALREADY_ACKNOWLEDGED'});
    expect(g.buildSaveData().board).toEqual(before.board);expect(g.player).toEqual(before.player);expect(f.open().tutorial.firstUseHints).toEqual(['backpack']);
  });
  it('loads v8 optional flags safely and discards unknown or malformed entries', () => {
    const f=fixture(),save=createDefaultSaveData(f.bundle.game,f.clock.now());
    Object.assign(save.tutorial,{firstUseHints:['backpack','backpack',null,'not-a-guide']});f.values.set(f.bundle.game.saveKey,JSON.stringify(save));
    expect(f.open().tutorial.firstUseHints).toEqual(['backpack']);
  });
});
