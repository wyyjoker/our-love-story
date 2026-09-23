/**
 * Headless playable-loop smoke against the browser harness bundle logic.
 * Simulates the same GameContext operations the UI drives.
 */
import { describe, expect, it } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';
import { FixedRandomService } from '../assets/scripts/infrastructure/RandomService';
import { SequentialIdService } from '../assets/scripts/infrastructure/IdService';
import type { StorageAdapter } from '../assets/scripts/infrastructure/PlatformService';

function mem(): StorageAdapter {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

describe('Playable loop (UI-independent)', () => {
  it('spawn → move → swap → merge → claim → level path', () => {
    const storage = mem();
    const clock = new FakeClockService(2_000_000);
    const random = new FixedRandomService([0, 0.1, 0.2, 0.3]);
    const game = createGameContext({
      storage,
      clock,
      random,
      ids: new SequentialIdService('p'),
      saveDebounceMs: 0,
    });

    // spawn x2 coffee
    expect(game.spawnFromGenerator('coffee_machine').ok).toBe(true);
    expect(game.spawnFromGenerator('coffee_machine').ok).toBe(true);
    expect(game.player.energy).toBe(48);

    // starter merge
    const merged = game.dropItem(0, 1);
    expect(merged.ok && merged.kind).toBe('MERGE');

    // find two coffee_01 and merge if present
    const board = game.board.getBoard();
    const c1 = board.cells
      .filter((c) => c.item?.definitionId === 'coffee_01')
      .map((c) => c.index);
    if (c1.length >= 2) {
      const m2 = game.dropItem(c1[0], c1[1]);
      expect(m2.ok).toBe(true);
    }

    // swap two different if exist
    const occupied = board.cells.filter((c) => c.item).map((c) => c.index);
    if (occupied.length >= 2) {
      const preview = game.board.previewDrop(occupied[0], occupied[1]);
      if (preview.kind === 'SWAP') {
        const swapped = game.dropItem(occupied[0], occupied[1]);
        expect(swapped.ok && swapped.kind).toBe('SWAP');
      }
    }

    // claim tutorial if ready
    for (const o of game.orders.getOrders()) {
      if (game.orders.canClaim(o.uid)) {
        const beforeCoins = game.player.coins;
        const r = game.claimOrder(o.uid);
        expect(r.ok).toBe(true);
        expect(game.player.coins).toBeGreaterThan(beforeCoins);
        break;
      }
    }

    // force xp toward level 3 unlock path via debug
    game.debugAddXp(200);
    expect(game.player.level).toBeGreaterThanOrEqual(3);
    expect(game.player.unlockedChainIds).toContain('dessert');

    // save reload
    game.save();
    const again = createGameContext({
      storage,
      clock,
      random,
      ids: new SequentialIdService('p2'),
      saveDebounceMs: 0,
    });
    expect(again.player.level).toBe(game.player.level);
    expect(again.player.coins).toBe(game.player.coins);
  });
});
