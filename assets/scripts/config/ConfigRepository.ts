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
import { generatorItemDefinitions } from '../core/generator/generatorItems';

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
import { circuitState, requirementsBaseCost, type AdventureChapter, type PuzzleDefinition, type SmallDateDefinition } from '../core/play/types';
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

function nonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validPuzzleDefinition(value: unknown): value is PuzzleDefinition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const puzzle = value as Record<string, unknown>;
  if (puzzle.kind === 'find') {
    const hotspots = puzzle.hotspots;
    return typeof puzzle.solution === 'string' && puzzle.solution.length === 4 && Array.from(puzzle.solution).every((digit) => digit >= '0' && digit <= '9')
      && Array.isArray(hotspots) && hotspots.length === 3
      && new Set(hotspots.map((hotspot) => hotspot && typeof hotspot === 'object' ? (hotspot as Record<string, unknown>).id : undefined)).size === hotspots.length
      && hotspots.every((hotspot) => {
        if (!hotspot || typeof hotspot !== 'object' || Array.isArray(hotspot)) return false;
        const entry = hotspot as Record<string, unknown>;
        return typeof entry.id === 'string' && /^[a-z][a-z0-9_]*$/.test(entry.id)
          && nonEmptyText(entry.label) && nonEmptyText(entry.clue)
          && Number.isFinite(entry.x) && Number.isFinite(entry.y);
      });
  }
  if (puzzle.kind === 'sequence') {
    const tiles = puzzle.tiles, solution = puzzle.solution;
    return Array.isArray(tiles) && tiles.length === 4 && Array.isArray(solution) && solution.length === tiles.length
      && new Set(tiles.map((tile) => tile && typeof tile === 'object' ? (tile as Record<string, unknown>).id : undefined)).size === tiles.length
      && new Set(solution).size === solution.length
      && tiles.every((tile) => {
        if (!tile || typeof tile !== 'object' || Array.isArray(tile)) return false;
        const entry = tile as Record<string, unknown>;
        return typeof entry.id === 'string' && /^[a-z][a-z0-9_]*$/.test(entry.id)
          && nonEmptyText(entry.label) && nonEmptyText(entry.clue) && solution.includes(entry.id);
      })
      && solution.every((id) => tiles.some((tile) => (tile as Record<string, unknown>).id === id));
  }
  if (puzzle.kind === 'circuit') {
    const columns = puzzle.columns, rows = puzzle.rows, ports = puzzle.ports;
    const initial = puzzle.initial, solution = puzzle.solution;
    const start = puzzle.start, end = puzzle.end;
    if (columns !== 3 || rows !== 3 || !Array.isArray(ports) || ports.length !== 9
      || !Array.isArray(initial) || initial.length !== 9 || !Array.isArray(solution) || solution.length !== 9
      || ![...initial, ...solution].every((rotation) => Number.isInteger(rotation) && (rotation as number) >= 0 && (rotation as number) < 4)
      || !ports.every((cell) => Array.isArray(cell) && cell.length === 2
        && new Set(cell).size === 2 && cell.every((port) => Number.isInteger(port) && port >= 0 && port < 4))
      || !Number.isInteger(start) || (start as number) < 0 || (start as number) >= 9
      || !Number.isInteger(end) || (end as number) < 0 || (end as number) >= 9) return false;
    const circuit = value as Extract<PuzzleDefinition, { kind: 'circuit' }>;
    return circuitState(circuit, circuit.solution).solved && !circuitState(circuit, circuit.initial).solved;
  }
  return false;
}

