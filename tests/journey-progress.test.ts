import { describe, expect, it } from 'vitest';
import { createGameContext, type GameContext } from '../assets/scripts/gameplay/GameContext';
import type { StorageAdapter } from '../assets/scripts/infrastructure/PlatformService';

function fixture(values = new Map<string, string>()) {
  const storage: StorageAdapter = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
  return createGameContext({ deterministic: true, storage });
}

function prepare(game: GameContext, id: string): void {
  const chapter = game.bundle.adventures.find((entry) => entry.id === id)!;
  for (const step of chapter.steps.slice(game.play.progress(id).step)) {
    game.debugClearBoard();
    for (const need of step.requirements) {
      for (let count = 0; count < need.count; count += 1) game.debugSpawn(need.itemId);
    }
    expect(game.playAction('deliver', id)).toEqual({ ok: true });
  }
}

function solve(game: GameContext, id: string): void {
  const chapter = game.bundle.adventures.find((entry) => entry.id === id)!;
  if (chapter.puzzle.kind === 'find') {
    for (const hotspot of chapter.puzzle.hotspots) game.puzzleAction(id, 'find', hotspot.id);
    for (const digit of chapter.puzzle.solution) game.puzzleAction(id, 'digit', digit);
  } else if (chapter.puzzle.kind === 'sequence') {
    for (const tile of chapter.puzzle.solution) game.puzzleAction(id, 'select', tile);
  } else {
    chapter.puzzle.initial.forEach((rotation, index) => {
      const puzzle = chapter.puzzle;
      if (puzzle.kind !== 'circuit') return;
      const turns = (puzzle.solution[index] - rotation + 4) % 4;
      for (let turn = 0; turn < turns; turn += 1) game.puzzleAction(id, 'rotate', String(index));
    });
  }
  expect(game.playAction('solve', id)).toEqual({ ok: true });
}

describe('42-chapter journey progress', () => {
  it('recommends the first chapter and permits chapters at Lv1', () => {
    const game = fixture();
    const journey = game.play.journeyProgress();

    expect(journey).toMatchObject({ completed: 0, total: 42, nextChapter: { id: 'zhoushan' }, availability: { available: true } });
    expect(game.play.chapterAvailability('love_letters')).toMatchObject({
      available: true,
    });
  });

  it('keeps a solved chapter as the recommendation until claimed and restores the next chapter', () => {
    const values = new Map<string, string>();
    const game = fixture(values);
    prepare(game, 'zhoushan');
    solve(game, 'zhoushan');
    expect(game.play.journeyProgress().nextChapter?.id).toBe('zhoushan');
    expect(game.play.journeyProgress().nextProgress?.outcome).toBe('solved');
    expect(game.play.journeyProgress().completed).toBe(0);
    expect(game.playAction('claim', 'zhoushan')).toEqual({ ok: true });
    const restored = fixture(values);
    const before = restored.buildSaveData();
    expect(restored.play.journeyProgress()).toMatchObject({
      completed: 1, nextChapter: { id: 'love_letters' }, availability: { available: true },
    });
    expect(restored.play.chapterAvailability('missing')).toBeUndefined();
    expect(restored.buildSaveData().play).toEqual(before.play);
    expect(restored.buildSaveData().player).toEqual(before.player);
    expect(restored.buildSaveData().life).toEqual(before.life);
  });

  it('opens a later chapter at Lv1 without requiring an earlier claim', () => {
    const game = fixture();
    expect(game.player.level).toBe(1);
    expect(game.play.chapterAvailability('memory_wedding_thanksgiving')).toEqual({ available: true });
    prepare(game, 'zhoushan');
    solve(game, 'zhoushan');
    game.playAction('claim', 'zhoushan');
    expect(game.play.journeyProgress().availability?.available).toBe(true);
  });

  it('lets a reader of a previously purchased memory solve its new puzzle and earn its reward once', () => {
    const values = new Map<string, string>();
    const previous = fixture(values);
    const chapter = previous.bundle.adventures.find(entry => entry.id === 'memory_marriage_registration')!;
    const save = previous.buildSaveData();
    save.life.unlockedMemoryIds.push(chapter.memoryId);
    values.set(previous.config.saveKey, JSON.stringify(save));

    const restored = fixture(values);
    expect(restored.player.level).toBe(1);
    expect(restored.life.state.unlockedMemoryIds).toContain(chapter.memoryId);
    expect(restored.play.progress(chapter.id).claimed).toBe(false);
    expect(restored.play.isAvailable(chapter.id)).toBe(true);
    const coins = restored.player.coins;
    solve(restored, chapter.id);
    expect(restored.playAction('claim', chapter.id)).toEqual({ ok: true });
    expect(restored.player.coins).toBe(coins + chapter.reward.coins);
    expect(restored.life.state.unlockedMemoryIds.filter(id => id === chapter.memoryId)).toHaveLength(1);
    const restarted = fixture(values);
    expect(restarted.playAction('claim', chapter.id)).toEqual({ ok: false, reason: 'ALREADY_CLAIMED' });
    expect(restarted.playAction('replay', chapter.id)).toEqual({ ok: true });
    expect(restarted.player.coins).toBe(coins + chapter.reward.coins);
  });

  it('continues the existing six-chapter save into new memories and solves all 42 without consuming items', () => {
    const values = new Map<string, string>();
    let game = fixture(values);
    expect(game.player.level).toBe(1);
    expect(game.bundle.adventures.filter(chapter => chapter.puzzle.kind === 'circuit')).toHaveLength(7);
    expect(game.bundle.adventures.some(chapter => chapter.puzzle.kind === 'sequence' && chapter.puzzle.tiles.length === 6)).toBe(true);
    const board = game.buildSaveData().board;
    const energy = game.player.energy;

    for (const [index, chapter] of game.bundle.adventures.entries()) {
      if (index === 6) game = fixture(values);
      expect(game.play.journeyProgress().nextChapter?.id).toBe(chapter.id);
      expect(game.play.isAvailable(chapter.id)).toBe(true);
      solve(game, chapter.id);
      expect(game.playAction('claim', chapter.id)).toEqual({ ok: true });
      expect(game.playAction('claim', chapter.id)).toEqual({ ok: false, reason: 'ALREADY_CLAIMED' });
    }

    const restored = fixture(values);
    expect(restored.play.journeyProgress()).toMatchObject({ completed: 42, total: 42, nextChapter: null, nextProgress: null, availability: null });
    expect(new Set(restored.life.state.unlockedMemoryIds)).toEqual(new Set(restored.bundle.memories.map(memory => memory.id)));
    expect(restored.player.energy).toBe(energy + game.bundle.adventures.reduce((total, chapter) => total + chapter.reward.energy, 0));
    for (const cell of board) if (cell.item) expect(restored.board.getBoard().cells[cell.index].item?.uid).toBe(cell.item.uid);
  });
});
