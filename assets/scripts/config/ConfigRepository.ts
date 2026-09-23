import type {
  GameConfig,
  GeneratorDefinition,
  ItemDefinition,
  OrderTemplate,
  ProgressionConfig,
} from '../core/types';
import { createItemCatalog, type ItemCatalog } from '../core/item/catalog';

import gameJson from '../../resources/config/game.json';
import itemsJson from '../../resources/config/items.json';
import generatorsJson from '../../resources/config/generators.json';
import ordersJson from '../../resources/config/orders.json';
import progressionJson from '../../resources/config/progression.json';

export type ConfigBundle = {
  game: GameConfig;
  items: readonly ItemDefinition[];
  catalog: ItemCatalog;
  generators: readonly GeneratorDefinition[];
  orders: readonly OrderTemplate[];
  progression: ProgressionConfig;
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
  return { game, items, catalog, generators, orders, progression };
}

export function validateConfig(bundle: ConfigBundle): ConfigValidationIssue[] {
  const issues: ConfigValidationIssue[] = [];
  const { game, items, catalog, generators, orders, progression } = bundle;

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