export function loadConfigBundle(): ConfigBundle {
  const game = gameJson as GameConfig;
  const items = [...itemsJson as ItemDefinition[], ...generatorItemDefinitions(generatorsJson as GeneratorDefinition[])];
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
  const couple = (game as unknown as { couple?: unknown }).couple;
  if (couple && typeof couple === 'object' && !Array.isArray(couple)
    && Object.prototype.hasOwnProperty.call(couple, 'gift')) {
    const gift = (couple as Record<string, unknown>).gift;
    if (!gift || typeof gift !== 'object' || Array.isArray(gift)) {
      issues.push({ level: 'error', message: 'Couple gift must be a non-null object' });
    } else {
      for (const field of ['title', 'salutation', 'body', 'signoff', 'signature', 'coverMessage']) {
        if (Object.prototype.hasOwnProperty.call(gift, field) && typeof (gift as Record<string, unknown>)[field] !== 'string') {
          issues.push({ level: 'error', message: `Couple gift ${field} must be a string` });
        }
      }
    }
  }

  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) {
      issues.push({ level: 'error', message: `Duplicate item id: ${item.id}` });
    }
    seen.add(item.id);
    if (item.maxUses !== undefined && (item.chainId !== 'scissors' || !Number.isSafeInteger(item.maxUses) || item.maxUses <= 0)) issues.push({ level: 'error', message: `Item ${item.id} invalid tool uses` });
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
    if (!Number.isSafeInteger(gen.purchaseCoins) || gen.purchaseCoins <= 0) issues.push({ level: 'error', message: `Generator ${gen.id} purchase price invalid` });
    if (gen.recharge && (!Number.isInteger(gen.recharge.capacity) || gen.recharge.capacity < 1 || !Number.isFinite(gen.recharge.intervalMs) || gen.recharge.intervalMs <= 0 || gen.energyCost !== 0)) issues.push({ level: 'error', message: `Generator ${gen.id} recharge invalid` });
    if (gen.recharge?.legacyCapacity !== undefined && (!Number.isSafeInteger(gen.recharge.legacyCapacity) || gen.recharge.legacyCapacity < 1 || gen.recharge.legacyCapacity > gen.recharge.capacity)) issues.push({ level: 'error', message: `Generator ${gen.id} legacy recharge capacity invalid` });
    if (gen.streakCooldown && (gen.recharge || !Number.isSafeInteger(gen.streakCooldown.uses) || gen.streakCooldown.uses < 1 || !Number.isSafeInteger(gen.streakCooldown.durationMs) || gen.streakCooldown.durationMs <= 0)) issues.push({ level: 'error', message: `Generator ${gen.id} cooldown invalid` });
    if (gen.upgrade) {
      const upgrade = gen.upgrade;
      const validOutputs = (outputs: GeneratorDefinition['outputs'], minLevel: number): boolean => Array.isArray(outputs) && outputs.length > 0
        && outputs.every((output) => {
          const item = catalog.get(output.itemId);
          return item?.chainId === gen.chainId && item.level >= minLevel && item.level <= Math.min(12, minLevel + 2) && Number.isFinite(output.weight) && output.weight > 0;
        });
      if (!Number.isSafeInteger(upgrade.maxLevel) || upgrade.maxLevel < 2 || upgrade.maxLevel > 8 || !Number.isFinite(upgrade.rechargeFactor) || upgrade.rechargeFactor <= 0 || upgrade.rechargeFactor > 1
        || (upgrade.mergeRemainingRatio!==undefined&&(!Number.isFinite(upgrade.mergeRemainingRatio)||upgrade.mergeRemainingRatio<=0||upgrade.mergeRemainingRatio>.5))
        || !Number.isSafeInteger(upgrade.boostEnergyMultiplier) || upgrade.boostEnergyMultiplier < 2 || !Array.isArray(upgrade.levels)
        || upgrade.levels.length !== upgrade.maxLevel - 1 || upgrade.levels.some((entry, index) => entry.level !== index + 2 || !validOutputs(entry.outputs, entry.level)
          || (gen.energyCost > 0 && (!entry.boostOutputs || !validOutputs(entry.boostOutputs, entry.level)))
          || (entry.boostOutputs !== undefined && !validOutputs(entry.boostOutputs, entry.level)))) {
        issues.push({ level: 'error', message: `Generator ${gen.id} upgrade invalid` });
      }
    }
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
      const outputDefinition = catalog.get(out.itemId);
      if (outputDefinition && (outputDefinition.chainId !== gen.chainId || (gen.upgrade && outputDefinition.level > 3))) {
        issues.push({ level: 'error', message: `Generator ${gen.id} base output invalid: ${out.itemId}` });
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
        order.requirements.length > game.orders.maxRequirements ||
        order.requirements.some((requirement) => !Number.isSafeInteger(requirement.count) || requirement.count < 1) ||
        order.requirements.reduce((sum, requirement) => sum + requirement.count, 0) > 2) {
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
  if (!game.collection || !Array.isArray(game.collection.chainIds) || !game.collection.chainIds.length
    || new Set(game.collection.chainIds).size !== game.collection.chainIds.length
    || game.collection.chainIds.some((id) => !byChain.has(id))
    || !Number.isSafeInteger(game.collection.energyPerChain) || game.collection.energyPerChain <= 0
    || !Number.isSafeInteger(game.collection.maxEnergyCap) || game.collection.maxEnergyCap < 1) issues.push({ level: 'error', message: 'Collection configuration invalid' });
  if (!Array.isArray(game.generationBonusDrops) || game.generationBonusDrops.some((drop) => (drop.generatorId !== '*' && !generators.some((gen) => gen.id === drop.generatorId))
    || !catalog.has(drop.itemId) || !Number.isFinite(drop.chance) || drop.chance < 0 || drop.chance > 1 || !Number.isSafeInteger(drop.minLevel) || drop.minLevel < 1)) issues.push({ level: 'error', message: 'Generation bonus drops invalid' });
  if (items.filter((item) => item.wildcard).length !== 1 || items.some((item) => item.wildcard && (item.nextItemId || item.wildcardEligible))) issues.push({ level: 'error', message: 'Wildcard item invalid' });
  if (!game.board.unlocks?.length || game.board.unlocks.some((u, i, all) => !Number.isInteger(u.level) || !Number.isInteger(u.rows) || !Number.isInteger(u.columns) || u.level < 1 || u.rows < 1 || u.columns < 1 || u.rows > game.board.rows || u.columns > game.board.columns || (i > 0 && (u.level <= all[i - 1].level || u.rows < all[i - 1].rows || u.columns < all[i - 1].columns)))) issues.push({ level: 'error', message: 'Board unlocks invalid' });
  const rewards = game.rewards;
  if (!rewards || !Number.isFinite(rewards.chestDropChance) || rewards.chestDropChance < 0 || rewards.chestDropChance > 1 || !Number.isInteger(rewards.discoveryCoins) || rewards.discoveryCoins < 0 || !Array.isArray(rewards.chestLoot) || !rewards.chestLoot.length || rewards.chestLoot.some((entry) => !catalog.has(entry.itemId) || !Number.isFinite(entry.weight) || entry.weight <= 0) || !Array.isArray(rewards.exchangeOffers) || !rewards.exchangeOffers.length || rewards.exchangeOffers.some((entry) => !entry.id || !Number.isInteger(entry.diamonds) || entry.diamonds <= 0 || !Number.isInteger(entry.energy) || entry.energy <= 0) || !Array.isArray(rewards.checkIn) || rewards.checkIn.length !== 7 || rewards.checkIn.some((entry) => [entry.coins, entry.energy, entry.diamonds].some((n) => !Number.isInteger(n) || n < 0))) issues.push({ level: 'error', message: 'Rewards configuration invalid' });
  const chestItems = items.filter((item) => item.chainId === 'treasure_chest').sort((a, b) => a.level - b.level);
  for (const chainId of ['coin', 'energy', 'diamond']) {
    const supply = items.filter((item) => item.chainId === chainId).sort((a, b) => a.level - b.level);
    if (supply.length !== 5 || supply.some((item, index) => item.level !== index + 1
      || item.id !== `${chainId}_0${index + 1}` || item.nextItemId !== supply[index + 1]?.id
      || (index === 4 ? item.maxLevel !== true : item.maxLevel === true)
      || !Number.isSafeInteger(item.useValue) || (item.useValue ?? 0) <= 0
      || (index > 0 && (item.useValue ?? 0) <= 2 * (supply[index - 1].useValue ?? 0)))) {
      issues.push({ level: 'error', message: `Supply chain ${chainId} invalid` });
    }
  }
  if (chestItems.length !== 5 || chestItems.some((item, index) => item.level !== index + 1
    || item.id !== (index === 0 ? 'treasure_chest' : `treasure_chest_0${index + 1}`)
    || item.maxLevel !== (index === 4) || item.nextItemId !== chestItems[index + 1]?.id || item.wildcardEligible === true)) {
    issues.push({ level: 'error', message: 'Treasure chest chain invalid' });
  }
  const validChestLoot = (loot: unknown): boolean => Array.isArray(loot) && loot.length > 0
    && loot.every((entry) => entry && typeof entry === 'object' && typeof entry.itemId === 'string'
      && ['coin', 'energy', 'diamond'].includes(catalog.get(entry.itemId)?.chainId ?? '')
      && Number.isFinite(entry.weight) && entry.weight > 0);
  if (!rewards || !validChestLoot(rewards.chestLoot) || !Array.isArray(rewards.chestLevels) || rewards.chestLevels.length !== 5
    || rewards.chestLevels.some((entry, index) => !entry || entry.level !== index + 1 || !Number.isSafeInteger(entry.count)
      || entry.count < 1 || entry.count > 32 || (index > 0 && entry.loot === undefined) || !validChestLoot(entry.loot ?? rewards.chestLoot))) {
    issues.push({ level: 'error', message: 'Treasure chest rewards invalid' });
  }
  if (!Number.isSafeInteger(game.orders.refreshCooldownMs) || game.orders.refreshCooldownMs <= 0 || !Number.isSafeInteger(game.orders.refreshDiamondCost) || game.orders.refreshDiamondCost <= 0) issues.push({ level: 'error', message: 'Order refresh configuration invalid' });
  if (!game.generatorRestore || !Number.isSafeInteger(game.generatorRestore.cooldownCost) || game.generatorRestore.cooldownCost < 1
    || !Number.isSafeInteger(game.generatorRestore.chargeCost) || game.generatorRestore.chargeCost < 1) issues.push({ level: 'error', message: 'Generator restore configuration invalid' });
  const daily = game.rewards?.dailyTasks;
  if (!Array.isArray(daily) || daily.length !== 3 || new Set(daily.map((task) => task.id)).size !== daily.length || daily.some((task) => !/^[a-z][a-z0-9_]*$/.test(task.id) || !['orders', 'merges', 'specific'].includes(task.kind) || !task.title || !Number.isSafeInteger(task.target) || task.target <= 0 || !task.reward || [task.reward.coins, task.reward.xp, task.reward.energy, task.reward.diamonds].some((n) => !Number.isSafeInteger(n) || n < 0)) || new Set(daily.map((task) => task.kind)).size !== 3) issues.push({ level: 'error', message: 'Daily tasks configuration invalid' });
  if (game.energy.recoverIntervalMs <= 0) {
    issues.push({ level: 'error', message: 'Energy recoverIntervalMs invalid' });
  }
  if (game.energy.maxByLevel && (game.energy.maxByLevel.length !== progression.levels.length || game.energy.maxByLevel.some((n, i, a) => !Number.isSafeInteger(n) || n < 1 || n > 1000 || (i > 0 && n < a[i - 1])))) issues.push({ level: 'error', message: 'Energy capacity curve invalid' });
  const dynamicOrders = game.orders.dynamic;
  if (dynamicOrders?.pacedSlots !== undefined && typeof dynamicOrders.pacedSlots !== 'boolean') issues.push({ level: 'error', message: 'Order pacing flag must be boolean' });
  if (dynamicOrders && ([dynamicOrders.twoItemChance, dynamicOrders.rareChance, dynamicOrders.urgentChance].some((n) => !Number.isFinite(n) || n < 0 || n > 1)
    || !Number.isSafeInteger(dynamicOrders.urgentDurationMs) || dynamicOrders.urgentDurationMs <= 0
    || !Number.isSafeInteger(dynamicOrders.rewardMultiplierMaxLevel) || dynamicOrders.rewardMultiplierMaxLevel < 1
    || !Number.isFinite(dynamicOrders.rewardMultiplierMin) || !Number.isFinite(dynamicOrders.rewardMultiplierMax)
    || dynamicOrders.rewardMultiplierMin <= 0 || dynamicOrders.rewardMultiplierMax < dynamicOrders.rewardMultiplierMin)) issues.push({ level: 'error', message: 'Dynamic order configuration invalid' });

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
  if (furniture.length < 10 || wishes.length !== 10) {
    issues.push({ level: 'error', message: 'Life content must have at least 10 furniture items and 10 wishes' });
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
    if (!['living', 'bedroom', 'garden', 'study', 'terrace', 'pool'].includes(item.room)
      || !item.placement
      || ![item.placement.x, item.placement.y, item.placement.width, item.placement.height].every(Number.isFinite)
      || item.placement.width <= 0 || item.placement.height <= 0) {
      issues.push({ level: 'error', message: `Furniture ${item.id} placement invalid` });
    }
  }
  const validGeneratorGift=(gift:import('../core/types').GeneratorGift|undefined):boolean=>gift===undefined||!!gift
    &&generators.some(g=>g.id===gift.generatorId&&Number.isSafeInteger(gift.level)&&gift.level>=1&&gift.level<=(g.upgrade?.maxLevel??1))
    &&Number.isSafeInteger(gift.count)&&gift.count>=1&&gift.count<=8;
  for (const wish of wishes) {
    if (wish.target <= 0 || wish.rewardCoins < 0 || wish.rewardHearts < 0 || !validGeneratorGift(wish.generatorReward)) {
      issues.push({ level: 'error', message: `Wish ${wish.id} invalid` });
    }
  }
  if (levelRewards.default.coinsPerLevel < 0 || levelRewards.default.heartsPerLevel < 0 || levelRewards.default.xp < 0) {
    issues.push({ level: 'error', message: 'Default level reward invalid' });
  }
  if (levelRewards.generatorRotation && (new Set(levelRewards.generatorRotation).size !== levelRewards.generatorRotation.length
    || levelRewards.generatorRotation.some((id) => !generators.some((generator) => generator.id === id)))) {
    issues.push({ level: 'error', message: 'Level generator reward rotation invalid' });
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
  const backpack = game.toolbox?.backpackExpansion;
  if (!backpack || !Number.isSafeInteger(backpack.maxSlots) || backpack.maxSlots !== 36
    || backpack.maxSlots < game.toolbox.warehouseSlots || !Number.isSafeInteger(backpack.baseDiamondCost) || backpack.baseDiamondCost < 1
    || !Number.isSafeInteger(backpack.stepDiamondCost) || backpack.stepDiamondCost < 1) {
    issues.push({ level: 'error', message: 'Backpack expansion config invalid' });
  }
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
      && [c.reward.coins,c.reward.hearts,c.reward.energy,c.reward.scissors].every((n) => Number.isInteger(n) && n >= 0)
      && validGeneratorGift(c.reward.generator) && catalog.has(c.souvenir.artItemId)
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
    let variantsOk = c.replayVariants === undefined || Array.isArray(c.replayVariants);
    const variantIds = new Set<string>(['classic']);
    if (Array.isArray(c.replayVariants)) {
      for (const candidate of c.replayVariants) {
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) { variantsOk = false; continue; }
        const variant = candidate as unknown as Record<string, unknown>;
        const id = variant.id;
        const variantPuzzle = variant.puzzle;
        const variantPuzzleValid = validPuzzleDefinition(variantPuzzle);
        const sameKind = !puzzleOk || (variantPuzzleValid && variantPuzzle.kind === p.kind);
        const hints = variant.hints;
        const valid = typeof id === 'string' && /^[a-z][a-z0-9_]*$/.test(id) && !variantIds.has(id)
          && nonEmptyText(variant.instruction) && Array.isArray(hints) && hints.length === 3
          && hints.every(nonEmptyText) && variantPuzzleValid && sameKind;
        if (typeof id === 'string') variantIds.add(id);
        if (!valid) variantsOk = false;
      }
    }
    if (!baseOk || !puzzleOk || !variantsOk) issues.push({ level: 'error', message: `Adventure ${c.id} invalid` });
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
      && date.requirements.reduce((sum, requirement) => sum + requirement.count, 0) <= 2
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
