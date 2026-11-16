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

describe('six-chapter journey progress', () => {
  it('recommends the first chapter and explains the level lock', () => {
    const game = fixture();
    const journey = game.play.journeyProgress();

    expect(journey).toMatchObject({ completed: 0, total: 6, nextChapter: { id: 'zhoushan' }, availability: { available: true } });
    expect(game.play.chapterAvailability('love_letters')).toMatchObject({
      available: false,
      requiredLevel: 3,
      currentLevel: 1,
    });
  });

  it('keeps a solved chapter as the recommendation until claimed and restores the level-only lock', () => {
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
      completed: 1, nextChapter: { id: 'love_letters' },
      availability: { available: false, currentLevel: 1, requiredLevel: 3 },
    });
    expect(restored.play.chapterAvailability('missing')).toBeUndefined();
    expect(restored.buildSaveData().play).toEqual(before.play);
    expect(restored.buildSaveData().player).toEqual(before.player);
    expect(restored.buildSaveData().life).toEqual(before.life);
  });

  it('opens a later chapter at its level without requiring an earlier claim', () => {
    const game = fixture();
    game.progression.addXp(400);
    expect(game.player.level).toBeGreaterThanOrEqual(3);
    expect(game.play.chapterAvailability('love_letters')).toMatchObject({
      available: true, requiredLevel: 3,
    });
    prepare(game, 'zhoushan');
    solve(game, 'zhoushan');
    game.playAction('claim', 'zhoushan');
    expect(game.play.journeyProgress().availability?.available).toBe(true);
  });

  it('moves the recommendation forward in order and reports completion after all six claims', () => {
    const game = fixture();
    game.player.level = 10;

    for (const chapter of game.bundle.adventures) {
      expect(game.play.journeyProgress().nextChapter?.id).toBe(chapter.id);
      expect(game.play.isAvailable(chapter.id)).toBe(true);
      prepare(game, chapter.id);
      solve(game, chapter.id);
      expect(game.playAction('claim', chapter.id)).toEqual({ ok: true });
    }

    expect(game.play.journeyProgress()).toMatchObject({ completed: 6, total: 6, nextChapter: null, nextProgress: null, availability: null });
  });
});
