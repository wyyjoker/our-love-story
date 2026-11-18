import { describe, expect, it } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { loadConfigBundle } from '../assets/scripts/config/ConfigRepository';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';
import { createDefaultSaveData, SaveService } from '../assets/scripts/infrastructure/SaveService';
import type { StorageAdapter } from '../assets/scripts/infrastructure/PlatformService';
import type { SaveData } from '../assets/scripts/core/types';

function memoryStorage() {
  const values = new Map<string, string>();
  const storage: StorageAdapter = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
  return { values, storage };
}

describe('saved feedback preferences', () => {
  it('defaults both controls on and preserves changes across a fresh context', () => {
    const { storage } = memoryStorage();
    const game = createGameContext({ deterministic: true, storage });
    expect(game.preferences).toEqual({ soundEnabled: true, vibrationEnabled: true });
    game.setPreferences({ soundEnabled: false });
    const resumed = createGameContext({ deterministic: true, storage });
    expect(resumed.preferences).toEqual({ soundEnabled: false, vibrationEnabled: true });
  });

  it('migrates v3 saves that do not contain preferences without losing progress', () => {
    const bundle = loadConfigBundle();
    const clock = new FakeClockService(1_000_000);
    const { values, storage } = memoryStorage();
    const legacy: Partial<SaveData> = { ...createDefaultSaveData(bundle.game, clock.now()), version: 3 };
    delete legacy.preferences;
    if (legacy.player) legacy.player.coins = 37;
    values.set(bundle.game.saveKey, JSON.stringify(legacy));

    const save = new SaveService({
      storage,
      clock,
      saveKey: bundle.game.saveKey,
      version: bundle.game.saveVersion,
      createDefault: () => createDefaultSaveData(bundle.game, clock.now()),
    });
    const loaded = save.load();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.data.version).toBe(9);
    expect(loaded.data.preferences).toEqual({ soundEnabled: true, vibrationEnabled: true });
    expect(loaded.data.player.coins).toBe(37);
    expect(loaded.notice).toBe('MIGRATED');
  });
});
