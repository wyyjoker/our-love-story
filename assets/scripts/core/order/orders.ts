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
  minItemLevel: number;
  maxItemLevel: number;
  random: RandomService;
  id: string;
};

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

export function pickOrderTemplate(
  candidates: readonly OrderTemplate[],
  recentOrderIds: readonly string[],
  random: RandomService,
): OrderTemplate | null {
  if (candidates.length === 0) return null;

  const recentSet = new Set(recentOrderIds.slice(-3));
  const preferred = candidates.filter((t) => !recentSet.has(t.id));
  const pool = preferred.length > 0 ? preferred : [...candidates];
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

  const template = pickOrderTemplate(pool, input.recentOrderIds, input.random);
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
