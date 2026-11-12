import { describe, expect, it } from 'vitest';
import { loadConfigBundle, validateConfig } from '../assets/scripts/config/ConfigRepository';
import { createDefaultSaveData } from '../assets/scripts/infrastructure/SaveService';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';

describe('personal story content compatibility', () => {
  it('preserves existing chapter IDs and unlock prices when the narrative changes', () => {
    const bundle = loadConfigBundle();
    expect(bundle.memories).toHaveLength(28);
    const legacy = ['letters', 'first_trip', 'night_view', 'promise', 'wedding',
      'first_home', 'rainy_day', 'birthday', 'garden', 'anniversary'];
    expect(legacy.map((id) => bundle.memories.find((entry) => entry.id === id)?.heartCost))
      .toEqual([50, 80, 100, 120, 150, 180, 210, 240, 270, 300]);
    expect(bundle.memories[0].dateLabel).toBe('2023 年 9 月 8 日 · 舟山');
    expect(bundle.memories[bundle.memories.length - 1].dateLabel).toBe('2026 年 10 月 3 日');
    expect(bundle.game.couple.anniversary).toBe('');
    expect(bundle.game.couple.metDate).toBe('2023-09-08');
    expect(bundle.game.couple.weddingDate).toBe('2026-10-03');
    expect(validateConfig(bundle).filter((issue) => issue.level === 'error')).toEqual([]);
  });

  it('keeps old unlocked chapters and continues at the next chapter without charging twice', () => {
    const bundle = loadConfigBundle();
    const clock = new FakeClockService();
    const save = createDefaultSaveData(bundle.game, clock.now());
    save.life.unlockedMemoryIds = ['letters', 'first_trip', 'night_view'];
    save.player.hearts = 120;
    const values = new Map([[bundle.game.saveKey, JSON.stringify(save)]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    const game = createGameContext({ storage, clock });
    expect(game.unlockMemory('letters')).toEqual({ ok: false, reason: 'ALREADY_OWNED' });
    expect(game.player.hearts).toBe(120);
    expect(game.unlockMemory('promise')).toEqual({ ok: true });
    expect(game.player.hearts).toBe(0);
    expect(createGameContext({ storage, clock }).life.state.unlockedMemoryIds)
      .toEqual(['letters', 'first_trip', 'night_view', 'promise']);
  });

  it('rejects crop focus outside the supported image range', () => {
    const bundle = loadConfigBundle();
    for (const artFocusY of [-0.1, 1.1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const changed = { ...bundle, memories: [{ ...bundle.memories[0], artFocusY }, ...bundle.memories.slice(1)] };
      expect(validateConfig(changed).some((issue) => issue.message.includes('art focus invalid'))).toBe(true);
    }
    for (const artFocusY of [undefined, 0, 0.5, 1]) {
      const changed = { ...bundle, memories: [{ ...bundle.memories[0], artFocusY }, ...bundle.memories.slice(1)] };
      expect(validateConfig(changed).filter((issue) => issue.level === 'error')).toEqual([]);
    }
  });

  it('validates two-row atlas bounds while accepting legacy one-row artwork', () => {
    const bundle = loadConfigBundle();
    const legacy = { ...bundle, memories: bundle.memories.map((entry, i) => i === 0
      ? { ...entry, art: 'memory_sheet_a#4', artColumns: undefined, artRows: undefined } : entry) };
    expect(validateConfig(legacy).filter((issue) => issue.level === 'error')).toEqual([]);
    for (const invalid of [{ art: 'our_story_sheet#10' }, { artColumns: 0 }, { artRows: 1 }]) {
      const changed = { ...bundle, memories: bundle.memories.map((entry, i) => i === bundle.memories.length - 1
        ? { ...entry, art: 'our_story_sheet#9', artColumns: 5, artRows: 2, ...invalid } : entry) };
      expect(validateConfig(changed).some((issue) => issue.message.includes('atlas bounds invalid'))).toBe(true);
    }
  });

  it('allows configuration-driven chapter counts and keeps previously unlocked stories after insertion', () => {
    const bundle = loadConfigBundle();
    expect(validateConfig({ ...bundle, memories: bundle.memories.slice(0, 2), adventures: bundle.adventures.slice(0, 1) }).filter((issue) => issue.level === 'error')).toEqual([]);
    expect(validateConfig({ ...bundle, memories: [] }).some((issue) => issue.message.includes('must not be empty'))).toBe(true);
    const clock = new FakeClockService();
    const save = createDefaultSaveData(bundle.game, clock.now());
    const legacy = ['letters', 'first_trip', 'night_view', 'promise', 'wedding', 'first_home', 'rainy_day', 'birthday', 'garden', 'anniversary'];
    save.life.unlockedMemoryIds = legacy;
    save.player.hearts = bundle.memories[1].heartCost;
    const values = new Map([[bundle.game.saveKey, JSON.stringify(save)]]);
    const storage = { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
    const game = createGameContext({ storage, clock });
    expect(game.life.state.unlockedMemoryIds).toEqual(legacy);
    expect(game.unlockMemory('anniversary')).toEqual({ ok: false, reason: 'ALREADY_OWNED' });
    expect(game.unlockMemory('trampoline_park')).toEqual({ ok: false, reason: 'LOCKED' });
    expect(game.unlockMemory('shenxianju')).toEqual({ ok: true });
    expect(game.player.hearts).toBe(0);
    expect(createGameContext({ storage, clock }).life.state.unlockedMemoryIds).toEqual([...legacy, 'shenxianju']);
  });
});
