import type {
  ActiveOrder,
  OrderTemplate,
  OrderDynamicConfig,
  PlayerState,
} from '../core/types';
import type { ItemCatalog } from '../core/item/catalog';
import type { RandomService } from '../infrastructure/RandomService';
import type { IdGenerator } from '../infrastructure/IdService';
import type { GameEventBus } from '../events/GameEventBus';
import type { BoardService } from './BoardService';
import type { ProgressionService } from './ProgressionService';
import type { ClockService } from '../infrastructure/ClockService';
import { SystemClockService } from '../infrastructure/ClockService';
import {
  DEFAULT_DYNAMIC_ORDER_CONFIG,
  generateOrder,
  generateTutorialOrder,
} from '../core/order/orders';

export type ClaimResult =
  | {
      ok: true;
      orderUid: string;
      rewardCoins: number;
      rewardXp: number;
      rewardHearts: number;
    }
  | { ok: false; reason: 'NOT_READY' | 'ORDER_NOT_FOUND' | 'INVENTORY_RACE' };

export class OrderService {
  private orders: ActiveOrder[] = [];
  private recentOrderIds: string[] = [];

  constructor(
    private readonly templates: readonly OrderTemplate[],
    private readonly catalog: ItemCatalog,
    private readonly board: BoardService,
    private readonly player: PlayerState,
    private readonly progression: ProgressionService,
    private readonly random: RandomService,
    private readonly ids: IdGenerator,
    private readonly bus: GameEventBus,
    private readonly slots: number,
    private readonly minItemLevel: number,
    private readonly maxItemLevel: number,
    private readonly limitedChainIds: readonly string[] = [],
    private readonly clock: ClockService = new SystemClockService(),
    private readonly dynamic: OrderDynamicConfig = DEFAULT_DYNAMIC_ORDER_CONFIG,
    private readonly projectItem: (id: string) => string = (id) => id,
    private readonly minimumLevelForChain: (chainId: string) => number = () => 1,
    private readonly canProduceItem: (itemId: string) => boolean = () => true,
    private readonly maxMergeCostForChain: (chainId: string) => number = () => Infinity,
  ) {}

  hydrate(orders: ActiveOrder[], recentOrderIds: string[]): void {
    this.orders = orders.map((o) => ({
      ...o,
      ...(o.longTerm === true || this.templates.find((t) => t.id === o.templateId)?.longTerm === true ? { longTerm: true } : {}),
      requirements: o.requirements.map((r) => ({ ...r })),
    }));
    this.recentOrderIds = [...recentOrderIds];
    // Existing orders retain their UID and promised rewards while oversized
    // requirements are reduced; owned items and already-earned assets stay untouched.
    const limit = 2;
    for (const order of this.orders) {
      const valid = order.requirements.filter((r) => r && typeof r.itemId === 'string' && this.catalog.has(r.itemId)
        && Number.isSafeInteger(r.count) && r.count > 0);
      let remaining = limit;
      order.requirements = valid.flatMap((requirement) => {
        const count = Math.min(remaining, requirement.count); remaining -= count;
        return count > 0 ? [{ itemId: requirement.itemId, count }] : [];
      });
    }
    // A malformed empty requirement is not a free order; replace its slot.
    for (let index = 0; index < this.orders.length; index++) {
      if (this.orders[index].requirements.length) continue;
      const replacement = this.createNextOrder(false, this.orders[index].uid);
      if (replacement) this.orders[index] = replacement;
    }
    this.orders = this.orders.filter((order) => order.requirements.length > 0);
    this.reconcileRequirements();
  }

  reconcileRequirements(): void {
    for (const order of this.orders) {
      if (this.board.findItemsForRequirements(order.requirements)) continue;
      if (order.requirements.some((req) => !this.canProduceItem(req.itemId) || !this.player.unlockedChainIds.includes(this.catalog.get(req.itemId)?.chainId ?? ''))) {
        const replacement = this.createNextOrder(false, order.uid);
        if (replacement) {
          order.requirements = replacement.requirements; order.templateId = replacement.templateId;
          delete order.longTerm; this.bus.emit('ORDER_UPDATED', { orderUid: order.uid });
        }
      }
      let changed = false;
      const counts = new Map<string, number>();
      for (const requirement of order.requirements) {
        const itemId = this.projectItem(requirement.itemId);
        if (itemId !== requirement.itemId) changed = true;
        counts.set(itemId, (counts.get(itemId) ?? 0) + requirement.count);
      }
      if (changed) order.requirements = Array.from(counts.entries()).map(([itemId, count]) => ({ itemId, count }));
      if (changed) this.bus.emit('ORDER_UPDATED', { orderUid: order.uid });
    }
  }

  getOrders(): ActiveOrder[] {
    return this.orders.map((o) => {
      const copy = { ...o, requirements: o.requirements.map((r) => ({ ...r })) };
      if (copy.urgentUntil !== undefined && this.clock.now() >= copy.urgentUntil) {
        if (copy.urgentBaseCoins !== undefined) copy.rewardCoins = copy.urgentBaseCoins;
        if (copy.urgentBaseXp !== undefined) copy.rewardXp = copy.urgentBaseXp;
        if (copy.urgentBaseHearts !== undefined) copy.rewardHearts = copy.urgentBaseHearts;
        delete copy.urgentUntil; delete copy.urgentBaseCoins; delete copy.urgentBaseXp; delete copy.urgentBaseHearts;
      }
      return copy;
    });
  }

  getRecentIds(): string[] {
    return [...this.recentOrderIds];
  }

