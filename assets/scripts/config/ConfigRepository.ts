import type {
  GameConfig,
  GeneratorDefinition,
  ItemDefinition,
  OrderTemplate,
  ProgressionConfig,
  MemoryDefinition,
  FurnitureDefinition,
  WishDefinition,
  LevelRewardConfig,
} from '../core/types';
import { createItemCatalog, type ItemCatalog } from '../core/item/catalog';

import gameJson from '../../resources/config/game.json';
import itemsJson from '../../resources/config/items.json';
import generatorsJson from '../../resources/config/generators.json';
import ordersJson from '../../resources/config/orders.json';
import progressionJson from '../../resources/config/progression.json';
import memoriesJson from '../../resources/config/memories.json';
import furnitureJson from '../../resources/config/furniture.json';
import wishesJson from '../../resources/config/wishes.json';
import levelRewardsJson from '../../resources/config/level_rewards.json';

export type ConfigBundle = {
  game: GameConfig;
  items: readonly ItemDefinition[];
  catalog: ItemCatalog;
  generators: readonly GeneratorDefinition[];
  orders: readonly OrderTemplate[];
  progression: ProgressionConfig;
  memories: readonly MemoryDefinition[];
  furniture: readonly FurnitureDefinition[];
  wishes: readonly WishDefinition[];
  levelRewards: LevelRewardConfig;
};

export type ConfigValidationIssue = {
  level: 'error' | 'warn';
  message: string;
};

export function loadConfigBundle(): ConfigBundle {
  const game = gameJson as GameConfig;
  const items = itemsJson as ItemDefinition[];
  const generators = generatorsJson as GeneratorDefinition[];
  const orders = ordersJson as OrderTemplate[];
  const progression = progressionJson as ProgressionConfig;
  const catalog = createItemCatalog(items);
  const memories = memoriesJson as MemoryDefinition[];
  const furniture = furnitureJson as FurnitureDefinition[];
  const wishes = wishesJson as WishDefinition[];
  const levelRewards = levelRewardsJson as LevelRewardConfig;
  return { game, items, catalog, generators, orders, progression, memories, furniture, wishes, levelRewards };
}

