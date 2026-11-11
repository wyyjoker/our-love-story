import { describe, expect, it, vi } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { SaveService, createDefaultSaveData } from '../assets/scripts/infrastructure/SaveService';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';
import { loadConfigBundle } from '../assets/scripts/config/ConfigRepository';
import type { StorageAdapter } from '../assets/scripts/infrastructure/PlatformService';

function fixture() {
  const data = new Map<string, string>();
  let failed = false;
  const storage: StorageAdapter = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { if (failed) throw new Error('quota'); data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
  };
  return { data, storage, fail: (value: boolean) => { failed = value; } };
}

describe('storage fault recovery', () => {
  it('keeps the last good save, emits no false success and flushes the newest progress after recovery', () => {
    const f = fixture();
    const game = createGameContext({ storage: f.storage, deterministic: true });
    const saved = vi.fn();
    game.bus.on('GAME_SAVED', saved);
    const before = f.data.get(game.config.saveKey);
    f.fail(true);
    expect(game.spawnFromGenerator('coffee_machine').ok).toBe(true);
    expect(game.saveFailed).toBe(true);
    expect(saved).not.toHaveBeenCalled();
    expect(f.data.get(game.config.saveKey)).toBe(before);
    expect(game.spawnFromGenerator('coffee_machine').ok).toBe(true);
    f.fail(false);
    game.flushSave();
    expect(game.saveFailed).toBe(false);
    expect(saved).toHaveBeenCalledTimes(1);
    const restored = createGameContext({ storage: f.storage, deterministic: true });
    expect(restored.life.state.stats.spawns).toBe(2);
    expect(restored.player.energy).toBe(98);
  });

  it('retains a failed debounced write for later lifecycle flush', () => {
    vi.useFakeTimers();
    try {
      const f = fixture();
      const config = loadConfigBundle().game;
      const clock = new FakeClockService(1000);
      const onWrite = vi.fn();
      const save = new SaveService({ storage: f.storage, clock,
        saveKey: config.saveKey, version: 2,
        createDefault: () => createDefaultSaveData(config, clock.now()), debounceMs: 100, onWrite });
      f.fail(true);
      const data = createDefaultSaveData(config, clock.now());
      data.player.coins = 123;
      save.scheduleSave(data);
      expect(() => vi.advanceTimersByTime(100)).not.toThrow();
      expect(onWrite).toHaveBeenLastCalledWith({ ok: false, reason: 'STORAGE_UNAVAILABLE' });
      f.fail(false);
      save.flush();
      expect(JSON.parse(f.data.get(config.saveKey)!).player.coins).toBe(123);
      expect(onWrite).toHaveBeenLastCalledWith({ ok: true, savedAt: 1000 });
    } finally { vi.useRealTimers(); }
  });

  it('blocks startup when reading storage fails without overwriting it', () => {
    const write = vi.fn();
    const storage: StorageAdapter = { getItem: () => { throw new Error('unavailable'); }, setItem: write, removeItem: vi.fn() };
    expect(() => createGameContext({ storage, deterministic: true })).toThrow('原进度未覆盖');
    expect(write).not.toHaveBeenCalled();
  });

  it('restores a valid backup without replacing it with corrupt primary data', () => {
    const f = fixture();
    const config = loadConfigBundle().game;
    const good = createDefaultSaveData(config, 1000);
    good.player.coins = 987;
    const backup = JSON.stringify(good);
    f.data.set(config.saveKey, '{broken');
    f.data.set(`${config.saveKey}:backup`, backup);
    const game = createGameContext({ storage: f.storage, deterministic: true });
    expect(game.loadNotice).toContain('备份恢复');
    expect(game.player.coins).toBe(987);
    expect(f.data.get(`${config.saveKey}:backup`)).toBe(backup);
  });

  it('preserves corrupt data and explains the default recovery', () => {
    const f = fixture();
    const config = loadConfigBundle().game;
    f.data.set(config.saveKey, '{broken');
    const game = createGameContext({ storage: f.storage, deterministic: true });
    expect(game.loadNotice).toContain('原始数据已备份');
    expect(f.data.get(`${config.saveKey}:backup`)).toBe('{broken');
  });

  it('does not replace corrupt data when backing it up fails', () => {
    const f = fixture();
    const config = loadConfigBundle().game;
    f.data.set(config.saveKey, '{broken');
    f.fail(true);
    expect(() => createGameContext({ storage: f.storage, deterministic: true })).toThrow('原进度未覆盖');
    expect(f.data.get(config.saveKey)).toBe('{broken');
  });

  it('announces legacy migration once and stays quiet on normal reload', () => {
    const f = fixture();
    const config = loadConfigBundle().game;
    f.data.set(config.saveKey, JSON.stringify({ ...createDefaultSaveData(config, 1000), version: 1 }));
    const first = createGameContext({ storage: f.storage, deterministic: true });
    expect(first.loadNotice).toContain('旧存档已升级');
    expect(createGameContext({ storage: f.storage, deterministic: true }).loadNotice).toBeNull();
  });
});
