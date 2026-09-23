import type {
  BoardState,
  DropResolve,
  ItemInstance,
  OrderRequirement,
} from '../core/types';
import {
  applyDrop,
  consumeLocations,
  findItemsForRequirements,
  getOrderProgress,
  resolveDrop,
  type ItemLocation,
  type OrderProgress,
} from '../core/board/rules';
import {
  createEmptyBoard,
  findFirstEmptyIndex,
  isBoardFull,
} from '../core/board/board';
import type { ItemCatalog } from '../core/item/catalog';
import type { GameEventBus } from '../events/GameEventBus';
import type { IdGenerator } from '../infrastructure/IdService';

export type SpawnOnBoardResult =
  | { ok: true; item: ItemInstance; cellIndex: number }
  | { ok: false; reason: 'BOARD_FULL' };

export type DropItemResult =
  | { ok: true; kind: 'MOVE'; from: number; to: number }
  | { ok: true; kind: 'SWAP'; from: number; to: number }
  | {
      ok: true;
      kind: 'MERGE';
      from: number;
      to: number;
      resultUid: string;
      resultDefinitionId: string;
    }
  | { ok: false; reason: 'INVALID' | 'EMPTY_SOURCE' | 'CANNOT_MERGE' };

export class BoardService {
  private board: BoardState;

  constructor(
    private readonly catalog: ItemCatalog,
    private readonly ids: IdGenerator,
    private readonly bus: GameEventBus,
    rows: number,
    columns: number,
    initial?: BoardState | BoardState['cells'],
  ) {
    if (initial && 'cells' in initial && 'rows' in initial) {
      this.board = initial;
    } else if (Array.isArray(initial)) {
      this.board = {
        rows,
        columns,
        cells: initial.map((c) => ({
          ...c,
          item: c.item ? { ...c.item } : undefined,
        })),
      };
    } else {
      this.board = createEmptyBoard(rows, columns);
    }
  }

  getBoard(): BoardState {
    return this.board;
  }

  getRows(): number {
    return this.board.rows;
  }

  getColumns(): number {
    return this.board.columns;
  }

  replaceBoard(board: BoardState): void {
    this.board = board;
    this.bus.emit('BOARD_CHANGED', { reason: 'reset' });
  }

  previewDrop(from: number, to: number | null): DropResolve {
    return resolveDrop(this.board, this.catalog, from, to);
  }

  tryDrop(from: number, to: number | null): DropItemResult {
    const nextUid = this.ids.next();
    const result = applyDrop(this.board, this.catalog, from, to, nextUid);
    if (!result.ok) return result;

    this.board = result.board;

    if (result.kind === 'MERGE') {
      const dest = to as number;
      const merged = result.merged;
      this.bus.emit('ITEM_MERGED', {
        from,
        to: dest,
        resultUid: merged.uid,
        resultDefinitionId: merged.definitionId,
      });
      this.bus.emit('BOARD_CHANGED', { reason: 'merge' });
      return {
        ok: true,
        kind: 'MERGE',
        from,
        to: dest,
        resultUid: merged.uid,
        resultDefinitionId: merged.definitionId,
      };
    }

    const dest = to as number;
    if (result.kind === 'MOVE') {
      const uid = this.board.cells[dest]?.item?.uid ?? '';
      this.bus.emit('ITEM_MOVED', { uid, from, to: dest });
      this.bus.emit('BOARD_CHANGED', { reason: 'move' });
      return { ok: true, kind: 'MOVE', from, to: dest };
    }

    const fromUid = this.board.cells[from]?.item?.uid ?? '';
    const toUid = this.board.cells[dest]?.item?.uid ?? '';
    this.bus.emit('ITEM_SWAPPED', { fromUid, toUid, from, to: dest });
    this.bus.emit('BOARD_CHANGED', { reason: 'swap' });
    return { ok: true, kind: 'SWAP', from, to: dest };
  }

  spawn(definitionId: string): SpawnOnBoardResult {
    const index = findFirstEmptyIndex(this.board);
    if (index === null) {
      return { ok: false, reason: 'BOARD_FULL' };
    }
    const item: ItemInstance = { uid: this.ids.next(), definitionId };
    this.board.cells[index].item = item;
    this.bus.emit('ITEM_SPAWNED', {
      uid: item.uid,
      definitionId,
      cellIndex: index,
    });
    this.bus.emit('BOARD_CHANGED', { reason: 'spawn' });
    return { ok: true, item, cellIndex: index };
  }

  isFull(): boolean {
    return isBoardFull(this.board);
  }

  findItemsForRequirements(
    requirements: readonly OrderRequirement[],
  ): ItemLocation[] | null {
    return findItemsForRequirements(this.board, requirements);
  }

  consumeItems(locations: readonly ItemLocation[]): void {
    this.board = consumeLocations(this.board, locations);
    this.bus.emit('BOARD_CHANGED', { reason: 'claim' });
  }

  getOrderProgress(order: { requirements: OrderRequirement[] }): OrderProgress {
    return getOrderProgress(this.board, order);
  }

  clearBoard(): void {
    for (const cell of this.board.cells) {
      cell.item = undefined;
    }
    this.bus.emit('BOARD_CHANGED', { reason: 'debug' });
  }

  placeAt(index: number, definitionId: string): ItemInstance | null {
    if (index < 0 || index >= this.board.cells.length) return null;
    if (this.board.cells[index].item) return null;
    const item: ItemInstance = { uid: this.ids.next(), definitionId };
    this.board.cells[index].item = item;
    this.bus.emit('ITEM_SPAWNED', {
      uid: item.uid,
      definitionId,
      cellIndex: index,
    });
    this.bus.emit('BOARD_CHANGED', { reason: 'debug' });
    return item;
  }
}
