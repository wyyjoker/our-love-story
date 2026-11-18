import { BlockInputEvents, Button, Graphics, Label, Node } from 'cc';
import type { OrderVm } from '../../presentation/GameViewMapper';
import type { UiRoots } from './UiFactory';
import { applyArt, itemArt } from './CocosArt';
import { createUiNode, ensureTransform, hexColor, makeLabel, paintRoundRect } from './CocosTheme';

/** A brief, explicit delivery shortcut; all resource changes stay in GameContext. */
export class CocosReadyOrderNotice {
  private readonly card: Node;
  private readonly body: Node;
  private readonly title: Label;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private uid: string | null = null;
  constructor(roots: UiRoots, private readonly deliver: (uid: string) => void, private readonly dismissed: () => void) {
    this.card = createUiNode('ReadyOrderNotice'); roots.toastLayer.addChild(this.card);
    ensureTransform(this.card, 560, 224); this.card.setScale(Math.min(1, (roots.designWidth - 40) / 560), Math.min(1, (roots.designWidth - 40) / 560), 1);
    this.card.addComponent(BlockInputEvents);
    paintRoundRect(this.card.addComponent(Graphics), 560, 224, 30, hexColor('#FFF9EE'), hexColor('#8BB18A'), 4);
    this.title = makeLabel('✓ 订单已备齐', 34, hexColor('#557B59'), true); this.card.addChild(this.title.node); ensureTransform(this.title.node, 430, 50); this.title.node.setPosition(-25, 73, 0);
    const close = createUiNode('ReadyOrderDismiss'); this.card.addChild(close); ensureTransform(close, 60, 58); close.setPosition(236, 73, 0); close.addComponent(Button); close.addComponent(BlockInputEvents);
    const cross = makeLabel('×', 30, hexColor('#9B8B77'), true); close.addChild(cross.node); ensureTransform(cross.node, 56, 54);
    close.on(Button.EventType.CLICK, () => { this.hide(); this.dismissed(); });
    this.body = createUiNode('ReadyOrderItems'); this.card.addChild(this.body);
    const claim = createUiNode('ReadyOrderDeliver'); this.card.addChild(claim); ensureTransform(claim, 332, 62); claim.setPosition(0, -65, 0);
    paintRoundRect(claim.addComponent(Graphics), 332, 62, 27, hexColor('#739B79'));
    const caption = makeLabel('点击交付订单', 28, hexColor('#FFFFFF'), true); claim.addChild(caption.node); ensureTransform(caption.node, 320, 58);
    claim.addComponent(Button); claim.on(Button.EventType.CLICK, () => { const uid = this.uid; this.hide(); if (uid) this.deliver(uid); });
    this.card.once(Node.EventType.NODE_DESTROYED, () => this.hide()); this.card.active = false;
  }
  show(order: OrderVm, otherReadyCount: number): void {
    this.hide(); this.uid = order.uid;
    this.title.string = `✓ 订单已备齐${otherReadyCount ? ` · 另有${otherReadyCount}单` : ''}`;
    for (const child of [...this.body.children]) { child.removeFromParent(); child.destroy(); }
    order.requirements.forEach((req, index) => {
      const icon = createUiNode('ReadyNoticeItem'); this.body.addChild(icon); icon.setPosition((index - (order.requirements.length - 1) / 2) * 116, 10, 0);
      const art = itemArt(req.itemId); if (art) applyArt(icon, { ...art, preserveAspect: true }, 76, 64);
      const count = makeLabel(`×${req.count}`, 20, hexColor('#64866B'), true); icon.addChild(count.node); count.node.setPosition(40, -16, 0); ensureTransform(count.node, 44, 28);
    });
    this.card.active = true; this.timer = setTimeout(() => { this.hide(); this.dismissed(); }, 4500);
  }
  hide(): void { if (this.timer !== null) clearTimeout(this.timer); this.timer = null; this.uid = null; this.card.active = false; }
  get orderUid(): string | null { return this.uid; }
}
