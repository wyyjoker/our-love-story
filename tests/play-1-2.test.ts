import { describe, expect, it } from 'vitest';
import { createGameContext, type GameContext } from '../assets/scripts/gameplay/GameContext';
import { loadConfigBundle, validateConfig } from '../assets/scripts/config/ConfigRepository';
import {
  filterOrderTemplates,
  generateOrder,
  generateTutorialOrder,
  pickOrderTemplate,
  requirementSignature,
} from '../assets/scripts/core/order/orders';
import { circuitState, requirementsBaseCost } from '../assets/scripts/core/play/types';
import { FixedRandomService } from '../assets/scripts/infrastructure/RandomService';
import type { StorageAdapter } from '../assets/scripts/infrastructure/PlatformService';
import type { OrderRequirement, OrderTemplate } from '../assets/scripts/core/types';

function fixture() {
  const values = new Map<string, string>();
  const storage: StorageAdapter = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
  const open = () => createGameContext({ deterministic: true, storage });
  return { game: open(), values, open };
}

function prepare(game: GameContext, id: string) {
  const chapter = game.bundle.adventures.find((entry) => entry.id === id)!;
  for (const step of chapter.steps.slice(game.play.progress(id).step)) {
    game.debugClearBoard();
    for (const need of step.requirements) for (let i = 0; i < need.count; i++) game.debugSpawn(need.itemId);
    expect(game.playAction('deliver', id)).toEqual({ ok: true });
  }
}

function solve(game: GameContext, id: string) {
  const chapter = game.bundle.adventures.find((entry) => entry.id === id)!;
  if (chapter.puzzle.kind === 'find') {
    for (const hotspot of chapter.puzzle.hotspots) expect(game.puzzleAction(id, 'find', hotspot.id).ok).toBe(true);
    for (const digit of chapter.puzzle.solution) game.puzzleAction(id, 'digit', digit);
  } else if (chapter.puzzle.kind === 'sequence') {
    for (const tile of chapter.puzzle.solution) game.puzzleAction(id, 'select', tile);
  } else {
    chapter.puzzle.initial.forEach((rotation, index) => {
      const puzzle = chapter.puzzle;
      if (puzzle.kind !== 'circuit') return;
      for (let count = 0; count < (puzzle.solution[index] - rotation + 4) % 4; count++) {
        game.puzzleAction(id, 'rotate', String(index));
      }
    });
  }
  expect(game.playAction('solve', id)).toEqual({ ok: true });
}

function prepareSmallDate(game: GameContext, requirements: readonly OrderRequirement[]) {
  game.debugClearBoard();
  for (const req of requirements) for (let i = 0; i < req.count; i++) game.debugSpawn(req.itemId);
}

function template(id: string, requirements: OrderRequirement[], extra: Partial<OrderTemplate> = {}): OrderTemplate {
  return {
    id,
    minLevel: 1,
    maxLevel: 99,
    requirements,
    rewardCoins: 10,
    rewardXp: 5,
    rewardHearts: 1,
    ...extra,
  };
}

