import { describe, expect, it } from 'vitest';
import { loadConfigBundle, validateConfig, type ConfigBundle } from '../assets/scripts/config/ConfigRepository';
import { circuitState, type PuzzleDefinition, type PuzzleProgress } from '../assets/scripts/core/play/types';
import { createGameContext, type GameContext } from '../assets/scripts/gameplay/GameContext';
import type { StorageAdapter } from '../assets/scripts/infrastructure/PlatformService';

const chapterIds = ['zhoushan', 'love_letters', 'namsan', 'hengdian_newyear', 'lijiang_photos', 'leqing_wedding'];
const zeroStats = { started: 0, solved: 0, skipped: 0, totalHints: 0, bestSolvedHints: null, legacyHistoryIncomplete: false };

function fixture() {
  const values = new Map<string, string>();
  let rejectWrites = false;
  const storage: StorageAdapter = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      if (rejectWrites) throw new Error('storage full');
      values.set(key, value);
    },
    removeItem: (key) => { values.delete(key); },
  };
  const open = () => createGameContext({ deterministic: true, storage });
  return { game: open(), values, open, rejectWrites: (reject: boolean) => { rejectWrites = reject; } };
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
  const puzzle = game.play.puzzleDefinition(id)!.puzzle;
  const progress = game.play.puzzleProgress(id);
  if (puzzle.kind === 'find') {
    for (const hotspot of puzzle.hotspots) expect(game.puzzleAction(id, 'find', hotspot.id)).toEqual({ ok: true });
    expect(game.puzzleAction(id, 'reset')).toEqual({ ok: true });
    for (const digit of puzzle.solution) expect(game.puzzleAction(id, 'digit', digit)).toEqual({ ok: true });
  } else if (puzzle.kind === 'sequence') {
    expect(game.puzzleAction(id, 'reset')).toEqual({ ok: true });
    for (const tile of puzzle.solution) expect(game.puzzleAction(id, 'select', tile)).toEqual({ ok: true });
  } else {
    const rotations = progress.rotations.length ? progress.rotations : puzzle.initial;
    rotations.forEach((rotation, index) => {
      for (let count = 0; count < (puzzle.solution[index] - rotation + 4) % 4; count++) {
        expect(game.puzzleAction(id, 'rotate', String(index))).toEqual({ ok: true });
      }
    });
  }
  expect(game.playAction('solve', id)).toEqual({ ok: true });
}

function claimThrough(game: GameContext, id = 'zhoushan') {
  game.debugAddXp(7650);
  for (const chapter of game.bundle.adventures) {
    if (!game.play.progress(chapter.id).claimed) {
      prepare(game, chapter.id);
      solve(game, chapter.id);
      expect(game.playAction('claim', chapter.id)).toEqual({ ok: true });
    }
    if (chapter.id === id) return;
  }
}

function resources(game: GameContext, id = 'zhoushan') {
  const save = game.buildSaveData();
  return { player: save.player, board: save.board, life: save.life, preferences: save.preferences,
    warehouse: save.play.warehouse, scissors: save.play.scissors, chapter: save.play.chapters[id] };
}

function isSolved(puzzle: PuzzleDefinition, progress: PuzzleProgress): boolean {
  if (puzzle.kind === 'find') return progress.found.length === puzzle.hotspots.length && progress.code === puzzle.solution;
  if (puzzle.kind === 'sequence') return JSON.stringify(progress.selected) === JSON.stringify(puzzle.solution);
  return circuitState(puzzle, progress.rotations).solved;
}

function mutableBundle(): ConfigBundle {
  const bundle = loadConfigBundle();
  return { ...bundle, adventures: JSON.parse(JSON.stringify(bundle.adventures)) as ConfigBundle['adventures'] };
}

