import type {
  ActiveOrder,
  BoardState,
  DropResolve,
  ItemInstance,
  OrderRequirement,
} from '../types';
import {
  cloneBoard,
  getCellItem,
  isValidIndex,
} from '../board/board';
import { MergeEngine, remainingToolUses } from '../merge/mergeEngine';
import type { ItemCatalog } from '../item/catalog';

export type ItemLocation = {
  cellIndex: number;
  uid: string;
  definitionId: string;
};

export function resolveDrop(
  board: BoardState,
  catalog: ItemCatalog,
  from: number,
  to: number | null,
): DropResolve {
  if (to === null || !isValidIndex(from, board.rows, board.columns)) {
    return { kind: 'CANCEL' };
  }
  if (!isValidIndex(to, board.rows, board.columns)) {
    return { kind: 'CANCEL' };
  }
  if (board.cells[from]?.locked || board.cells[to]?.locked) return { kind: 'CANCEL' };
  if (from === to) {
    return { kind: 'CANCEL' };
  }

  const source = getCellItem(board, from);
  if (!source) {
    return { kind: 'CANCEL' };
  }

  const target = getCellItem(board, to);
  if (!target) {
    return { kind: 'MOVE', from, to };
  }

  const tool = catalog.get(source.definitionId), targetDefinition = catalog.get(target.definitionId);
  if (tool?.maxUses && targetDefinition?.chainId !== tool.chainId) {
    if (targetDefinition?.generator) return { kind: 'CANCEL' };
    const uses = remainingToolUses(source, tool);
    const previous = Array.from(catalog.values()).find((item) => item.nextItemId === target.definitionId);
    if (uses <= 0 || !previous || targetDefinition?.maxUses || (uses > 1 && !board.cells.some((cell) => !cell.locked && !cell.item))) return { kind: 'CANCEL' };
    return { kind: 'SPLIT', from, to };
  }

  const mergeEngine = new MergeEngine(catalog);
  if (mergeEngine.canMerge(source, target)) {
    return { kind: 'MERGE', from, to };
  }
  return { kind: 'SWAP', from, to };
}

export type BoardApplyResult =
  | { ok: true; kind: 'SPLIT'; board: BoardState }
  | {
      ok: true;
      kind: 'MOVE' | 'SWAP';
      board: BoardState;
    }
  | {
      ok: true;
      kind: 'MERGE';
      board: BoardState;
      merged: ItemInstance;
    }
  | { ok: false; reason: 'INVALID' | 'EMPTY_SOURCE' | 'CANNOT_MERGE' };

export function applyDrop(
  board: BoardState,
  catalog: ItemCatalog,
  from: number,
  to: number | null,
  nextUid: string,
  nowMs = 0,
): BoardApplyResult {
  const drop = resolveDrop(board, catalog, from, to);
  if (drop.kind === 'CANCEL') {
    return { ok: false, reason: 'INVALID' };
  }

  const next = cloneBoard(board);
  const source = next.cells[from]?.item;
  if (!source) {
    return { ok: false, reason: 'EMPTY_SOURCE' };
  }

  const targetIndex = drop.to;

  if (drop.kind === 'SPLIT') {
    const tool = catalog.get(source.definitionId)!, target = next.cells[targetIndex].item!;
    const previous = Array.from(catalog.values()).find((item) => item.nextItemId === target.definitionId)!;
    const uses = remainingToolUses(source, tool);
    const extra = uses === 1 ? next.cells[from] : next.cells.find((cell) => !cell.locked && !cell.item)!;
    next.cells[from].item = uses === 1 ? undefined : { ...source, remainingUses: uses - 1 };
    next.cells[targetIndex].item = { uid: target.uid, definitionId: previous.id };
    extra.item = { uid: nextUid, definitionId: previous.id };
    return { ok: true, kind: 'SPLIT', board: next };
  }

  if (drop.kind === 'MOVE') {
    next.cells[from].item = undefined;
    next.cells[targetIndex].item = source;
    return { ok: true, kind: 'MOVE', board: next };
  }

  if (drop.kind === 'SWAP') {
    const target = next.cells[targetIndex].item;
    next.cells[targetIndex].item = source;
    next.cells[from].item = target;
    return { ok: true, kind: 'SWAP', board: next };
  }

  const target = next.cells[targetIndex].item;
  if (!target) {
    return { ok: false, reason: 'INVALID' };
  }
  const mergeEngine = new MergeEngine(catalog, nowMs);
  const merged = mergeEngine.merge(source, target, nextUid);
  if (!merged.ok) {
    return { ok: false, reason: 'CANNOT_MERGE' };
  }
  next.cells[from].item = undefined;
  next.cells[targetIndex].item = merged.item;
  return { ok: true, kind: 'MERGE', board: next, merged: merged.item };
}

export function findItemsForRequirements(
  board: BoardState,
  requirements: readonly OrderRequirement[],
): ItemLocation[] | null {
  const needed = new Map<string, number>();
  for (const req of requirements) {
    if (req.count <= 0) return null;
    needed.set(req.itemId, (needed.get(req.itemId) ?? 0) + req.count);
  }

  const picked: ItemLocation[] = [];
  for (const cell of board.cells) {
    const item = cell.item;
    if (!item) continue;
    const remain = needed.get(item.definitionId);
    if (remain === undefined || remain <= 0) continue;
    picked.push({
      cellIndex: cell.index,
      uid: item.uid,
      definitionId: item.definitionId,
    });
    needed.set(item.definitionId, remain - 1);
  }

  for (const count of needed.values()) {
    if (count > 0) return null;
  }
  return picked;
}

export function canSatisfyOrder(
  board: BoardState,
  requirements: readonly OrderRequirement[],
): boolean {
  return findItemsForRequirements(board, requirements) !== null;
}

export function consumeLocations(
  board: BoardState,
  locations: readonly ItemLocation[],
): BoardState {
  const next = cloneBoard(board);
  // Ascending index for deterministic removal order
  const sorted = [...locations].sort((a, b) => a.cellIndex - b.cellIndex);
  for (const loc of sorted) {
    const cell = next.cells[loc.cellIndex];
    if (cell?.item?.uid === loc.uid) {
      cell.item = undefined;
    }
  }
  return next;
}

export function countBoardItems(board: BoardState): number {
  let n = 0;
  for (const cell of board.cells) {
    if (cell.item) n += 1;
  }
  return n;
}

export type OrderProgress = {
  requirements: Array<OrderRequirement & { have: number; done: boolean }>;
  ready: boolean;
};

export function getOrderProgress(
  board: BoardState,
  order: Pick<ActiveOrder, 'requirements'>,
): OrderProgress {
  const haveMap = new Map<string, number>();
  for (const cell of board.cells) {
    if (!cell.item) continue;
    haveMap.set(
      cell.item.definitionId,
      (haveMap.get(cell.item.definitionId) ?? 0) + 1,
    );
  }
  let ready = true;
  const requirements = order.requirements.map((req) => {
    const have = haveMap.get(req.itemId) ?? 0;
    const done = have >= req.count;
    if (!done) ready = false;
    return { ...req, have: Math.min(have, req.count), done };
  });
  return { requirements, ready };
}
