import { describe, expect, it } from 'vitest';
import { loadConfigBundle, validateConfig, type ConfigBundle } from '../assets/scripts/config/ConfigRepository';
import { requirementsBaseCost } from '../assets/scripts/core/play/types';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import type { StorageAdapter } from '../assets/scripts/infrastructure/PlatformService';

const giftFields = ['coverMessage', 'title', 'salutation', 'body', 'signoff', 'signature'] as const;

// loadConfigBundle exposes imported JSON: never mutate its shared objects in negative tests.
function withGift(gift: unknown, present = true): ConfigBundle {
  const bundle = loadConfigBundle();
  const game = JSON.parse(JSON.stringify(bundle.game)) as ConfigBundle['game'];
  const couple = game.couple as unknown as Record<string, unknown>;
  if (present) couple.gift = gift;
  else delete couple.gift;
  return { ...bundle, game };
}

function errors(bundle: ConfigBundle) {
  return validateConfig(bundle).filter((issue) => issue.level === 'error');
}

const originalSmallDates = [
  {
    id: 'small_date_morning_coffee', title: '晨间咖啡',
    description: '不用等特别的日子，早起磨一杯咖啡，把清晨留给彼此。', memoryId: 'letters', minLevel: 1,
    requirements: [{ itemId: 'coffee_02', count: 1 }, { itemId: 'coffee_01', count: 1 }], rewardCoins: 16, rewardXp: 8, rewardHearts: 2,
  },
  {
    id: 'small_date_window_tea', title: '窗边下午茶',
    description: '把甜点和咖啡搬到窗边，看一会儿云，也说一会儿话。', memoryId: 'first_trip', minLevel: 5,
    requirements: [{ itemId: 'coffee_03', count: 1 }, { itemId: 'dessert_02', count: 1 }], rewardCoins: 20, rewardXp: 10, rewardHearts: 3,
  },
  {
    id: 'small_date_walk_flowers', title: '散步带花',
    description: '沿着熟悉的小路慢慢走，顺手带一枝花回家。', memoryId: 'shenxianju', minLevel: 3,
    requirements: [{ itemId: 'flower_02', count: 1 }, { itemId: 'coffee_02', count: 1 }], rewardCoins: 18, rewardXp: 9, rewardHearts: 2,
  },
  {
    id: 'small_date_movie_night', title: '电影小夜晚',
    description: '挑一部老电影，准备一点甜点，关掉灯就是一个晚上。', memoryId: 'new_year_balloons', minLevel: 5,
    requirements: [{ itemId: 'dessert_02', count: 1 }, { itemId: 'coffee_01', count: 1 }], rewardCoins: 19, rewardXp: 9, rewardHearts: 3,
  },
];

describe('optional couple gift configuration', () => {
  it('accepts omission, an empty object, and all six empty strings', () => {
    expect(errors(withGift(undefined, false))).toEqual([]);
    expect(errors(withGift({}))).toEqual([]);
    expect(errors(withGift(Object.fromEntries(giftFields.map((field) => [field, '']))))).toEqual([]);
  });

  it.each(giftFields)('accepts optional string field %s on its own without requiring any other field', (field) => {
    expect(errors(withGift({ [field]: '给你的一点心意\n愿每天都有小小欢喜。' }))).toEqual([]);
    expect(errors(withGift({ [field]: '' }))).toEqual([]);
  });

  it.each([null, [], ['letter'], 'letter', 12, false])('returns an error, not an exception, for malformed gift object %j', (gift) => {
    const bundle = withGift(gift);
    expect(() => validateConfig(bundle)).not.toThrow();
    expect(errors(bundle).some((issue) => /gift/i.test(issue.message))).toBe(true);
  });

  it.each(giftFields)('rejects every non-string form for gift.%s, including explicit undefined', (field) => {
    for (const value of [undefined, null, 0, false, [], {}, ['text']]) {
      const bundle = withGift({ [field]: value });
      expect(() => validateConfig(bundle), `${field}: ${String(value)}`).not.toThrow();
      expect(errors(bundle).some((issue) => issue.message.includes(field)), `${field}: ${String(value)}`).toBe(true);
    }
  });

  it('reports all invalid fields and leaves imported production config untouched', () => {
    const before = JSON.stringify(loadConfigBundle().game);
    const bundle = withGift(Object.fromEntries(giftFields.map((field) => [field, null])));
    const issues = errors(bundle);
    for (const field of giftFields) expect(issues.some((issue) => issue.message.includes(field))).toBe(true);
    expect(JSON.stringify(loadConfigBundle().game)).toBe(before);
    expect(errors(loadConfigBundle())).toEqual([]);
  });
});

