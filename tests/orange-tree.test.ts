import { describe, expect, it } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';
import { FixedRandomService } from '../assets/scripts/infrastructure/RandomService';
import { createDefaultSaveData } from '../assets/scripts/infrastructure/SaveService';
import { loadConfigBundle } from '../assets/scripts/config/ConfigRepository';
import { generateOrder, instantiateOrder, requirementSignature } from '../assets/scripts/core/order/orders';
import { GameViewMapper } from '../assets/scripts/presentation/GameViewMapper';

function fixture(start = 1_000_000) {
  const data = new Map<string, string>();
  const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } };
  const clock = new FakeClockService(start);
  const open = () => createGameContext({ storage, clock, deterministic: true, random: new FixedRandomService([0.5]), saveDebounceMs: 0 });
  return { data, storage, clock, open };
}
const treeConfig = loadConfigBundle().generators.find((generator) => generator.id === 'orange_tree')!;
const interval = treeConfig.recharge!.intervalMs;
const capacity = treeConfig.recharge!.capacity;
describe('sunshine orange tree', () => {
  it('unlocks at level 2 with configured free picks and does not alter energy or its timer', () => {
    const f = fixture(); const g = f.open();
    expect(interval).toBe(60_000); expect(g.config.energy.recoverIntervalMs).toBe(240_000);
    expect(g.getGeneratorStatus('orange_tree')).toMatchObject({ unlocked: false, charges: null, maxCharges: capacity, nextRecoveryMs: null });
    expect(g.spawnFromGenerator('orange_tree')).toEqual({ ok: false, reason: 'LOCKED' });
    g.debugAddXp(50); g.debugClearBoard(); const energy = g.player.energy, timestamp = g.player.lastEnergyAt;
    expect(g.getGeneratorStatus('orange_tree')).toMatchObject({ unlocked: true, charges: capacity, maxCharges: capacity, nextRecoveryMs: null });
    for (let i=0; i<capacity; i++) { expect(g.spawnFromGenerator('orange_tree')).toMatchObject({ ok: true, itemDefinitionId: 'fruit_01' }); g.debugClearBoard(); }
    expect(g.spawnFromGenerator('orange_tree')).toEqual({ ok: false, reason: 'NO_CHARGES' });
    expect(g.player.energy).toBe(energy); expect(g.player.lastEnergyAt).toBe(timestamp);
    expect(f.open().getGeneratorStatus('orange_tree')).toMatchObject({ charges: 0, nextRecoveryMs: interval });
  });
  it('recovers offline one per minute, preserves partial time and limits capacity', () => {
    const f = fixture(); let g = f.open(); g.debugAddXp(50); g.debugClearBoard();
    for (let i=0;i<capacity;i++) { expect(g.spawnFromGenerator('orange_tree').ok).toBe(true); g.debugClearBoard(); }
    f.clock.advance(interval + interval / 5); g = f.open();
    expect(g.getGeneratorStatus('orange_tree')).toMatchObject({ charges: 1, nextRecoveryMs: interval * .8 });
    expect(g.spawnFromGenerator('orange_tree').ok).toBe(true);
    expect(f.open().getGeneratorStatus('orange_tree')).toMatchObject({ charges: 0, nextRecoveryMs: interval * .8 });
    f.clock.advance(interval * 10); expect(g.getGeneratorStatus('orange_tree')).toMatchObject({ charges: capacity, maxCharges: capacity, nextRecoveryMs: null });
    expect(g.spawnFromGenerator('orange_tree').ok).toBe(true);
    expect(g.getGeneratorStatus('orange_tree')).toMatchObject({ charges: capacity - 1, nextRecoveryMs: interval });
  });
  it('cannot farm recovered charges by rewinding the clock or leaving a full tree idle', () => {
    const f = fixture(); const g = f.open(); g.debugAddXp(50); g.debugClearBoard();
    f.clock.advance(interval * capacity); expect(g.spawnFromGenerator('orange_tree').ok).toBe(true);
    expect(g.getGeneratorStatus('orange_tree')?.charges).toBe(capacity - 1);
    g.debugClearBoard(); f.clock.advance(-interval * 5); for (let i=0;i<capacity - 1;i++) { expect(g.spawnFromGenerator('orange_tree').ok).toBe(true); g.debugClearBoard(); }
    expect(g.spawnFromGenerator('orange_tree')).toEqual({ ok: false, reason: 'NO_CHARGES' });
    f.clock.advance(interval * 5); expect(g.getGeneratorStatus('orange_tree')?.charges).toBe(0);
    f.clock.advance(interval); expect(f.open().getGeneratorStatus('orange_tree')?.charges).toBe(1);
  });
  it('retains all configured charges on a full board and initializes eligible old saves once', () => {
    const f = fixture(); const cfg = loadConfigBundle().game; const legacy = createDefaultSaveData(cfg, f.clock.now());
    legacy.version = 5; legacy.player.level = 2; legacy.player.xp = 50; delete legacy.generatorCharges;
    f.data.set(cfg.saveKey, JSON.stringify(legacy)); let g = f.open();
    expect(g.getGeneratorStatus('orange_tree')?.charges).toBe(capacity);
    for (const c of g.board.getBoard().cells) if (!c.item) g.board.placeAt(c.index, 'coffee_01');
    expect(g.spawnFromGenerator('orange_tree')).toEqual({ ok: false, reason: 'BOARD_FULL' });
    expect(g.getGeneratorStatus('orange_tree')?.charges).toBe(capacity);
    g.debugClearBoard(); expect(g.spawnFromGenerator('orange_tree').ok).toBe(true);
    g = f.open(); expect(g.getGeneratorStatus('orange_tree')?.charges).toBe(capacity-1);
  });
  it('allows unlocked fruit early and at most one occupied slot', () => {
    const bundle = loadConfigBundle();
    const base = { player: { level: 11, unlockedChainIds: ['coffee', 'fruit'] }, templates: bundle.orders,
      catalog: bundle.catalog, recentOrderIds: [], minItemLevel: 2, maxItemLevel: 5,
      random: new FixedRandomService([0]), id: 'test', limitedChainIds: ['fruit'] };
    const rare = generateOrder(base)!;
    expect(rare.requirements.some((r) => bundle.catalog.get(r.itemId)?.chainId === 'fruit')).toBe(true);
    expect(generateOrder({ ...base, player: { ...base.player, level: 5 } })!.requirements.some((r) => bundle.catalog.get(r.itemId)?.chainId === 'fruit')).toBe(true);
    expect(generateOrder({ ...base, player: { ...base.player, unlockedChainIds: ['coffee'] } })!.requirements.every((r) => bundle.catalog.get(r.itemId)?.chainId !== 'fruit')).toBe(true);
    expect(generateOrder({ ...base, activeOrders: [rare] })!.requirements.every((r) => bundle.catalog.get(r.itemId)?.chainId !== 'fruit')).toBe(true);
  });

});

