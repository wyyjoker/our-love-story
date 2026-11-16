import { Node, Vec3 } from 'cc';
import type { OrderVm } from '../../presentation/GameViewMapper';
import { CocosOrderCard } from './CocosOrderCard';
import { createUiNode, ensureTransform } from './CocosTheme';

/** Three stable customer slots. New orders arrive only after delivery. */
export class CocosOrderPanel {
  readonly node: Node;
  private readonly cards: CocosOrderCard[] = [];
  private readonly deliveries = new Map<string, CocosOrderCard>();
  constructor(parent: Node, width: number, height: number) {
    this.node = createUiNode('OrderPanelView'); parent.addChild(this.node); ensureTransform(this.node, width, height);
    const gap = 8, cardW = (width - 24 - gap * 2) / 3;
    for (let i = 0; i < 3; i++) { const card = new CocosOrderCard(this.node, cardW, height - 12, i); card.node.setPosition(-width / 2 + 12 + cardW / 2 + i * (cardW + gap), 0, 0); this.cards.push(card); }
  }
  bind(onClaim: (uid: string) => void): void { this.cards.forEach(card => card.bind(onClaim)); }
  beginDelivery(uid: string): Vec3 | null {
    if (this.deliveries.has(uid)) return null;
    for (const card of this.cards) { const position = card.beginDelivery(uid); if (position) { this.deliveries.set(uid, card); return position; } }
    return null;
  }
  receiveDelivery(uid: string): void { this.deliveries.get(uid)?.receiveDelivery(); }
  finishDelivery(uid: string): void { this.deliveries.get(uid)?.finishDelivery(); this.deliveries.delete(uid); }
  cancelDeliveries(): void { this.deliveries.forEach(card => card.finishDelivery(false)); this.deliveries.clear(); }
  readyHintPosition(): Vec3 | null {
    const claim = this.cards.map(card => card.node.getChildByName('ClaimButton')).find(node => node?.activeInHierarchy);
    return claim?.worldPosition.clone() ?? null;
  }
  render(orders: OrderVm[], nowMs = 0): void { this.cards.forEach((card, index) => { if (orders[index]) card.render(orders[index], nowMs); }); }
}
