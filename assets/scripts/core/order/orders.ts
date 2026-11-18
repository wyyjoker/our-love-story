import type {
  ActiveOrder,
  OrderRequirement,
  OrderDynamicConfig,
  OrderTemplate,
  PlayerState,
} from '../types';
import type { ItemCatalog } from '../item/catalog';
import type { RandomService } from '../../infrastructure/RandomService';

export type OrderGenerateInput = {
  player: Pick<PlayerState, 'level' | 'unlockedChainIds'>;
  templates: readonly OrderTemplate[];
  catalog: ItemCatalog;
  recentOrderIds: readonly string[];
  /** Orders occupying the other slots right now, including the one being replaced. */
  activeOrders?: readonly Pick<ActiveOrder, 'templateId' | 'requirements'>[];
  replacingRequirements?: readonly OrderRequirement[];
  dynamic?: OrderDynamicConfig;
  minItemLevel: number;
  maxItemLevel: number;
  random: RandomService;
  id: string;
  limitedChainIds?: readonly string[];
  minimumLevelForChain?: (chainId: string) => number;
  canProduceItem?: (itemId: string) => boolean;
  maxMergeCostForChain?: (chainId: string) => number;
  pace?: ActiveOrder['pace'];
};

/** Stable signature so equal needs with different template ids or split rows count as duplicates. */
export function requirementSignature(requirements: readonly OrderRequirement[]): string {
  const totals = new Map<string, number>();
  for (const req of requirements) totals.set(req.itemId, (totals.get(req.itemId) ?? 0) + req.count);
  return Array.from(totals.entries())
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([itemId, count]) => `${itemId}x${count}`)
    .join('|');
}

export function filterOrderTemplates(
  templates: readonly OrderTemplate[],
  playerLevel: number,
  catalog: ItemCatalog,
  unlockedChainIds: readonly string[],
  minItemLevel: number,
  maxItemLevel: number,
): OrderTemplate[] {
  const unlocked = new Set(unlockedChainIds);
  return templates.filter((template) => {
    if (playerLevel < template.minLevel || playerLevel > template.maxLevel) {
      return false;
    }
    for (const req of template.requirements) {
      const def = catalog.get(req.itemId);
      if (!def) return false;
      if (!unlocked.has(def.chainId)) return false;
      if (def.level < minItemLevel || def.level > maxItemLevel) {
        return false;
      }
    }
    return true;
  });
}

export function instantiateOrder(
  template: OrderTemplate,
  uid: string,
): ActiveOrder {
  const requirements: OrderRequirement[] = template.requirements.map((r) => ({
    itemId: r.itemId,
    count: r.count,
  }));
  return {
    uid,
    templateId: template.id,
    ...(template.longTerm === true ? { longTerm: true } : {}),
    requirements,
    rewardCoins: template.rewardCoins,
    rewardXp: template.rewardXp,
    rewardHearts: template.rewardHearts,
  };
}

export type OrderSelectionContext = {
  recentOrderIds?: readonly string[];
  recentSignatures?: readonly string[];
  activeOrderIds?: readonly string[];
  activeOrderSignatures?: readonly string[];
};

/**
 * Pick without duplicates in three graceful stages:
 * 1. avoid active orders and the last three orders (id + normalized needs);
 * 2. if every remaining candidate is recent, still avoid active orders;
 * 3. if candidates are exhausted, reuse one rather than leaving an empty slot.
 * No retry loop is used, so a narrowly filtered config can never hang.
 */
export function pickOrderTemplate(
  candidates: readonly OrderTemplate[],
  random: RandomService,
  context: OrderSelectionContext = {},
): OrderTemplate | null {
  if (candidates.length === 0) return null;

  const activeIds = new Set(context.activeOrderIds ?? []);
  const activeSignatures = new Set(context.activeOrderSignatures ?? []);
  const recentIds = new Set((context.recentOrderIds ?? []).slice(-3));
  const recentSignatures = new Set(context.recentSignatures ?? []);

  const notActive = candidates.filter((template) => !activeIds.has(template.id)
    && !activeSignatures.has(requirementSignature(template.requirements)));
  const preferred = notActive.filter((template) => !recentIds.has(template.id)
    && !recentSignatures.has(requirementSignature(template.requirements)));
  const pool = preferred.length > 0 ? preferred : notActive.length > 0 ? notActive : [...candidates];
  const index = random.pickIndex(pool.length);
  return pool[index] ?? pool[0] ?? null;
}

export const DEFAULT_DYNAMIC_ORDER_CONFIG: OrderDynamicConfig = {
  twoItemChance: 0.3, rareChance: 0.2, urgentChance: 0.1, urgentDurationMs: 30 * 60_000,
  rewardMultiplierMin: 1.2, rewardMultiplierMax: 1.8, rewardMultiplierMaxLevel: 18,
};