describe('1.2 order pacing', () => {
  const bundle = loadConfigBundle();
  const player = { level: 1, unlockedChainIds: ['coffee'] };
  const generate = (templates: OrderTemplate[], recentOrderIds: string[],
    activeOrders: Array<{ templateId: string; requirements: OrderRequirement[] }> = []) => generateOrder({
    player,
    templates,
    catalog: bundle.catalog,
    recentOrderIds,
    activeOrders: activeOrders.map((order) => ({ ...order, uid: order.templateId })),
    minItemLevel: 2,
    maxItemLevel: 5,
    random: new FixedRandomService([0]),
    id: 'next',
  });

  it('keeps the tutorial order and avoids matching active needs for dynamic orders', () => {
    const tutorial = template('tutorial', [{ itemId: 'coffee_02', count: 1 }], { tutorialOnly: true });
    expect(generateTutorialOrder([tutorial], 'tutorial')?.templateId).toBe('tutorial');
    const active = [{ templateId: 'same_a', requirements: [{ itemId: 'coffee_02', count: 1 }] }];
    const result = generate([tutorial], ['tutorial'], active);
    expect(result).not.toBeNull();
    expect(requirementSignature(result!.requirements)).not.toBe(requirementSignature(active[0].requirements));
  });

  it('suppresses recent legacy template signatures when alternatives exist', () => {
    const old = template('same_a', [{ itemId: 'coffee_02', count: 1 }]);
    const order = generateOrder({ player, templates: [old], catalog: bundle.catalog,
      recentOrderIds: ['same_a'], activeOrders: [], minItemLevel: 2, maxItemLevel: 5,
      random: new FixedRandomService([0]), id: 'next' });
    expect(requirementSignature(order!.requirements)).not.toBe(requirementSignature(old.requirements));
  });

  it('degrades gracefully instead of looping or returning an empty slot when options are exhausted', () => {
    const onlyA = template('only_a', [{ itemId: 'coffee_02', count: 1 }]);
    const onlyB = template('only_b', [{ itemId: 'coffee_02', count: 1 }]);
    const signature = requirementSignature(onlyA.requirements);
    expect(pickOrderTemplate([onlyA, onlyB], new FixedRandomService([0]), {
      activeOrderIds: ['only_a'],
      activeOrderSignatures: [signature],
      recentOrderIds: ['only_a', 'only_b'],
      recentSignatures: [signature],
    })).not.toBeNull();
    const order = generateOrder({
      player: { level: 1, unlockedChainIds: ['coffee'] },
      templates: [onlyA, onlyB],
      catalog: bundle.catalog,
      recentOrderIds: ['only_a', 'only_b', 'only_a'],
      activeOrders: [
        { templateId: 'only_a', requirements: onlyA.requirements },
        { templateId: 'only_b', requirements: onlyB.requirements },
      ],
      minItemLevel: 2,
      maxItemLevel: 5,
      random: new FixedRandomService([0]),
      id: 'next',
    });
    expect(order).not.toBeNull();
  });

  it('keeps the actual Lv1/Lv2 single-coffee pool at or below eight base items', () => {
    for (const level of [1, 2]) {
      const pool = filterOrderTemplates(bundle.orders, level, bundle.catalog, ['coffee'],
        bundle.game.orders.minItemLevel, bundle.game.orders.maxItemLevel);
      expect(pool.length).toBeGreaterThanOrEqual(3);
      for (const order of pool) {
        expect(requirementsBaseCost(order.requirements, (id) => bundle.catalog.get(id)?.level)).toBeLessThanOrEqual(8);
      }
      expect(pool.some((order) => order.id === 'order_latte_date')).toBe(false);
    }
  });

  it('treats split requirement rows for the same item as one normalized signature', () => {
    const split = requirementSignature([
      { itemId: 'coffee_02', count: 1 },
      { itemId: 'coffee_02', count: 1 },
      { itemId: 'flower_02', count: 1 },
    ]);
    const combined = requirementSignature([
      { itemId: 'flower_02', count: 1 },
      { itemId: 'coffee_02', count: 2 },
    ]);
    expect(split).toBe(combined);
  });
});

