import type { ConfigBundle } from '../config/ConfigRepository';
import type { SaveData } from '../core/types';
import type { StorageAdapter } from './PlatformService';
import { createDefaultSaveData } from './SaveService';

/** Review-only fixture. No dependency on or access to device storage. */
export function createDemoSave(bundle: ConfigBundle, now: number): SaveData {
  const data = createDefaultSaveData(bundle.game, now);
  const level = bundle.progression.levels.find((entry) => entry.level === 12)!;
  data.player = { ...data.player, level: 12, xp: level.xpRequired + 320,
    coins: 12460, hearts: 520, energy: 86,
    unlockedChainIds: bundle.generators.map((generator) => generator.chainId) };
  const rows = [
    ['coffee_01','coffee_01','coffee_02','coffee_03','coffee_04','coffee_05','coffee_06','coffee_07',''],
    ['flower_01','flower_02','flower_03','flower_04','flower_05','flower_06','flower_07','flower_08',''],
    ['dessert_01','dessert_02','dessert_03','dessert_04','','dessert_05','dessert_06','dessert_07',''],
    ['gift_01','gift_02','gift_03','gift_04','gift_05','gift_06','gift_07','gift_08',''],
    ['gift_06','gift_07','','gift_05','','flower_03','flower_04','flower_05',''],
    ['coffee_04','coffee_05','coffee_06','coffee_07','','coffee_08','coffee_01','coffee_02',''],
    ['flower_04','flower_05','','flower_08','flower_06','flower_07','','flower_01',''],
    ['dessert_01','dessert_02','','dessert_03','dessert_04','dessert_05','dessert_06','dessert_08',''],
    ['gift_01','gift_02','','gift_03','gift_04','gift_05','gift_06','gift_08',''],
  ].flat();
  data.board = data.board.map((_, index) => rows[index]
    ? { index, item: { uid: `demo_${index}`, definitionId: rows[index] } } : { index });
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
