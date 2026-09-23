import type { ItemInstance } from '../types';
import type { ItemCatalog } from '../item/catalog';

export type MergeFailureReason = 'MISSING_DEFINITION' | 'DIFFERENT_ITEM' | 'MAX_LEVEL';

export type MergeResult =
  | { ok: true; item: ItemInstance; sourceUid: string; targetUid: string }
  | { ok: false; reason: MergeFailureReason };

/**
 * Pure merge rules. Same definitionId only; max level cannot merge.
 * No Cocos / UI / storage dependencies.
 */
export class MergeEngine {
  constructor(private readonly catalog: ItemCatalog) {}

  canMerge(source: ItemInstance, target: ItemInstance): boolean {
    return this.tryMerge(source, target, `${source.uid}_merged`).ok;
  }

  merge(source: ItemInstance, target: ItemInstance, nextUid: string): MergeResult {
    return this.tryMerge(source, target, nextUid);
  }

  private tryMerge(
    source: ItemInstance,
    target: ItemInstance,
    nextUid: string,
  ): MergeResult {
    const sourceDef = this.catalog.get(source.definitionId);
    const targetDef = this.catalog.get(target.definitionId);
    if (!sourceDef || !targetDef) {
      return { ok: false, reason: 'MISSING_DEFINITION' };
    }
    if (source.definitionId !== target.definitionId) {
      return { ok: false, reason: 'DIFFERENT_ITEM' };
    }
    if (!sourceDef.nextItemId) {
      return { ok: false, reason: 'MAX_LEVEL' };
    }
    const nextDef = this.catalog.get(sourceDef.nextItemId);
    if (!nextDef) {
      return { ok: false, reason: 'MISSING_DEFINITION' };
    }
    return {
      ok: true,
      item: { uid: nextUid, definitionId: nextDef.id },
      sourceUid: source.uid,
      targetUid: target.uid,
    };
  }
}
