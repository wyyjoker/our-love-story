import type { ConfigBundle } from '../config/ConfigRepository';
import type { SaveData } from '../core/types';
import type { StorageAdapter } from './PlatformService';
import { createDefaultSaveData } from './SaveService';
import { energyCapacity } from '../core/energy/capacity';
import { freshGeneratorState, generatorItemId } from '../core/generator/generatorItems';

/** Review-only fixture. No dependency on or access to device storage. */
export function createDemoSave(bundle: ConfigBundle, now: number): SaveData {
  const data = createDefaultSaveData(bundle.game, now);
  const level = bundle.progression.levels.find((entry) => entry.level === 12)!;
  data.player = { ...data.player, level: 12, xp: level.xpRequired + 320,
    coins: 12460, hearts: 520, energy: 86, maxEnergy: energyCapacity(bundle.game.energy, 12),
    unlockedChainIds: bundle.generators.map((generator) => generator.chainId) };
  const items = ['coffee_01', ...bundle.items
    .filter(item => item.level <= 6 && ['coffee', 'flower', 'dessert', 'gift'].includes(item.chainId))
    .map(item => item.id), 'fruit_01', 'fruit_03', 'treasure_chest', 'energy_02'];
  data.board = data.board.map((_, index) => items[index]
    ? { index, item: { uid: `demo_${index}`, definitionId: items[index] } } : { index });
  const machines = [bundle.generators[0], ...bundle.generators];
  const firstMachineCell = bundle.game.board.columns * 5;
  for (const [offset, generator] of machines.entries()) {
    const index = firstMachineCell + offset;
    const definitionId = generatorItemId(generator.id, 1);
    const definition = bundle.catalog.get(definitionId);
    if (!definition?.generator) continue;
    data.board[index] = { index, item: { uid: `demo_${index}`, definitionId,
      generatorState: freshGeneratorState(definition.generator, now) } };
  }
  data.generatorBoard = { ready: true, entitlements: bundle.generators.map(g => g.id), rewards: [] };
  data.discoveredItemIds = [...new Set(items)];
  data.claimedDiscoveryIds = [...data.discoveredItemIds];
  const orderIds = ['order_romantic_combo', 'order_anniversary_preview', 'order_morning_set'];
  data.activeOrders = orderIds.map((id, index) => {
    const template = bundle.orders.find((order) => order.id === id)!;
    return { uid: `demo_order_${index}`, templateId: id,
      requirements: template.requirements.map((requirement) => ({ ...requirement })),
      rewardCoins: template.rewardCoins, rewardXp: template.rewardXp, rewardHearts: template.rewardHearts };
  });
  data.recentOrderIds = orderIds;
  data.tutorial = { generatorClicked: true, firstMergeCompleted: true, firstOrderCompleted: true, firstOrderHintShown: true };
  const furniture = bundle.furniture.filter((item) => item.unlockLevel <= 12).map((item) => item.id);
  data.life = { ...data.life, unlockedMemoryIds: bundle.memories.slice(0, 3).map((memory) => memory.id),
    ownedFurnitureIds: furniture, placedFurnitureIds: [...furniture],
    claimedLevelRewards: Array.from({ length: 11 }, (_, index) => index + 2),
    claimedWishIds: bundle.wishes.slice(0, 3).map((wish) => wish.id), stats: { spawns: 520, merges: 200, orders: 80 } };
  return data;
}

/** A fresh preview resets on reload; normal saved progress is never read or written. */
export function createDemoStorage(bundle: ConfigBundle, now: number): StorageAdapter {
  const values = new Map([[bundle.game.saveKey, JSON.stringify(createDemoSave(bundle, now))]]);
  return { getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); }, removeItem: (key) => { values.delete(key); } };
}
