import { describe, expect, it } from 'vitest';
import { loadConfigBundle, validateConfig } from '../assets/scripts/config/ConfigRepository';
import { createDefaultSaveData } from '../assets/scripts/infrastructure/SaveService';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { memoryVisibility } from '../assets/scripts/presentation/MemoryVisibility';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';

describe('personal story content compatibility', () => {
  it('preserves existing chapter IDs and unlock prices when the narrative changes', () => {
    const bundle = loadConfigBundle();
    expect(bundle.memories).toHaveLength(42);
    const legacy = ['letters', 'first_trip', 'night_view', 'promise', 'wedding',
      'first_home', 'rainy_day', 'birthday', 'garden', 'anniversary'];
    expect(legacy.map((id) => bundle.memories.find((entry) => entry.id === id)?.heartCost))
      .toEqual([50, 80, 100, 120, 150, 180, 210, 240, 270, 300]);
    expect(bundle.memories[0].dateLabel).toBe('2023 年 9 月 8 日 · 舟山');
    expect(bundle.memories.find((memory) => memory.id === 'anniversary')?.dateLabel).toBe('2026 年 10 月 3 日');
    expect(bundle.game.couple.anniversary).toBe('');
    expect(bundle.game.couple.metDate).toBe('2023-09-08');
    expect(bundle.game.couple.weddingDate).toBe('2026-10-03');
    expect(bundle.memories.find(memory=>memory.id==='xian_terracotta')?.dateLabel).toBe('2026 年 8 月 27 日起 · 西安');
    expect(validateConfig(bundle).filter((issue) => issue.level === 'error')).toEqual([]);
  });


  it('keeps all locked story content out of the presentation and separates the three October events', () => {
    const bundle = loadConfigBundle();
    for (const memory of bundle.memories) {
      const hidden = memoryVisibility(memory, false);
      expect(hidden.art).toBeNull();
      expect(hidden.date).toBe('');
      expect(JSON.stringify(hidden)).not.toContain(memory.title);
      expect(JSON.stringify(hidden)).not.toContain(memory.diary);
      expect(memoryVisibility(memory, true)).toMatchObject({ title: memory.title, diary: memory.diary, art: memory.art });
    }
    const events = bundle.memories.slice(-3);
    expect(events.map((m) => m.id)).toEqual(['anniversary', 'marriage_registration', 'wedding_thanksgiving']);
    expect(events.map((m) => m.dateLabel)).toEqual(['2026 年 10 月 3 日', '2026 年 10 月 20 日', '2026 年 10 月 31 日 · 仙居']);
    expect(events[0].diary).not.toContain('领了证');
    expect(events[0].diary).not.toContain('答谢宴');
    expect(new Set(events.map((m) => m.art)).size).toBe(3);
  });

  it('inserts the twelve additional memories beside their source stories', () => {
    const memories = loadConfigBundle().memories;
    const groups: Array<[string, string[]]> = [
      ['letters', ['zhoushan_bonfire']], ['night_view', ['qinwang_palace', 'hengdian_hot_spring']],
      ['promise', ['huangshan_trip', 'qiandao_lake', 'wangchen_pavilion']], ['jeju_first', ['shanghai_departure']],
      ['barbie_summer', ['nanhu_boat']], ['snow_and_family', ['hengdian_family']],
      ['hangzhou_wedding', ['wedding_mv']], ['summer_before_wedding', ['concert', 'xian_terracotta']],
    ];
    for (const [source, additions] of groups) {
      const index = memories.findIndex((memory) => memory.id === source);
      expect(memories.slice(index + 1, index + 1 + additions.length).map((memory) => memory.id)).toEqual(additions);
      for (const memory of memories.slice(index + 1, index + 1 + additions.length)) {
        expect(memory.heartCost).toBeGreaterThanOrEqual(40);
        expect(memory.heartCost).toBeLessThanOrEqual(100);
        expect(memory.art).toMatch(/^story_(3[1-9]|4[0-2])_/);
      }
    }
  });

  it('unlocks the three October memories separately on a new save', () => {
    const bundle = loadConfigBundle();
    const clock = new FakeClockService();
    const save = createDefaultSaveData(bundle.game, clock.now());
    save.life.unlockedMemoryIds = bundle.memories.slice(0, bundle.memories.findIndex((memory) => memory.id === 'anniversary')).map((memory) => memory.id);
    save.player.hearts = 540;
    const values = new Map([[bundle.game.saveKey, JSON.stringify(save)]]);
    const storage = { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
    const game = createGameContext({ storage, clock });
    expect(game.unlockMemory('marriage_registration')).toEqual({ ok: false, reason: 'LOCKED' });
    expect(game.unlockMemory('anniversary').ok).toBe(true);
    expect(game.life.state.unlockedMemoryIds).not.toContain('marriage_registration');
    expect(game.unlockMemory('marriage_registration').ok).toBe(true);
    expect(game.life.state.unlockedMemoryIds).not.toContain('wedding_thanksgiving');
    expect(game.unlockMemory('wedding_thanksgiving').ok).toBe(true);
    expect(game.play.isAvailable('memory_wedding_thanksgiving')).toBe(true);
    expect(game.player.hearts).toBe(0);
  });

  it('keeps old unlocked chapters and continues at the next chapter without charging twice', () => {
    const bundle = loadConfigBundle();
    const clock = new FakeClockService();
    const save = createDefaultSaveData(bundle.game, clock.now());
    save.life.unlockedMemoryIds = ['letters', 'first_trip', 'night_view', 'qinwang_palace', 'hengdian_hot_spring'];
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
      .toEqual(['letters', 'first_trip', 'night_view', 'qinwang_palace', 'hengdian_hot_spring', 'promise']);
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
    save.life.unlockedMemoryIds = [...legacy, 'zhoushan_bonfire'];
    save.player.hearts = bundle.memories.find((memory) => memory.id === 'shenxianju')!.heartCost;
    const values = new Map([[bundle.game.saveKey, JSON.stringify(save)]]);
    const storage = { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
    const game = createGameContext({ storage, clock });
    expect(game.life.state.unlockedMemoryIds).toEqual([...legacy, 'zhoushan_bonfire']);
    expect(game.unlockMemory('anniversary')).toEqual({ ok: false, reason: 'ALREADY_OWNED' });
    expect(game.unlockMemory('trampoline_park')).toEqual({ ok: false, reason: 'LOCKED' });
    expect(game.unlockMemory('shenxianju')).toEqual({ ok: true });
    expect(game.player.hearts).toBe(0);
    expect(createGameContext({ storage, clock }).life.state.unlockedMemoryIds).toEqual([...legacy, 'zhoushan_bonfire', 'shenxianju']);
  });
});
