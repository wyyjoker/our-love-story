/**
 * OrderPanel - top 3 order cards.
 * Button: deliver when ready, else "need more" (disabled).
 */
import type { ActiveOrder, OrderRequirement } from '../core/types';

export type OrderRow = OrderRequirement & { have: number; done: boolean };

export class OrderPanel {
  formatButton(ready: boolean): string {
    return ready ? 'Deliver' : 'Need more';
  }

  formatProgress(requirements: OrderRow[]): string {
    return requirements
      .map((r) => `${r.itemId} ${r.done ? 'OK' : `${r.have}/${r.count}`}`)
      .join(', ');
  }

  formatReward(order: ActiveOrder): string {
    return `coins ${order.rewardCoins} hearts ${order.rewardHearts}`;
  }
}
