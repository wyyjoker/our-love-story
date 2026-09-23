import { describe, expect, it } from 'vitest';
import { loadConfigBundle } from '../assets/scripts/config/ConfigRepository';
import { BoardService } from '../assets/scripts/gameplay/BoardService';
import { EnergyService } from '../assets/scripts/gameplay/EnergyService';
import { GeneratorService } from '../assets/scripts/gameplay/GeneratorService';
import { OrderService } from '../assets/scripts/gameplay/OrderService';
import { ProgressionService } from '../assets/scripts/gameplay/ProgressionService';
import { GameEventBus } from '../assets/scripts/events/GameEventBus';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';
import { FixedRandomService } from '../assets/scripts/infrastructure/RandomService';
import { SequentialIdService } from '../assets/scripts/infrastructure/IdService';
import type { PlayerState } from '../assets/scripts/core/types';
import { filterOrderTemplates } from '../assets/scripts/core/order/orders';

function makePlayer(): PlayerState {
  return {
    level: 1,
    xp: 0,
    coins: 0,
    hearts: 0,
    energy: 50,
    maxEnergy: 50,
    lastEnergyAt: 0,
    unlockedChainIds: ['coffee', 'flower'],
  };
}

function setup() {
  const bundle = loadConfigBundle();
  const bus = new GameEventBus();
  const player = makePlayer();
  const ids = new SequentialIdService('o');
  const board = new BoardService(
    bundle.catalog,
    ids,
    bus,
    bundle.game.board.rows,
    bundle.game.board.columns,
  );
  const energy = new EnergyService(player, new FakeClockService(), bus, 120_000);
  const progression = new ProgressionService(
    player,
    bundle.progression,
    bundle.generators,
    bus,
  );
  const orders = new OrderService(
    bundle.orders,
    bundle.catalog,
    board,
    player,
    progression,
    new FixedRandomService([0]),
    ids,
    bus,
    3,
    bundle.game.orders.minItemLevel,
    bundle.game.orders.maxItemLevel,
  );
  orders.hydrate(
    [
      {
        uid: 'ord1',
        templateId: 'order_tutorial_coffee',
        requirements: [{ itemId: 'coffee_02', count: 1 }],
        rewardCoins: 20,
        rewardXp: 10,
        rewardHearts: 1,
      },
      {
        uid: 'ord2',
        templateId: 'order_flower_seed',
        requirements: [{ itemId: 'flower_01', count: 2 }],
        rewardCoins: 12,
        rewardXp: 6,
        rewardHearts: 1,
      },
      {
        uid: 'ord3',
        templateId: 'order_coffee_powder',
        requirements: [{ itemId: 'coffee_02', count: 1 }],
        rewardCoins: 18,
        rewardXp: 8,
        rewardHearts: 1,
      },
    ],
    ['order_tutorial_coffee', 'order_flower_seed', 'order_coffee_powder'],
  );
  const gen = new GeneratorService(
    bundle.generators,
    bundle.catalog,
    board,
    energy,
    player,
    new FixedRandomService([0]),
    new FakeClockService(),
  );
  return { bundle, player, board, energy, progression, orders, gen, bus };
}

describe('OrderService', () => {
  it('cannot claim when requirements not met', () => {
    const { orders } = setup();
    expect(orders.canClaim('ord1')).toBe(false);
    const result = orders.claim('ord1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('INVENTORY_RACE');
  });

  it('can claim when satisfied; deducts items and grants rewards', () => {
    const { orders, board, player, progression } = setup();
    board.spawn('coffee_02');
    expect(orders.canClaim('ord1')).toBe(true);
    const result = orders.claim('ord1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rewardCoins).toBe(20);
      expect(result.rewardXp).toBe(10);
      expect(result.rewardHearts).toBe(1);
    }
    expect(player.coins).toBe(20);
    expect(player.hearts).toBe(1);
    expect(progression.xp).toBe(10);
    // coffee_02 consumed
    const items = board
      .getBoard()
      .cells.filter((c) => c.item?.definitionId === 'coffee_02');
    expect(items).toHaveLength(0);
    // order replaced
    expect(orders.getOrders()).toHaveLength(3);
    expect(orders.getOrders().some((o) => o.uid === 'ord1')).toBe(false);
  });

  it('deducts correct items (lowest index first)', () => {
    const { orders, board } = setup();
    // place flower_01 at 0 and 5, coffee_02 at 1
    board.placeAt(0, 'flower_01');
    board.placeAt(5, 'flower_01');
    board.placeAt(1, 'coffee_02');
    orders.claim('ord2');
    const cells = board.getBoard().cells;
    expect(cells[0].item).toBeUndefined();
    expect(cells[5].item).toBeUndefined();
    expect(cells[1].item?.definitionId).toBe('coffee_02');
  });

  it('does not generate orders for locked chains', () => {
    const { bundle, player } = setup();
    const filtered = filterOrderTemplates(
      bundle.orders,
      player.level,
      bundle.catalog,
      player.unlockedChainIds,
      bundle.game.orders.minItemLevel,
      bundle.game.orders.maxItemLevel,
    );
    for (const t of filtered) {
      for (const req of t.requirements) {
        const def = bundle.catalog.get(req.itemId)!;
        expect(player.unlockedChainIds).toContain(def.chainId);
        expect(def.level).toBeGreaterThanOrEqual(2);
        expect(def.level).toBeLessThanOrEqual(5);
      }
    }
  });
});
