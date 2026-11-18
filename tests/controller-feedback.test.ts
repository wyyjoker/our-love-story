import { describe, expect, it } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { GameController } from '../assets/scripts/ui/GameController';

describe('drop feedback', () => {
  it('explains two maximum-level items without changing merge rules or granting progress', () => {
    const game = createGameContext({ deterministic: true });
    game.board.clearBoard(); game.board.placeAt(0, 'coffee_12'); game.board.placeAt(1, 'coffee_12');
    const message = new GameController(game).onDrop(0, 1);
    expect(message).toMatchObject({ ok: true, kind: 'SWAP', tone: 'info' });
    expect(message.toast).toContain('最高等级');
    expect(game.life.state.stats.merges).toBe(0);
    expect(game.board.getBoard().cells.slice(0, 2).map((cell) => cell.item?.definitionId)).toEqual(['coffee_12', 'coffee_12']);
    game.flushSave();
  });
  it('keeps ordinary moves and cancelled drags quiet', () => {
    const game = createGameContext({ deterministic: true });
    const controller = new GameController(game);
    expect(controller.onDrop(0, null)).toEqual({ ok: false });
    expect(controller.onDrop(0, 9)).toEqual({ ok: true, kind: 'MOVE' });
    expect(controller.onDrop(9, 1)).toMatchObject({ ok: true, kind: 'MERGE', toast: '合成成功！' });
    game.flushSave();
  });
});
