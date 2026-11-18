import { describe, expect, it } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { constrainFurniturePose, furnitureContainsPoint, furnitureScaleFromProgress, furnitureScaleProgress, rotatedFurnitureSize } from '../assets/scripts/presentation/FurnitureEditing';
import { snapFurniturePlacement } from '../assets/scripts/presentation/UiSafety';

function fixture() {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const open = () => createGameContext({ storage, deterministic: true, saveDebounceMs: 0 });
  const game = open(); game.debugAddCoins(10000); game.buyFurniture('sofa'); game.buyFurniture('tea_table');
  return { game, open };
}
describe('session furniture undo through GameContext', () => {
  it('restores move, scale, rotation, flip and reset in reverse order without changing the wallet', () => {
    const { game, open } = fixture(); const wallet = { coins: game.player.coins, hearts: game.player.hearts, energy: game.player.energy };
    expect(game.getFurnitureUndoState()).toBeNull();
    game.moveFurniture('sofa', .2, .4); const moved = { ...game.life.state.furniturePositions.sofa };
    game.setFurnitureTransform('sofa', { scale: 1.5, rotation: -30, flipped: true }); const styled = { ...game.life.state.furniturePositions.sofa };
    game.resetFurniturePosition('sofa'); expect(game.life.state.furniturePositions.sofa).toBeUndefined();
    expect(game.undoFurnitureEdit('living')).toEqual({ ok: true, furnitureId: 'sofa' }); expect(game.life.state.furniturePositions.sofa).toEqual(styled);
    expect(open().life.state.furniturePositions.sofa).toEqual(styled);
    expect(game.undoFurnitureEdit('living').ok).toBe(true); expect(game.life.state.furniturePositions.sofa).toEqual(moved);
    expect(game.undoFurnitureEdit('living').ok).toBe(true); expect(game.life.state.furniturePositions.sofa).toBeUndefined();
    expect(game.undoFurnitureEdit()).toEqual({ ok: false, reason: 'NOT_READY' });
    expect({ coins: game.player.coins, hearts: game.player.hearts, energy: game.player.energy }).toEqual(wallet);
  });
  it('records only changed successful edits and supports alternating selected furniture', () => {
    const { game } = fixture(); game.moveFurniture('sofa', .2, .3); game.moveFurniture('sofa', .2, .3);
    expect(game.setFurnitureTransform('sofa', { scale: 99 }).ok).toBe(false);
    game.moveFurniture('tea_table', .5, .6); expect(game.getFurnitureUndoState()?.id).toBe('tea_table');
    game.undoFurnitureEdit(); expect(game.life.state.furniturePositions.tea_table).toBeUndefined();
    game.undoFurnitureEdit(); expect(game.life.state.furniturePositions.sofa).toBeUndefined(); expect(game.getFurnitureUndoState()).toBeNull();
  });
  it('rejects stale history and ignores hidden furniture or another room', () => {
    const { game } = fixture(); game.moveFurniture('sofa', .2, .3); expect(game.undoFurnitureEdit('pool').ok).toBe(false);
    game.life.state.furniturePositions.sofa = { x: .8, y: .7 };
    expect(game.undoFurnitureEdit()).toEqual({ ok: false, reason: 'STATE_CHANGED' }); expect(game.life.state.furniturePositions.sofa).toEqual({ x: .8, y: .7 });
    game.placeFurniture('sofa'); expect(game.getFurnitureUndoState()).toBeNull();
  });
  it('limits history to twenty edits and clears it independently of the saved layout', () => {
    const { game, open } = fixture(); for (let i = 0; i < 30; i++) game.moveFurniture('sofa', .1 + i / 1000, .4);
    for (let i = 0; i < 20; i++) expect(game.undoFurnitureEdit().ok).toBe(true);
    expect(game.life.state.furniturePositions.sofa.x).toBeCloseTo(.109); expect(game.getFurnitureUndoState()).toBeNull();
    game.moveFurniture('sofa', .5, .6); game.clearFurnitureEditHistory(); expect(game.getFurnitureUndoState()).toBeNull();
    expect(open().life.state.furniturePositions.sofa).toMatchObject({ x: .5, y: .6 }); expect(open().getFurnitureUndoState()).toBeNull();
  });
});
describe('furniture editing geometry', () => {
  it('maps the scale slider exactly to both limits and rounds previews consistently', () => {
    expect(furnitureScaleFromProgress(0)).toBe(.5); expect(furnitureScaleFromProgress(1)).toBe(1.8);
    expect(furnitureScaleFromProgress(NaN)).toBe(.5); expect(furnitureScaleFromProgress(2)).toBe(1.8);
    for (const value of [.5, .73, 1, 1.36, 1.8]) expect(furnitureScaleFromProgress(furnitureScaleProgress(value))).toBe(value);
  });
  it('hits actual rotated rectangles instead of empty bounding-box corners', () => {
    expect(furnitureContainsPoint({ x: 20, y: 20 }, { x: 0, y: 0 }, { width: 100, height: 40 }, 1, 45)).toBe(true);
    expect(furnitureContainsPoint({ x: 47, y: 47 }, { x: 0, y: 0 }, { width: 100, height: 40 }, 1, 45)).toBe(false);
    expect(furnitureContainsPoint({ x: 0, y: 0 }, { x: 0, y: 0 }, { width: 100, height: 40 }, 0, 0)).toBe(false);
  });
  it('clamps transformed furniture, centres oversized frames and keeps alignment guides at exact anchors', () => {
    const area = { width: 700, height: 700 }, size = { width: 180, height: 120 };
    const pose = constrainFurniturePose({ x: 1, y: 0, scale: 1.5, rotation: 30 }, size, area), bounds = rotatedFurnitureSize(size.width, size.height, pose.scale, pose.rotation);
    expect(pose.x * area.width + bounds.width / 2).toBeCloseTo(area.width); expect(pose.y * area.height - bounds.height / 2).toBeCloseTo(0);
    expect(constrainFurniturePose({ x: 1, y: 0, scale: 1.8 }, { width: 900, height: 900 }, area)).toMatchObject({ x: .5, y: .5 });
    expect(snapFurniturePlacement(0, 5, 100, 80, [])).toMatchObject({ guideX: 0, guideY: null });
    expect(snapFurniturePlacement(40, 30, 100, 80, [{ x: 100, foot: -10 }])).toMatchObject({ guideX: null, guideY: -10 });
  });
});