describe('small-date content and unchanged original economy', () => {
  it('preserves all original four definitions verbatim and appends exactly four affordable themes', () => {
    const bundle = loadConfigBundle();
    expect(bundle.smallDates).toHaveLength(8);
    expect(bundle.smallDates.slice(0, 4)).toEqual(originalSmallDates);
    expect(new Set(bundle.smallDates.map((date) => date.id)).size).toBe(8);
    expect(new Set(bundle.smallDates.map((date) => date.title)).size).toBe(8);
    for (const date of bundle.smallDates.slice(4)) {
      expect(date.id).toMatch(/^small_date_[a-z0-9_]+$/);
      expect(bundle.memories.some((memory) => memory.id === date.memoryId)).toBe(true);
      expect(date.requirements.length).toBeGreaterThan(0);
      for (const requirement of date.requirements) {
        expect(bundle.catalog.get(requirement.itemId)?.level).toBeLessThanOrEqual(3);
        expect(Number.isInteger(requirement.count)).toBe(true);
        expect(requirement.count).toBeGreaterThan(0);
      }
      const cost = requirementsBaseCost(date.requirements, (id) => bundle.catalog.get(id)?.level);
      expect(cost).toBeGreaterThanOrEqual(2);
      expect(cost).toBeLessThanOrEqual(8);
    }
    expect(errors(bundle)).toEqual([]);
  });

  it('delivers the unchanged original Lv1 order for its exact rewards and rotates to the added Lv1 theme', () => {
    const values = new Map<string, string>();
    const storage: StorageAdapter = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: (key) => { values.delete(key); },
    };
    const game = createGameContext({ deterministic: true, storage });
    const date = game.play.smallDateOrder()!;
    expect(date.template).toEqual(originalSmallDates[0]);
    game.debugClearBoard();
    for (const requirement of date.template.requirements) {
      for (let i = 0; i < requirement.count; i++) game.debugSpawn(requirement.itemId);
    }
    const before = { ...game.player }, memories = [...game.life.state.unlockedMemoryIds], scissors = game.play.state.scissors;
    expect(game.playAction('small_date', date.token)).toEqual({ ok: true });
    expect(game.player.coins - before.coins).toBe(16);
    expect(game.player.xp - before.xp).toBe(8);
    expect(game.player.hearts - before.hearts).toBe(2);
    expect(game.player.energy).toBe(before.energy);
    expect(game.play.state.scissors).toBe(scissors);
    expect(game.life.state.unlockedMemoryIds).toEqual(memories);
    expect(game.playAction('small_date', date.token)).toEqual({ ok: false, reason: 'STALE_DATE' });
    const next = game.play.smallDateOrder()!;
    expect(next.template.id).toBe('small_date_shared_coffee');
    expect(next.template.minLevel).toBe(1);
    expect(next.template.requirements.every((req) => game.bundle.catalog.get(req.itemId)?.chainId === 'coffee')).toBe(true);
    const restored = createGameContext({ deterministic: true, storage });
    expect(restored.play.smallDateOrder()?.token).toBe(next.token);
    expect(restored.play.state.smallDate).toMatchObject({ completed: 1 });
  });
});
