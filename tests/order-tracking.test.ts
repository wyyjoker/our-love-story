import { describe, expect, it } from 'vitest';
import { loadConfigBundle } from '../assets/scripts/config/ConfigRepository';
import { planOrderRequirement } from '../assets/scripts/core/order/tracking';
import { generateOrder } from '../assets/scripts/core/order/orders';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import type { ActiveOrder, BoardCellState } from '../assets/scripts/core/types';

const bundle = loadConfigBundle();
const board = (ids: string[]): BoardCellState[] => ids.map((definitionId, index) => ({ index, item: { uid: `i${index}`, definitionId } }));
const order = (count = 2): ActiveOrder => ({ uid: 'target', templateId: 'test', requirements: [{ itemId: 'coffee_01', count }], rewardCoins: 10, rewardXp: 2, rewardHearts: 1 });
function fixture(ids: string[], count = 2) {
  const game = createGameContext({ deterministic: true }); game.debugClearBoard();
  ids.forEach(id => game.debugSpawn(id)); game.orders.hydrate([order(count)], []); return game;
}

describe('order tracking without spending or discovering items', () => {
  it('uses current partial pieces to calculate missing production and merges', () => {
    expect(planOrderRequirement(bundle.catalog, board(['coffee_02', 'coffee_01', 'coffee_01']), { itemId: 'coffee_03', count: 1 }, 1))
      .toMatchObject({ have: 0, missing: 1, spawnEstimate: 0, mergeEstimate: 2, precursorIndices: [0, 1, 2] });
  });
  it('estimates from an upgraded producer floor and ignores unrelated or higher items', () => {
    expect(planOrderRequirement(bundle.catalog, board(['coffee_02', 'coffee_01', 'coffee_04', 'flower_02']), { itemId: 'coffee_03', count: 1 }, 2))
      .toMatchObject({ spawnEstimate: 1, mergeEstimate: 1, precursorIndices: [0] });
  });
  it('excludes locked cells and caps missing quantity at zero', () => {
    const cells = board(['coffee_03', 'coffee_03']); cells[0].locked = true;
    expect(planOrderRequirement(bundle.catalog, cells, { itemId: 'coffee_03', count: 1 }, 1)).toMatchObject({ have: 1, missing: 0, spawnEstimate: 0, mergeEstimate: 0, matchingIndices: [1] });
  });
  it('keeps frozen backpack items separate and preserves the entire save on inspection', () => {
    const g = fixture(['coffee_01', 'coffee_01']); g.playAction('store', '0');
    const before = g.buildSaveData();
    expect(g.getOrderTracking('target', 'coffee_01')).toMatchObject({ ok: true, guide: { have: 1, missing: 1, backpackCount: 1, source: { id: 'coffee_machine' } } });
    expect(g.getOrderTracking('stale', 'coffee_01')).toEqual({ ok: false, reason: 'ORDER_CHANGED' });
    expect(g.buildSaveData()).toEqual(before);
  });
  it('marks both needed objects when a two-object order becomes ready', () => {
    const g = fixture(['coffee_01', 'coffee_01']); expect(g.getOrderBoardHints()).toEqual([{ index: 0, ready: true }, { index: 1, ready: true }]);
    expect(g.getDropOrderWarning(0, 1)).toBe('订单需要，建议先交付');
    expect(g.dropItem(0, 1).ok).toBe(true); expect(g.orders.canClaim('target')).toBe(false);
  });
  it('does not warn for safe movement or for merging surplus pieces', () => {
    const g = fixture(['coffee_01', 'coffee_01', 'coffee_01'], 1);
    expect(g.getDropOrderWarning(0, 1)).toBeNull(); expect(g.getDropOrderWarning(0, 2)).toBeNull();
    expect(g.getDropOrderWarning(0, 6)).toBeNull(); expect(g.getDropOrderWarning(0, null)).toBeNull();
  });
  it('does not claim a partially stocked order is ready', () => {
    const g = fixture(['coffee_01']); expect(g.getOrderBoardHints()).toEqual([{ index: 0, ready: false }]);
    expect(g.getDropOrderWarning(0, 1)).toBeNull();
  });
  it('combines duplicate rows from a legacy order before counting the same board item', () => {
    const g = fixture(['coffee_01']);
    g.orders.hydrate([{ ...order(), requirements: [{ itemId: 'coffee_01', count: 1 }, { itemId: 'coffee_01', count: 1 }] }], []);
    expect(g.orders.getOrders()[0].requirements).toEqual([{ itemId: 'coffee_01', count: 2 }]);
    expect(g.orders.canClaim('target')).toBe(false);
    g.debugSpawn('coffee_01');
    expect(g.orders.canClaim('target')).toBe(true);
  });
  it.each(['coin_01', 'diamond_03', 'energy_05', 'treasure_chest'])('previews %s without consuming it or drawing loot', id => {
    let draws = 0;
    const g = createGameContext({ deterministic: true, random: { next: () => { draws++; return .5; }, pickIndex: () => { draws++; return 0; } } });
    g.debugClearBoard(); g.debugSpawn(id); const before = g.buildSaveData(), beforeDraws = draws;
    const preview = g.getSupplyPreview(0, g.board.getBoard().cells[0].item!.uid)!;
    expect(preview).toMatchObject({ itemId: id, level: bundle.catalog.get(id)!.level });
    expect(g.getSupplyPreview(0, 'stale')).toBeNull(); expect(g.buildSaveData()).toEqual(before); expect(draws).toBe(beforeDraws);
    expect(g.useBoardItem(0, preview.uid).ok).toBe(true); expect(g.useBoardItem(0, preview.uid).ok).toBe(false);
  });
});

