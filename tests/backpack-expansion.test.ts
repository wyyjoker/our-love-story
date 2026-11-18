import { describe, expect, it } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { createDefaultSaveData } from '../assets/scripts/infrastructure/SaveService';
import { loadConfigBundle, validateConfig } from '../assets/scripts/config/ConfigRepository';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';

function fixture() {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const clock = new FakeClockService(1_000_000);
  const open = () => createGameContext({ storage, clock, deterministic: true, saveDebounceMs: 0 });
  return { values, clock, open };
}

describe('diamond backpack expansion', () => {
  it('starts at six usable slots with a bounded quote', () => {
    const game = fixture().open();
    expect(game.getBackpackStatus()).toEqual({ used: 0, capacity: 6, maxCapacity: 36, nextCost: 10, affordable: false });
  });

  it('charges the exact reviewed quote once, and rejects a repeated click', () => {
    const game = fixture().open(); game.player.diamonds = 25;
    const before = { coins: game.player.coins, energy: game.player.energy, xp: game.player.xp };
    const events: string[] = [];
    game.bus.on('PLAY_CHANGED', event => events.push(event.reason));
    expect(game.expandBackpack(6, 10)).toEqual({ ok: true, capacity: 7, cost: 10 });
    expect(game.player.diamonds).toBe(15);
    expect(game.getBackpackStatus()).toMatchObject({ capacity: 7, nextCost: 12, affordable: true });
    expect(game.expandBackpack(6, 10)).toEqual({ ok: false, reason: 'STALE_QUOTE' });
    expect(game.player.diamonds).toBe(15); expect(events).toEqual(['warehouse']);
    expect({ coins: game.player.coins, energy: game.player.energy, xp: game.player.xp }).toEqual(before);
  });

  it('rejects a stale price and insufficient funds without any mutation', () => {
    const game = fixture().open(); game.player.diamonds = 9;
    const before = game.buildSaveData();
    expect(game.expandBackpack(6, 9)).toEqual({ ok: false, reason: 'STALE_QUOTE' });
    expect(game.expandBackpack(6, 10)).toEqual({ ok: false, reason: 'NOT_ENOUGH_DIAMONDS' });
    expect(game.buildSaveData()).toEqual(before);
  });

  it('blocks reentrant expansion while the first transaction emits events', () => {
    const game = fixture().open(); game.player.diamonds = 100;
    let result: ReturnType<typeof game.expandBackpack> | undefined;
    game.bus.on('PLAY_CHANGED', () => { result = game.expandBackpack(7, 12); });
    expect(game.expandBackpack(6, 10).ok).toBe(true);
    expect(result).toEqual({ ok: false, reason: 'IN_PROGRESS' });
    expect(game.player.diamonds).toBe(90); expect(game.play.warehouseCapacity).toBe(7);
  });

  it('expands one slot at a time to exactly 36 and never charges above the cap', () => {
    const game = fixture().open(); game.player.diamonds = 10_000;
    let total = 0;
    for (let capacity = 6; capacity < 36; capacity += 1) {
      const quote = game.getBackpackStatus();
      expect(quote.capacity).toBe(capacity); total += quote.nextCost!;
      expect(game.expandBackpack(capacity, quote.nextCost!)).toEqual({ ok: true, capacity: capacity + 1, cost: quote.nextCost });
    }
    expect(game.player.diamonds).toBe(10_000 - total);
    expect(game.getBackpackStatus()).toMatchObject({ capacity: 36, maxCapacity: 36, nextCost: null, affordable: false });
    const before = game.buildSaveData();
    expect(game.expandBackpack(36, 999)).toEqual({ ok: false, reason: 'MAX_CAPACITY' });
    expect(game.buildSaveData()).toEqual(before);
  });

  it('uses purchased slots and preserves item UIDs and the capacity on restart', () => {
    const f = fixture(), game = f.open(); game.debugClearBoard(); game.player.diamonds = 100;
    for (let i = 0; i < 6; i += 1) { game.board.placeAt(0, 'coffee_01'); expect(game.playAction('store', '0').ok).toBe(true); }
    const item = game.board.placeAt(0, 'flower_03')!;
    expect(game.playAction('store', '0')).toEqual({ ok: false, reason: 'WAREHOUSE_FULL' });
    expect(game.expandBackpack(6, 10).ok).toBe(true);
    expect(game.playAction('store', '0').ok).toBe(true);
    const restored = f.open();
    expect(restored.play.warehouseCapacity).toBe(7); expect(restored.player.diamonds).toBe(90);
    expect(restored.play.state.warehouse[6]).toEqual(item);
    expect(restored.playAction('withdraw', item.uid)).toEqual({ ok: true });
    expect(restored.board.getBoard().cells.some(cell => cell.item?.uid === item.uid)).toBe(true);
  });

  it('preserves all occupied legacy slots and an existing purchased capacity', () => {
    const f = fixture(), config = loadConfigBundle().game, old = createDefaultSaveData(config, f.clock.now());
    delete old.play.warehouseCapacity;
    old.play.warehouse = Array.from({ length: 8 }, (_, i) => ({ uid: `legacy_${i}`, definitionId: 'coffee_01' }));
    f.values.set(config.saveKey, JSON.stringify(old)); const game = f.open();
    expect(game.play.warehouseCapacity).toBe(8); expect(game.play.state.warehouse).toEqual(old.play.warehouse);
    game.player.diamonds = 100; expect(game.expandBackpack(8, 14).ok).toBe(true);
    expect(f.open().play.warehouseCapacity).toBe(9);
  });

  it('preserves over-limit damaged legacy items in the reward inbox without exceeding 36 slots', () => {
    const f = fixture(), config = loadConfigBundle().game, old = createDefaultSaveData(config, f.clock.now());
    old.play.warehouseCapacity = 99;
    old.play.warehouse = Array.from({ length: 40 }, (_, i) => ({ uid: `over_${i}`, definitionId: 'coffee_02' }));
    f.values.set(config.saveKey, JSON.stringify(old)); const game = f.open();
    expect(game.play.warehouseCapacity).toBe(36); expect(game.play.state.warehouse).toHaveLength(36);
    expect(game.rewardInbox).toEqual(old.play.warehouse.slice(36));
    expect(new Set([...game.play.state.warehouse, ...game.rewardInbox].map(item => item.uid)).size).toBe(40);
    expect(f.open().play.warehouseCapacity).toBe(36);
  });

  it.each([-4, NaN, '20', null])('repairs an invalid capacity %j to the initial capacity', capacity => {
    const f = fixture(), config = loadConfigBundle().game, old = createDefaultSaveData(config, f.clock.now());
    Object.assign(old.play, { warehouseCapacity: capacity }); f.values.set(config.saveKey, JSON.stringify(old));
    expect(f.open().play.warehouseCapacity).toBe(6);
  });

  it('validates the bounded configuration and an increasing diamond curve', () => {
    const original = loadConfigBundle();
    for (const invalid of [{ maxSlots: 37 }, { baseDiamondCost: 0 }, { stepDiamondCost: -1 }]) {
      const game = structuredClone(original.game); Object.assign(game.toolbox.backpackExpansion, invalid);
      expect(validateConfig({ ...original, game }).some(issue => issue.message === 'Backpack expansion config invalid')).toBe(true);
    }
  });
});
