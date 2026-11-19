import { describe, expect, it } from 'vitest';
import { createGameContext, type GameContext } from '../assets/scripts/gameplay/GameContext';
import { loadConfigBundle, validateConfig } from '../assets/scripts/config/ConfigRepository';
import { circuitState } from '../assets/scripts/core/play/types';
import type { StorageAdapter } from '../assets/scripts/infrastructure/PlatformService';

function fixture() {
  const values = new Map<string, string>();
  const storage: StorageAdapter = { getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => { values.set(k, v); }, removeItem: (k) => { values.delete(k); } };
  const open = () => createGameContext({ deterministic: true, storage });
  return { game: open(), values, open };
}
function prepare(game: GameContext, id: string) {
  const chapter = game.bundle.adventures.find((c) => c.id === id)!;
  for (const step of chapter.steps.slice(game.play.progress(id).step)) {
    game.debugClearBoard();
    for (const need of step.requirements) for (let i = 0; i < need.count; i++) game.debugSpawn(need.itemId);
    expect(game.playAction('deliver', id)).toEqual({ ok: true });
  }
}
function solve(game: GameContext, id: string) {
  const c = game.bundle.adventures.find((c) => c.id === id)!;
  if (c.puzzle.kind === 'find') {
    for (const h of c.puzzle.hotspots) expect(game.puzzleAction(id, 'find', h.id).ok).toBe(true);
    for (const n of c.puzzle.solution) game.puzzleAction(id, 'digit', n);
  } else if (c.puzzle.kind === 'sequence') for (const n of c.puzzle.solution) game.puzzleAction(id, 'select', n);
  else c.puzzle.initial.forEach((r, i) => {
    const puzzle = c.puzzle;
    if (puzzle.kind !== 'circuit') return;
    for (let k = 0; k < (puzzle.solution[i] - r + 4) % 4; k++) game.puzzleAction(id, 'rotate', String(i));
  });
  expect(game.playAction('solve', id)).toEqual({ ok: true });
}

