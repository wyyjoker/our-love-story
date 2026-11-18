import { describe, expect, it } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { loadConfigBundle } from '../assets/scripts/config/ConfigRepository';
import { createDefaultSaveData } from '../assets/scripts/infrastructure/SaveService';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';

function fixture() {
  const values = new Map<string, string>(), clock = new FakeClockService(1_000_000);
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); } };
  return { values, clock, open: () => createGameContext({ storage, clock, deterministic: true, saveDebounceMs: 0 }) };
}

describe('self-describing 7 by 9 save geometry', () => {
  it('maps all 42 v8 UIDs and retained rights by their old six-column coordinates exactly once', () => {
    const f = fixture(), config = loadConfigBundle().game, old = createDefaultSaveData(config, f.clock.now());
    old.version = 8; delete old.boardSize;
    old.board = Array.from({ length: 42 }, (_, index) => ({ index, item: { uid: `v8_${index}`, definitionId: 'coffee_03' } }));
    old.retainedOpenCellIndices = [40, 41]; old.player.coins = 431; old.player.diamonds = 17; old.player.energy = 150;
    old.play.warehouseCapacity = 12;
    old.generatorInventory = { coffee_machine: [1, 2, 1] };
    const original = JSON.stringify(old); f.values.set(config.saveKey, original);
    const game = f.open();
    expect(f.values.get(config.saveKey + ':backup')).toBe(original);
    for (let index = 0; index < 42; index += 1) {
      const mapped = Math.floor(index / 6) * 7 + index % 6;
      expect(game.board.getBoard().cells[mapped].item?.uid).toBe(`v8_${index}`);
      expect(game.board.getBoard().cells[mapped].locked).toBe(false);
    }
    expect(game.board.getBoard().cells.filter(cell => cell.item)).toHaveLength(42);
    expect(game.rewardInbox).toEqual([]);
    expect(game.player).toMatchObject({ coins: 431, diamonds: 17, energy: 150 });
    expect(game.play.warehouseCapacity).toBe(12);
    const saved = game.buildSaveData();
    expect(saved.version).toBe(9); expect(saved.boardSize).toEqual({ rows: 9, columns: 7 });
    expect(saved.retainedOpenCellIndices).toEqual(expect.arrayContaining([46, 47]));
    const reloaded = f.open();
    expect(reloaded.buildSaveData().board).toEqual(saved.board);
    expect(reloaded.buildSaveData().retainedOpenCellIndices).toEqual(saved.retainedOpenCellIndices);
  });

  it.each([48, 63, 81])('conserves every item from a %i-cell historical layout, including outlying columns', size => {
    const f = fixture(), config = loadConfigBundle().game, old = createDefaultSaveData(config, f.clock.now());
    old.version = 5; delete old.boardSize;
    old.board = Array.from({ length: size }, (_, index) => ({ index, item: { uid: `old_${index}`, definitionId: 'flower_02' } }));
    old.rewardInbox = [{ uid: 'existing_inbox', definitionId: 'coin_03' }];
    f.values.set(config.saveKey, JSON.stringify(old)); const game = f.open();
    const all = [...game.board.getBoard().cells.flatMap(cell => cell.item ? [cell.item] : []), ...game.rewardInbox];
    expect(all).toHaveLength(size + 1); expect(new Set(all.map(item => item.uid)).size).toBe(size + 1);
    expect(new Set(all.map(item => item.uid))).toEqual(new Set([...old.board.map(cell => cell.item!.uid), 'existing_inbox']));
    expect(f.open().buildSaveData().board).toEqual(game.buildSaveData().board);
  });
});
