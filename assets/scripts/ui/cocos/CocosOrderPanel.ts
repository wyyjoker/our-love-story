/**
 * CocosOrderPanel — 3 order cards in a row.
 */
import { Node } from 'cc';
import type { OrderVm } from '../../presentation/GameViewMapper';
import { CocosOrderCard } from './CocosOrderCard';
import { createUiNode, ensureTransform } from './CocosTheme';

export class CocosOrderPanel {
  readonly node: Node;
  private cards: CocosOrderCard[] = [];

  constructor(parent: Node, width: number, height: number) {
    this.node = createUiNode('OrderPanelView');
    parent.addChild(this.node);
    ensureTransform(this.node, width, height);
    const gap = 8;
    const cardW = (width - 24 - gap * 2) / 3;
    const cardH = height - 12;
    for (let i = 0; i < 3; i += 1) {
      const card = new CocosOrderCard(this.node, cardW, cardH);
      card.node.setPosition(-width / 2 + 12 + cardW / 2 + i * (cardW + gap), 0, 0);
      this.cards.push(card);
    }
  }

  bind(onClaim: (orderUid: string) => void): void {
    for (const card of this.cards) card.bind(onClaim);
  }

  render(orders: OrderVm[]): void {
    for (let i = 0; i < this.cards.length; i += 1) {
      const vm = orders[i];
      if (vm) this.cards[i].render(vm);
    }
  }
}