describe('1.2 free puzzle replays', () => {
  it('opens practice only after a claimed chapter and never rewrites the original progress', () => {
    const { game } = fixture();
    game.debugAddXp(7650);
    prepare(game, 'zhoushan'); solve(game, 'zhoushan');
    expect(game.playAction('replay', 'zhoushan')).toEqual({ ok: false, reason: 'NOT_CLAIMED' });
    expect(game.playAction('claim', 'zhoushan')).toEqual({ ok: true });
    const original = game.play.progress('zhoushan');
    const rewards = { coins: game.player.coins, hearts: game.player.hearts, scissors: game.play.state.scissors };
    const memories = [...game.life.state.unlockedMemoryIds];
    const energy = game.player.energy;
    expect(game.playAction('replay', 'zhoushan')).toEqual({ ok: true });
    expect(game.play.replayProgress('zhoushan')).toMatchObject({ outcome: 'playing', hints: 0 });
    expect(game.play.progress('zhoushan')).toEqual(original);
    // Story preparation is skipped in practice: skipping the puzzle is allowed immediately.
    expect(game.playAction('skip', 'zhoushan')).toEqual({ ok: true });
    expect(game.play.replayProgress('zhoushan')?.outcome).toBe('skipped');
    expect(game.playAction('claim', 'zhoushan')).toEqual({ ok: false, reason: 'ALREADY_CLAIMED' });
    expect(game.player.coins).toBe(rewards.coins);
    expect(game.player.hearts).toBe(rewards.hearts);
    expect(game.play.state.scissors).toBe(rewards.scissors);
    expect(game.player.energy).toBe(energy);
    expect(game.life.state.unlockedMemoryIds).toEqual(memories);
    expect(game.play.progress('zhoushan')).toEqual(original);
  });

  it('resumes independent practice after restart and solving it grants no duplicate reward', () => {
    const f = fixture(), game = f.game;
    prepare(game, 'zhoushan'); solve(game, 'zhoushan'); game.playAction('claim', 'zhoushan');
    const original = game.play.progress('zhoushan');
    const coins = game.player.coins;
    expect(game.playAction('replay', 'zhoushan')).toEqual({ ok: true });
    game.puzzleAction('zhoushan', 'find', 'calendar');
    game.puzzleAction('zhoushan', 'digit', '0');
    game.playAction('hint', 'zhoushan');
    const restored = f.open();
    expect(restored.play.replayProgress('zhoushan')).toMatchObject({
      outcome: 'playing', found: ['calendar'], code: '0', hints: 1,
    });
    expect(restored.play.progress('zhoushan')).toEqual(original);
    restored.puzzleAction('zhoushan', 'reset');
    solve(restored, 'zhoushan');
    expect(restored.play.replayProgress('zhoushan')?.outcome).toBe('solved');
    expect(restored.play.progress('zhoushan')).toEqual(original);
    expect(restored.playAction('claim', 'zhoushan')).toEqual({ ok: false, reason: 'ALREADY_CLAIMED' });
    expect(restored.player.coins).toBe(coins);
    restored.playAction('replay', 'zhoushan');
    expect(restored.play.replayProgress('zhoushan')).toMatchObject({ outcome: 'playing', found: [], code: '', hints: 0 });
  });

  it('normalizes old v3 saves that never had replay or small-date fields', () => {
    const f = fixture(), game = f.game;
    game.debugAddXp(7650);
    prepare(game, 'zhoushan'); solve(game, 'zhoushan'); game.playAction('claim', 'zhoushan');
    const legacy = game.buildSaveData() as unknown as {
      play: { warehouse: unknown[]; scissors: number; chapters: Record<string, unknown> };
    };
    delete (legacy.play as { replays?: unknown }).replays;
    delete (legacy.play as { smallDate?: unknown }).smallDate;
    f.values.set(game.config.saveKey, JSON.stringify(legacy));
    const restored = f.open();
    expect(restored.config.saveVersion).toBe(9);
    expect(restored.play.state.replays).toEqual({});
    expect(restored.play.state.smallDate).toMatchObject({ rotation: 0, completed: 0 });
    expect(restored.play.progress('zhoushan').claimed).toBe(true);
    expect(restored.play.smallDateOrder()).toBeDefined();
  });
});