describe('playful story and inventory loop', () => {
  it('migrates v2 without changing acquired memories, currency or photos, and never replenishes spent tools on restart', () => {
    const f = fixture(), saved = f.game.buildSaveData();
    const legacy: Partial<typeof saved> = { ...saved, version: 2 };
    delete legacy.play;
    legacy.life = { ...saved.life, unlockedMemoryIds: ['letters', 'first_trip'], photoPaths: ['wxfile://photo'] };
    legacy.player = { ...saved.player, coins: 342, hearts: 91 };
    const legacyRaw = JSON.stringify(legacy);
    f.values.set(f.game.config.saveKey, legacyRaw);
    const restored = f.open();
    expect(restored.config.saveVersion).toBe(9);
    expect(restored.life.state.unlockedMemoryIds).toEqual(['letters', 'first_trip', 'zhoushan_bonfire']);
    expect(restored.life.state.photoPaths).toEqual(['wxfile://photo']);
    expect(restored.player.coins).toBe(342); expect(restored.player.hearts).toBe(91);
    expect(f.values.get(f.game.config.saveKey + ':backup')).toBe(legacyRaw);
    for (let i = 0; i < restored.config.toolbox.startingScissors; i++) {
      restored.debugClearBoard(); restored.debugSpawn('coffee_03'); expect(restored.playAction('split', '0').ok).toBe(true);
    }
    expect(f.open().play.state.scissors).toBe(0);
  });
  it('stores and returns the original UID, stops duplicate transfers and persists inventory across restart', () => {
    const f = fixture(), item = { ...f.game.board.getBoard().cells[0].item! };
    expect(f.game.playAction('store', '0').ok).toBe(true);
    expect(f.game.playAction('store', '0')).toEqual({ ok: false, reason: 'INVALID' });
    const loaded = f.open(); expect(loaded.play.state.warehouse).toEqual([item]);
    expect(loaded.playAction('withdraw', item.uid).ok).toBe(true);
    expect(loaded.board.getBoard().cells[0].item).toEqual(item);
    expect(loaded.playAction('withdraw', item.uid)).toEqual({ ok: false, reason: 'INVALID' });
    expect(f.open().play.state.warehouse).toEqual([]);
  });
  it('fails atomically when the warehouse or board is full', () => {
    const { game } = fixture();
    game.debugClearBoard();
    for (let i = 0; i < game.config.toolbox.warehouseSlots; i++) { game.debugSpawn('coffee_01'); expect(game.playAction('store', '0').ok).toBe(true); }
    game.debugSpawn('coffee_03');
    const before = game.buildSaveData();
    expect(game.playAction('store', '0')).toEqual({ ok: false, reason: 'WAREHOUSE_FULL' });
    expect(game.buildSaveData().board).toEqual(before.board);
    while (!game.board.isFull()) game.debugSpawn('coffee_01');
    const full = game.buildSaveData();
    expect(game.playAction('withdraw', game.play.state.warehouse[0].uid)).toEqual({ ok: false, reason: 'BOARD_FULL' });
    expect(game.playAction('split', '0')).toEqual({ ok: false, reason: 'BOARD_FULL' });
    expect(game.buildSaveData().play).toEqual(full.play);
    expect(game.buildSaveData().board).toEqual(full.board);
  });
  it('splits every chain level without creating merge value, spending energy or counting a merge', () => {
    const bundle = loadConfigBundle();
    for (const definition of bundle.items.filter((item) => item.level > 1 && !item.maxUses && !item.generator)) {
      const { game } = fixture(); game.debugClearBoard(); game.debugSpawn(definition.id);
      const uid = game.board.getBoard().cells[0].item!.uid;
      const energy = game.player.energy;
      expect(game.playAction('split', '0').ok).toBe(true);
      const items = game.board.getBoard().cells.flatMap((c) => c.item && !game.bundle.catalog.get(c.item.definitionId)?.generator ? [c.item] : []);
      expect(items).toHaveLength(2); expect(items[0].uid).toBe(uid); expect(items[1].uid).not.toBe(uid);
      expect(items.map((i) => bundle.catalog.get(i.definitionId)?.level)).toEqual([definition.level - 1, definition.level - 1]);
      expect(game.player.energy).toBe(energy); expect(game.life.state.stats.merges).toBe(0);
      expect(game.play.state.scissors).toBe(game.config.toolbox.startingScissors - 1);
    }
  });
  it('rejects beginner items and unavailable scissors without altering the board', () => {
    const { game } = fixture(), before = game.buildSaveData();
    expect(game.playAction('split', '0')).toEqual({ ok: false, reason: 'CANNOT_SPLIT' });
    expect(game.buildSaveData().board).toEqual(before.board);
    for (let i = 0; i < before.play.scissors; i++) { game.debugClearBoard(); game.debugSpawn('coffee_02'); game.playAction('split', '0'); }
    game.debugClearBoard(); game.debugSpawn('coffee_02');
    expect(game.playAction('split', '0')).toEqual({ ok: false, reason: 'NO_SCISSORS' });
  });
  it('no longer consumes warehouse or board items to open a story puzzle', () => {
    const { game } = fixture(); game.debugClearBoard(); game.debugSpawn('coffee_02'); game.playAction('store', '0');
    expect(game.playAction('deliver', 'zhoushan')).toEqual({ ok: false, reason: 'NOT_READY' });
    expect(game.play.progress('zhoushan').step).toBe(2); expect(game.play.state.warehouse).toHaveLength(1);
    expect(game.puzzleAction('zhoushan', 'find', 'calendar')).toEqual({ ok: true });
    game.playAction('withdraw', game.play.state.warehouse[0].uid);
    expect(game.playAction('deliver', 'zhoushan')).toEqual({ ok: false, reason: 'NOT_READY' });
    expect(game.board.getBoard().cells.some((c) => c.item?.definitionId === 'coffee_02')).toBe(true);
    expect(game.orders.getOrders()).toHaveLength(6);
  });
  it('keeps clues, code, free hint count and step progress after restart; wrong answers never charge energy', () => {
    const f = fixture(); prepare(f.game, 'zhoushan');
    f.game.puzzleAction('zhoushan', 'find', 'calendar'); f.game.puzzleAction('zhoushan', 'digit', '9');
    for (let i = 0; i < 5; i++) f.game.playAction('hint', 'zhoushan');
    const game = f.open(); expect(game.play.progress('zhoushan')).toMatchObject({ step: 2, found: ['calendar'], code: '9', hints: 3 });
    const energy = game.player.energy;
    expect(game.playAction('solve', 'zhoushan')).toEqual({ ok: false, reason: 'WRONG_ANSWER' });
    expect(game.player.energy).toBe(energy);
    game.puzzleAction('zhoushan', 'reset'); solve(game, 'zhoushan');
  });
  it('plays all three different puzzles, grants the correct rewards and memories once, and restores the completed chapter', () => {
    const f = fixture(), game = f.game; game.debugAddXp(7650);
    for (const chapter of game.bundle.adventures) {
      prepare(game, chapter.id); solve(game, chapter.id);
      const before = { coins: game.player.coins, hearts: game.player.hearts, scissors: game.play.state.scissors };
      expect(game.playAction('claim', chapter.id)).toEqual({ ok: true });
      expect(game.player.coins - before.coins).toBe(chapter.reward.coins);
      expect(game.player.hearts - before.hearts).toBe(chapter.reward.hearts);
      expect(game.play.state.scissors - before.scissors).toBe(chapter.reward.scissors);
      expect(game.life.state.unlockedMemoryIds).toContain(chapter.memoryId);
      expect(game.playAction('claim', chapter.id)).toEqual({ ok: false, reason: 'ALREADY_CLAIMED' });
      expect(game.player.coins).toBe(before.coins + chapter.reward.coins);
    }
    expect(f.open().play.state).toEqual(game.play.state);
  });
  it('permits free skipping at the required level and keeps previously purchased memory rights', () => {
    const { game } = fixture(); game.debugAddXp(7650);
    expect(game.playAction('skip', 'love_letters')).toEqual({ ok: true });
    game.debugAddCoins(100); const normal = game.orders.getOrders().map((o) => o.uid);
    prepare(game, 'zhoushan'); expect(game.playAction('skip', 'zhoushan').ok).toBe(true);
    expect(game.play.progress('zhoushan').outcome).toBe('skipped');
    game.playAction('claim', 'zhoushan');
    expect(game.unlockMemory('letters')).toEqual({ ok: false, reason: 'ALREADY_OWNED' });
    expect(game.orders.getOrders().map((o) => o.uid)).toEqual(normal);
    expect(game.play.isAvailable('love_letters')).toBe(true);
  });
  it('accepts real reciprocal circuit connections rather than any memorized rotation list', () => {
    const p = loadConfigBundle().adventures[2].puzzle; if (p.kind !== 'circuit') throw Error('fixture');
    expect(circuitState(p, p.initial).solved).toBe(false);
    expect(circuitState(p, p.solution).solved).toBe(true);
    const alternate = [...p.solution]; alternate[0] = 2;
    expect(circuitState(p, alternate).solved).toBe(true);
    alternate[2] = 1; expect(circuitState(p, alternate).solved).toBe(false);
  });
  it('rejects invalid puzzle content and unsolvable circuit configurations', () => {
    const b = loadConfigBundle();
    const p = b.adventures[2].puzzle; if (p.kind !== 'circuit') throw Error('fixture');
    const invalid = { ...b.adventures[2], puzzle: { ...p, solution: Array.from({ length: 9 }, () => 1) } };
    expect(validateConfig({ ...b, adventures: [invalid] }).some((i) => i.message.includes('Adventure'))).toBe(true);
  });
  it('retains pending tool and reward changes after a failed write and saves them exactly once on retry', () => {
    const values = new Map<string, string>(); let fail = false;
    const storage: StorageAdapter = { getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => { if (fail) throw Error('quota'); values.set(k, v); }, removeItem: (k) => { values.delete(k); } };
    const game = createGameContext({ deterministic: true, storage });
    fail = true; game.playAction('store', '0'); expect(game.saveFailed).toBe(true);
    expect(JSON.parse(values.get(game.config.saveKey)!).play.warehouse).toHaveLength(0);
    fail = false; expect(game.save().ok).toBe(true);
    expect(createGameContext({ deterministic: true, storage }).play.state.warehouse).toHaveLength(1);
    prepare(game, 'zhoushan'); game.playAction('skip', 'zhoushan'); fail = true;
    expect(game.playAction('claim', 'zhoushan').ok).toBe(true); expect(game.saveFailed).toBe(true);
    fail = false; game.flushSave();
    const restored = createGameContext({ deterministic: true, storage });
    expect(restored.player.coins).toBe(game.bundle.adventures[0].reward.coins);
    expect(restored.playAction('claim', 'zhoushan')).toEqual({ ok: false, reason: 'ALREADY_CLAIMED' });
  });
  it('stops a schema upgrade if the original save cannot be backed up', () => {
    const f = fixture(), legacy = JSON.stringify({ ...f.game.buildSaveData(), version: 2 });
    const storage: StorageAdapter = { getItem: () => legacy, setItem: () => { throw Error('quota'); }, removeItem: () => {} };
    expect(() => createGameContext({ storage, deterministic: true })).toThrow('安全读取或备份');
  });
});
