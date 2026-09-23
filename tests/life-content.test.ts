import { describe, expect, it } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';
import type { StorageAdapter } from '../assets/scripts/infrastructure/PlatformService';

function storage(): StorageAdapter {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

describe('life content loop', () => {
  it('spends hearts sequentially and persists memories and photos', () => {
    const saved = storage();
    const clock = new FakeClockService(1000);
    const game = createGameContext({ storage: saved, clock });
    expect(game.unlockMemory('first_trip')).toEqual({ ok: false, reason: 'LOCKED' });
    game.progression.addHearts(130);
    expect(game.unlockMemory('letters').ok).toBe(true);
    expect(game.player.hearts).toBe(80);
    expect(game.unlockMemory('letters')).toEqual({ ok: false, reason: 'ALREADY_OWNED' });
    expect(game.unlockMemory('first_trip').ok).toBe(true);
    expect(game.player.hearts).toBe(0);
    expect(game.addPhoto('wxfile://memory-1.png').ok).toBe(true);

    const again = createGameContext({ storage: saved, clock });
    expect(again.life.state.unlockedMemoryIds).toEqual(['letters', 'first_trip']);
    expect(again.life.state.photoPaths).toEqual(['wxfile://memory-1.png']);
  });

  it('buys ten furnishings once and reaches 50 decor points', () => {
    const game = createGameContext({ storage: storage(), deterministic: true });
    game.debugAddXp(7650);
    game.debugAddCoins(5000);
    for (const item of game.bundle.furniture) {
      expect(game.buyFurniture(item.id).ok).toBe(true);
      expect(game.buyFurniture(item.id)).toEqual({ ok: false, reason: 'ALREADY_OWNED' });
    }
    expect(game.life.getDecorPoints()).toBe(50);
    expect(game.placeFurniture('sofa').ok).toBe(true);
    expect(game.life.getDecorPoints()).toBe(46);
    expect(game.placeFurniture('sofa').ok).toBe(true);
    expect(game.life.getDecorPoints()).toBe(50);
  });

  it('claims wishes and level rewards only once; reward XP can level again', () => {
    const game = createGameContext({ storage: storage(), deterministic: true });
    game.debugAddXp(150);
    expect(game.player.level).toBe(3);
    expect(game.life.pendingLevelRewards()).toEqual([2, 3]);
    const before = { coins: game.player.coins, hearts: game.player.hearts };
    expect(game.claimLevelReward(3).ok).toBe(true);
    expect(game.player.coins).toBe(before.coins + 200);
    expect(game.player.hearts).toBe(before.hearts + 50);
    expect(game.player.level).toBe(4);
    expect(game.claimLevelReward(3)).toEqual({ ok: false, reason: 'ALREADY_CLAIMED' });
    expect(game.claimWish('flower_time').ok).toBe(true);
    expect(game.claimWish('flower_time')).toEqual({ ok: false, reason: 'ALREADY_CLAIMED' });
  });
});
