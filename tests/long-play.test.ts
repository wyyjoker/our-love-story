import { describe, expect, it } from 'vitest';
import { loadConfigBundle } from '../assets/scripts/config/ConfigRepository';
import { generateOrder } from '../assets/scripts/core/order/orders';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';
import { createDefaultSaveData } from '../assets/scripts/infrastructure/SaveService';

const bundle = loadConfigBundle();
const xpAt = (level: number) => bundle.progression.levels[level - 1].xpRequired;
const day = 86400000;

function fixture(level: number, xp = xpAt(level), now = Date.UTC(2026, 10, 16) - 8 * 3600000) {
  const clock = new FakeClockService(now);
  const data = createDefaultSaveData(bundle.game, clock.now());
  Object.assign(data.player, { level, xp, maxEnergy: 1000, energy: 870 });
  const values = new Map([[bundle.game.saveKey, JSON.stringify(data)]]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  const open = () => createGameContext({ storage, clock, deterministic: true, saveDebounceMs: 0 });
  return { clock, open, storage };
}

describe('long-term progression', () => {
  it('applies accumulated XP from the old Lv18 cap and retains paid Lv19+ rewards after reloading', () => {
    const { open } = fixture(18, xpAt(20) + 20);
    const game = open();
    expect(game.player.level).toBe(20);
    expect(game.player.energy).toBe(870);
    expect(game.life.pendingLevelRewards()).toContain(19);
    expect(game.life.pendingLevelRewards()).toContain(20);
    expect(game.claimLevelReward(19)).toEqual({ ok: true });
    expect(game.claimLevelReward(20)).toEqual({ ok: true });
    expect(game.getGeneratorStatus('orange_tree')?.level).toBe(2);
    const again = open();
    expect(again.claimLevelReward(19)).toEqual({ ok: false, reason: 'ALREADY_CLAIMED' });
    expect(again.claimLevelReward(20)).toEqual({ ok: false, reason: 'ALREADY_CLAIMED' });
    expect(again.getGeneratorStatus('orange_tree')?.inventory[1]).toBe(1);
  });

  it('stops at Lv50 and queues the milestone generator if the board is full', () => {
    const { open } = fixture(49, xpAt(50) - 1);
    const game = open();
    expect(game.claimLevelReward(50)).toEqual({ ok: false, reason: 'LOCKED' });
    game.debugAddXp(100000);
    expect(game.player.level).toBe(50);
    expect(game.progression.getXpToNext().nextThreshold).toBeNull();
    expect(game.player.maxEnergy).toBe(1000);
    while (!game.board.isFull()) game.debugSpawn('coffee_01');
    expect(game.claimLevelReward(50)).toEqual({ ok: true });
    const gift = (entry: { level: number; generatorId: string }) => entry.level === 8 && entry.generatorId === 'coffee_machine';
    expect(game.generators.getRewards().filter(gift)).toHaveLength(1);
    const again = open();
    expect(again.player.level).toBe(50);
    expect(again.claimLevelReward(50)).toEqual({ ok: false, reason: 'ALREADY_CLAIMED' });
    expect(again.generators.getRewards().filter(gift)).toHaveLength(1);
  });

  it('keeps quick slots easy and raises regular and goal requirements at Lv18 and Lv50', () => {
    for (const [level, regularMin, goalMin, ceiling] of [[18, 4, 5, 7], [50, 8, 9, 11]]) {
      let twoItemRegularOrders = 0;
      for (let sample = 0; sample < 100; sample++) {
        for (const pace of ['quick', 'regular', 'goal'] as const) {
          const roll = (sample + 0.5) / 100;
          const order = generateOrder({
            player: { level, unlockedChainIds: ['coffee', 'flower', 'dessert', 'gift', 'fruit'] },
            templates: bundle.orders, catalog: bundle.catalog, recentOrderIds: [], dynamic: bundle.game.orders.dynamic,
            minItemLevel: bundle.game.orders.minItemLevel, maxItemLevel: bundle.game.orders.maxItemLevel,
            limitedChainIds: ['fruit'], random: { next: () => roll, pickIndex: n => Math.floor(n * roll) }, id: 'order', pace,
          });
          expect(order).not.toBeNull();
          const highest = Math.max(...order!.requirements.map(requirement => bundle.catalog.get(requirement.itemId)!.level));
          const count = order!.requirements.reduce((sum, requirement) => sum + requirement.count, 0);
          expect(count).toBeLessThanOrEqual(2);
          if (pace === 'quick') expect(highest).toBeLessThanOrEqual(3);
          if (pace === 'regular') {
            expect(highest).toBeGreaterThanOrEqual(regularMin);
            if (count === 2) twoItemRegularOrders++;
          }
          if (pace === 'goal') {
            expect(highest).toBeGreaterThanOrEqual(goalMin);
            expect(highest).toBeLessThanOrEqual(ceiling);
            expect(count).toBe(2);
          }
        }
      }
      expect(twoItemRegularOrders).toBe(70);
    }
  });
});

describe('weekly shop challenges', () => {
  it('counts three distinct days, relevant merges, and delivery once, even across reload and week rollover', () => {
    const { open, clock } = fixture(18);
    let game = open();
    const weekly = game.getWeeklyChallenge()!;
    const config = bundle.game.rewards.weeklyChallenge!;
    const theme = config.themes.find(entry => entry.title === weekly.title)!;
    const precursor = bundle.items.find(item => item.chainId === theme.chains[0] && item.level === 3)!;
    expect(game.claimWeeklyChallenge(weekly.week)).toEqual({ ok: false, reason: 'NOT_READY' });
    for (let count = 0; count < theme.advancedMerges; count++) {
      game.debugClearBoard();
      game.debugSpawn(precursor.id); game.debugSpawn(precursor.id);
      const positions = game.board.getBoard().cells.filter(cell => cell.item?.definitionId === precursor.id);
      expect(game.dropItem(positions[0].index, positions[1].index).ok).toBe(true);
    }
    for (let count = 0; count < theme.orders; count++) {
      if (count === 1 || count === 2) { clock.advance(day); game = open(); }
      game.debugClearBoard(); game.debugSpawn('coffee_04');
      const uid = 'fixture-order-' + count;
      game.orders.hydrate([{ uid, templateId: 'fixture', requirements: [{ itemId: 'coffee_04', count: 1 }],
        rewardCoins: 1, rewardXp: 1, rewardHearts: 1 }], []);
      expect(game.claimOrder(uid).ok).toBe(true);
      expect(game.claimOrder(uid).ok).toBe(false);
    }
    expect(game.getWeeklyChallenge()?.ready).toBe(true);
    const before = game.player.diamonds;
    expect(game.claimWeeklyChallenge(weekly.week)).toEqual({ ok: true, reward: config.reward });
    game = open();
    expect(game.player.diamonds).toBe(before + config.reward.diamonds);
    expect(game.claimWeeklyChallenge(weekly.week)).toEqual({ ok: false, reason: 'ALREADY_CLAIMED' });
    clock.advance(5 * day);
    expect(game.claimWeeklyChallenge(weekly.week)).toEqual({ ok: false, reason: 'STALE_WEEK' });
    expect(game.getWeeklyChallenge()).toMatchObject({ completedWeeks: 1, claimed: false, ready: false, daysLeft: 7 });
    expect(game.getWeeklyChallenge()?.goals.every(goal => goal.current === 0)).toBe(true);
  });

  it('rotates eight themes weekly and keeps the ninth cycle open', () => {
    const { open, clock } = fixture(8);
    const game = open();
    const themes = Array.from({ length: 9 }, () => {
      const title = game.getWeeklyChallenge()?.title;
      clock.advance(7 * day);
      return title;
    });
    expect(new Set(themes.slice(0, 8)).size).toBe(8);
    expect(themes[8]).toBe(themes[0]);
  });

  it('keeps an earned weekly reward claimable after missing the rollover and restarting', () => {
    const { open, clock, storage } = fixture(18);
    let game = open();
    const weekly = game.getWeeklyChallenge()!;
    const config = bundle.game.rewards.weeklyChallenge!;
    const theme = config.themes.find(entry => entry.title === weekly.title)!;
    const save = game.buildSaveData();
    save.weeklyChallenge = { week: weekly.week, orders: theme.orders, advancedMerges: theme.advancedMerges,
      challengeOrders: theme.challengeOrders, orderDays: [0, 1, 2], claimed: false, completedWeeks: 0, pendingRewardWeeks: [] };
    storage.setItem(bundle.game.saveKey, JSON.stringify(save));
    clock.advance(14 * day);
    game = open();
    expect(game.hasWeeklyReward()).toBe(true);
    expect(game.getWeeklyChallenge()).toMatchObject({ week: weekly.week + 2, ready: false, pendingRewardWeeks: [weekly.week] });
    const before = game.player.diamonds;
    expect(game.claimWeeklyChallenge(weekly.week)).toEqual({ ok: true, reward: config.reward });
    game = open();
    expect(game.player.diamonds).toBe(before + config.reward.diamonds);
    expect(game.getWeeklyChallenge()).toMatchObject({ completedWeeks: 1, pendingRewardWeeks: [] });
    expect(game.hasWeeklyReward()).toBe(false);
    expect(game.claimWeeklyChallenge(weekly.week)).toEqual({ ok: false, reason: 'STALE_WEEK' });
  });
});