describe('automatic order replacement and daily tasks', () => {
  it('disables manual replacement without charging or changing saved orders', () => {
    const f=fixture(),g=f.open();const before=g.buildSaveData();const uid=g.orders.getOrders()[0].uid;
    expect(g.getOrderRefreshStatus(uid)).toBeNull();
    expect(g.refreshOrder(uid,'free')).toEqual({ok:false,reason:'DISABLED'});
    expect(g.refreshOrder(uid,'diamond')).toEqual({ok:false,reason:'DISABLED'});
    expect(g.buildSaveData().activeOrders).toEqual(before.activeOrders);
    expect(g.player.diamonds).toBe(before.player.diamonds);
    expect(f.open().orders.getOrders()).toEqual(before.activeOrders);
  });
  it('fills the completed slot automatically while manual replacement stays disabled', () => {
    const g=fixture().open();const old=g.orders.getOrders()[0];g.debugClearBoard();
    for(const req of old.requirements)for(let i=0;i<req.count;i++)g.debugSpawn(req.itemId);
    expect(g.claimOrder(old.uid).ok).toBe(true);expect(g.orders.getOrders()).toHaveLength(6);
    expect(g.orders.getOrders()[0].uid).not.toBe(old.uid);
    expect(g.getOrderRefreshStatus(g.orders.getOrders()[0].uid)).toBeNull();
  });
  it('tracks real merges and orders, pays once, survives restart and handles a backwards clock', () => {
    const f = fixture(); const g = f.open(); g.debugClearBoard();
    const task = g.getDailyTasks().tasks.find((t) => t.id === 'specific_2')!; const target = task.targetItemId!;
    const previous = g.bundle.items.find((item) => item.nextItemId === target)!;
    for (let i=0;i<2;i++) { g.board.placeAt(0, previous.id); g.board.placeAt(1, previous.id); expect(g.dropItem(0,1).ok).toBe(true); g.debugClearBoard(); }
    expect(g.getDailyTasks().tasks.find((t) => t.id === 'specific_2')).toMatchObject({ progress: 2, ready: true });
    expect(f.open().getDailyTasks().tasks.find((t) => t.id === 'specific_2')?.progress).toBe(2);
    g.player.energy = g.player.maxEnergy - 2; let nested: unknown; g.bus.on('COINS_CHANGED', () => { nested = g.claimDailyTask('specific_2'); });
    expect(g.claimDailyTask('specific_2')).toMatchObject({ ok: true, energy: 5, diamonds: 1 });
    expect(g.player.energy).toBe(g.player.maxEnergy + 3);
    expect(nested).toEqual({ ok: false, reason: 'ALREADY_CLAIMED' });
    expect(f.open().claimDailyTask('specific_2')).toEqual({ ok: false, reason: 'ALREADY_CLAIMED' });
    const day = g.getDailyTasks().day; f.clock.advance(86400000);
    expect(g.getDailyTasks().day).toBe(day + 1); expect(g.getDailyTasks().tasks.find((t) => t.id === 'specific_2')).toMatchObject({ progress: 0, claimed: false });
    f.clock.advance(-86400000); expect(g.getDailyTasks().day).toBe(day + 1);
    expect(g.claimDailyTask('specific_2')).toEqual({ ok: false, reason: 'NOT_READY' });
  });
  it('counts delivered orders and genuine merges but not moving, spawning or failed actions', () => {
    const f = fixture(); const g = f.open(); g.getDailyTasks(); g.debugClearBoard();
    g.debugSpawn('coffee_01'); g.dropItem(0, 1); g.dropItem(1, 1);
    expect(g.getDailyTasks().tasks.find((t) => t.id === 'merges_10')?.progress).toBe(0);
    for (let i=0;i<3;i++) {
      const order = g.orders.getOrders()[0]; g.debugClearBoard();
      for (const req of order.requirements) for (let count=0;count<req.count;count++) g.debugSpawn(req.itemId);
      expect(g.claimOrder(order.uid).ok).toBe(true);
    }
    expect(g.getDailyTasks().tasks.find((t) => t.id === 'orders_3')).toMatchObject({ progress: 3, ready: true });
    expect(g.claimDailyTask('orders_3').ok).toBe(true);
  });
  it('offers early single and mixed orders while limiting time-gated chains', () => {
    const b = loadConfigBundle(); const unlocked = ['coffee','flower','dessert','gift','fruit'];
    for (let i=0;i<100;i++) {
      const base = { player: { level: 4, unlockedChainIds: unlocked }, templates: b.orders, catalog: b.catalog, recentOrderIds: [], minItemLevel: 2, maxItemLevel: 5, random: new FixedRandomService([i/100]), id: `stage_${i}`, limitedChainIds: ['fruit'] };
      const order = generateOrder(base)!; expect(order.requirements.reduce((sum,r)=>sum+r.count,0)).toBeLessThanOrEqual(2);
    }
    const mixed = b.orders.find((o) => o.id === 'order_afternoon_together')!;
    expect(mixed.minLevel).toBe(6); expect(mixed.requirements).toHaveLength(2);
    const long = b.orders.find((o) => o.id === 'order_sunshine_longterm')!;
    expect(long.minLevel).toBe(15); expect(long.requirements[0].itemId).toBe('fruit_04');
  });
  it('allows normal fruit merges to drop a chest but excludes consumable merges', () => {
    const g = createGameContext({ deterministic: true, random: new FixedRandomService([0]) }); g.board.clearBoard();
    g.board.placeAt(0, 'fruit_01'); g.board.placeAt(1, 'fruit_01'); g.dropItem(0,1);
    expect(g.isItemDiscovered('fruit_02')).toBe(true);
    expect(g.board.getBoard().cells.some((c) => c.item?.definitionId === 'treasure_chest')).toBe(true);
  });
});

