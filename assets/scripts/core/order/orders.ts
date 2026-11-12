import type {
  ActiveOrder,
  OrderRequirement,
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
  minItemLevel: number;
  maxItemLevel: number;
  random: RandomService;
  id: string;
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

export function generateOrder(input: OrderGenerateInput): ActiveOrder | null {
  const candidates = filterOrderTemplates(
    input.templates,
    input.player.level,
    input.catalog,
    input.player.unlockedChainIds,
    input.minItemLevel,
    input.maxItemLevel,
  );

  const nonTutorial = candidates.filter((t) => !t.tutorialOnly);
  const tutorial = candidates.filter((t) => t.tutorialOnly);

  // First fill can use tutorial; otherwise avoid repeating tutorial-only templates
  const preferTutorial =
    tutorial.length > 0 && input.recentOrderIds.length === 0;
  const pool = preferTutorial
    ? tutorial
    : nonTutorial.length > 0
      ? nonTutorial
      : candidates;

  const templateById = new Map(input.templates.map((template) => [template.id, template]));
  const recentSignatures = input.recentOrderIds
    .slice(-3)
    .map((id) => templateById.get(id))
    .filter((template): template is OrderTemplate => !!template)
    .map((template) => requirementSignature(template.requirements));
  const activeOrders = input.activeOrders ?? [];
  const template = pickOrderTemplate(pool, input.random, {
    recentOrderIds: input.recentOrderIds,
    recentSignatures,
    activeOrderIds: activeOrders.map((order) => order.templateId),
    activeOrderSignatures: activeOrders.map((order) => requirementSignature(order.requirements)),
  });
  if (!template) return null;
  return instantiateOrder(template, input.id);
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
