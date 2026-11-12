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
import adventuresJson from '../../resources/config/adventures.json';
import smallDatesJson from '../../resources/config/small_dates.json';
import { circuitState, requirementsBaseCost, type AdventureChapter, type SmallDateDefinition } from '../core/play/types';
import { collectUnlockChains } from '../core/progression/progression';

export type ConfigBundle = {
  adventures: readonly AdventureChapter[];
  smallDates: readonly SmallDateDefinition[];
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
  return {
    game, items, catalog, generators, orders, progression, memories, furniture, wishes, levelRewards,
    adventures: adventuresJson as AdventureChapter[],
    smallDates: smallDatesJson as SmallDateDefinition[],
  };
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
  if (memories.length === 0) {
    issues.push({ level: 'error', message: 'Memory content must not be empty' });
  }
  if (furniture.length !== 10 || wishes.length !== 10) {
    issues.push({ level: 'error', message: 'Life content must have 10 furniture items and wishes' });
  }
  if (furniture.reduce((n, f) => n + f.decorPoints, 0) !== 50) {
    issues.push({ level: 'error', message: 'Furniture decor points must total 50' });
  }
  for (const memory of memories) {
    if (memory.artMode !== undefined && !['cover', 'contain'].includes(memory.artMode)) {
      issues.push({ level: 'error', message: `Memory ${memory.id} art mode invalid` });
    }
    if (memory.artFocusY !== undefined && (!Number.isFinite(memory.artFocusY) || memory.artFocusY < 0 || memory.artFocusY > 1)) {
      issues.push({ level: 'error', message: `Memory ${memory.id} art focus invalid` });
    }
    if (memory.heartCost <= 0) issues.push({ level: 'error', message: `Memory ${memory.id} cost invalid` });
    if (typeof memory.art !== 'string' || !/^[a-z][a-z0-9_]*(?:#\d{1,2})?$/.test(memory.art)) {
      issues.push({ level: 'error', message: `Memory ${memory.id} art invalid` });
      continue;
    }
    const columns = memory.artColumns ?? 5;
    const rows = memory.artRows ?? 1;
    const frame = Number(memory.art.split('#')[1] ?? 0);
    if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 1 || rows < 1 || frame >= columns * rows) {
      issues.push({ level: 'error', message: `Memory ${memory.id} atlas bounds invalid` });
    }
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

  if (!Number.isInteger(game.toolbox?.warehouseSlots) || game.toolbox.warehouseSlots < 1 || game.toolbox.warehouseSlots > 6
    || !Number.isInteger(game.toolbox.startingScissors) || game.toolbox.startingScissors < 0) issues.push({ level: 'error', message: 'Toolbox config invalid' });
  const chapterIds = new Set<string>();
  const chapterMemoryIds = new Set<string>();
  const souvenirKeys = new Set<string>();
  for (const c of bundle.adventures) {
    const p = c.puzzle;
    const unlockedAtLevel = new Set(collectUnlockChains(progression, c.unlockLevel));
    const souvenirKey = `${c.souvenir.room}:${c.souvenir.x}:${c.souvenir.y}`;
    const baseOk = /^[a-z][a-z0-9_]*$/.test(c.id) && !chapterIds.has(c.id) && memories.some((m) => m.id === c.memoryId)
      && !chapterMemoryIds.has(c.memoryId)
      && typeof c.title === 'string' && c.title.trim().length > 0
      && typeof c.intro === 'string' && c.intro.trim().length > 0
      && typeof c.instruction === 'string' && c.instruction.trim().length > 0
      && c.steps.length === 2 && c.hints.length === 3
      && c.hints.every((hint) => typeof hint === 'string' && hint.trim().length > 0)
      && Number.isInteger(c.unlockLevel) && c.unlockLevel >= 1 && c.unlockLevel <= 18
      && Object.values(c.reward).every((n) => Number.isInteger(n) && n >= 0) && catalog.has(c.souvenir.artItemId)
      && ['living', 'bedroom', 'garden'].includes(c.souvenir.room)
      && typeof c.souvenir.title === 'string' && c.souvenir.title.trim().length > 0
      && Number.isFinite(c.souvenir.x) && Number.isFinite(c.souvenir.y) && !souvenirKeys.has(souvenirKey)
      && c.steps.every((s) => typeof s.title === 'string' && typeof s.note === 'string'
        && s.requirements.length > 0 && s.requirements.every((r) => {
          const def = catalog.get(r.itemId);
          return !!def && unlockedAtLevel.has(def.chainId) && Number.isInteger(r.count) && r.count > 0;
        }));
    chapterIds.add(c.id);
    chapterMemoryIds.add(c.memoryId);
    souvenirKeys.add(souvenirKey);
    let puzzleOk = false;
    if (p.kind === 'find') puzzleOk = /^\d{4}$/.test(p.solution) && p.hotspots.length >= 2
      && new Set(p.hotspots.map((h) => h.id)).size === p.hotspots.length
      && p.hotspots.every((h) => typeof h.label === 'string' && h.label.trim().length > 0
        && typeof h.clue === 'string' && h.clue.trim().length > 0 && Number.isFinite(h.x) && Number.isFinite(h.y));
    if (p.kind === 'sequence') puzzleOk = p.tiles.length >= 3 && p.tiles.length <= 6 && new Set(p.solution).size === p.tiles.length
      && p.solution.length === p.tiles.length && p.tiles.every((t) => p.solution.includes(t.id))
      && p.tiles.every((t) => typeof t.label === 'string' && t.label.trim().length > 0
        && typeof t.clue === 'string' && t.clue.trim().length > 0);
    if (p.kind === 'circuit') {
      puzzleOk = p.columns === 3 && p.rows === 3 && p.ports.length === 9 && p.initial.length === 9 && p.solution.length === 9
        && p.ports.every((ports) => ports.length === 2 && new Set(ports).size === 2 && ports.every((n) => Number.isInteger(n) && n >= 0 && n < 4))
        && [...p.initial, ...p.solution].every((n) => Number.isInteger(n) && n >= 0 && n < 4)
        && Number.isInteger(p.start) && p.start >= 0 && p.start < 9 && Number.isInteger(p.end) && p.end >= 0 && p.end < 9;
      if (puzzleOk) puzzleOk = circuitState(p, p.solution).solved && !circuitState(p, p.initial).solved;
    }
    if (!baseOk || !puzzleOk) issues.push({ level: 'error', message: `Adventure ${c.id} invalid` });
  }

  if (bundle.smallDates.length < 4) {
    issues.push({ level: 'error', message: 'Small dates must provide at least 4 themes' });
  }
  const smallDateIds = new Set<string>();
  const levelOneChains = new Set(collectUnlockChains(progression, 1));
  let levelOneDate = false;
  for (const date of bundle.smallDates) {
    const cost = requirementsBaseCost(date.requirements, (id) => catalog.get(id)?.level);
    const dateOk = /^[a-z][a-z0-9_]*$/.test(date.id) && !smallDateIds.has(date.id)
      && typeof date.title === 'string' && date.title.trim().length > 0
      && typeof date.description === 'string' && date.description.trim().length > 0
      && typeof date.memoryId === 'string' && date.memoryId.length > 0
      && Number.isInteger(date.minLevel) && date.minLevel >= 1 && date.minLevel <= 18
      && date.requirements.length > 0
      && date.requirements.every((r) => {
        const def = catalog.get(r.itemId);
        return !!def && def.level <= 3 && Number.isInteger(r.count) && r.count > 0;
      })
      && cost >= 2 && cost <= 8
      && [date.rewardCoins, date.rewardXp, date.rewardHearts].every((n) => Number.isInteger(n) && n >= 0);
    smallDateIds.add(date.id);
    if (!dateOk) issues.push({ level: 'error', message: `Small date ${date.id} invalid` });
    else if (!memories.some((m) => m.id === date.memoryId)) issues.push({ level: 'warn', message: `Small date ${date.id} illustration memory missing` });
    if (date.minLevel <= 1 && date.requirements.length > 0 && date.requirements.every((r) => {
      const def = catalog.get(r.itemId);
      return !!def && levelOneChains.has(def.chainId);
    })) levelOneDate = true;
  }
  if (!levelOneDate) issues.push({ level: 'error', message: 'Small dates need an entry playable at level 1' });
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
