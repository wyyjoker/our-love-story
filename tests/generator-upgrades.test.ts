import { describe, it, expect } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';
import { FixedRandomService } from '../assets/scripts/infrastructure/RandomService';
import { loadConfigBundle } from '../assets/scripts/config/ConfigRepository';
import { createDefaultSaveData } from '../assets/scripts/infrastructure/SaveService';

function fixture() {
  const data = new Map<string, string>(), clock = new FakeClockService(1_000_000);
  const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k,v); }, removeItem: (k: string) => { data.delete(k); } };
  const open = (random = 0.95) => createGameContext({ storage, clock, random: new FixedRandomService([random]), deterministic: true, saveDebounceMs: 0 });
  return { data, storage, clock, open };
}
describe('generator upgrades', () => {
  it('grants coffee on the Lv2 reward once, merges same levels and persists highest active level', () => {
    const f = fixture(); const g = f.open();
    const coffeeConfig=g.generators.get('coffee_machine')!;
    expect(g.getGeneratorStatus('coffee_machine')).toMatchObject({level:1, inventory:[1,0,0,0,0,0,0,0,0], boostAvailable:false, cooldownMs:coffeeConfig.streakCooldown!.durationMs});
    expect(g.mergeGenerators('coffee_machine',1)).toEqual({ok:false,reason:'NOT_ENOUGH_GENERATORS'});
    g.debugAddXp(50); expect(g.claimLevelReward(2).ok).toBe(true);
    expect(g.getGeneratorStatus('coffee_machine')?.inventory).toEqual([2,0,0,0,0,0,0,0,0]);
    expect(g.claimLevelReward(2).ok).toBe(false);
    expect(g.mergeGenerators('coffee_machine',1)).toEqual({ok:true,level:2});
    expect(g.getGeneratorStatus('coffee_machine')).toMatchObject({level:2, inventory:[0,1,0,0,0,0,0,0,0], boostAvailable:true, cooldownMs:Math.round(coffeeConfig.streakCooldown!.durationMs*coffeeConfig.upgrade!.rechargeFactor)});
    const h=f.open(); expect(h.getGeneratorStatus('coffee_machine')).toMatchObject({level:2, inventory:[0,1,0,0,0,0,0,0,0]});
    expect(h.mergeGenerators('coffee_machine',2)).toEqual({ok:false,reason:'NOT_ENOUGH_GENERATORS'});
  });
  it('uses configured better output weights and requires 2x energy only when boost is selected', () => {
    const f = fixture(); const g=f.open(); g.debugAddXp(50); g.claimLevelReward(2); g.mergeGenerators('coffee_machine',1); g.debugClearBoard();
    const initial=g.player.energy; const result=g.spawnFromGenerator('coffee_machine', true);
    expect(result).toMatchObject({ok:true,itemDefinitionId:'coffee_04'}); expect(g.player.energy).toBe(initial-2);
    g.player.energy=1; const count=g.board.getBoard().cells.filter((c)=>c.item).length;
    expect(g.spawnFromGenerator('coffee_machine',true)).toEqual({ok:false,reason:'NOT_ENOUGH_ENERGY'});
    expect(g.player.energy).toBe(1); expect(g.board.getBoard().cells.filter((c)=>c.item)).toHaveLength(count);
    expect(g.spawnFromGenerator('orange_tree',true)).toEqual({ok:false,reason:'BOOST_UNAVAILABLE'});
  });
  it('changes high-tier probability by level and boost according to configuration', () => {
    const g = fixture().open(0.55);
    const gen = g.generators.get('coffee_machine')!;
    expect(g.generators.rollOutput(gen, 1)?.itemId).toBe('coffee_01');
    expect(g.generators.rollOutput(gen, 2)?.itemId).toBe('coffee_02');
    expect(g.generators.rollOutput(gen, 2, true)?.itemId).toBe('coffee_03');
    expect(g.generators.rollOutput(gen, 3)?.itemId).toBe('coffee_03');
    expect(g.generators.rollOutput(gen, 3, true)?.itemId).toBe('coffee_04');
  });
  it('merges two level 2 machines to level 3 and rejects invalid upgrades', () => {
    const f=fixture(); const g=f.open(); g.debugAddXp(50); g.claimLevelReward(2); g.mergeGenerators('coffee_machine',1);
    g.generators.grantLevelReward(2,['coffee_machine']); g.generators.grantLevelReward(2,['coffee_machine']);
    expect(g.mergeGenerators('coffee_machine',1)).toEqual({ok:true,level:2});
    expect(g.mergeGenerators('coffee_machine',2)).toEqual({ok:true,level:3});
    expect(g.getGeneratorStatus('coffee_machine')).toMatchObject({level:3,inventory:[0,0,1,0,0,0,0,0,0],boostAvailable:true});
    expect(g.mergeGenerators('coffee_machine',3)).toEqual({ok:false,reason:'NOT_ENOUGH_GENERATORS'});
    expect(g.mergeGenerators('coffee_machine',9)).toEqual({ok:false,reason:'MAX_LEVEL'});
    expect(g.mergeGenerators('gift_box',1)).toEqual({ok:false,reason:'LOCKED'});
    expect(f.open().getGeneratorStatus('coffee_machine')?.level).toBe(3);
  });
  it('shortens orange recovery without granting partial elapsed time twice, and persists cooldown', () => {
    const f=fixture(); const g=f.open(); g.debugAddXp(50); g.debugClearBoard();
    const treeConfig=g.generators.get('orange_tree')!, interval=treeConfig.recharge!.intervalMs, capacity=treeConfig.recharge!.capacity;
    expect(g.spawnFromGenerator('orange_tree').ok).toBe(true); f.clock.advance(interval / 2);
    g.generators.grantLevelReward(2,['orange_tree']); expect(g.mergeGenerators('orange_tree',1).ok).toBe(true);
    const upgradedInterval=Math.round(interval*treeConfig.upgrade!.rechargeFactor);
    expect(g.getGeneratorStatus('orange_tree')).toMatchObject({level:2,charges:capacity-1,cooldownMs:upgradedInterval,nextRecoveryMs:upgradedInterval});
    expect(f.open().getGeneratorStatus('orange_tree')).toMatchObject({level:2,charges:capacity-1,nextRecoveryMs:upgradedInterval});
    f.clock.advance(upgradedInterval); expect(g.getGeneratorStatus('orange_tree')).toMatchObject({charges:capacity,nextRecoveryMs:null});
  });
  it('initializes old saves at one per unlocked generator without inventing past reward gifts', () => {
    const f=fixture(); const cfg=loadConfigBundle().game; const old=createDefaultSaveData(cfg,f.clock.now());
    old.version=5; old.player.level=3; old.player.xp=150; old.life.claimedLevelRewards=[2,3]; delete old.generatorInventory;
    f.data.set(cfg.saveKey,JSON.stringify(old)); const g=f.open();
    expect(g.getGeneratorStatus('coffee_machine')?.inventory).toEqual([1,0,0,0,0,0,0,0,0]);
    expect(g.getGeneratorStatus('orange_tree')?.inventory).toEqual([1,0,0,0,0,0,0,0,0]);
    expect(g.getGeneratorStatus('flower_basket')?.inventory).toEqual([1,0,0,0,0,0,0,0,0]);
    expect(g.getGeneratorStatus('dessert_oven')?.inventory).toEqual([0,0,0,0,0,0,0,0,0]);
    expect(f.open().getGeneratorStatus('coffee_machine')?.inventory).toEqual([1,0,0,0,0,0,0,0,0]);
  });
  it('keeps all eighteen chain levels and level-specific generator pools', () => {
    const g = fixture().open();
    for (const id of ['coffee_machine', 'flower_basket', 'dessert_oven', 'gift_box', 'orange_tree', 'painting_easel', 'photo_station']) {
      const gen = g.generators.get(id)!;
      expect(gen.upgrade!.maxLevel).toBe(9);
      for (let level = 1; level <= 8; level++) {
        const pool = level === 1 ? gen.outputs : gen.upgrade!.levels[level - 2].outputs;
        expect(pool.map((p) => p.itemId)).toEqual([level, level + 1, level + 2].map((n) => `${gen.chainId}_${String(n).padStart(2, '0')}`));
        expect(pool.map((p) => p.weight)).toEqual([70, 25, 5]);
        if (level > 1 && gen.energyCost > 0) expect(gen.upgrade!.levels[level - 2].boostOutputs!.map((p) => p.weight)).toEqual([25, 50, 25]);
      }
      const maxTier = gen.upgrade!.levels[7];
      expect(maxTier.outputs.map((p) => p.itemId)).toEqual([9, 10, 11, 12].map((n) => `${gen.chainId}_${String(n).padStart(2, '0')}`));
      expect(maxTier.outputs.map((p) => p.weight)).toEqual([60, 26, 12, 2]);
      if (gen.energyCost > 0) expect(maxTier.boostOutputs!.map((p) => p.weight)).toEqual([20, 42, 32, 6]);
      for (let level = 8; level <= 18; level++) {
        const item = loadConfigBundle().items.find((entry) => entry.id === `${gen.chainId}_${String(level).padStart(2, '0')}`)!;
        expect(item.maxLevel).toBe(level === 18);
        if (level < 18) expect(item.nextItemId).toBe(`${gen.chainId}_${String(level + 1).padStart(2, '0')}`);
      }
    }
  });
  it('preserves three-level inventory when loading older saves', () => {
    const f = fixture(); const cfg = loadConfigBundle().game; const old = createDefaultSaveData(cfg, f.clock.now());
    old.generatorInventory = { coffee_machine: [2, 1, 1] };
    f.data.set(cfg.saveKey, JSON.stringify(old));
    expect(f.open().getGeneratorStatus('coffee_machine')).toMatchObject({ level: 3, inventory: [2,1,1,0,0,0,0,0,0] });
  });
  it('buys and merges 256 machines through level nine and preserves them after restart', () => {
    const f = fixture(); const g = f.open();
    expect(g.getGeneratorPurchaseQuote('coffee_machine')).toEqual({ok:true,generatorId:'coffee_machine',cost:100});
    expect(g.purchaseGenerator('orange_tree')).toEqual({ok:false,reason:'LOCKED'});
    expect(g.purchaseGenerator('missing')).toEqual({ok:false,reason:'NOT_FOUND'});
    g.debugAddXp(7650); g.debugClearBoard(); g.player.coins = 25500;
    for (let n = 0; n < 255; n++) {
      expect(g.purchaseGenerator('coffee_machine').ok).toBe(true);
      for (let level = 1; level < 9; level++) {
        if (g.getGeneratorStatus('coffee_machine')!.inventory[level - 1] >= 2) expect(g.mergeGenerators('coffee_machine', level).ok).toBe(true);
      }
    }
    expect(g.player.coins).toBe(0);
    expect(g.purchaseGenerator('coffee_machine')).toEqual({ok:false,reason:'NOT_ENOUGH_COINS'});
    expect(f.open().getGeneratorStatus('coffee_machine')).toMatchObject({level:9,inventory:[0,0,0,0,0,0,0,0,1]});
    expect(g.mergeGenerators('coffee_machine',9)).toEqual({ok:false,reason:'MAX_LEVEL'});
  });
  it('keeps orders, dates and daily merge targets obtainable after generator upgrades', () => {
    const f = fixture(); const g = f.open(); g.debugClearBoard();
    const daily = g.getDailyTasks().tasks.find((task) => task.targetItemId)!;
    expect(daily.targetItemId).toBe('coffee_02');
    const date = g.play.smallDateOrder()!;
    const original = g.orders.getOrders();
    g.debugAddXp(50); g.claimLevelReward(2); expect(g.mergeGenerators('coffee_machine', 1).ok).toBe(true);
    expect(g.orders.getOrders().every((order) => order.requirements.every((req) => {
      const item = loadConfigBundle().catalog.get(req.itemId)!;
      return item.chainId !== 'coffee' || item.level >= 2;
    }))).toBe(true);
    expect(g.orders.getOrders().map((order) => order.uid)).toEqual(original.map((order) => order.uid));
    expect(g.play.smallDateOrder()!.token).toBe(date.token);
    expect(g.play.smallDateOrder()!.template.requirements).toEqual([{itemId:'coffee_02',count:2}]);
    expect(g.play.smallDateOrder()!.requirements).toEqual([{itemId:'coffee_02',count:2,have:0,done:false}]);
    expect(g.getDailyTasks().tasks.find((task) => task.targetItemId)!.targetItemId).toBe('coffee_03');
    for (let i = 0; i < 2; i++) g.debugSpawn('coffee_02');
    expect(g.play.smallDateOrder()!.ready).toBe(true);
    expect(g.play.deliverSmallDate(date.token).ok).toBe(true);
    const h = f.open();
    expect(h.getDailyTasks().tasks.find((task) => task.targetItemId)!.targetItemId).toBe('coffee_03');
  });
  it('retains a fully prepared low-level order during an upgrade and generates level eight needs', () => {
    const f = fixture(); const g = f.open(); g.debugClearBoard();
    const existing = g.orders.getOrders()[0];
    for (const req of existing.requirements) for (let n = 0; n < req.count; n++) g.debugSpawn(req.itemId);
    g.debugAddXp(50); g.claimLevelReward(2); g.mergeGenerators('coffee_machine', 1);
    expect(g.orders.getOrders().find((order) => order.uid === existing.uid)!.requirements).toEqual(existing.requirements);
    const save = g.buildSaveData(); for (const cell of save.board) if (cell.item && g.bundle.catalog.get(cell.item.definitionId)?.generator?.id === 'coffee_machine') cell.item.definitionId = 'generator_coffee_machine_08';
    f.data.set(loadConfigBundle().game.saveKey, JSON.stringify(save)); const h = f.open();
    const created = h.orders.createNextOrder()!;
    expect(created.requirements.every((req) => {
      const item = loadConfigBundle().catalog.get(req.itemId)!;
      return item.chainId !== 'coffee' || item.level >= 8;
    })).toBe(true);
    expect(h.getDailyTasks().tasks.find((task) => task.targetItemId)!.targetItemId).toBe('coffee_09');
  });
});
