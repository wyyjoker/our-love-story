import type {
  ActiveOrder,
  OrderTemplate,
  PlayerState,
} from '../core/types';
import type { ItemCatalog } from '../core/item/catalog';
import type { RandomService } from '../infrastructure/RandomService';
import type { IdGenerator } from '../infrastructure/IdService';
import type { GameEventBus } from '../events/GameEventBus';
import type { BoardService } from './BoardService';
import type { ProgressionService } from './ProgressionService';
import {
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
  ) {}

  hydrate(orders: ActiveOrder[], recentOrderIds: string[]): void {
    this.orders = orders.map((o) => ({
      ...o,
      requirements: o.requirements.map((r) => ({ ...r })),
    }));
    this.recentOrderIds = [...recentOrderIds];
  }

  getOrders(): ActiveOrder[] {
    return this.orders.map((o) => ({
      ...o,
      requirements: o.requirements.map((r) => ({ ...r })),
    }));
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

  createNextOrder(forceTutorial = false): ActiveOrder | null {
    const order = forceTutorial
      ? generateTutorialOrder(this.templates, this.ids.next())
      : generateOrder({
          player: this.player,
          templates: this.templates,
          catalog: this.catalog,
          recentOrderIds: this.recentOrderIds,
          minItemLevel: this.minItemLevel,
          maxItemLevel: this.maxItemLevel,
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
    const replacement = this.createNextOrder(false);
    this.orders.splice(index, 1);
    if (replacement) {
      this.orders.push(replacement);
    }

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

  refreshProgressHints(): void {
    for (const order of this.orders) {
      this.bus.emit('ORDER_UPDATED', { orderUid: order.uid });
    }
  }
}