describe('replay variants: live actions and isolation', () => {
  it('starts a fresh save with no invented history and permits a Lv1 small date', () => {
    const f = fixture();
    expect(f.game.buildSaveData().version).toBe(8);
    expect(f.game.play.state.replays).toEqual({});
    expect(f.game.play.state.replayStats).toEqual({});
    expect(f.game.play.replaySummary('zhoushan')).toEqual(zeroStats);
    expect(f.game.play.puzzleDefinition('zhoushan')?.variantId).toBe('classic');
    expect(f.game.play.smallDateOrder()?.template.minLevel).toBe(1);
    expect(f.game.playAction('replay', 'zhoushan')).toEqual({ ok: false, reason: 'NOT_CLAIMED' });
    expect(f.game.playAction('replay_reset', 'zhoushan')).toEqual({ ok: false, reason: 'NOT_CLAIMED' });
    expect(f.game.play.puzzleDefinition('unknown')).toBeUndefined();
    f.game.save();
    expect(f.open().play.replaySummary('zhoushan')).toEqual(zeroStats);
    expect(fixture().game.play.state.replayStats).toEqual({});
  });

  it.each(chapterIds)('solves classic and extra variant through actual actions: %s', (id) => {
    const { game } = fixture();
    claimThrough(game, id);
    const original = resources(game, id);
    const chapter = game.bundle.adventures.find((entry) => entry.id === id)!;
    expect(game.playAction('replay', id)).toEqual({ ok: true });
    expect(game.play.puzzleDefinition(id)).toEqual({ puzzle: chapter.puzzle, instruction: chapter.instruction,
      hints: chapter.hints, variantId: 'classic' });
    expect(game.playAction('solve', id)).toEqual({ ok: false, reason: 'WRONG_ANSWER' });
    solve(game, id);
    expect(game.playAction('replay', id)).toEqual({ ok: true });
    const variant = chapter.replayVariants![0];
    expect(game.play.puzzleDefinition(id)).toEqual({ puzzle: variant.puzzle, instruction: variant.instruction,
      hints: variant.hints, variantId: variant.id });
    expect(game.play.replayProgress(id)?.variantId).toBe(variant.id);
    expect(game.playAction('solve', id)).toEqual({ ok: false, reason: 'WRONG_ANSWER' });
    solve(game, id);
    expect(game.play.replaySummary(id)).toEqual({ ...zeroStats, started: 2, solved: 2, bestSolvedHints: 0 });
    expect(game.playAction('claim', id)).toEqual({ ok: false, reason: 'ALREADY_CLAIMED' });
    expect(resources(game, id)).toEqual(original);
    game.playAction('replay', id);
    expect(game.play.replayProgress(id)?.variantId).toBe('classic');
    expect(game.play.replaySummary(id).started).toBe(3);
  });

  it.each(['zhoushan', 'love_letters', 'namsan'])('reloads the same extra variant and partial state; resume does not count: %s', (id) => {
    const f = fixture(), game = f.game;
    claimThrough(game, id);
    game.playAction('replay', id);
    game.playAction('skip', id);
    game.playAction('replay', id);
    const definition = game.play.puzzleDefinition(id)!;
    const puzzle = definition.puzzle;
    if (puzzle.kind === 'find') {
      expect(game.puzzleAction(id, 'find', puzzle.hotspots[0].id).ok).toBe(true);
      expect(game.puzzleAction(id, 'digit', puzzle.solution[0]).ok).toBe(true);
    } else if (puzzle.kind === 'sequence') {
      expect(game.puzzleAction(id, 'select', puzzle.solution[0]).ok).toBe(true);
    } else expect(game.puzzleAction(id, 'rotate', '0').ok).toBe(true);
    game.playAction('hint', id);
    const partial = game.play.replayProgress(id), stats = game.play.replaySummary(id);
    const restored = f.open();
    expect(restored.play.puzzleDefinition(id)).toEqual(definition);
    expect(restored.play.replayProgress(id)).toEqual(partial);
    for (let i = 0; i < 3; i++) expect(restored.playAction('replay', id)).toEqual({ ok: true });
    expect(restored.play.replayProgress(id)).toEqual(partial);
    expect(restored.play.replaySummary(id)).toEqual(stats);
    expect(stats.started).toBeGreaterThanOrEqual(stats.solved + stats.skipped + 1);
    expect(stats.totalHints).toBe(0);
    expect(stats.bestSolvedHints).toBeNull();
    solve(restored, id);
    expect(f.open().play.replaySummary(id)).toEqual({ ...stats, solved: 1, totalHints: 1, bestSolvedHints: 1 });
  });

  it('input reset preserves found clues and hints; explicit restart counts and rotates without settling abandoned hints', () => {
    const { game } = fixture();
    claimThrough(game);
    game.playAction('replay', 'zhoushan');
    const puzzle = game.play.puzzleDefinition('zhoushan')!.puzzle;
    if (puzzle.kind !== 'find') throw new Error('expected find puzzle');
    game.puzzleAction('zhoushan', 'find', puzzle.hotspots[0].id);
    game.puzzleAction('zhoushan', 'digit', '0');
    game.playAction('hint', 'zhoushan');
    game.puzzleAction('zhoushan', 'reset');
    expect(game.play.replayProgress('zhoushan')).toMatchObject({ found: [puzzle.hotspots[0].id], code: '', hints: 1 });
    expect(game.play.replaySummary('zhoushan')).toEqual({ ...zeroStats, started: 1 });
    game.playAction('replay_reset', 'zhoushan');
    expect(game.play.replayProgress('zhoushan')).toMatchObject({ variantId: 'practice_card', found: [], code: '', hints: 0, outcome: 'playing' });
    expect(game.play.replaySummary('zhoushan')).toEqual({ ...zeroStats, started: 2 });
  });

  it('settles terminal hints once, records only solved best, and improves best without duplicate rewards', () => {
    const f = fixture(), game = f.game;
    claimThrough(game);
    const original = resources(game);
    game.playAction('replay', 'zhoushan');
    for (let i = 0; i < 6; i++) game.playAction('hint', 'zhoushan');
    expect(game.play.replayProgress('zhoushan')?.hints).toBe(3);
    expect(game.play.replaySummary('zhoushan').totalHints).toBe(0);
    game.playAction('skip', 'zhoushan');
    const skipped = { ...zeroStats, started: 1, skipped: 1, totalHints: 3 };
    expect(game.play.replaySummary('zhoushan')).toEqual(skipped);
    for (const action of ['skip', 'solve', 'hint'] as const) expect(game.playAction(action, 'zhoushan').ok).toBe(false);
    expect(game.play.replaySummary('zhoushan')).toEqual(skipped);
    game.playAction('replay', 'zhoushan');
    game.playAction('hint', 'zhoushan'); game.playAction('hint', 'zhoushan');
    solve(game, 'zhoushan');
    expect(game.play.replaySummary('zhoushan').bestSolvedHints).toBe(2);
    expect(game.playAction('solve', 'zhoushan').ok).toBe(false);
    game.playAction('replay', 'zhoushan');
    solve(game, 'zhoushan');
    const final = { ...zeroStats, started: 3, solved: 2, skipped: 1, totalHints: 5, bestSolvedHints: 0 };
    expect(game.play.replaySummary('zhoushan')).toEqual(final);
    expect(f.open().play.replaySummary('zhoushan')).toEqual(final);
    expect(resources(f.open())).toEqual(original);
  });

  it('exposes defensive snapshots rather than mutable progress, statistics or config references', () => {
    const { game } = fixture(); claimThrough(game); game.playAction('replay', 'zhoushan');
    const before = game.play.puzzleDefinition('zhoushan');
    const definition = game.play.puzzleDefinition('zhoushan')!;
    definition.hints.push('not persisted'); definition.instruction = 'not persisted';
    if (definition.puzzle.kind === 'find') definition.puzzle.hotspots[0].id = 'not_persisted';
    game.play.replayProgress('zhoushan')!.found.push('not_persisted');
    game.play.replaySummary('zhoushan').started = 999;
    const snapshot = game.play.state;
    snapshot.replayStats.zhoushan.totalHints = 999;
    expect(game.play.puzzleDefinition('zhoushan')).toEqual(before);
    expect(game.play.replayProgress('zhoushan')!.found).toEqual([]);
    expect(game.play.replaySummary('zhoushan')).toEqual({ ...zeroStats, started: 1 });
  });

  it('retries a failed terminal write without losing or double-counting the settled run', () => {
    const f = fixture(), game = f.game; claimThrough(game); game.playAction('replay', 'zhoushan');
    game.playAction('hint', 'zhoushan');
    const persisted = f.values.get(game.config.saveKey), original = resources(game);
    f.rejectWrites(true);
    expect(game.playAction('skip', 'zhoushan')).toEqual({ ok: true });
    expect(game.saveFailed).toBe(true);
    expect(f.values.get(game.config.saveKey)).toBe(persisted);
    expect(game.playAction('skip', 'zhoushan').ok).toBe(false);
    f.rejectWrites(false);
    game.flushSave();
    expect(game.saveFailed).toBe(false);
    const restored = f.open();
    expect(restored.play.replaySummary('zhoushan')).toEqual({ ...zeroStats, started: 1, skipped: 1, totalHints: 1 });
    expect(restored.play.replayProgress('zhoushan')?.outcome).toBe('skipped');
    expect(resources(restored)).toEqual(original);
  });
});

