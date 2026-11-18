import { describe, expect, it } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { loadConfigBundle } from '../assets/scripts/config/ConfigRepository';
import { createDefaultSaveData } from '../assets/scripts/infrastructure/SaveService';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';
import { FixedRandomService } from '../assets/scripts/infrastructure/RandomService';

function fixture() {
  const values=new Map<string,string>(), clock=new FakeClockService(1_000_000), bundle=loadConfigBundle();
  const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};
  const open=()=>createGameContext({storage,clock,random:new FixedRandomService([.55]),deterministic:true,saveDebounceMs:0});
  return {values,clock,bundle,open};
}
describe('physical producers on main board',()=>{
  it('starts with one coffee machine on the nine open cells and an empty backpack',()=>{
    const g=fixture().open(), producers=g.board.getBoard().cells.filter(c=>c.item&&g.bundle.catalog.get(c.item.definitionId)?.generator);
    expect(producers).toHaveLength(1);expect(producers[0].locked).toBe(false);expect(g.board.getBoard().cells.filter(c=>!c.locked)).toHaveLength(9);
    expect(g.getGeneratorStatus(producers[0].item!.uid)).toMatchObject({uid:producers[0].item!.uid,remainingUses:60,level:1});
    expect(g.play.state.warehouse).toHaveLength(0);expect(g.buildSaveData().generatorInventory).toBeUndefined();
  });
  it('keeps a packed machine, pending orders and boost across restart and a full-board withdrawal', () => {
    const f = fixture(), g = f.open();
    g.debugClearBoard();
    g.debugAddCoins(120);
    expect(g.purchaseGenerator('coffee_machine').ok).toBe(true);
    expect(g.mergeGenerators('coffee_machine', 1).ok).toBe(true);
    const uid = g.getGeneratorStatus('coffee_machine')!.uid!;
    g.setGeneratorBoost(uid, true);
    expect(g.spawnFromGenerator(uid).ok).toBe(true);
    const cell = g.board.getBoard().cells.find(c => c.item?.uid === uid)!;
    const machine = g.buildSaveData().board[cell.index].item!;
    const orders = g.orders.getOrders();
    expect(g.playAction('store', String(cell.index))).toEqual({ ok: true });
    expect(g.getGeneratorStatus('coffee_machine')?.uid).toBeNull();
    expect(g.spawnFromGenerator('coffee_machine')).toEqual({ ok: false, reason: 'LOCKED' });
    expect(g.play.state.warehouse).toEqual([machine]);
    expect(g.board.getBoard().cells[cell.index].item).toBeUndefined();

    const h = f.open();
    expect(h.play.state.warehouse).toEqual([machine]);
    expect(h.getGeneratorStatus('coffee_machine')?.uid).toBeNull();
    expect(h.orders.getOrders()).toEqual(orders);
    const order = h.orders.getOrders()[0];
    expect(h.getOrderTracking(order.uid, order.requirements[0].itemId)).toMatchObject({
      ok: true, guide: { source: { id: 'coffee_machine', level: 2, unlocked: false, storedUid: uid } },
    });
    for (const c of h.board.getBoard().cells) if (!c.locked && !c.item) h.board.placeAt(c.index, 'coffee_01');
    expect(h.playAction('withdraw', uid)).toEqual({ ok: false, reason: 'BOARD_FULL' });
    expect(h.play.state.warehouse).toEqual([machine]);
    const freed = h.board.getBoard().cells[cell.index].item!;
    expect(h.sellBoardItem(cell.index, freed.uid).ok).toBe(true);
    expect(h.playAction('withdraw', uid)).toEqual({ ok: true });
    expect(h.board.getBoard().cells[cell.index].item).toEqual(machine);
    expect(h.play.state.warehouse).toHaveLength(0);
    expect(h.playAction('withdraw', uid)).toEqual({ ok: false, reason: 'INVALID' });
    expect(f.open().getGeneratorStatus(uid)).toMatchObject({ level: 2, boosted: true, remainingUses: 59 });
  });
  it('applies only elapsed real-time recharge while an orange tree is packed', () => {
    const f = fixture(), g = f.open();
    g.debugAddXp(50);
    const first = g.getGeneratorStatus('orange_tree')!;
    expect(first.charges).toBe(10);
    expect(g.spawnFromGenerator(first.uid!).ok).toBe(true);
    expect(g.spawnFromGenerator(first.uid!).ok).toBe(true);
    f.clock.advance(25_000);
    const index = g.board.getBoard().cells.find(c => c.item?.uid === first.uid)!.index;
    expect(g.playAction('store', String(index))).toEqual({ ok: true });
    f.clock.advance(40_000);
    const h = f.open();
    expect(h.getGeneratorStatus('orange_tree')?.uid).toBeNull();
    expect(h.playAction('withdraw', first.uid!)).toEqual({ ok: true });
    expect(h.getGeneratorStatus(first.uid!)).toMatchObject({ charges: 9, nextRecoveryMs: 55_000 });
  });
  it('preserves a machine if the backpack is full, and repairs its entitlement without granting a copy', () => {
    const f = fixture(), g = f.open();
    const machine = g.board.getBoard().cells.find(c => c.item?.generatorState)!;
    const save = g.buildSaveData();
    save.play.warehouse = Array.from({ length: 6 }, (_, i) => ({ uid: `bag_${i}`, definitionId: 'coffee_01' }));
    f.values.set(g.config.saveKey, JSON.stringify(save));
    const h = f.open();
    expect(h.playAction('store', String(machine.index))).toEqual({ ok: false, reason: 'WAREHOUSE_FULL' });
    expect(h.board.getBoard().cells[machine.index].item).toEqual(machine.item);
    expect(h.playAction('withdraw', 'bag_0')).toEqual({ ok: true });
    expect(h.playAction('store', String(machine.index))).toEqual({ ok: true });
    const missingEntitlement = h.buildSaveData();
    missingEntitlement.generatorBoard!.entitlements = [];
    f.values.set(h.config.saveKey, JSON.stringify(missingEntitlement));
    const restored = f.open();
    expect(restored.generators.getRewards()).toHaveLength(0);
    expect(restored.getGeneratorStatus('coffee_machine')?.uid).toBeNull();
    expect(restored.play.getStoredGenerator('coffee_machine')?.uid).toBe(machine.item?.uid);
  });
  it('keeps independent budgets across drag, merge, clone and restart',()=>{
    const f=fixture(),g=f.open();g.debugClearBoard();g.player.coins=100;expect(g.purchaseGenerator('coffee_machine').ok).toBe(true);
    const machines=g.board.getBoard().cells.filter(c=>c.item&&g.bundle.catalog.get(c.item.definitionId)?.generator);
    const [a,b]=machines, uid=a.item!.uid;
    expect(g.spawnFromGenerator(uid).ok).toBe(true);g.debugClearBoard();
    expect(g.getGeneratorStatus(uid)?.remainingUses).toBe(59);expect(g.getGeneratorStatus(b.item!.uid)?.remainingUses).toBe(60);
    expect(g.dropItem(a.index,0)).toMatchObject({ok:true,kind:'MOVE'});expect(g.getGeneratorStatus(uid)?.remainingUses).toBe(59);
    const snapshot=g.buildSaveData();snapshot.board[0].item!.generatorState!.remainingUses=0;expect(g.getGeneratorStatus(uid)?.remainingUses).toBe(59);
    const h=f.open();expect(h.board.getBoard().cells[0].item?.uid).toBe(uid);expect(h.getGeneratorStatus(uid)?.remainingUses).toBe(59);
    expect(h.dropItem(0,b.index)).toMatchObject({ok:true,kind:'MERGE',resultDefinitionId:'generator_coffee_machine_02'});
    expect(h.getGeneratorStatus('coffee_machine')).toMatchObject({level:2,remainingUses:59,inventory:[0,1,0,0,0,0,0,0]});
    expect(h.player.coins).toBe(0);expect(h.rewardInbox).toHaveLength(0);expect(h.isItemDiscovered('generator_coffee_machine_02')).toBe(false);
    expect(f.open().getGeneratorStatus('coffee_machine')?.remainingUses).toBe(59);
  });
  it('does not produce a ghost machine after its board entity is removed',()=>{
    const g=fixture().open();g.board.clearBoard(false);expect(g.getGeneratorStatus('coffee_machine')?.uid).toBeNull();
    expect(g.spawnFromGenerator('coffee_machine')).toEqual({ok:false,reason:'LOCKED'});
  });
  it('does not charge for a full-board purchase and keeps earned gifts unclaimed',()=>{
    const f=fixture(),g=f.open();g.debugClearBoard();g.player.coins=500;
    for(const c of g.board.getBoard().cells)if(!c.locked&&!c.item)g.board.placeAt(c.index,'coffee_01');
    expect(g.purchaseGenerator('coffee_machine')).toEqual({ok:false,reason:'BOARD_FULL'});expect(g.player.coins).toBe(500);
    g.generators.grantLevelReward(2,['coffee_machine']);g.save();const reward=g.generators.getRewards()[0];
    expect(reward).toMatchObject({count:1,source:'level_reward'});expect(g.claimGeneratorReward(reward.id)).toEqual({ok:false,reason:'BOARD_FULL'});
    const h=f.open();expect(h.generators.getRewards()).toEqual([reward]);
    h.board.getBoard().cells[0].item=undefined;
    let nested:unknown;h.bus.on('ITEM_SPAWNED',()=>{nested=h.claimGeneratorReward(reward.id);});
    expect(h.claimGeneratorReward(reward.id).ok).toBe(true);expect(nested).toEqual({ok:false,reason:'IN_PROGRESS'});
    expect(h.generators.getRewards()).toHaveLength(0);expect(h.getGeneratorStatus('coffee_machine')?.inventory[0]).toBe(2);
    expect(h.claimGeneratorReward(reward.id)).toEqual({ok:false,reason:'NOT_FOUND'});
  });
  it('migrates old producer counts once without copying the shared remaining budget',()=>{
    const f=fixture(),save=createDefaultSaveData(f.bundle.game,f.clock.now());save.version=8;
    save.generatorInventory={coffee_machine:[3,1]};save.generatorCooldowns={coffee_machine:{streak:17,cooldownStartedAt:null}};
    f.values.set(f.bundle.game.saveKey,JSON.stringify(save));const g=f.open();
    expect(g.getGeneratorStatus('coffee_machine')?.inventory).toEqual([3,1,0,0,0,0,0,0]);
    const remaining=()=>g.board.getBoard().cells.reduce((sum,c)=>sum+(c.item?.generatorState?.remainingUses??0),0);
    expect(remaining()).toBe(43);expect(g.generators.getRewards()).toHaveLength(0);
    const h=f.open();expect(h.getGeneratorStatus('coffee_machine')?.inventory).toEqual([3,1,0,0,0,0,0,0]);
    expect(h.board.getBoard().cells.reduce((sum,c)=>sum+(c.item?.generatorState?.remainingUses??0),0)).toBe(43);
  });
  it('migrates large entitlement counts without losing rights or allocating an unbounded board',()=>{
    const f=fixture(),save=createDefaultSaveData(f.bundle.game,f.clock.now());save.generatorInventory={coffee_machine:[1_000_000]};
    f.values.set(f.bundle.game.saveKey,JSON.stringify(save));const g=f.open();
    const owned=g.getGeneratorStatus('coffee_machine')!.inventory[0],pending=g.generators.getRewards().reduce((sum,r)=>sum+r.count,0);
    expect(owned+pending).toBe(1_000_000);expect(owned).toBeLessThanOrEqual(9);expect(g.generators.getRewards().length).toBeLessThanOrEqual(2);
    expect(f.open().getGeneratorStatus('coffee_machine')!.inventory[0]).toBe(owned);
  });
  it('restores only the selected exhausted machine using diamonds',()=>{
    const g=fixture().open();g.debugClearBoard();g.player.coins=100;g.purchaseGenerator('coffee_machine');g.player.energy=1000;g.player.diamonds=10;
    const machines=g.board.getBoard().cells.filter(c=>c.item&&g.bundle.catalog.get(c.item.definitionId)?.generator).map(c=>c.item!.uid);
    for(let n=0;n<60;n++){expect(g.spawnFromGenerator(machines[0]).ok).toBe(true);g.debugClearBoard();}
    expect(g.getGeneratorStatus(machines[0])?.remainingUses).toBe(0);expect(g.getGeneratorStatus(machines[1])?.remainingUses).toBe(60);
    const quote=g.getGeneratorRestoreQuote(machines[0]);expect(quote.ok).toBe(true);
    expect(g.restoreGenerator(machines[0]).ok).toBe(true);expect(g.getGeneratorStatus(machines[0])?.remainingUses).toBe(60);
    expect(g.restoreGenerator(machines[0])).toEqual({ok:false,reason:'NOT_NEEDED'});
    expect(g.player.diamonds).toBe(10-(quote.ok?quote.cost:0));
  });
  it('persists a per-machine boost toggle and respects the level output floor',()=>{
    const f=fixture(),g=f.open();g.debugClearBoard();g.player.coins=100;g.purchaseGenerator('coffee_machine');g.mergeGenerators('coffee_machine',1);
    const uid=g.getGeneratorStatus('coffee_machine')!.uid!;expect(g.setGeneratorBoost(uid,true)).toBe(true);const energy=g.player.energy;
    const result=g.spawnFromGenerator(uid);expect(result.ok).toBe(true);expect(g.player.energy).toBe(energy-2);
    if(result.ok)expect(g.bundle.catalog.get(result.itemDefinitionId)!.level).toBeGreaterThanOrEqual(2);
    expect(f.open().getGeneratorStatus(uid)).toMatchObject({level:2,boosted:true,remainingUses:59});
  });
});