describe('1.2 repeatable small dates', () => {
  it('ships at least four inexpensive themes using atomic items from three item levels', () => {
    const bundle = loadConfigBundle();
    expect(bundle.smallDates.length).toBeGreaterThanOrEqual(4);
    expect(new Set(bundle.smallDates.map((date) => date.title)).size).toBe(bundle.smallDates.length);
    for (const date of bundle.smallDates) {
      expect(bundle.memories.some((memory) => memory.id === date.memoryId)).toBe(true);
      expect(date.requirements.length).toBeGreaterThan(0);
      for (const req of date.requirements) {
        expect(bundle.catalog.get(req.itemId)?.level).toBeLessThanOrEqual(3);
      }
      const cost = requirementsBaseCost(date.requirements, (id) => bundle.catalog.get(id)?.level);
      expect(cost).toBeGreaterThanOrEqual(2);
      expect(cost).toBeLessThanOrEqual(8);
    }
  });

  it('rejects a failed delivery without consuming items and pays only on success', () => {
    const f = fixture(), game = f.game;
    const order = game.play.smallDateOrder()!;
    expect(order.template.id).toBe('small_date_morning_coffee');
    const before = game.buildSaveData();
    expect(game.playAction('small_date', order.token)).toEqual({ ok: false, reason: 'NOT_READY' });
    expect(game.buildSaveData().board).toEqual(before.board);
    prepareSmallDate(game, order.template.requirements);
    const coins = game.player.coins, hearts = game.player.hearts, xp = game.player.xp;
    const energy = game.player.energy, scissors = game.play.state.scissors;
    const orders = game.life.state.stats.orders;
    expect(game.playAction('small_date', order.token)).toEqual({ ok: true });
    expect(game.player.coins - coins).toBe(order.template.rewardCoins);
    expect(game.player.hearts - hearts).toBe(order.template.rewardHearts);
    expect(game.player.xp - xp).toBe(order.template.rewardXp);
    expect(game.player.energy).toBe(energy);
    expect(game.play.state.scissors).toBe(scissors);
    expect(game.life.state.stats.orders).toBe(orders + 1);
    expect(game.board.getBoard().cells.every((cell) => !cell.item || !!game.bundle.catalog.get(cell.item.definitionId)?.generator)).toBe(true);
    expect(game.play.state.smallDate).toMatchObject({ rotation: 1, completed: 1 });
    // The token rendered before delivery is now stale even if the level-1 theme repeats.
    expect(game.playAction('small_date', order.token)).toEqual({ ok: false, reason: 'STALE_DATE' });
    expect(game.player.coins - coins).toBe(order.template.rewardCoins);
    expect(game.buildSaveData().play.smallDate).toMatchObject({ rotation: 1, completed: 1 });
  });

  it('allows a new token to continue immediately but rejects the old token for a second delivery', () => {
    const game = fixture().game;
    const first = game.play.smallDateOrder()!;
    game.debugClearBoard();
    for (let set = 0; set < 2; set += 1) {
      for (const req of first.template.requirements) for (let i = 0; i < req.count; i++) game.debugSpawn(req.itemId);
    }
    const coins = game.player.coins;
    expect(game.playAction('small_date', first.token)).toEqual({ ok: true });
    const second = game.play.smallDateOrder()!;
    expect(second.token).not.toBe(first.token);
    expect(game.playAction('small_date', first.token)).toEqual({ ok: false, reason: 'STALE_DATE' });
    expect(game.player.coins - coins).toBe(first.template.rewardCoins);
    expect(game.buildSaveData().play.smallDate).toMatchObject({ rotation: 1, completed: 1 });
    expect(game.board.getBoard().cells.filter((cell) => cell.item && !game.bundle.catalog.get(cell.item.definitionId)?.generator)).toHaveLength(first.template.requirements.reduce((n, req) => n + req.count, 0));
    // Lv1 now has multiple themes: prepare the newly rendered recipe, not a copy of the first.
    prepareSmallDate(game, second.template.requirements);
    expect(game.playAction('small_date', second.token)).toEqual({ ok: true });
    expect(game.player.coins - coins).toBe(first.template.rewardCoins + second.template.rewardCoins);
    expect(game.buildSaveData().play.smallDate).toMatchObject({ rotation: 2, completed: 2 });
  });

  it('rotates through unlocked themes, persists the current target and survives restart', () => {
    const f = fixture(), game = f.game;
    game.debugAddXp(500);
    const first = game.play.smallDateOrder()!;
    prepareSmallDate(game, first.template.requirements);
    expect(game.playAction('small_date', first.token)).toEqual({ ok: true });
    const after = game.play.smallDateOrder()!;
    expect(after.template.id).not.toBe(first.template.id);
    const currentId = after.template.id, rotation = game.play.state.smallDate.rotation;
    const restored = f.open();
    expect(restored.play.smallDateOrder()?.template.id).toBe(currentId);
    expect(restored.play.state.smallDate.rotation).toBe(rotation);
    expect(restored.play.state.smallDate.completed).toBe(1);
  });

  it('avoids the just-completed theme when a level-up expands the available pool', () => {
    const game = fixture().game;
    game.debugAddXp(150);
    const first = game.play.smallDateOrder()!;
    prepareSmallDate(game, first.template.requirements);
    expect(game.playAction('small_date', first.token)).toEqual({ ok: true });
    const second = game.play.smallDateOrder()!;
    expect(second.template.id).toBe('small_date_walk_flowers');
    // Another source of XP unlocks the dessert chain before the next delivery.
    game.debugAddXp(342);
    expect(game.player.level).toBe(5);
    prepareSmallDate(game, second.template.requirements);
    expect(game.playAction('small_date', second.token)).toEqual({ ok: true });
    const after = game.play.smallDateOrder()!;
    expect(after.template.id).not.toBe(second.template.id);
    expect(after.template.id).toBe('small_date_movie_night');
    expect(game.play.state.smallDate.rotation).toBe(2);
  });

  it('blocks a re-entrant delivery triggered by the reward event before rotation commits', () => {
    const game = fixture().game;
    game.debugAddXp(492);
    const order = game.play.smallDateOrder()!;
    game.debugClearBoard();
    for (let set = 0; set < 2; set += 1) {
      for (const req of order.template.requirements) for (let i = 0; i < req.count; i++) game.debugSpawn(req.itemId);
    }
    const coins = game.player.coins;
    let nested: ReturnType<GameContext['playAction']> | undefined;
    const off = game.bus.on('LEVEL_UP', () => {
      if (!nested) nested = game.playAction('small_date', order.token);
    });
    expect(game.playAction('small_date', order.token)).toEqual({ ok: true });
    off();
    expect(nested).toEqual({ ok: false, reason: 'STALE_DATE' });
    expect(game.player.coins - coins).toBe(order.template.rewardCoins);
    expect(game.play.state.smallDate).toMatchObject({ rotation: 1, completed: 1 });
    expect(game.board.getBoard().cells.filter((cell) => cell.item && !game.bundle.catalog.get(cell.item.definitionId)?.generator))
      .toHaveLength(order.template.requirements.reduce((n, req) => n + req.count, 0));
  });
});