describe('replay save v4 to v5 and malformed v5 normalization', () => {
  it.each(['playing', 'solved', 'skipped'] as const)('migrates v4 %s exactly once while retaining assets, preferences and claims', (outcome) => {
    const f = fixture(), game = f.game; claimThrough(game);
    game.debugClearBoard(); game.debugSpawn('coffee_03');
    const occupied = game.board.getBoard().cells.find((cell) => cell.item)!;
    expect(game.playAction('store', String(occupied.index))).toEqual({ ok: true });
    game.debugSpawn('coffee_01'); game.debugSpawn('flower_01');
    const legacy = game.buildSaveData();
    legacy.version = 4;
    legacy.preferences = { soundEnabled: false, vibrationEnabled: false };
    legacy.life.photoPaths = ['photos/kept.png'];
    legacy.life.ownedFurnitureIds = game.bundle.furniture.slice(0, 2).map((entry) => entry.id);
    legacy.life.placedFurnitureIds = [...legacy.life.ownedFurnitureIds];
    legacy.life.claimedWishIds = game.bundle.wishes.slice(0, 2).map((entry) => entry.id);
    legacy.life.claimedLevelRewards = [2, 3];
    legacy.play.replays.zhoushan = { found: ['calendar'], selected: [], rotations: [], code: '09', hints: 2, outcome, variantId: 'classic' };
    delete (legacy.play.replays.zhoushan as { variantId?: string }).variantId;
    delete (legacy.play as { replayStats?: unknown }).replayStats;
    const raw = JSON.stringify(legacy);
    f.values.set(game.config.saveKey, raw);
    const restored = f.open();
    const expected = { started: 1, solved: outcome === 'solved' ? 1 : 0, skipped: outcome === 'skipped' ? 1 : 0,
      totalHints: outcome === 'playing' ? 0 : 2, bestSolvedHints: outcome === 'solved' ? 2 : null, legacyHistoryIncomplete: true };
    expect(restored.play.replaySummary('zhoushan')).toEqual(expected);
    expect(restored.play.replayProgress('zhoushan')).toMatchObject({ variantId: 'classic', found: ['calendar'], code: '09', hints: 2, outcome });
    expect(restored.buildSaveData().version).toBe(8);
    expect(restored.player).toEqual(legacy.player);
    expect(restored.preferences).toEqual(legacy.preferences);
    expect(restored.life.state).toEqual({ ...legacy.life, unlockedMemoryIds: [...legacy.life.unlockedMemoryIds, 'zhoushan_bonfire'] });
    expect(restored.buildSaveData().board).toEqual(legacy.board);
    expect(restored.buildSaveData().activeOrders).toEqual(legacy.activeOrders);
    expect(restored.play.state.warehouse).toEqual(legacy.play.warehouse);
    expect(restored.play.state.scissors).toBe(legacy.play.scissors);
    expect(restored.play.progress('zhoushan')).toEqual(legacy.play.chapters.zhoushan);
    expect(f.values.get(`${game.config.saveKey}:backup`)).toBe(raw);
    const unchanged = resources(restored);
    restored.save();
    const again = f.open();
    expect(again.play.replaySummary('zhoushan')).toEqual(expected);
    expect(again.playAction('claim', 'zhoushan')).toEqual({ ok: false, reason: 'ALREADY_CLAIMED' });
    if (outcome === 'playing') {
      again.playAction('replay', 'zhoushan');
      expect(again.play.replaySummary('zhoushan')).toEqual(expected);
      again.playAction('skip', 'zhoushan');
      expect(again.play.replaySummary('zhoushan')).toEqual({ ...expected, skipped: 1, totalHints: 2 });
    } else {
      expect(again.playAction('skip', 'zhoushan').ok).toBe(false);
      expect(again.playAction('solve', 'zhoushan').ok).toBe(false);
    }
    again.save();
    expect(f.open().play.replaySummary('zhoushan')).toEqual(again.play.replaySummary('zhoushan'));
    expect(resources(f.open())).toEqual(unchanged);
    again.playAction('replay_reset', 'zhoushan');
    expect(again.play.replaySummary('zhoushan').started).toBe(2);
    expect(again.play.replaySummary('zhoushan').legacyHistoryIncomplete).toBe(true);
  });

  it.each([undefined, null, -1, 1.5, '0', false, {}, Number.MAX_SAFE_INTEGER + 1])('does not invent zero for absent/invalid v5 solved best: %j', (best) => {
    const f = fixture(); claimThrough(f.game); f.game.playAction('replay', 'zhoushan');
    const save = f.game.buildSaveData();
    const stats: Record<string, unknown> = { started: 1, solved: 2, skipped: 3, totalHints: 7, legacyHistoryIncomplete: false };
    if (best !== undefined) stats.bestSolvedHints = best;
    (save.play.replayStats as unknown as Record<string, unknown>).zhoushan = stats;
    f.values.set(f.game.config.saveKey, JSON.stringify(save));
    const restored = f.open();
    expect(restored.play.replaySummary('zhoushan')).toEqual({ started: 6, solved: 2, skipped: 3, totalHints: 7,
      bestSolvedHints: null, legacyHistoryIncomplete: false });
    restored.save();
    expect(f.open().play.replaySummary('zhoushan').bestSolvedHints).toBeNull();
    restored.playAction('hint', 'zhoushan'); solve(restored, 'zhoushan');
    expect(restored.play.replaySummary('zhoushan').bestSolvedHints).toBe(1);
  });

  it('retains a valid zero best but clears best when no solved run exists', () => {
    const f = fixture(); claimThrough(f.game); f.game.playAction('replay', 'zhoushan'); solve(f.game, 'zhoushan');
    expect(f.open().play.replaySummary('zhoushan').bestSolvedHints).toBe(0);
    const save = f.game.buildSaveData();
    save.play.replayStats.zhoushan.solved = 0;
    f.values.set(f.game.config.saveKey, JSON.stringify(save));
    expect(f.open().play.replaySummary('zhoushan').bestSolvedHints).toBeNull();
  });

  it('falls back from an unknown active variant to classic without erasing aggregates or claimed progress', () => {
    const f = fixture(); claimThrough(f.game); f.game.playAction('replay', 'zhoushan');
    const save = f.game.buildSaveData();
    save.play.replays.zhoushan.variantId = 'removed_variant';
    save.play.replays.zhoushan.found = ['removed_clue']; save.play.replays.zhoushan.code = '73';
    save.play.replayStats.zhoushan = { started: 9, solved: 4, skipped: 3, totalHints: 11, bestSolvedHints: 1, legacyHistoryIncomplete: true };
    f.values.set(f.game.config.saveKey, JSON.stringify(save));
    const restored = f.open();
    expect(restored.play.puzzleDefinition('zhoushan')?.variantId).toBe('classic');
    expect(restored.play.replayProgress('zhoushan')).toMatchObject({ variantId: 'classic', found: [], code: '' });
    expect(restored.play.replaySummary('zhoushan')).toEqual(save.play.replayStats.zhoushan);
    expect(restored.play.progress('zhoushan')).toEqual(save.play.chapters.zhoushan);
    restored.playAction('replay', 'zhoushan'); restored.save();
    expect(f.open().play.replaySummary('zhoushan')).toEqual(save.play.replayStats.zhoushan);
  });
});

