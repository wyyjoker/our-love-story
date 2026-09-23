import { describe, expect, it } from 'vitest';
import { MergeEngine } from '../assets/scripts/core/merge/mergeEngine';
import { createItemCatalog } from '../assets/scripts/core/item/catalog';
import type { ItemDefinition } from '../assets/scripts/core/types';

const items: ItemDefinition[] = [
  { id: 'coffee_01', chainId: 'coffee', level: 1, displayName: 'bean', nextItemId: 'coffee_02' },
  { id: 'coffee_02', chainId: 'coffee', level: 2, displayName: 'powder', nextItemId: 'coffee_03' },
  { id: 'coffee_03', chainId: 'coffee', level: 3, displayName: 'espresso', nextItemId: 'coffee_04' },
  { id: 'coffee_04', chainId: 'coffee', level: 4, displayName: 'americano', nextItemId: 'coffee_05' },
  { id: 'coffee_05', chainId: 'coffee', level: 5, displayName: 'latte', nextItemId: 'coffee_06' },
  { id: 'coffee_06', chainId: 'coffee', level: 6, displayName: 'heart latte', nextItemId: 'coffee_07' },
  { id: 'coffee_07', chainId: 'coffee', level: 7, displayName: 'duo coffee', nextItemId: 'coffee_08' },
  { id: 'coffee_08', chainId: 'coffee', level: 8, displayName: 'anniversary coffee' },
  { id: 'flower_03', chainId: 'flower', level: 3, displayName: 'tulip', nextItemId: 'flower_04' },
  { id: 'flower_04', chainId: 'flower', level: 4, displayName: 'rose' },
];

const catalog = createItemCatalog(items);
const engine = new MergeEngine(catalog);

describe('MergeEngine', () => {
  it('merges two identical Lv1 into Lv2', () => {
    const result = engine.merge(
      { uid: 'a', definitionId: 'coffee_01' },
      { uid: 'b', definitionId: 'coffee_01' },
      'c',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item.definitionId).toBe('coffee_02');
      expect(result.item.uid).toBe('c');
    }
  });

  it('merges two identical Lv7 into Lv8', () => {
    const result = engine.merge(
      { uid: 'a', definitionId: 'coffee_07' },
      { uid: 'b', definitionId: 'coffee_07' },
      'next',
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.item.definitionId).toBe('coffee_08');
  });

  it('rejects different levels', () => {
    const result = engine.merge(
      { uid: 'a', definitionId: 'coffee_01' },
      { uid: 'b', definitionId: 'coffee_02' },
      'x',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('DIFFERENT_ITEM');
  });

  it('rejects different chains', () => {
    const result = engine.merge(
      { uid: 'a', definitionId: 'coffee_03' },
      { uid: 'b', definitionId: 'flower_03' },
      'x',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('DIFFERENT_ITEM');
  });

  it('rejects max level merge', () => {
    const result = engine.merge(
      { uid: 'a', definitionId: 'coffee_08' },
      { uid: 'b', definitionId: 'coffee_08' },
      'x',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('MAX_LEVEL');
  });

  it('creates a new uid on merge', () => {
    const result = engine.merge(
      { uid: 'a', definitionId: 'coffee_01' },
      { uid: 'b', definitionId: 'coffee_01' },
      'brand-new-uid',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item.uid).toBe('brand-new-uid');
      expect(result.item.uid).not.toBe('a');
      expect(result.item.uid).not.toBe('b');
    }
  });

  it('canMerge matches merge success', () => {
    expect(
      engine.canMerge(
        { uid: 'a', definitionId: 'coffee_02' },
        { uid: 'b', definitionId: 'coffee_02' },
      ),
    ).toBe(true);
    expect(
      engine.canMerge(
        { uid: 'a', definitionId: 'coffee_08' },
        { uid: 'b', definitionId: 'coffee_08' },
      ),
    ).toBe(false);
  });
});
