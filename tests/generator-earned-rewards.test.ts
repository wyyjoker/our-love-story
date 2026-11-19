import { describe, expect, it } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { loadConfigBundle, validateConfig } from '../assets/scripts/config/ConfigRepository';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';

function fixture(){
  const values=new Map<string,string>(),clock=new FakeClockService(1_000_000);
  const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
  const open=()=>createGameContext({storage,clock,deterministic:true,saveDebounceMs:0});return{values,clock,open};
}
describe('earned physical producer gifts',()=>{
  it('grants a wish copy on the board once, retaining the same UID across restart',()=>{
    const f=fixture(),g=f.open();g.life.state.stats.merges=3;
    const before=g.player.coins;expect(g.claimWish('first_merges')).toEqual({ok:true});
    expect(g.player.coins).toBe(before+100);expect(g.getGeneratorStatus('coffee_machine')?.inventory[0]).toBe(2);
    const uids=g.board.getBoard().cells.filter(c=>c.item?.definitionId==='generator_coffee_machine_01').map(c=>c.item!.uid);
    expect(g.claimWish('first_merges')).toEqual({ok:false,reason:'ALREADY_CLAIMED'});
    const h=f.open();expect(h.board.getBoard().cells.filter(c=>c.item?.definitionId==='generator_coffee_machine_01').map(c=>c.item!.uid)).toEqual(uids);
    expect(h.generators.getBoardState().grantedSourceIds).toEqual(['wish_first_merges']);
  });
  it('keeps a full-board wish gift unclaimed without removing its normal rewards',()=>{
    const f=fixture(),g=f.open();g.debugClearBoard();g.life.state.stats.merges=3;
    for(const c of g.board.getBoard().cells)if(!c.locked&&!c.item)g.board.placeAt(c.index,'coffee_01');
    const coins=g.player.coins;expect(g.claimWish('first_merges').ok).toBe(true);expect(g.player.coins).toBe(coins+100);
    const reward=g.generators.getRewards()[0];expect(reward).toMatchObject({source:'wish_reward',generatorId:'coffee_machine',count:1});
    expect(g.claimGeneratorReward(reward.id)).toEqual({ok:false,reason:'BOARD_FULL'});
    const h=f.open();expect(h.generators.getRewards()).toEqual([reward]);h.board.getBoard().cells[0].item=undefined;
    expect(h.claimGeneratorReward(reward.id).ok).toBe(true);expect(f.open().generators.getRewards()).toEqual([]);
    expect(f.open().getGeneratorStatus('coffee_machine')?.inventory[0]).toBe(2);
  });
  it('grants a chapter gift once after solving or skipping, without an item hand-in',()=>{
    const f=fixture(),g=f.open();g.debugClearBoard();const coins=g.player.coins;
    expect(g.playAction('skip','zhoushan')).toEqual({ok:true});expect(g.playAction('claim','zhoushan')).toEqual({ok:true});
    expect(g.player.coins).toBe(coins+g.bundle.adventures[0].reward.coins);
    expect(g.getGeneratorStatus('coffee_machine')?.inventory[0]).toBe(2);
    expect(g.playAction('claim','zhoushan')).toEqual({ok:false,reason:'ALREADY_CLAIMED'});
    expect(f.open().generators.getBoardState().grantedSourceIds).toEqual(['chapter_zhoushan']);
    expect(f.open().getGeneratorStatus('coffee_machine')?.inventory[0]).toBe(2);
  });
  it('backfills previously claimed content exactly once and does not repay old currency',()=>{
    const f=fixture(),g=f.open();g.playAction('skip','zhoushan');const save=g.buildSaveData();
    save.play.chapters.zhoushan.claimed=true;save.life.claimedWishIds=['first_merges'];save.player.coins=73;
    delete save.generatorBoard!.grantedSourceIds;f.values.set(g.config.saveKey,JSON.stringify(save));
    const h=f.open();expect(h.getGeneratorStatus('coffee_machine')?.inventory[0]).toBe(3);expect(h.player.coins).toBe(73);
    const snapshot=h.buildSaveData();snapshot.generatorBoard!.grantedSourceIds!.push('mutated');
    expect(h.generators.getBoardState().grantedSourceIds).toEqual(['wish_first_merges','chapter_zhoushan']);
    expect(f.open().getGeneratorStatus('coffee_machine')?.inventory[0]).toBe(3);expect(f.open().player.coins).toBe(73);
  });
  it('reserves the source receipt before placement events and preserves batch rights on a small board',()=>{
    const f=fixture(),g=f.open(),gift={generatorId:'coffee_machine',level:1,count:8};let nested:boolean|undefined;
    g.bus.on('ITEM_SPAWNED',()=>{nested=g.generators.grantEarned('wish_test',gift,'wish_reward');});
    expect(g.generators.grantEarned('wish_test',gift,'wish_reward')).toBe(true);expect(nested).toBe(false);
    expect(g.getGeneratorStatus('coffee_machine')!.inventory[0]+g.generators.getRewards().reduce((sum,r)=>sum+r.count,0)).toBe(9);
    g.save();expect(f.open().generators.grantEarned('wish_test',gift,'wish_reward')).toBe(false);
  });
  it('rejects unknown, excessive and invalid tier configuration',()=>{
    const bundle=loadConfigBundle();expect(validateConfig(bundle).filter(x=>x.level==='error')).toEqual([]);
    for(const gift of [{generatorId:'unknown',level:1,count:1},{generatorId:'coffee_machine',level:10,count:1},{generatorId:'coffee_machine',level:1,count:9}]){
      const wishes=bundle.wishes.map((wish,index)=>index===0?{...wish,generatorReward:gift}:wish);
      expect(validateConfig({...bundle,wishes}).some(issue=>issue.level==='error'&&issue.message.includes('Wish'))).toBe(true);
      const adventures=bundle.adventures.map((chapter,index)=>index===0?{...chapter,reward:{...chapter.reward,generator:gift}}:chapter);
      expect(validateConfig({...bundle,adventures}).some(issue=>issue.level==='error'&&issue.message.includes('Adventure'))).toBe(true);
    }
  });
});
