import type { BoardPosition, BoardState, BoardCellState, ItemInstance } from '../types';

export function createEmptyBoard(rows: number, columns: number): BoardState {
  const cells: BoardCellState[] = [];
  for (let index = 0; index < rows * columns; index += 1) {
    cells.push({ index });
  }
  return { rows, columns, cells };
}

export function indexToPosition(index: number, columns: number): BoardPosition {
  return {
    row: Math.floor(index / columns),
    column: index % columns,
  };
}

export function positionToIndex(position: BoardPosition, columns: number): number {
  return position.row * columns + position.column;
}

export function isValidPosition(
  position: BoardPosition,
  rows: number,
  columns: number,
): boolean {
  return (
    Number.isInteger(position.row) &&
    Number.isInteger(position.column) &&
    position.row >= 0 &&
    position.column >= 0 &&
    position.row < rows &&
    position.column < columns
  );
}

export function isValidIndex(index: number, rows: number, columns: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < rows * columns;
}

export function findFirstEmptyIndex(board: BoardState): number | null {
  for (const cell of board.cells) {
    if (!cell.item) return cell.index;
  }
  return null;
}

export function isBoardFull(board: BoardState): boolean {
  return findFirstEmptyIndex(board) === null;
}

export function getCellItem(board: BoardState, index: number): ItemInstance | undefined {
  return board.cells[index]?.item;
}

export function cloneBoard(board: BoardState): BoardState {
  return {
    rows: board.rows,
    columns: board.columns,
    cells: board.cells.map((cell) => ({
      index: cell.index,
      item: cell.item ? { ...cell.item } : undefined,
    })),
  };
}
