import type { ItemInstance, ItemDefinition } from '../types';
import type { ItemCatalog } from '../item/catalog';


export function remainingToolUses(item: ItemInstance, definition: ItemDefinition): number {
  if (!definition.maxUses) return 0;
  return item.remainingUses === undefined ? definition.maxUses : Math.min(definition.maxUses,
    Math.max(0, Math.floor(Number.isFinite(item.remainingUses) ? item.remainingUses : 0)));
}

export type MergeFailureReason = 'MISSING_DEFINITION' | 'DIFFERENT_ITEM' | 'MAX_LEVEL';

export type MergeResult =
  | { ok: true; item: ItemInstance; sourceUid: string; targetUid: string }
  | { ok: false; reason: MergeFailureReason };

/**
 * Pure merge rules. An eligible wildcard substitutes for one matching item.
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
    const wildcardPair = sourceDef.wildcard === true !== (targetDef.wildcard === true);
    const ordinary = sourceDef.wildcard ? targetDef : sourceDef;
    if (wildcardPair && !ordinary.wildcardEligible) {
      return { ok: false, reason: 'DIFFERENT_ITEM' };
    }
    if (!wildcardPair && source.definitionId !== target.definitionId) {
      return { ok: false, reason: 'DIFFERENT_ITEM' };
    }
    if (ordinary.maxUses && (!remainingToolUses(source, ordinary) || !remainingToolUses(target, ordinary))) return { ok: false, reason: 'DIFFERENT_ITEM' };
    if (!ordinary.nextItemId) {
      return { ok: false, reason: 'MAX_LEVEL' };
    }
    const nextDef = this.catalog.get(ordinary.nextItemId);
    if (!nextDef) {
      return { ok: false, reason: 'MISSING_DEFINITION' };
    }
    return {
      ok: true,
      item: { uid: nextUid, definitionId: nextDef.id,
        ...(ordinary.maxUses && nextDef.maxUses ? { remainingUses: Math.max(1, Math.floor(
          (remainingToolUses(source, ordinary) + remainingToolUses(target, ordinary)) * nextDef.maxUses / (ordinary.maxUses * 2))) } : {}),
      },
      sourceUid: source.uid,
      targetUid: target.uid,
    };
  }
}
