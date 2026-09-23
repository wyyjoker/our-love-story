import { describe, expect, it } from 'vitest';
import {
  createEmptyBoard,
  findFirstEmptyIndex,
  indexToPosition,
  isBoardFull,
  isValidPosition,
  positionToIndex,
} from '../assets/scripts/core/board/board';
import {
  applyDrop,
  consumeLocations,
  findItemsForRequirements,
  resolveDrop,
} from '../assets/scripts/core/board/rules';
import { createItemCatalog } from '../assets/scripts/core/item/catalog';
import type { ItemDefinition } from '../assets/scripts/core/types';

const items: ItemDefinition[] = [
  { id: 'coffee_01', chainId: 'coffee', level: 1, displayName: 'a', nextItemId: 'coffee_02' },
  { id: 'coffee_02', chainId: 'coffee', level: 2, displayName: 'b', nextItemId: 'coffee_03' },
  { id: 'coffee_03', chainId: 'coffee', level: 3, displayName: 'c' },
  { id: 'flower_01', chainId: 'flower', level: 1, displayName: 'f', nextItemId: 'flower_02' },
  { id: 'flower_02', chainId: 'flower', level: 2, displayName: 'f2' },
];
const catalog = createItemCatalog(items);

describe('Board geometry', () => {
  it('initializes 63 cells for 7x9', () => {
    const board = createEmptyBoard(9, 7);
    expect(board.rows).toBe(9);
    expect(board.columns).toBe(7);
    expect(board.cells).toHaveLength(63);
  });

  it('index/position roundtrip', () => {
    expect(positionToIndex({ row: 0, column: 0 }, 7)).toBe(0);
    expect(positionToIndex({ row: 1, column: 2 }, 7)).toBe(9);
    expect(indexToPosition(9, 7)).toEqual({ row: 1, column: 2 });
    expect(isValidPosition({ row: 8, column: 6 }, 9, 7)).toBe(true);
    expect(isValidPosition({ row: 9, column: 0 }, 9, 7)).toBe(false);
    expect(isValidPosition({ row: 0, column: 7 }, 9, 7)).toBe(false);
  });
});

describe('Board drop rules', () => {
  function boardWith(entries: Array<[number, string]> ) {
    const board = createEmptyBoard(9, 7);
    for (const [index, definitionId] of entries) {
      board.cells[index].item = { uid: `u${index}`, definitionId };
    }
    return board;
  }

  it('moves into empty cell', () => {
    const board = boardWith([[0, 'coffee_01']]);
    const drop = resolveDrop(board, catalog, 0, 5);
    expect(drop.kind).toBe('MOVE');
    const result = applyDrop(board, catalog, 0, 5, 'new');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe('MOVE');
      expect(result.board.cells[0].item).toBeUndefined();
      expect(result.board.cells[5].item?.definitionId).toBe('coffee_01');
    }
  });

  it('merges occupied same', () => {
    const board = boardWith([
      [0, 'coffee_01'],
      [1, 'coffee_01'],
    ]);
    const drop = resolveDrop(board, catalog, 0, 1);
    expect(drop.kind).toBe('MERGE');
    const result = applyDrop(board, catalog, 0, 1, 'merged');
    expect(result.ok).toBe(true);
    if (result.ok && result.kind === 'MERGE') {
      expect(result.merged.definitionId).toBe('coffee_02');
      expect(result.board.cells[0].item).toBeUndefined();
      expect(result.board.cells[1].item?.uid).toBe('merged');
    }
  });

  it('swaps occupied different', () => {
    const board = boardWith([
      [0, 'coffee_01'],
      [1, 'flower_01'],
    ]);
    const drop = resolveDrop(board, catalog, 0, 1);
    expect(drop.kind).toBe('SWAP');
    const result = applyDrop(board, catalog, 0, 1, 'new');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe('SWAP');
      expect(result.board.cells[0].item?.definitionId).toBe('flower_01');
      expect(result.board.cells[1].item?.definitionId).toBe('coffee_01');
    }
  });

  it('invalid drop leaves state unchanged semantics (CANCEL)', () => {
    const board = boardWith([[0, 'coffee_01']]);
    const drop = resolveDrop(board, catalog, 0, null);
    expect(drop.kind).toBe('CANCEL');
    const dropOut = resolveDrop(board, catalog, 0, 999);
    expect(dropOut.kind).toBe('CANCEL');
    const same = resolveDrop(board, catalog, 0, 0);
    expect(same.kind).toBe('CANCEL');
  });

  it('board full â†?no empty cell', () => {
    const board = createEmptyBoard(1, 3);
    board.cells[0].item = { uid: 'a', definitionId: 'coffee_01' };
    board.cells[1].item = { uid: 'b', definitionId: 'coffee_01' };
    board.cells[2].item = { uid: 'c', definitionId: 'coffee_01' };
    expect(isBoardFull(board)).toBe(true);
    expect(findFirstEmptyIndex(board)).toBeNull();
  });

  it('finds items for requirements from lowest index', () => {
    const board = boardWith([
      [5, 'coffee_01'],
      [2, 'coffee_01'],
      [10, 'flower_01'],
    ]);
    const locs = findItemsForRequirements(board, [
      { itemId: 'coffee_01', count: 2 },
      { itemId: 'flower_01', count: 1 },
    ]);
    expect(locs).not.toBeNull();
    expect(locs!.map((l) => l.cellIndex)).toEqual([2, 5, 10]);
  });

  it('consumeLocations removes only matched', () => {
    const board = boardWith([
      [1, 'coffee_01'],
      [2, 'flower_01'],
    ]);
    const next = consumeLocations(board, [
      { cellIndex: 1, uid: 'u1', definitionId: 'coffee_01' },
    ]);
    expect(next.cells[1].item).toBeUndefined();
    expect(next.cells[2].item?.definitionId).toBe('flower_01');
  });
});