describe('replay configuration invariants', () => {
  it('keeps the fixed six chapter order, validates cleanly, and gives each chapter exactly one named extra', () => {
    const bundle = loadConfigBundle();
    expect(bundle.adventures.map((chapter) => chapter.id)).toEqual(chapterIds);
    expect(validateConfig(bundle).filter((issue) => issue.level === 'error')).toEqual([]);
    for (const chapter of bundle.adventures) {
      expect(chapter.replayVariants).toHaveLength(1);
      const ids = ['classic', ...chapter.replayVariants!.map((variant) => variant.id)];
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(chapter.replayVariants![0].puzzle.kind).toBe(chapter.puzzle.kind);
    }
  });

  it.each(chapterIds)('has an unsolved initial state and a valid solution for every configured puzzle: %s', (id) => {
    const chapter = loadConfigBundle().adventures.find((entry) => entry.id === id)!;
    for (const puzzle of [chapter.puzzle, ...chapter.replayVariants!.map((variant) => variant.puzzle)]) {
      const progress: PuzzleProgress = { found: [], selected: [], rotations: [], code: '', hints: 0, outcome: 'playing' };
      expect(isSolved(puzzle, progress)).toBe(false);
      if (puzzle.kind === 'find') { progress.found = puzzle.hotspots.map((hotspot) => hotspot.id); progress.code = puzzle.solution; }
      else if (puzzle.kind === 'sequence') progress.selected = [...puzzle.solution];
      else progress.rotations = [...puzzle.solution];
      expect(isSolved(puzzle, progress)).toBe(true);
    }
  });

  it.each(['duplicate', 'classic', 'bad-id', 'missing_tile', 'duplicate_hotspot', 'initial_solved'] as const)('reports invalid variant config instead of accepting it: %s', (mutation) => {
    const bundle = mutableBundle();
    const chapter = bundle.adventures[0], variant = chapter.replayVariants![0];
    if (mutation === 'duplicate') chapter.replayVariants!.push(JSON.parse(JSON.stringify(variant)) as typeof variant);
    else if (mutation === 'classic' || mutation === 'bad-id') variant.id = mutation;
    else if (mutation === 'duplicate_hotspot' && variant.puzzle.kind === 'find') variant.puzzle.hotspots[1].id = variant.puzzle.hotspots[0].id;
    else if (mutation === 'missing_tile') {
      const sequence = bundle.adventures.find((entry) => entry.puzzle.kind === 'sequence')!.replayVariants![0].puzzle;
      if (sequence.kind === 'sequence') sequence.solution[0] = 'unknown_tile';
    } else if (mutation === 'initial_solved') {
      const circuit = bundle.adventures.find((entry) => entry.puzzle.kind === 'circuit')!.replayVariants![0].puzzle;
      if (circuit.kind === 'circuit') circuit.initial = [...circuit.solution];
    }
    expect(() => validateConfig(bundle)).not.toThrow();
    expect(validateConfig(bundle).some((issue) => issue.level === 'error' && /Adventure/.test(issue.message))).toBe(true);
  });
});