describe('1.2 six-chapter story content', () => {
  it('keeps the original ids and unlock levels, then adds the three personal story chapters', () => {
    const bundle = loadConfigBundle();
    expect(validateConfig(bundle).filter((issue) => issue.level === 'error')).toEqual([]);
    expect(bundle.adventures.map((chapter) => chapter.id)).toEqual([
      'zhoushan', 'love_letters', 'namsan', 'hengdian_newyear', 'lijiang_photos', 'leqing_wedding',
    ]);
    expect(bundle.adventures.map((chapter) => chapter.unlockLevel)).toEqual([1, 3, 5, 6, 8, 10]);
    const newChapters = bundle.adventures.slice(3);
    for (const chapter of newChapters) expect(chapter.steps).toHaveLength(2);
    expect(newChapters.map((chapter) => chapter.memoryId)).toEqual(['night_view', 'lijiang_wedding', 'anniversary']);
    const souvenirKeys = bundle.adventures.map((chapter) => `${chapter.souvenir.room}:${chapter.souvenir.x}:${chapter.souvenir.y}`);
    expect(new Set(souvenirKeys).size).toBe(souvenirKeys.length);
    expect(bundle.memories.find((memory) => memory.id === 'anniversary')?.dateLabel).toContain('2026 年 10 月 3 日');
  });

  it('validates distinct, solvable new puzzles and rejects locked chains or overlapping souvenirs', () => {
    const bundle = loadConfigBundle();
    const [hengdian, lijiang, leqing] = bundle.adventures.slice(3);
    expect(hengdian.puzzle.kind).toBe('sequence');
    expect(hengdian.puzzle.kind === 'sequence' ? hengdian.puzzle.solution : []).toEqual(['qinwang', 'park', 'hotspring', 'back_wenzhou']);
    if (hengdian.puzzle.kind === 'sequence') {
      const clues = hengdian.puzzle.tiles.map((tile) => tile.clue).join('|');
      expect(hengdian.instruction).toContain('排版');
      expect(clues).toContain('页码 1');
      expect(clues).not.toContain('夜里');
      expect(clues).not.toContain('天色');
    }
    expect(lijiang.puzzle.kind).toBe('find');
    expect(lijiang.puzzle.kind === 'find' ? lijiang.puzzle.solution : '').toBe('0522');
    expect(lijiang.souvenir.title).toBe('丽江旅拍花束');
    expect(leqing.puzzle.kind).toBe('circuit');
    if (leqing.puzzle.kind === 'circuit') {
      expect(circuitState(leqing.puzzle, leqing.puzzle.solution).solved).toBe(true);
      expect(circuitState(leqing.puzzle, leqing.puzzle.initial).solved).toBe(false);
    }
    for (const id of ['namsan', 'leqing_wedding']) {
      const circuit = bundle.adventures.find((chapter) => chapter.id === id)?.puzzle;
      if (circuit?.kind === 'circuit') {
        expect(circuit.start).toBe(0);
        expect(circuit.end).toBe(8);
        expect(circuitState(circuit, circuit.solution).solved).toBe(true);
      }
    }

    const overlap = { ...bundle, adventures: bundle.adventures.map((chapter) => chapter.id === 'leqing_wedding'
      ? { ...chapter, souvenir: { ...chapter.souvenir, room: 'living' as const, x: 155, y: -6 } } : chapter) };
    expect(validateConfig(overlap).some((issue) => issue.message.includes('Adventure leqing_wedding invalid'))).toBe(true);

    const locked = { ...bundle, adventures: bundle.adventures.map((chapter) => chapter.id === 'hengdian_newyear'
      ? { ...chapter, steps: [{ ...chapter.steps[0], requirements: [{ itemId: 'gift_04', count: 1 }] }, chapter.steps[1]] } : chapter) };
    expect(validateConfig(locked).some((issue) => issue.message.includes('Adventure hengdian_newyear invalid'))).toBe(true);

    const costly = { ...bundle, smallDates: bundle.smallDates.map((date, index) => index === 0
      ? { ...date, requirements: [{ itemId: 'flower_06', count: 1 }] } : date) };
    expect(validateConfig(costly).some((issue) => issue.message.includes('Small date'))).toBe(true);
  });

  it('completes all six chapters through delivery, distinct puzzles and one-time claims', () => {
    const { game } = fixture();
    game.debugAddXp(7650);
    for (const chapter of game.bundle.adventures) {
      prepare(game, chapter.id);
      solve(game, chapter.id);
      const before = {
        coins: game.player.coins,
        hearts: game.player.hearts,
        scissors: game.play.state.scissors,
        memories: [...game.life.state.unlockedMemoryIds],
      };
      expect(game.playAction('claim', chapter.id)).toEqual({ ok: true });
      expect(game.player.coins - before.coins).toBe(chapter.reward.coins);
      expect(game.player.hearts - before.hearts).toBe(chapter.reward.hearts);
      expect(game.play.state.scissors - before.scissors).toBe(chapter.reward.scissors);
      expect(game.life.state.unlockedMemoryIds).toContain(chapter.memoryId);
      expect(game.playAction('claim', chapter.id)).toEqual({ ok: false, reason: 'ALREADY_CLAIMED' });
    }
    expect(game.play.state.chapters.leqing_wedding.claimed).toBe(true);
    expect(game.life.state.unlockedMemoryIds).toEqual(expect.arrayContaining([
      'letters', 'first_trip', 'rainy_day', 'night_view', 'lijiang_wedding', 'anniversary',
    ]));
  });
});
