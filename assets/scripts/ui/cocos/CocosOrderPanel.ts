import { Graphics, Label, Mask, Node, ScrollView, UITransform, Vec3 } from 'cc';
import type { OrderVm } from '../../presentation/GameViewMapper';
import { CocosOrderCard } from './CocosOrderCard';
import { createUiNode, ensureTransform, hexColor, makeLabel, paintRoundRect } from './CocosTheme';

/** A horizontal queue with three customer cards visible at a time. */
export class CocosOrderPanel {
  readonly node: Node;
  private readonly cards: CocosOrderCard[] = [];
  private readonly deliveries = new Map<string, CocosOrderCard>();
  private readonly scroll: ScrollView;
  private readonly content: Node;
  private readonly contentTransform: UITransform;
  private readonly range: Label;
  private readonly cardWidth: number;
  private readonly stride: number;
  private activeCount = 0;

  constructor(parent: Node, private readonly width: number, height: number, slots: number) {
    this.node = createUiNode('OrderPanelView'); parent.addChild(this.node); ensureTransform(this.node, width, height);
    const counter = createUiNode('CustomerCounter'); this.node.addChild(counter);
    ensureTransform(counter, width, 24); counter.setPosition(0, -height / 2 + 12, 0);
    paintRoundRect(counter.addComponent(Graphics), width, 24, 11, hexColor('#F3DFC6'), hexColor('#D5B38A'), 1);
    this.range = makeLabel('', 18, hexColor('#80583E'), true);
    this.range.node.name = 'CustomerQueueRange'; counter.addChild(this.range.node);
    ensureTransform(this.range.node, width - 24, 24);
    this.range.overflow = Label.Overflow.SHRINK;

    const viewport = createUiNode('CustomerQueueViewport'); this.node.addChild(viewport);
    const cardHeight = height - 24;
    ensureTransform(viewport, width, cardHeight); viewport.setPosition(0, 12, 0);
    viewport.addComponent(Mask);
    this.content = createUiNode('CustomerQueueContent'); viewport.addChild(this.content);
    this.contentTransform = ensureTransform(this.content, width, cardHeight, 0, 0.5);
    this.content.setPosition(-width / 2, 0, 0);
    this.scroll = viewport.addComponent(ScrollView);
    this.scroll.horizontal = true; this.scroll.vertical = false; this.scroll.elastic = false;
    this.scroll.cancelInnerEvents = true; this.scroll.content = this.content;

    const gap = 8;
    this.cardWidth = (width - 4 * gap) / 3;
    this.stride = this.cardWidth + gap;
    for (let index = 0; index < slots; index++) {
      const card = new CocosOrderCard(this.content, this.cardWidth, cardHeight, index);
      card.node.setPosition(gap + this.cardWidth / 2 + index * this.stride, 0, 0);
      this.cards.push(card);
    }
  }
  private get offset(): number { return Math.max(0, -this.width / 2 - this.content.position.x); }
  private fullyVisible(index: number): boolean {
    const x = this.cards[index].node.position.x - this.offset;
    return x - this.cardWidth / 2 >= -0.5 && x + this.cardWidth / 2 <= this.width + 0.5;
  }
  private revealCard(index: number): void {
    this.scroll.stopAutoScroll();
    if (this.fullyVisible(index)) return;
    const max = this.scroll.getMaxScrollOffset().x;
    if (max > 0) this.scroll.scrollToPercentHorizontal(Math.min(1, index * this.stride / max), 0, false);
  }
  private renderRange(): void {
    this.range.string = this.activeCount > 3 ? `‹ 左右滑动看订单 · ${this.activeCount} 位顾客 ›` : '';
  }
  bind(onClaim: (uid: string) => void, onInspect: (uid: string, itemId: string) => void): void { this.cards.forEach(card => card.bind(onClaim, onInspect)); }
  beginDelivery(uid: string): Vec3 | null {
    if (this.deliveries.has(uid)) return null;
    for (const [index, card] of this.cards.entries()) {
      if (!card.node.activeInHierarchy) continue;
      const position = card.beginDelivery(uid, () => this.revealCard(index));
      if (position) { this.deliveries.set(uid, card); return position; }
    }
    return null;
  }
  receiveDelivery(uid: string): void { this.deliveries.get(uid)?.receiveDelivery(); }
  finishDelivery(uid: string): void { this.deliveries.get(uid)?.finishDelivery(); this.deliveries.delete(uid); }
  cancelDeliveries(): void { this.deliveries.forEach(card => card.finishDelivery(false)); this.deliveries.clear(); }
  readyHintPosition(): Vec3 | null {
    const claim = this.cards.find((card, index) => this.fullyVisible(index) && card.node.getChildByName('ClaimButton')?.activeInHierarchy)
      ?.node.getChildByName('ClaimButton');
    return claim?.worldPosition.clone() ?? null;
  }
  render(orders: OrderVm[], nowMs = 0): void {
    const count = Math.min(orders.length, this.cards.length);
    if (count !== this.activeCount) {
      this.activeCount = count;
      const before = this.offset;
      this.contentTransform.width = Math.max(this.width, count * this.stride + 8);
      const max = this.contentTransform.width - this.width;
      this.scroll.stopAutoScroll();
      this.scroll.scrollToPercentHorizontal(max > 0 ? Math.min(1, before / max) : 0, 0, false);
      this.renderRange();
    }
    this.cards.forEach((card, index) => {
      const order = orders[index];
      card.node.active = !!order;
      if (order) card.render(order, nowMs);
    });
  }
}