  ensureFilled(): void {
    while (this.orders.length < this.slots) {
      const created = this.createNextOrder();
      if (!created) break;
      this.orders.push(created);
      this.bus.emit('ORDER_UPDATED', { orderUid: created.uid });
    }
  }

  createNextOrder(forceTutorial = false, replacingUid?: string): ActiveOrder | null {
    const slot = replacingUid ? this.getSlot(replacingUid) : this.orders.length;
    const pace = this.dynamic.pacedSlots ? (['quick', 'regular', 'goal'] as const)[Math.max(0, slot) % 3] : undefined;
    const order = forceTutorial
      ? generateTutorialOrder(this.templates, this.ids.next())
      : generateOrder({
          player: this.player,
          templates: this.templates,
          catalog: this.catalog,
          recentOrderIds: this.recentOrderIds,
          activeOrders: this.orders.filter((order) => order.uid !== replacingUid),
          dynamic: this.dynamic,
          replacingRequirements: this.orders.find((order) => order.uid === replacingUid)?.requirements,
          minItemLevel: this.minItemLevel,
          maxItemLevel: this.maxItemLevel,
          minimumLevelForChain: this.minimumLevelForChain,
          canProduceItem: this.canProduceItem,
          maxMergeCostForChain: this.maxMergeCostForChain,
          pace,
          limitedChainIds: this.limitedChainIds,
          random: this.random,
          id: this.ids.next(),
        });
    if (order) {
      this.recentOrderIds.push(order.templateId);
      if (this.recentOrderIds.length > 12) {
        this.recentOrderIds = this.recentOrderIds.slice(-12);
      }
    }
    return order;
  }

  getSlot(orderUid: string): number { return this.orders.findIndex((order) => order.uid === orderUid); }

  refresh(orderUid: string): { ok: true; orderUid: string } | { ok: false; reason: 'ORDER_NOT_FOUND' | 'NO_REPLACEMENT' } {
    const index = this.getSlot(orderUid); if (index < 0) return { ok: false, reason: 'ORDER_NOT_FOUND' };
    const replacement = this.createNextOrder(false, orderUid); if (!replacement) return { ok: false, reason: 'NO_REPLACEMENT' };
    this.orders[index] = replacement; this.bus.emit('ORDER_UPDATED', { orderUid: replacement.uid });
    return { ok: true, orderUid: replacement.uid };
  }

  canClaim(orderUid: string): boolean {
    const order = this.orders.find((o) => o.uid === orderUid);
    if (!order) return false;
    return this.board.getOrderProgress(order).ready;
  }

  /**
   * Transactional claim: re-validate inventory, collect locations first,
   * then consume + grant rewards. Never half-complete.
   */
  claim(orderUid: string): ClaimResult {
    const index = this.orders.findIndex((o) => o.uid === orderUid);
    if (index < 0) {
      return { ok: false, reason: 'ORDER_NOT_FOUND' };
    }
    this.expireUrgentOrders();
    const order = this.orders[index];

    const locations = this.board.findItemsForRequirements(order.requirements);
    if (!locations) {
      this.bus.emit('ORDER_UPDATED', { orderUid });
      return { ok: false, reason: 'INVENTORY_RACE' };
    }

    // Collect all mutations first (transaction mindset)
    const rewardCoins = order.rewardCoins;
    const rewardXp = order.rewardXp;
    const rewardHearts = order.rewardHearts;

    // Commit board removal
    this.board.consumeItems(locations);

    // Commit rewards
    this.progression.addCoins(rewardCoins);
    this.progression.addHearts(rewardHearts);
    this.progression.addXp(rewardXp);

    // Replace order
    const replacement = this.createNextOrder(false, orderUid);
    if (replacement && this.random.next() < this.dynamic.urgentChance) {
      replacement.urgentBaseCoins = replacement.rewardCoins;
      replacement.urgentBaseXp = replacement.rewardXp;
      replacement.urgentBaseHearts = replacement.rewardHearts;
      replacement.rewardCoins *= 2; replacement.rewardXp *= 2; replacement.rewardHearts *= 2;
      replacement.urgentUntil = this.clock.now() + this.dynamic.urgentDurationMs;
    }
    if (replacement) this.orders[index] = replacement;
    else this.orders.splice(index, 1);

    this.bus.emit('ORDER_COMPLETED', {
      orderUid,
      rewardCoins,
      rewardXp,
      rewardHearts,
    });
    this.bus.emit('ORDER_UPDATED', {
      orderUid: replacement?.uid ?? orderUid,
    });

    return {
      ok: true,
      orderUid,
      rewardCoins,
      rewardXp,
      rewardHearts,
    };
  }

  /** Returns whether an expired order changed, so the caller can persist and refresh UI. */
  expireUrgentOrders(): boolean {
    let changed = false;
    for (const order of this.orders) {
      if (order.urgentUntil !== undefined && this.clock.now() >= order.urgentUntil) {
        if (order.urgentBaseCoins !== undefined) order.rewardCoins = order.urgentBaseCoins;
        if (order.urgentBaseXp !== undefined) order.rewardXp = order.urgentBaseXp;
        if (order.urgentBaseHearts !== undefined) order.rewardHearts = order.urgentBaseHearts;
        delete order.urgentUntil; delete order.urgentBaseCoins; delete order.urgentBaseXp; delete order.urgentBaseHearts; changed = true;
      }
    }
    return changed;
  }

  refreshProgressHints(): void {
    for (const order of this.orders) {
      this.bus.emit('ORDER_UPDATED', { orderUid: order.uid });
    }
  }
}
