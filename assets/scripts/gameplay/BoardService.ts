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
  cloneItem,
} from '../core/board/board';
import type { ItemCatalog } from '../core/item/catalog';
import type { GameEventBus } from '../events/GameEventBus';
import type { IdGenerator } from '../infrastructure/IdService';
import type { ClockService } from '../infrastructure/ClockService';

export type SpawnOnBoardResult =
  | { ok: true; item: ItemInstance; cellIndex: number }
  | { ok: false; reason: 'BOARD_FULL' };

export type DropItemResult =
  | { ok: true; kind: 'SPLIT'; from: number; to: number }
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
    private readonly clock?: ClockService,
  ) {
    if (initial && 'cells' in initial && 'rows' in initial) {
      this.board = initial;
    } else if (Array.isArray(initial)) {
      this.board = {
        rows,
        columns,
        cells: initial.map((c) => ({
          ...c,
          item: c.item ? cloneItem(c.item) : undefined,
        })),
      };
    } else {
      this.board = createEmptyBoard(rows, columns);
    }
  }

  getBoard(): BoardState {
    return this.board;
  }

  private unlockLevels: number[] = [];

  getLockedUnlockLevel(index: number): number | null {
    return this.unlockLevels[index] || null;
  }

  configureUnlocks(level: number, unlocks: ReadonlyArray<{ level: number; rows: number; columns: number }>, retainedIndices: readonly number[] = []): void {
    this.unlockLevels = this.board.cells.map((c) => unlocks.find((u) => Math.floor(c.index / this.board.columns) < u.rows && c.index % this.board.columns < u.columns)?.level ?? 0);
    const retained = new Set(retainedIndices);
    for (const cell of this.board.cells) cell.locked = !retained.has(cell.index) && (!this.unlockLevels[cell.index] || level < this.unlockLevels[cell.index]);
  }

  getRows(): number {
    return this.board.rows;
  }

  getColumns(): number {
    return this.board.columns;
  }

  getMergeHint(): { from: number; to: number; definitionId: string } | null {
    const occupied = this.board.cells.filter((cell) => cell.item);
    for (let first = 0; first < occupied.length; first += 1) {
      for (let second = first + 1; second < occupied.length; second += 1) {
        const from = occupied[first];
        const to = occupied[second];
        if (this.previewDrop(from.index, to.index).kind === 'MERGE' && from.item) {
          return { from: from.index, to: to.index, definitionId: from.item.definitionId };
        }
      }
    }
    return null;
  }

  replaceBoard(board: BoardState, reason: 'reset' | 'tool' = 'reset'): void {
    this.board = board;
    this.bus.emit('BOARD_CHANGED', { reason });
  }

  previewDrop(from: number, to: number | null): DropResolve {
    return resolveDrop(this.board, this.catalog, from, to);
  }

  tryDrop(from: number, to: number | null): DropItemResult {
    const nextUid = this.ids.next();
    const result = applyDrop(this.board, this.catalog, from, to, nextUid, this.clock?.now() ?? 0);
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
    if (result.kind === 'SPLIT') { this.bus.emit('BOARD_CHANGED', { reason: 'tool' }); this.bus.emit('PLAY_CHANGED', { reason: 'scissors' }); return { ok: true, kind: 'SPLIT', from, to: dest }; }
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
    return this.placeInstanceAt(index, { uid: this.ids.next(), definitionId })!;
  }

  placeInstanceAt(index: number, item: ItemInstance): SpawnOnBoardResult | null {
    const cell = this.board.cells[index];
    if (!cell || cell.locked || cell.item) return null;
    item = cloneItem(item);
    this.board.cells[index].item = item;
    this.bus.emit('ITEM_SPAWNED', {
      uid: item.uid,
      definitionId: item.definitionId,
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

  clearBoard(preserveGenerators = true): void {
    for (const cell of this.board.cells) {
      if (preserveGenerators && cell.item && this.catalog.get(cell.item.definitionId)?.generator) continue;
      cell.item = undefined;
    }
    this.bus.emit('BOARD_CHANGED', { reason: 'debug' });
  }

  placeAt(index: number, definitionId: string, generatorState?: ItemInstance['generatorState']): ItemInstance | null {
    if (index < 0 || index >= this.board.cells.length) return null;
    if (this.board.cells[index].item || this.board.cells[index].locked) return null;
    const item: ItemInstance = { uid: this.ids.next(), definitionId };
    const rules = this.catalog.get(definitionId)?.generator;
    if (rules) item.generatorState = generatorState ? { ...generatorState } : { remainingUses: rules.capacity, recoveryAt: this.clock?.now() ?? 0, cooldownUntil: null, boosted: false };
    const placed = this.placeInstanceAt(index, item);
    return placed?.ok ? placed.item : null;
  }
}
