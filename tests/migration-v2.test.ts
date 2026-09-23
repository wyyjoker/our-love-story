import { describe, expect, it } from 'vitest';
import { SaveService, createDefaultSaveData } from '../assets/scripts/infrastructure/SaveService';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';
import { loadConfigBundle } from '../assets/scripts/config/ConfigRepository';
import type { StorageAdapter } from '../assets/scripts/infrastructure/PlatformService';

describe('v1 to v2 migration', () => {
  it('maps every old cell by row and column and preserves earned resources', () => {
    const game = loadConfigBundle().game;
    const clock = new FakeClockService(1_000_000);
    const values = new Map<string, string>();
    const storage: StorageAdapter = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: (key) => { values.delete(key); },
    };
    const board = Array.from({ length: 63 }, (_, index) => ({
      index,
      item: index === 8 ? { uid: 'old-item', definitionId: 'flower_02' } : undefined,
    }));
    values.set(game.saveKey, JSON.stringify({
      version: 1,
      savedAt: 900_000,
      board,
      player: {
        level: 3, xp: 100, coins: 245, hearts: 37,
        energy: 20, maxEnergy: 50, lastEnergyAt: 900_000,
        unlockedChainIds: ['coffee', 'flower', 'dessert'],
      },
      activeOrders: [],
      tutorial: {},
    }));
    const save = new SaveService({
      storage, clock, saveKey: game.saveKey, version: 2,
      createDefault: () => createDefaultSaveData(game, clock.now()),
    });
    const loaded = save.load();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.data.board).toHaveLength(81);
    expect(loaded.data.board[10].item?.uid).toBe('old-item');
    expect(loaded.data.player.energy).toBe(70);
    expect(loaded.data.player.maxEnergy).toBe(100);
    expect(loaded.data.player.coins).toBe(245);
    expect(loaded.data.player.hearts).toBe(37);
    expect(loaded.data.player.unlockedChainIds).toContain('dessert');
    expect(loaded.data.player.xp).toBeGreaterThanOrEqual(150);
    expect(loaded.data.life.unlockedMemoryIds).toEqual([]);
  });

  it('repairs the former Creator Set-serialization marker for starter furniture', () => {
    const bundle = loadConfigBundle();
    const clock = new FakeClockService(1_000_000);
    const values = new Map<string, string>();
    const storage: StorageAdapter = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: (key) => { values.delete(key); },
    };
    const data = createDefaultSaveData(bundle.game, clock.now());
    values.set(bundle.game.saveKey, JSON.stringify({
      ...data,
      life: { ...data.life, ownedFurnitureIds: [{}], placedFurnitureIds: [{}] },
    }));
    const save = new SaveService({
      storage, clock, saveKey: bundle.game.saveKey, version: 2,
      createDefault: () => createDefaultSaveData(bundle.game, clock.now()),
      legacyStarterFurnitureId: bundle.furniture[0].id,
    });
    const loaded = save.load();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.repaired).toBe(true);
    expect(loaded.data.life.ownedFurnitureIds).toEqual([bundle.furniture[0].id]);
    expect(loaded.data.life.placedFurnitureIds).toEqual([bundle.furniture[0].id]);
  });
});
