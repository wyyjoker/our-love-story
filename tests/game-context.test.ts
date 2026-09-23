import { describe, expect, it } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';
import { FixedRandomService } from '../assets/scripts/infrastructure/RandomService';
import type { StorageAdapter } from '../assets/scripts/infrastructure/PlatformService';

function memStorage(): StorageAdapter {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
}

describe('GameContext full loop', () => {
  it('boot â†?spawn â†?merge â†?claim â†?level progress', () => {
    const storage = memStorage();
    const clock = new FakeClockService(1_000_000);
    const random = new FixedRandomService([0, 0, 0, 0, 0]);
    const game = createGameContext({
      storage,
      clock,
      random,
      saveDebounceMs: 0,
    });

    expect(game.bootState).toBe('READY');
    expect(game.player.level).toBe(1);
    expect(game.player.energy).toBe(100);
    expect(game.player.unlockedChainIds).toEqual(
      expect.arrayContaining(['coffee']),
    );

    // starter: coffee_01 x2 at 0,1 â€?merge them
    const merge = game.dropItem(0, 1);
    expect(merge.ok).toBe(true);
    if (merge.ok) expect(merge.kind).toBe('MERGE');
    // board[1] should be coffee_02 â€?tutorial order ready
    expect(game.orders.canClaim('order_start_1')).toBe(true);

    const claim = game.claimOrder('order_start_1');
    expect(claim.ok).toBe(true);
    expect(game.player.coins).toBe(20);
    expect(game.player.hearts).toBe(1);
    expect(game.player.xp).toBe(10);

    // spawn from generator
    const spawn = game.spawnFromGenerator('coffee_machine');
    expect(spawn.ok).toBe(true);
    expect(game.player.energy).toBe(99);

    // save and reload
    game.save();
    const game2 = createGameContext({ storage, clock, random, saveDebounceMs: 0 });
    expect(game2.player.coins).toBe(game.player.coins);
    expect(game2.player.energy).toBe(game.player.energy);
    expect(game2.player.xp).toBe(game.player.xp);
  });

  it('offline energy recovery on boot', () => {
    const storage = memStorage();
    const clock = new FakeClockService(1_000_000);
    const game = createGameContext({ storage, clock, saveDebounceMs: 0 });
    game.player.energy = 40;
    game.player.lastEnergyAt = 1_000_000;
    game.save();

    // 10 minutes later
    clock.advance(600_000);
    const game2 = createGameContext({ storage, clock, saveDebounceMs: 0 });
    // 600/240 = 2
    expect(game2.player.energy).toBe(42);
  });
});
