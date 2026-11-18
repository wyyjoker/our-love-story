import type { BoardCellState, OrderRequirement } from '../types';
import type { ItemCatalog } from '../item/catalog';

/** Estimate from current open-board pieces and the producer's minimum output.
 * Frozen backpack pieces and higher-level pieces cannot fulfil this calculation.
 * Weighted higher drops can make the actual work smaller than this estimate. */
export function planOrderRequirement(catalog: ItemCatalog, cells: readonly BoardCellState[], requirement: OrderRequirement, minimumOutputLevel: number) {
  const target = catalog.get(requirement.itemId);
  if (!target) return null;
  const floor = Math.max(1, Math.min(target.level, minimumOutputLevel));
  const matching: number[] = [], precursors: number[] = [];
  const counts = new Map<number, number>();
  for (const cell of cells) {
    if (cell.locked || !cell.item) continue;
    const item = catalog.get(cell.item.definitionId);
    if (!item || item.chainId !== target.chainId) continue;
    if (item.id === target.id) matching.push(cell.index);
    if (item.level >= floor && item.level < target.level) {
      precursors.push(cell.index); counts.set(item.level, (counts.get(item.level) ?? 0) + 1);
    }
  }
  const missing = Math.max(0, requirement.count - matching.length);
  let needed = missing, merges = 0;
  for (let level = target.level - 1; level >= floor; level--) {
    merges += needed;
    needed = Math.max(0, needed * 2 - (counts.get(level) ?? 0));
  }
  return { itemId: target.id, count: requirement.count, have: matching.length, missing,
    matchingIndices: matching, precursorIndices: precursors, spawnEstimate: needed, mergeEstimate: merges, minimumOutputLevel: floor };
}
