import { describe, expect, it } from 'vitest';
import { loadConfigBundle } from '../assets/scripts/config/ConfigRepository';
import { generateOrder, requirementSignature } from '../assets/scripts/core/order/orders';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { OrderService } from '../assets/scripts/gameplay/OrderService';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';
import { SequentialIdService } from '../assets/scripts/infrastructure/IdService';
import type { ActiveOrder } from '../assets/scripts/core/types';

const bundle = loadConfigBundle();
function generated(level: number, roll: number, activeOrders: ActiveOrder[] = [], chains = ['coffee', 'flower', 'dessert', 'gift', 'fruit']) {
  return generateOrder({ player: { level, unlockedChainIds: chains }, templates: bundle.orders, catalog: bundle.catalog,
    recentOrderIds: [], activeOrders, minItemLevel: 2, maxItemLevel: 5, limitedChainIds: ['fruit'],
    random: { next: () => roll, pickIndex: () => 0 }, id: 'new' })!;
}

describe('dynamic orders', () => {
  it('uses the correct requirement counts and energy-based reward across level bands', () => {
    for (const level of [1, 5, 6, 10, 11, 18, 30]) {
      const order = generated(level, 0.8);
      expect(order.requirements.reduce((sum, requirement) => sum + requirement.count, 0)).toBe(1);
      const cost = order.requirements.reduce((sum, req) => sum + req.count * 2 ** (bundle.catalog.get(req.itemId)!.level - 1), 0);
      const factor = 1.2 + 0.6 * (Math.min(18, level) - 1) / 17;
      expect(order.rewardCoins).toBe(Math.ceil(cost * factor));
      expect(order.rewardXp).toBeGreaterThan(0);
      expect(order.requirements.every((r) => bundle.catalog.get(r.itemId)?.chainId !== 'fruit')).toBe(true);
    }
  });
  it('uses the 20% rare threshold only for unlocked fruit and at most one occupied slot', () => {
    const fruit = (order: ActiveOrder) => order.requirements.some((r) => bundle.catalog.get(r.itemId)?.chainId === 'fruit');
    const rare = generated(11, 0.1999); expect(fruit(rare)).toBe(true);
    expect(fruit(generated(11, 0.2))).toBe(false);
    expect(fruit(generated(2, 0))).toBe(true);
    expect(fruit(generated(2, 0, [], ['coffee']))).toBe(false);
    expect(fruit(generated(11, 0, [rare]))).toBe(false);
    expect(fruit(generated(11, 0, [], ['coffee']))).toBe(false);
  });
  it('selects the rare branch for exactly twenty of one hundred evenly spaced rolls', () => {
    let rare = 0;
    for (let i = 0; i < 100; i++) {
      const order = generated(18, (i + 0.5) / 100);
      if (order.requirements.some((req) => bundle.catalog.get(req.itemId)?.chainId === 'fruit')) rare++;
    }
    expect(rare).toBe(20);
    let two = 0;
    for (let i = 0; i < 100; i++) {
      const order = generated(18, (i + 0.5) / 100);
      if (order.requirements.reduce((sum, requirement) => sum + requirement.count, 0) === 2) two++;
    }
    expect(two).toBe(30);
  });
  it('avoids the replaced and other active needs when alternatives exist', () => {
    const one = generated(1, 0.5);
    const next = generateOrder({ player: { level: 1, unlockedChainIds: ['coffee'] }, templates: bundle.orders,
      catalog: bundle.catalog, recentOrderIds: [], activeOrders: [], replacingRequirements: one.requirements,
      minItemLevel: 2, maxItemLevel: 5, limitedChainIds: ['fruit'], random: { next: () => 0.5, pickIndex: () => 0 }, id: 'next' })!;
    expect(requirementSignature(next.requirements)).not.toBe(requirementSignature(one.requirements));
  });
  it('uses the exact urgent threshold only after a successful delivery', () => {
    for (const roll of [0.099, 0.1]) {
      const clock = new FakeClockService(); const game = createGameContext({ deterministic: true, clock });
      game.debugClearBoard(); game.debugSpawn('coffee_02');
      const old: ActiveOrder = { uid: 'source', templateId: 'old', requirements: [{ itemId: 'coffee_02', count: 1 }], rewardCoins: 10, rewardXp: 1, rewardHearts: 1 };
      const service = new OrderService(bundle.orders, bundle.catalog, game.board, game.player, game.progression,
        { next: () => roll, pickIndex: () => 0 }, new SequentialIdService('threshold'), game.bus, 1, 2, 5, ['fruit'], clock);
      service.hydrate([old], []); expect(service.claim('source').ok).toBe(true);
      expect(service.getOrders()[0].urgentUntil !== undefined).toBe(roll < 0.1);
      const beforeRefresh = service.getOrders()[0]; expect(service.refresh(beforeRefresh.uid).ok).toBe(true);
      expect(service.getOrders()[0].urgentUntil).toBeUndefined();
    }
  });
  it('makes a delivered replacement urgent once and expires it without repeated doubling', () => {
    const clock = new FakeClockService();
    const game = createGameContext({ deterministic: true, clock });
    game.debugClearBoard(); game.debugSpawn('coffee_02');
    const old: ActiveOrder = { uid: 'urgent_source', templateId: 'old', requirements: [{ itemId: 'coffee_02', count: 1 }], rewardCoins: 10, rewardXp: 1, rewardHearts: 1 };
    const service = new OrderService(bundle.orders, bundle.catalog, game.board, game.player, game.progression,
      { next: () => 0, pickIndex: () => 0 }, new SequentialIdService('urgent'), game.bus, 1, 2, 5, ['fruit'], clock);
    service.hydrate([old], []);
    let duringEvent: ActiveOrder | undefined;
    game.bus.on('ORDER_COMPLETED', () => { duringEvent = service.getOrders()[0]; });
    expect(service.claim(old.uid).ok).toBe(true);
    const urgent = service.getOrders()[0];
    expect(urgent.urgentUntil).toBe(clock.now() + 30 * 60_000);
    expect(urgent.rewardCoins).toBe(urgent.urgentBaseCoins! * 2);
    expect(urgent.rewardXp).toBe(urgent.urgentBaseXp! * 2);
    expect(urgent.rewardHearts).toBe(urgent.urgentBaseHearts! * 2);
    expect(duringEvent?.uid).toBe(urgent.uid);
    service.hydrate([urgent], []); clock.advance(30 * 60_000 - 1);
    expect(service.getOrders()[0].rewardCoins).toBe(urgent.rewardCoins);
    clock.advance(1);
    expect(service.getOrders()[0].rewardCoins).toBe(urgent.urgentBaseCoins);
    expect(service.expireUrgentOrders()).toBe(true);
    expect(service.expireUrgentOrders()).toBe(false);
    expect(service.getOrders()[0]).not.toHaveProperty('urgentUntil');
    expect(service.getOrders()[0].rewardCoins).toBe(urgent.urgentBaseCoins);
    expect(service.getOrders()[0].rewardXp).toBe(urgent.urgentBaseXp);
    expect(service.getOrders()[0].rewardHearts).toBe(urgent.urgentBaseHearts);
    service.hydrate([{ ...urgent, urgentBaseXp: undefined, urgentBaseHearts: undefined }], []);
    expect(service.expireUrgentOrders()).toBe(true);
    expect(service.getOrders()[0].rewardXp).toBe(urgent.rewardXp);
    expect(service.getOrders()[0].rewardHearts).toBe(urgent.rewardHearts);
  });
  it('persists urgent coins, experience and hearts through restart and restores each on expiry', () => {
    const clock = new FakeClockService(); const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
    const first = createGameContext({ storage, clock, deterministic: true, saveDebounceMs: 0 });
    const save = first.buildSaveData();
    const order = save.activeOrders[0];
    Object.assign(order, { urgentUntil: clock.now() + 1800000, urgentBaseCoins: 3, urgentBaseXp: 10,
      urgentBaseHearts: 1, rewardCoins: 6, rewardXp: 20, rewardHearts: 2 });
    data.set(bundle.game.saveKey, JSON.stringify(save));
    const reopened = createGameContext({ storage, clock, deterministic: true, saveDebounceMs: 0 });
    expect(reopened.orders.getOrders()[0]).toMatchObject({ rewardCoins: 6, rewardXp: 20, rewardHearts: 2, urgentUntil: order.urgentUntil });
    clock.advance(1800000); reopened.refreshOrderClock();
    const final = createGameContext({ storage, clock, deterministic: true, saveDebounceMs: 0 }).orders.getOrders()[0];
    expect(final).toMatchObject({ rewardCoins: 3, rewardXp: 10, rewardHearts: 1 });
    expect(final.urgentUntil).toBeUndefined();
  });

});
