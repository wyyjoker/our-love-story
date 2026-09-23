/**
 * Runtime self-test on boot (dev). Uses an isolated GameContext — never touches real save.
 * Prints [SELF_TEST] PASS/FAIL to help verify playable core without GUI.
 */
import { createGameContext } from '../gameplay/GameContext';
import { FakeClockService } from '../infrastructure/ClockService';
import { FixedRandomService } from '../infrastructure/RandomService';
import { SequentialIdService } from '../infrastructure/IdService';
import type { StorageAdapter } from '../infrastructure/PlatformService';
import { GameLogger } from '../infrastructure/GameLogger';

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

export function runRuntimeSelfTest(logger: GameLogger = new GameLogger(true)): boolean {
  try {
    const storage = memStorage();
    const clock = new FakeClockService(1_000_000);
    const random = new FixedRandomService([0, 0, 0, 0]);
    const game = createGameContext({
      storage,
      clock,
      random,
      ids: new SequentialIdService('self'),
      saveDebounceMs: 0,
      logger,
    });

    // spawn
    const spawn = game.spawnFromGenerator('coffee_machine');
    if (!spawn.ok) throw new Error(`spawn failed: ${spawn.reason}`);

    // move starter coffee_01 pair -> merge path uses default board cells 0,1
    const merge = game.dropItem(0, 1);
    if (!merge.ok || merge.kind !== 'MERGE') {
      throw new Error(`merge failed: ${JSON.stringify(merge)}`);
    }

    // move + swap smoke via board service
    const board = game.board.getBoard();
    const from = board.cells.findIndex((c) => c.item);
    const empty = board.cells.find((c) => !c.item)?.index ?? 0;
    if (from >= 0) {
      const moved = game.dropItem(from, empty);
      if (!moved.ok) throw new Error('move failed');
    }

    // claim if tutorial order ready
    const orders = game.orders.getOrders();
    for (const o of orders) {
      if (game.orders.canClaim(o.uid)) {
        const claim = game.claimOrder(o.uid);
        if (!claim.ok) throw new Error(`claim failed: ${claim.reason}`);
        break;
      }
    }

    // save roundtrip
    const starterFurnitureId = game.bundle.furniture[0].id;
    game.progression.addCoins(game.bundle.furniture[0].coinCost);
    if (!game.buyFurniture(starterFurnitureId).ok) {
      throw new Error('furniture purchase failed');
    }
    game.save();
    const game2 = createGameContext({
      storage,
      clock,
      random,
      ids: new SequentialIdService('self2'),
      saveDebounceMs: 0,
      logger,
    });
    if (game2.player.energy > game.player.energy) {
      throw new Error('save roundtrip energy mismatch');
    }
    if (!game2.life.state.ownedFurnitureIds.includes(starterFurnitureId)
      || !game2.life.state.placedFurnitureIds.includes(starterFurnitureId)) {
      throw new Error('save roundtrip furniture mismatch');
    }

    logger.info('BOOT', '[SELF_TEST] PASS');
    return true;
  } catch (err) {
    logger.error('BOOT', '[SELF_TEST] FAIL', err);
    return false;
  }
}