export function validateConfig(bundle: ConfigBundle): ConfigValidationIssue[] {
  const issues: ConfigValidationIssue[] = [];
  const { game, items, catalog, generators, orders, progression, memories, furniture, wishes, levelRewards } = bundle;

  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) {
      issues.push({ level: 'error', message: `Duplicate item id: ${item.id}` });
    }
    seen.add(item.id);
    if (item.level < 1) {
      issues.push({ level: 'error', message: `Item ${item.id} level < 1` });
    }
  }

  // chains continuous levels 1..8
  const byChain = new Map<string, ItemDefinition[]>();
  for (const item of items) {
    const list = byChain.get(item.chainId) ?? [];
    list.push(item);
    byChain.set(item.chainId, list);
  }
  for (const [chainId, list] of byChain) {
    const levels = [...list].map((i) => i.level).sort((a, b) => a - b);
    for (let i = 0; i < levels.length; i += 1) {
      if (levels[i] !== i + 1) {
        issues.push({
          level: 'error',
          message: `Chain ${chainId} levels not continuous at index ${i}`,
        });
        break;
      }
    }
  }

  for (const item of items) {
    if (item.nextItemId !== undefined) {
      const next = catalog.get(item.nextItemId);
      if (!next) {
        issues.push({
          level: 'error',
          message: `Item ${item.id} nextItemId missing: ${item.nextItemId}`,
        });
      } else if (next.chainId !== item.chainId || next.level !== item.level + 1) {
        issues.push({
          level: 'error',
          message: `Item ${item.id} nextItemId chain/level mismatch`,
        });
      }
    }
  }

  for (const gen of generators) {
    if (!byChain.has(gen.chainId)) {
      issues.push({
        level: 'error',
        message: `Generator ${gen.id} unknown chainId ${gen.chainId}`,
      });
    }
    if (gen.outputs.length === 0) {
      issues.push({ level: 'error', message: `Generator ${gen.id} has no outputs` });
    }
    for (const out of gen.outputs) {
      if (!catalog.has(out.itemId)) {
        issues.push({
          level: 'error',
          message: `Generator ${gen.id} output missing item ${out.itemId}`,
        });
      }
      if (out.weight <= 0) {
        issues.push({
          level: 'warn',
          message: `Generator ${gen.id} output ${out.itemId} non-positive weight`,
        });
      }
    }
  }

  for (const order of orders) {
    if (order.requirements.length < game.orders.minRequirements ||
        order.requirements.length > game.orders.maxRequirements) {
      issues.push({
        level: 'error',
        message: `Order ${order.id} requirement count out of range`,
      });
    }
    for (const req of order.requirements) {
      const def = catalog.get(req.itemId);
      if (!def) {
        issues.push({
          level: 'error',
          message: `Order ${order.id} missing item ${req.itemId}`,
        });
      }
    }
  }

  let prev = -Infinity;
  for (const level of progression.levels) {
    if (level.xpRequired < prev) {
      issues.push({
        level: 'error',
        message: `Progression xpRequired not increasing at level ${level.level}`,
      });
    }
    prev = level.xpRequired;
    for (const chain of level.unlockChains) {
      if (!byChain.has(chain)) {
        issues.push({
          level: 'error',
          message: `Progression level ${level.level} unlocks unknown chain ${chain}`,
        });
      }
    }
  }

  if (game.board.rows * game.board.columns <= 0) {
    issues.push({ level: 'error', message: 'Board size invalid' });
  }
  if (game.energy.recoverIntervalMs <= 0) {
    issues.push({ level: 'error', message: 'Energy recoverIntervalMs invalid' });
  }

  for (const [name, values] of [
    ['memory', memories],
    ['furniture', furniture],
    ['wish', wishes],
  ] as const) {
    const ids = new Set<string>();
    for (const entry of values) {
      if (ids.has(entry.id)) issues.push({ level: 'error', message: `Duplicate ${name} id: ${entry.id}` });
      ids.add(entry.id);
    }
  }
  if (memories.length !== 10 || furniture.length !== 10 || wishes.length !== 10) {
    issues.push({ level: 'error', message: 'Life content must have 10 memories, furniture, and wishes' });
  }
  if (furniture.reduce((n, f) => n + f.decorPoints, 0) !== 50) {
    issues.push({ level: 'error', message: 'Furniture decor points must total 50' });
  }
  for (const memory of memories) {
    if (memory.heartCost <= 0) issues.push({ level: 'error', message: `Memory ${memory.id} cost invalid` });
  }
  for (const item of furniture) {
    if (item.coinCost < 0 || item.unlockLevel < 1 || item.decorPoints <= 0) {
      issues.push({ level: 'error', message: `Furniture ${item.id} invalid` });
    }
    if (!['living', 'bedroom', 'garden'].includes(item.room)
      || !item.placement
      || ![item.placement.x, item.placement.y, item.placement.width, item.placement.height].every(Number.isFinite)
      || item.placement.width <= 0 || item.placement.height <= 0) {
      issues.push({ level: 'error', message: `Furniture ${item.id} placement invalid` });
    }
  }
  for (const wish of wishes) {
    if (wish.target <= 0 || wish.rewardCoins < 0 || wish.rewardHearts < 0) {
      issues.push({ level: 'error', message: `Wish ${wish.id} invalid` });
    }
  }
  if (levelRewards.default.coinsPerLevel < 0 || levelRewards.default.heartsPerLevel < 0 || levelRewards.default.xp < 0) {
    issues.push({ level: 'error', message: 'Default level reward invalid' });
  }
  const specialLevels = new Set<number>();
  for (const reward of levelRewards.special) {
    if (specialLevels.has(reward.level) || reward.level < 2 || reward.coins < 0 || reward.hearts < 0 || reward.xp < 0) {
      issues.push({ level: 'error', message: `Level reward ${reward.level} invalid` });
    }
    specialLevels.add(reward.level);
  }

  return issues;
}

export function assertConfigValid(bundle: ConfigBundle): void {
  const issues = validateConfig(bundle);
  const errors = issues.filter((i) => i.level === 'error');
  for (const issue of issues) {
    if (issue.level === 'error') {
      console.error(`[BOOT] CONFIG ERROR: ${issue.message}`);
    } else {
      console.warn(`[BOOT] CONFIG WARN: ${issue.message}`);
    }
  }
  if (errors.length > 0) {
    throw new Error(`Config validation failed: ${errors.length} error(s)`);
  }
}
