import { describe, expect, it } from 'vitest';
import { loadConfigBundle, validateConfig } from '../assets/scripts/config/ConfigRepository';
import { createDefaultSaveData } from '../assets/scripts/infrastructure/SaveService';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';

describe('personal story content compatibility', () => {
  it('preserves existing chapter IDs and unlock prices when the narrative changes', () => {
    const bundle = loadConfigBundle();
    expect(bundle.memories.map((entry) => entry.id)).toEqual([
      'letters', 'first_trip', 'night_view', 'promise', 'wedding',
      'first_home', 'rainy_day', 'birthday', 'garden', 'anniversary',
    ]);
    expect(bundle.memories.map((entry) => entry.heartCost)).toEqual([50, 80, 100, 120, 150, 180, 210, 240, 270, 300]);
    expect(bundle.memories[0].dateLabel).toBe('2023 年 9 月 · 舟山');
    expect(bundle.memories[9].dateLabel).toBe('2026 年 10 月 3 日');
    expect(bundle.game.couple.anniversary).toBe('');
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

  it('validates two-row atlas bounds while accepting legacy one-row artwork', () => {
    const bundle = loadConfigBundle();
    const legacy = { ...bundle, memories: bundle.memories.map((entry, i) => i === 0
      ? { ...entry, art: 'memory_sheet_a#4', artColumns: undefined, artRows: undefined } : entry) };
    expect(validateConfig(legacy).filter((issue) => issue.level === 'error')).toEqual([]);
    for (const invalid of [{ art: 'our_story_sheet#10' }, { artColumns: 0 }, { artRows: 1 }]) {
      const changed = { ...bundle, memories: bundle.memories.map((entry, i) => i === 9 ? { ...entry, ...invalid } : entry) };
      expect(validateConfig(changed).some((issue) => issue.message.includes('atlas bounds invalid'))).toBe(true);
    }
  });
});