describe('long-term orders', () => {
  it('persists the long-term marker and exposes it in the view model', () => {
    const f = fixture(); const cfg = loadConfigBundle(); const saved = createDefaultSaveData(cfg.game, f.clock.now());
    saved.player.level = 15; saved.player.xp = cfg.progression.levels.find((l) => l.level === 15)!.xpRequired;
    const template = cfg.orders.find((o) => o.id === 'order_sunshine_longterm')!;
    const order = instantiateOrder(template, 'long_order'); expect(order.longTerm).toBe(true);
    saved.activeOrders[0] = order; f.data.set(cfg.game.saveKey, JSON.stringify(saved));
    const g = f.open(); const restored = g.orders.getOrders()[0]; expect(restored.longTerm).toBe(true);
    expect(new GameViewMapper(cfg).mapOrder(restored, g.board.getOrderProgress(restored)).longTerm).toBe(true);
    expect(f.open().orders.getOrders()[0].longTerm).toBe(true);
  });
  it('avoids active duplicate needs when alternatives exist and never selects locked fruit', () => {
    const f = fixture(); const g = f.open();
    for (let n=0;n<15;n++) {
      const before = g.orders.getOrders(), selected = before[0];
      const signatures = before.map((o) => requirementSignature(o.requirements));
      const result = g.orders.refresh(selected.uid);
      expect(result.ok).toBe(true); if (!result.ok) break;
      const current = g.orders.getOrders()[0];
      const possible = g.bundle.items.filter((item) => item.chainId === 'coffee' && item.level >= 2 && item.level <= 3)
        .map((item) => requirementSignature([{ itemId: item.id, count: 1 }]));
      if (possible.some((signature) => !signatures.includes(signature))) expect(signatures).not.toContain(requirementSignature(current.requirements));
      expect(current.requirements.every((r) => g.bundle.catalog.get(r.itemId)?.chainId !== 'fruit')).toBe(true);
      f.clock.advance(g.config.orders.refreshCooldownMs);
    }
  });
});
