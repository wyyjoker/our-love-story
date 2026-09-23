import type { ItemDefinition, ItemInstance } from '../types';

export type ItemCatalog = ReadonlyMap<string, ItemDefinition>;

export function createItemCatalog(items: readonly ItemDefinition[]): ItemCatalog {
  const map = new Map<string, ItemDefinition>();
  for (const item of items) {
    if (map.has(item.id)) {
      throw new Error(`Duplicate item id: ${item.id}`);
    }
    map.set(item.id, item);
  }
  return map;
}

export function getItemDefinition(
  catalog: ItemCatalog,
  definitionId: string,
): ItemDefinition | undefined {
  return catalog.get(definitionId);
}

export function createItemInstance(
  uid: string,
  definitionId: string,
): ItemInstance {
  return { uid, definitionId };
}