describe('paced customer slots', () => {
  it('offers increasing effort without changing the reward formula', () => {
    const orders = (['quick', 'regular', 'goal'] as const).map(pace => generateOrder({ pace, player: { level: 1, unlockedChainIds: ['coffee'] }, templates: bundle.orders,
      catalog: bundle.catalog, recentOrderIds: [], minItemLevel: 1, maxItemLevel: 5, random: { next: () => .8, pickIndex: () => 0 }, id: pace })!);
    const costs = orders.map(o => o.requirements.reduce((sum, req) => sum + 2 ** (bundle.catalog.get(req.itemId)!.level - 1) * req.count, 0));
    expect(costs).toEqual([1, 2, 4]); orders.forEach((o, i) => expect(o.rewardCoins).toBe(Math.ceil(costs[i] * 1.2)));
  });
  it('keeps quick orders free of time-gated fruit, while other slots can request it at Lv2', () => {
    const g = createGameContext({ deterministic: true, random: { next: () => 0, pickIndex: () => 0 } }); g.debugAddXp(50);
    g.orders.hydrate([], []); g.orders.ensureFilled(); const orders = g.orders.getOrders();
    expect(orders.map(o => o.pace)).toEqual(['quick', 'regular', 'goal', 'quick', 'regular', 'goal']);
    expect(orders.filter(o => o.pace === 'quick').every(o => o.requirements.every(r => !r.itemId.startsWith('fruit')))).toBe(true);
    expect(orders.filter(o => o.requirements.some(r => r.itemId.startsWith('fruit')))).toHaveLength(1);
  });
  it('budgets actual minimum output rather than the order eligibility floor', () => {
    for (let i = 0; i < 80; i++) {
      const o = generateOrder({ player: { level: 14, unlockedChainIds: ['coffee', 'fruit'] }, catalog: bundle.catalog, templates: bundle.orders, recentOrderIds: [], limitedChainIds: ['fruit'], minItemLevel: 2, maxItemLevel: 5,
        maxMergeCostForChain: chain => chain === 'fruit' ? 10 : Infinity, minimumLevelForChain: () => 1, random: { next: () => .1, pickIndex: n => i % n }, id: 'budget' })!;
      expect(o.requirements.filter(r => r.itemId.startsWith('fruit')).reduce((sum, r) => sum + r.count * 2 ** (bundle.catalog.get(r.itemId)!.level - 1), 0)).toBeLessThanOrEqual(10);
    }
  });
});
