import { describe, expect, it } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';
import { FixedRandomService } from '../assets/scripts/infrastructure/RandomService';
import { SequentialIdService } from '../assets/scripts/infrastructure/IdService';
import type { StorageAdapter } from '../assets/scripts/infrastructure/PlatformService';

describe('full progression with production configuration', () => {
  it('earns Lv18, all stories, furniture and wishes through gameplay, then restores them', () => {
    const values = new Map<string, string>();
    const storage: StorageAdapter = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: (key) => { values.delete(key); },
    };
    const clock = new FakeClockService();
    const ids = new SequentialIdService('full');
    const options = { storage, clock, ids, random: new FixedRandomService([0.1]), saveDebounceMs: 0 };
    let game = createGameContext(options);
    expect(game.player.level).toBe(1);
    expect(game.board.getBoard().cells).toHaveLength(42);
    expect(game.player.unlockedChainIds).toEqual(['coffee']);
    const levels: number[] = [];
    const subscribe = () => game.bus.on('LEVEL_UP', ({ level }) => levels.push(level));
    let unsubscribe = subscribe();

    // Drive the same public actions as the client. Advance the clock to recover
    // energy rather than injecting currency, XP, items, or progress counters.
    function craft(id: string, reserved: Set<number>): number {
      const existing = game.board.getBoard().cells.find((cell) =>
        cell.item?.definitionId === id && !reserved.has(cell.index));
      if (existing) return existing.index;
      const previous = game.bundle.items.find((item) => item.nextItemId === id);
      if (previous) {
        const first = craft(previous.id, reserved);
        reserved.add(first);
        const second = craft(previous.id, reserved);
        reserved.delete(first);
        const merge = game.dropItem(first, second);
        expect(merge.ok && merge.kind).toBe('MERGE');
        return second;
      }
      const generator = game.bundle.generators.find((entry) => entry.outputs[0].itemId === id);
      if (!generator) throw new Error(`No generator for ${id}`);
      if (game.player.energy < generator.energyCost) {
        clock.advance(game.config.energy.recoverIntervalMs * game.player.maxEnergy);
        game.tick();
      }
      let result = game.spawnFromGenerator(generator.id);
      if (!result.ok && (result.reason === 'NO_CHARGES' || result.reason === 'GENERATOR_COOLDOWN')) {
        const status = game.getGeneratorStatus(generator.id);
        clock.advance(result.reason === 'NO_CHARGES' ? status?.nextRecoveryMs ?? 0 : status?.remainingCooldownMs ?? 0);
        result = game.spawnFromGenerator(generator.id);
      }
      if (!result.ok) throw new Error(`Cannot produce ${id}: ${result.reason}`);
      expect(result.itemDefinitionId).toBe(id);
      return result.cellIndex;
    }

    function claimContent(): void {
      let pending = game.life.pendingLevelRewards();
      while (pending.length > 0) {
        expect(game.claimLevelReward(pending[0])).toEqual({ ok: true });
        // Lv3's reward can add another level while draining the queue.
        pending = game.life.pendingLevelRewards();
      }
      for (const item of game.bundle.furniture) {
        if (!game.life.state.ownedFurnitureIds.includes(item.id)
          && game.player.level >= item.unlockLevel && game.player.coins >= item.coinCost) {
          const before = game.player.coins;
          expect(game.buyFurniture(item.id)).toEqual({ ok: true });
          expect(game.player.coins).toBe(before - item.coinCost);
        }
      }
      for (const memory of game.bundle.memories) {
        if (!game.life.state.unlockedMemoryIds.includes(memory.id)) {
          if (game.player.hearts < memory.heartCost) break;
          const before = game.player.hearts;
          expect(game.unlockMemory(memory.id)).toEqual({ ok: true });
          expect(game.player.hearts).toBe(before - memory.heartCost);
        }
      }
      for (const wish of game.bundle.wishes) {
        if (!game.life.state.claimedWishIds.includes(wish.id) && game.life.getWishProgress(wish) >= wish.target) {
          expect(game.claimWish(wish.id)).toEqual({ ok: true });
        }
      }
    }

    const complete = () => game.player.level === 18
      && game.life.state.unlockedMemoryIds.length === game.bundle.memories.length
      && game.life.state.ownedFurnitureIds.length === game.bundle.furniture.length
      && game.life.state.claimedWishIds.length === 10;
    for (let count = 0; count < 1500 && !complete(); count += 1) {
      const order = game.orders.getOrders()[0];
      expect(order).toBeDefined();
      const reserved = new Set<number>();
      for (const requirement of order.requirements) {
        for (let item = 0; item < requirement.count; item += 1) {
          reserved.add(craft(requirement.itemId, reserved));
        }
      }
      expect(game.orders.canClaim(order.uid)).toBe(true);
      const before = { coins: game.player.coins, hearts: game.player.hearts };
      expect(game.claimOrder(order.uid).ok).toBe(true);
      expect(game.player.coins).toBe(before.coins + order.rewardCoins);
      expect(game.player.hearts).toBe(before.hearts + order.rewardHearts);
      expect(game.claimOrder(order.uid)).toEqual({ ok: false, reason: 'ORDER_NOT_FOUND' });
      expect(game.orders.getOrders()).toHaveLength(3);
      claimContent();

      // Interrupt actual progression to verify it resumes from a partial save.
      if (count === 20) {
        game.tick();
        const beforeReload = game.buildSaveData();
        game.flushSave();
        unsubscribe();
        game = createGameContext(options);
        unsubscribe = subscribe();
        expect(game.buildSaveData()).toEqual(beforeReload);
      }
    }
    expect(complete()).toBe(true);
    expect(levels).toEqual(Array.from({ length: 17 }, (_, index) => index + 2));
    expect(game.life.getDecorPoints()).toBe(game.bundle.furniture.reduce((sum, item) => sum + item.decorPoints, 0));
    expect(game.player.unlockedChainIds).toEqual(['coffee', 'fruit', 'flower', 'dessert', 'gift']);
    // Every regular chain's last item is reachable on the same 6x7 board.
    for (const item of game.bundle.items.filter((entry) => ['coffee', 'flower', 'dessert', 'gift'].includes(entry.chainId) && !entry.nextItemId)) {
      const index = craft(item.id, new Set());
      expect(game.board.getBoard().cells[index].item?.definitionId).toBe(item.id);
    }
    expect(game.addPhoto('wxfile://full-progression.png')).toEqual({ ok: true });
    // The clock has advanced while crafting; settle natural recovery before
    // comparing a snapshot to the normal cold-boot recovery path.
    game.tick();
    const beforeReload = game.buildSaveData();
    unsubscribe();
    game.flushSave();
    game = createGameContext(options);
    expect(game.buildSaveData()).toEqual(beforeReload);
    const wallet = { coins: game.player.coins, hearts: game.player.hearts, xp: game.player.xp };
    for (const wish of game.bundle.wishes) {
      expect(game.claimWish(wish.id)).toEqual({ ok: false, reason: 'ALREADY_CLAIMED' });
    }
    for (let level = 2; level <= 18; level += 1) {
      expect(game.claimLevelReward(level)).toEqual({ ok: false, reason: 'ALREADY_CLAIMED' });
    }
    expect({ coins: game.player.coins, hearts: game.player.hearts, xp: game.player.xp }).toEqual(wallet);
    expect(game.life.state.photoPaths).toEqual(['wxfile://full-progression.png']);
  }, 20_000);
});
