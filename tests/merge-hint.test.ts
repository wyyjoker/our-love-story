import { describe, expect, it } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';

describe('merge guidance', () => {
  it('uses legal drops for its hint and never changes the board', () => {
    const game = createGameContext({ deterministic: true });
    const before = JSON.stringify(game.buildSaveData());
    expect(game.getMergeHint()).toEqual({ from: 0, to: 1, definitionId: 'coffee_01' });
    expect(JSON.stringify(game.buildSaveData())).toBe(before);
    game.dropItem(0, 1);
    expect(game.getMergeHint()).toEqual({ from: 2, to: 3, definitionId: 'coffee_01' });
  });
  it('does not suggest swaps or a merge beyond the last item level', () => {
    const game = createGameContext({ deterministic: true });
    game.debugClearBoard();
    game.debugSpawn('coffee_08'); game.debugSpawn('coffee_08'); game.debugSpawn('flower_01');
    expect(game.getMergeHint()).toBeNull();
  });
});
