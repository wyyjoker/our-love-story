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
    const second = game.bundle.memories[1];
    game.progression.addHearts(50 + second.heartCost);
    expect(game.unlockMemory('letters').ok).toBe(true);
    expect(game.player.hearts).toBe(second.heartCost);
    expect(game.unlockMemory('letters')).toEqual({ ok: false, reason: 'ALREADY_OWNED' });
    expect(game.unlockMemory(second.id).ok).toBe(true);
    expect(game.player.hearts).toBe(0);
    expect(game.addPhoto('wxfile://memory-1.png').ok).toBe(true);

    const again = createGameContext({ storage: saved, clock });
    expect(again.life.state.unlockedMemoryIds).toEqual(['letters', second.id]);
    expect(again.life.state.photoPaths).toEqual(['wxfile://memory-1.png']);
  });

  it('buys ten furnishings once and reaches 50 decor points', () => {
    const game = createGameContext({ storage: storage(), deterministic: true });
    game.debugAddXp(7650);
    game.debugAddCoins(5000);
    for (const item of game.bundle.furniture.slice(0, 10)) {
      expect(game.buyFurniture(item.id).ok).toBe(true);
      expect(game.buyFurniture(item.id)).toEqual({ ok: false, reason: 'ALREADY_OWNED' });
    }
    expect(game.life.getDecorPoints()).toBe(50);
    expect(game.placeFurniture('sofa').ok).toBe(true);
    expect(game.life.getDecorPoints()).toBe(46);
    expect(game.placeFurniture('sofa').ok).toBe(true);
    expect(game.life.getDecorPoints()).toBe(50);
  });


  it('places and restores furnishings across six independent rooms', () => {
    const saved = storage();
    const game = createGameContext({ storage: saved, deterministic: true });
    game.debugAddXp(7650); game.debugAddCoins(20000);
    expect(game.bundle.furniture).toHaveLength(30);
    expect(new Set(game.bundle.furniture.map((item) => item.room))).toEqual(new Set(['living', 'bedroom', 'garden', 'study', 'terrace', 'pool']));
    for (const item of game.bundle.furniture) expect(game.buyFurniture(item.id).ok).toBe(true);
    expect(game.life.getDecorPoints()).toBe(game.bundle.furniture.reduce((total, item) => total + item.decorPoints, 0));
    for (const room of ['living', 'bedroom', 'garden', 'study', 'terrace', 'pool'] as const) {
      const item = game.bundle.furniture.find((entry) => entry.room === room)!;
      expect(game.moveFurniture(item.id, 0.25, 0.75).ok).toBe(true);
      expect(game.life.state.furniturePositions[item.id]).toEqual({ x: 0.25, y: 0.75 });
    }
    const restored = createGameContext({ storage: saved, deterministic: true });
    for (const room of ['living', 'bedroom', 'garden', 'study', 'terrace', 'pool'] as const) {
      const item = restored.bundle.furniture.find((entry) => entry.room === room)!;
      expect(restored.life.state.furniturePositions[item.id]).toEqual({ x: 0.25, y: 0.75, scale: 1, rotation: 0, flipped: false });
      expect(restored.resetFurniturePosition(item.id).ok).toBe(true);
      expect(restored.life.state.furniturePositions[item.id]).toBeUndefined();
      expect(restored.placeFurniture(item.id).ok).toBe(true);
      expect(restored.life.state.placedFurnitureIds).not.toContain(item.id);
      expect(restored.placeFurniture(item.id).ok).toBe(true);
    }
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