/** Generate the current economy from unlocked producer chains, without changing saved orders. */
export function generateOrder(input: OrderGenerateInput): ActiveOrder | null {
  const unlocked = new Set(input.player.unlockedChainIds);
  const limited = new Set(input.limitedChainIds ?? []);
  const hasLimited = (requirements: readonly OrderRequirement[]): boolean => requirements.some((r) => {
    const def = input.catalog.get(r.itemId); return !!def && limited.has(def.chainId);
  });
  const active = input.activeOrders ?? [];
  const occupiedLimited = active.some((order) => hasLimited(order.requirements));
  // Avoid asking a young player for items too high for their open board.
  const maxLevel = Math.min(input.maxItemLevel, 3 + Math.floor((Math.max(1, input.player.level) - 1) / 4));
  const items = Array.from(input.catalog.values()).filter((item) => {
    const floor = Math.max(input.minItemLevel, input.minimumLevelForChain?.(item.chainId) ?? 1);
    return (input.canProduceItem?.(item.id) ?? true) && unlocked.has(item.chainId) && item.level >= floor && item.level <= Math.max(maxLevel, floor);
  });
  const common = items.filter((item) => !limited.has(item.chainId));
  const rare = items.filter((item) => limited.has(item.chainId));
  if (!common.length) return null;
  const level = input.player.level;
  const dynamic = input.dynamic ?? DEFAULT_DYNAMIC_ORDER_CONFIG;
  const count = input.random.next() < dynamic.twoItemChance ? 2 : 1;
  const wantsRare = input.pace !== 'quick' && !occupiedLimited && rare.length > 0 && input.random.next() < dynamic.rareChance;
  const candidates: OrderRequirement[][] = [];
  if (count === 1) {
    for (const item of wantsRare ? rare : common) candidates.push([{ itemId: item.id, count: 1 }]);
  } else if (wantsRare) {
    for (const item of rare) {
      candidates.push([{ itemId: item.id, count: 2 }]);
      for (const other of common) candidates.push([{ itemId: item.id, count: 1 }, { itemId: other.id, count: 1 }]);
    }
  } else {
    for (let i = 0; i < common.length; i++) {
      candidates.push([{ itemId: common[i].id, count: 2 }]);
      for (let j = i + 1; j < common.length; j++) candidates.push([{ itemId: common[i].id, count: 1 }, { itemId: common[j].id, count: 1 }]);
    }
  }
  const affordable = candidates.filter((requirements) => {
    const costs = new Map<string, number>();
    for (const req of requirements) {
      const item = input.catalog.get(req.itemId)!;
      const floor = Math.max(1, input.minimumLevelForChain?.(item.chainId) ?? 1);
      costs.set(item.chainId, (costs.get(item.chainId) ?? 0) + 2 ** Math.max(0, item.level - floor) * req.count);
    }
    return Array.from(costs.entries()).every(([chain, cost]) => cost <= (input.maxMergeCostForChain?.(chain) ?? Infinity));
  });
  const activeSignatures = new Set(active.map((order) => requirementSignature(order.requirements)));
  const replacing = input.replacingRequirements && requirementSignature(input.replacingRequirements);
  const byId = new Map(input.templates.map((template) => [template.id, template]));
  const recentIds = new Set(input.recentOrderIds.slice(-3).map((id) => {
    const old = byId.get(id); return old ? `dynamic:${requirementSignature(old.requirements)}` : id;
  }));
  const notOccupied = affordable.filter((rows) => !activeSignatures.has(requirementSignature(rows)));
  const different = notOccupied.filter((rows) => requirementSignature(rows) !== replacing);
  const preferred = different.filter((rows) => !recentIds.has(`dynamic:${requirementSignature(rows)}`));
  // With only three early coffee choices, reuse the just-delivered kind before
  // duplicating another occupied slot. A narrow pool must still fill all slots.
  const pool = preferred.length ? preferred : different.length ? different : notOccupied.length ? notOccupied : affordable;
  const effort = (rows: readonly OrderRequirement[]): number => rows.reduce((sum, req) => {
    const item = input.catalog.get(req.itemId)!;
    return sum + 2 ** Math.max(0, item.level - (input.minimumLevelForChain?.(item.chainId) ?? 1)) * req.count;
  }, 0);
  // Split the reachable costs into three bands. If a band is occupied, prefer
  // another distinct need over duplicating a neighbouring customer.
  const costs = Array.from(new Set(affordable.map(effort))).sort((a, b) => a - b);
  const roleIndex = input.pace === 'quick' ? 0 : input.pace === 'regular' ? 1 : 2;
  const band = pool.filter(rows => Math.min(2, Math.floor(costs.indexOf(effort(rows)) * 3 / costs.length)) === roleIndex);
  const choices = input.pace && band.length ? band : pool;
  const requirements = choices[input.random.pickIndex(choices.length)];
  if (!requirements) return null;
  const cost = requirements.reduce((sum, req) => sum + 2 ** ((input.catalog.get(req.itemId)?.level ?? 1) - 1) * req.count, 0);
  const multiplier = dynamic.rewardMultiplierMin + (dynamic.rewardMultiplierMax - dynamic.rewardMultiplierMin)
    * (Math.min(dynamic.rewardMultiplierMaxLevel, Math.max(1, level)) - 1) / Math.max(1, dynamic.rewardMultiplierMaxLevel - 1);
  return { uid: input.id, templateId: `dynamic:${requirementSignature(requirements)}`, requirements,
    ...(input.pace ? { pace: input.pace } : {}),
    ...(level >= 15 && hasLimited(requirements) ? { longTerm: true } : {}),
    rewardCoins: Math.ceil(cost * multiplier), rewardXp: Math.max(6, cost * 2 + 6), rewardHearts: Math.max(1, Math.ceil(cost / 2)) };
}

export function generateTutorialOrder(
  templates: readonly OrderTemplate[],
  id: string,
): ActiveOrder | null {
  const template = templates.find((t) => t.tutorialOnly) ?? templates[0];
  if (!template) return null;
  return instantiateOrder(template, id);
}

export function isOrderComplete(
  boardCounts: ReadonlyMap<string, number>,
  order: ActiveOrder,
): boolean {
  return order.requirements.every(
    (req) => (boardCounts.get(req.itemId) ?? 0) >= req.count,
  );
}
