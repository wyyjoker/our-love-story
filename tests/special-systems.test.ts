import { describe, expect, it } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';
import { FixedRandomService } from '../assets/scripts/infrastructure/RandomService';
import { loadConfigBundle } from '../assets/scripts/config/ConfigRepository';
import { createDefaultSaveData } from '../assets/scripts/infrastructure/SaveService';
import { MergeEngine } from '../assets/scripts/core/merge/mergeEngine';
function fixture(roll = 0.5) {
  const values = new Map<string,string>(), clock = new FakeClockService(1_000_000);
  const storage = { getItem:(k:string)=>values.get(k)??null, setItem:(k:string,v:string)=>{values.set(k,v);}, removeItem:(k:string)=>{values.delete(k);} };
  const open=()=>createGameContext({storage,clock,random:new FixedRandomService([roll]),deterministic:true,saveDebounceMs:0});
  return { values,clock,open };
}
function upgraded(g: ReturnType<ReturnType<typeof fixture>['open']>, id='coffee_machine') {
  g.debugAddXp(50);
  if (id==='coffee_machine') g.claimLevelReward(2); else g.generators.grantLevelReward(2,[id]);
  expect(g.mergeGenerators(id,1).ok).toBe(true); g.debugClearBoard();
}
describe('collection, cooldown and special items', () => {
  it('sells one exact board item for its configured price and preserves the change after restart', () => {
    const f = fixture(), g = f.open();
    g.debugClearBoard();
    for (const cell of g.board.getBoard().cells) if (!cell.locked && !cell.item) g.board.placeAt(cell.index, 'coffee_12');
    const selected = g.board.getBoard().cells[0].item!;
    const untouched = g.board.getBoard().cells[1].item!;
    const before = { coins: g.player.coins, xp: g.player.xp, energy: g.player.energy };
    const price = g.bundle.catalog.get(selected.definitionId)!.sellValue!;
    expect(g.board.isFull()).toBe(true);
    expect(g.quoteBoardItemSale(0, selected.uid)).toMatchObject({ ok: true, index: 0, uid: selected.uid, coins: price });
    expect(g.player).toMatchObject(before);
    expect(g.sellBoardItem(0, untouched.uid)).toEqual({ ok: false, reason: 'ITEM_CHANGED' });
    expect(g.sellBoardItem(0, selected.uid)).toMatchObject({ ok: true, coins: price });
    expect(g.sellBoardItem(0, selected.uid)).toEqual({ ok: false, reason: 'ITEM_CHANGED' });
    expect(g.board.isFull()).toBe(false);
    const h = f.open();
    expect(h.player).toMatchObject({ ...before, coins: before.coins + price });
    expect(h.board.getBoard().cells[0].item).toBeUndefined();
    expect(h.board.getBoard().cells[1].item).toEqual(untouched);
    const machine = h.board.getBoard().cells.find(c => c.item?.generatorState)!;
    expect(h.sellBoardItem(machine.index, machine.item!.uid)).toEqual({ ok: false, reason: 'NOT_FOR_SALE' });
    const chest = h.board.placeAt(0, 'treasure_chest')!;
    expect(h.sellBoardItem(0, chest.uid)).toEqual({ ok: false, reason: 'NOT_FOR_SALE' });
  });
  it('warns before selling a ready requirement and only then updates the order', () => {
    const g = fixture().open();
    g.debugClearBoard();
    const item = g.board.placeAt(0, 'coffee_01')!;
    const spare = g.board.placeAt(1, 'coffee_01')!;
    const order = { ...g.orders.getOrders()[0], requirements: [{ itemId: 'coffee_01', count: 2 }] };
    g.orders.hydrate([order], []);
    expect(g.orders.canClaim(order.uid)).toBe(true);
    expect(g.quoteBoardItemSale(0, item.uid)).toMatchObject({ ok: true, breaksReadyOrder: true });
    expect(g.orders.canClaim(order.uid)).toBe(true);
    expect(g.sellBoardItem(0, item.uid).ok).toBe(true);
    expect(g.orders.canClaim(order.uid)).toBe(false);
    expect(g.board.getBoard().cells[1].item).toEqual(spare);
    expect(g.orders.getOrders()[0]).toEqual(order);
  });
  it('unlocks permanent collection bonus only once, preserving saved energy and cap through levels', () => {
    const f=fixture(), g=f.open(); g.debugClearBoard();
    expect(g.claimCollectionBonus('sugar')).toEqual({ok:false,reason:'NOT_READY'});
    for(let pair=0;pair<2;pair++){g.board.placeAt(0,'sugar_01');g.board.placeAt(1,'sugar_01');expect(g.dropItem(0,1).ok).toBe(true);g.dropItem(1,pair===0?7:8);}
    expect(g.dropItem(7,8)).toMatchObject({ok:true,kind:'MERGE',resultDefinitionId:'sugar_03'});
    expect(g.getCollectionProgress().find((c)=>c.chainId==='sugar')).toMatchObject({discovered:3,total:5,ready:false,claimed:false});
    expect(g.claimCollectionBonus('sugar')).toEqual({ok:false,reason:'NOT_READY'});
    g.board.placeAt(0,'sugar_03');
    expect(g.dropItem(8,0)).toMatchObject({ok:true,kind:'MERGE',resultDefinitionId:'sugar_04'});
    g.board.placeAt(1,'sugar_04');
    expect(g.dropItem(0,1)).toMatchObject({ok:true,kind:'MERGE',resultDefinitionId:'sugar_05'});
    expect(g.getCollectionProgress().find((c)=>c.chainId==='sugar')).toMatchObject({discovered:5,total:5,ready:true,claimed:false});
    const energy=g.player.energy; expect(g.player.maxEnergy).toBe(100);
    expect(g.claimCollectionBonus('sugar')).toEqual({ok:true,energyBonus:3});
    expect(g.player).toMatchObject({maxEnergy:103,energy}); expect(g.claimCollectionBonus('sugar')).toEqual({ok:false,reason:'ALREADY_CLAIMED'});
    let h=f.open(); expect(h.player).toMatchObject({maxEnergy:103,energy}); expect(h.getCollectionProgress().find((c)=>c.chainId==='sugar')?.claimed).toBe(true);
    h.debugAddXp(50); expect(h.player.maxEnergy).toBe(153); h=f.open(); expect(h.player.maxEnergy).toBe(153); expect(h.player.energy).toBe(energy);
  });
  it('merges two previously saved level-three sugar jars and keeps their new result after reload', () => {
    const f=fixture(), g=f.open();
    g.debugClearBoard();
    g.board.placeAt(0,'sugar_03'); g.board.placeAt(1,'sugar_03'); g.save();
    const restored=f.open();
    expect(restored.dropItem(0,1)).toMatchObject({ok:true,kind:'MERGE',resultDefinitionId:'sugar_04'});
    expect(f.open().board.getBoard().cells[1].item?.definitionId).toBe('sugar_04');
  });
  it('replaces a regular order with a single already-held sugar item and never duplicates its request', () => {
    const g=fixture().open(); g.debugClearBoard();
    const before=g.orders.getOrders().map(order=>({...order,requirements:[{itemId:'coffee_01',count:1}]}));
    g.orders.hydrate(before,[]);
    g.board.placeAt(0,'coffee_01');g.board.placeAt(1,'sugar_03');g.board.placeAt(2,'sugar_05');
    expect(g.claimOrder(before[1].uid).ok).toBe(true);
    const stocked=g.orders.getOrders()[1];
    expect(stocked.requirements).toEqual([{itemId:'sugar_05',count:1}]);
    expect(g.orders.canClaim(stocked.uid)).toBe(true);
    g.board.placeAt(0,'coffee_01');
    expect(g.claimOrder(before[2].uid).ok).toBe(true);
    expect(g.orders.getOrders().filter(order=>order.requirements.some(req=>req.itemId.startsWith('sugar_')))).toHaveLength(1);
    expect(g.claimOrder(stocked.uid).ok).toBe(true);
    expect(g.board.getBoard().cells[2].item).toBeUndefined();
    expect(g.board.getBoard().cells[1].item?.definitionId).toBe('sugar_03');
  });
  it('caps cumulative bonuses at 1000 without losing overflowing saved energy', () => {
    const f=fixture(), b=loadConfigBundle(), d=createDefaultSaveData(b.game,f.clock.now());
    d.player.level=18; d.player.xp=b.progression.levels[17].xpRequired; d.player.maxEnergy=1000; d.player.energy=1040;
    d.discoveredItemIds=b.items.filter((item)=>item.chainId==='sugar').map((item)=>item.id);
    f.values.set(b.game.saveKey,JSON.stringify(d)); const g=f.open();
    expect(g.player).toMatchObject({energy:1040,maxEnergy:1000});
    expect(g.claimCollectionBonus('sugar')).toEqual({ok:true,energyBonus:0});
    expect(f.open().player).toMatchObject({energy:1040,maxEnergy:1000});
  });
  it('restores previously claimed bonuses and an overflowing v6 wallet without changing its deficit', () => {
    const f=fixture(), b=loadConfigBundle(), d=createDefaultSaveData(b.game,f.clock.now());
    d.player.level=2; d.player.xp=50; d.player.maxEnergy=156; d.player.energy=164;
    d.claimedCollectionIds=['coffee','sugar']; f.values.set(b.game.saveKey,JSON.stringify(d));
    const g=f.open(); expect(g.player).toMatchObject({maxEnergy:156,energy:164});
    expect(g.getCollectionProgress().filter((c)=>c.claimed).map((c)=>c.chainId)).toEqual(['coffee','sugar']);
    expect(f.open().player).toMatchObject({maxEnergy:156,energy:164});
  });
  it('uses the configured output streak before a persisted level-scaled cooldown', () => {
    const f=fixture(), g=f.open(); g.debugClearBoard(); g.player.energy=1000;
    const config=g.generators.get('coffee_machine')!; const streakLimit=g.getGeneratorStatus('coffee_machine')!.streakLimit;
    for(let i=0;i<streakLimit;i++){expect(g.spawnFromGenerator('coffee_machine').ok).toBe(true);g.debugClearBoard();}
    expect(g.getGeneratorStatus('coffee_machine')).toMatchObject({streak:streakLimit,remainingCooldownMs:config.streakCooldown!.durationMs,cooldownMs:config.streakCooldown!.durationMs});
    const energy=g.player.energy; expect(g.spawnFromGenerator('coffee_machine')).toEqual({ok:false,reason:'GENERATOR_COOLDOWN'}); expect(g.player.energy).toBe(energy);
    f.clock.advance(5000); let h=f.open(); expect(h.getGeneratorStatus('coffee_machine')?.remainingCooldownMs).toBe(config.streakCooldown!.durationMs-5000);
    h.debugAddXp(50); h.claimLevelReward(2); h.mergeGenerators('coffee_machine',1);
    const upgradedInterval=Math.round(config.streakCooldown!.durationMs*config.upgrade!.rechargeFactor);
    expect(h.getGeneratorStatus('coffee_machine')).toMatchObject({cooldownMs:upgradedInterval,remainingCooldownMs:0,remainingUses:30});
    f.clock.advance(11000); expect(h.spawnFromGenerator('coffee_machine').ok).toBe(true);
    h=f.open(); expect(h.getGeneratorStatus('coffee_machine')).toMatchObject({streak:31,remainingCooldownMs:0});
    expect(h.getGeneratorStatus('orange_tree')).toMatchObject({streak:0,remainingCooldownMs:0});
  });
  it('drops sugar and wildcard into inbox when the primary output fills the last cell', () => {
    const f=fixture(0), g=f.open(); upgraded(g);
    for(const cell of g.board.getBoard().cells) if(!cell.locked && cell.index!==0) g.board.placeAt(cell.index,'coffee_01');
    expect(g.spawnFromGenerator('coffee_machine').ok).toBe(true);
    const dropped=g.rewardInbox.filter((item)=>item.definitionId==='sugar_01'||item.definitionId==='wildcard');
    expect(dropped.map((i)=>i.definitionId)).toEqual(['sugar_01','wildcard']); expect(new Set(dropped.map((i)=>i.uid)).size).toBe(2);
    expect(f.open().rewardInbox.filter((item)=>item.definitionId==='sugar_01'||item.definitionId==='wildcard')).toEqual(dropped);
  });
  it('checks chance boundaries and does not give bonus drops to a recharge tree', () => {
    const f=fixture(0.1), g=f.open(); upgraded(g); expect(g.spawnFromGenerator('coffee_machine').ok).toBe(true);
    expect(g.board.getBoard().cells.some((c)=>c.item?.definitionId==='sugar_01'||c.item?.definitionId==='wildcard')).toBe(false);
    const h=fixture(0).open(); upgraded(h,'orange_tree'); expect(h.spawnFromGenerator('orange_tree').ok).toBe(true);
    expect(h.board.getBoard().cells.some((c)=>c.item?.definitionId==='sugar_01'||c.item?.definitionId==='wildcard')).toBe(false);
    const exact=fixture(0.005).open(); upgraded(exact); expect(exact.spawnFromGenerator('coffee_machine').ok).toBe(true);
    expect(exact.board.getBoard().cells.some((c)=>c.item?.definitionId==='wildcard')).toBe(false);
    const below=fixture(0.0049).open(); upgraded(below); expect(below.spawnFromGenerator('coffee_machine').ok).toBe(true);
    expect(below.board.getBoard().cells.some((c)=>c.item?.definitionId==='wildcard')).toBe(true);
  });
  it('merges wildcard in both directions only with eligible non-max chains', () => {
    const bundle=loadConfigBundle(), engine=new MergeEngine(bundle.catalog);
    const item=(id:string)=>({uid:id,definitionId:id});
    for(const id of ['coffee_01','coffee_12','flower_03','dessert_04','gift_02','fruit_01','painting_03','photo_03','sugar_02']) {
      const expected=bundle.catalog.get(id)?.nextItemId;
      expect(engine.merge(item('wildcard'),item(id),'a')).toMatchObject({ok:true,item:{definitionId:expected}});
      expect(engine.merge(item(id),item('wildcard'),'b')).toMatchObject({ok:true,item:{definitionId:expected}});
    }
    for(const id of ['coffee_18','sugar_05','coin_01','energy_01','diamond_01','treasure_chest','wildcard']) expect(engine.canMerge(item('wildcard'),item(id))).toBe(false);
    expect(engine.merge(item('sugar_05'),item('sugar_05'),'max')).toEqual({ok:false,reason:'MAX_LEVEL'});
    const g=fixture(0.5).open(); g.board.clearBoard(); g.board.placeAt(0,'wildcard'); g.board.placeAt(1,'sugar_02');
    const coins=g.player.coins; expect(g.dropItem(0,1)).toMatchObject({ok:true,kind:'MERGE',resultDefinitionId:'sugar_03'});
    expect(g.player.coins).toBe(coins+g.config.rewards.discoveryCoins); expect(g.isItemDiscovered('sugar_03')).toBe(true);
  });
});
