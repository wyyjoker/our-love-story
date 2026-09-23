import { describe, expect, it } from 'vitest';
import {
  SaveService,
  createDefaultSaveData,
} from '../assets/scripts/infrastructure/SaveService';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';
import type { StorageAdapter } from '../assets/scripts/infrastructure/PlatformService';
import { loadConfigBundle } from '../assets/scripts/config/ConfigRepository';
import type { SaveData } from '../assets/scripts/core/types';

function memStorage(): StorageAdapter & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
}

function makeService(storage = memStorage(), clock = new FakeClockService(1000)) {
  const config = loadConfigBundle().game;
  return {
    storage,
    clock,
    config,
    save: new SaveService({
      storage,
      clock,
      saveKey: config.saveKey,
      version: config.saveVersion,
      createDefault: () => createDefaultSaveData(config, clock.now()),
      debounceMs: 0,
    }),
  };
}

describe('SaveService', () => {
  it('save â†?load same', () => {
    const { save, clock, config } = makeService();
    const data = createDefaultSaveData(config, clock.now());
    data.player.coins = 42;
    save.save(data);
    const loaded = save.load();
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.data.player.coins).toBe(42);
      expect(loaded.data.version).toBe(1);
    }
  });

  it('empty â†?default save', () => {
    const { save } = makeService();
    const loaded = save.load();
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) {
      expect(loaded.reason).toBe('EMPTY');
      expect(loaded.defaultData.player.level).toBe(1);
      expect(loaded.defaultData.board).toHaveLength(63);
    }
  });

  it('corrupt JSON â†?fallback default', () => {
    const storage = memStorage();
    const config = loadConfigBundle().game;
    storage.setItem(config.saveKey, '{not-json');
    const { save } = makeService(storage);
    const loaded = save.load();
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.reason).toBe('CORRUPT');
    // backup exists
    expect(storage.getItem(`${config.saveKey}:backup`)).toBe('{not-json');
  });

  it('board length invalid â†?fail safe default', () => {
    const storage = memStorage();
    const config = loadConfigBundle().game;
    const bad: SaveData = createDefaultSaveData(config, 0);
    bad.board = bad.board.slice(0, 10);
    storage.setItem(config.saveKey, JSON.stringify(bad));
    const { save } = makeService(storage);
    const loaded = save.load();
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.defaultData.board).toHaveLength(63);
  });

  it('old version migrates / future version rejected', () => {
    const storage = memStorage();
    const config = loadConfigBundle().game;
    const base = createDefaultSaveData(config, 0);
    // version 0 with valid shape â†?migrate repaired
    const v0 = { ...base, version: 0 };
    const migrated = makeService(storage).save.migrate(v0);
    expect(migrated).not.toBeNull();
    expect(migrated!.data.version).toBe(config.saveVersion);

    const future = { ...base, version: 999 };
    expect(makeService(storage).save.migrate(future)).toBeNull();
  });

  it('reset clears key', () => {
    const { save, clock, config } = makeService();
    save.save(createDefaultSaveData(config, clock.now()));
    save.reset();
    expect(save.load().ok).toBe(false);
  });
});
