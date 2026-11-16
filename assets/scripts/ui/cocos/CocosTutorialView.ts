/**
 * CocosTutorialView — hint bubble (never blocks board input).
 */
import { Button, Node, Label, Graphics, Tween, tween, UITransform, Vec3, isValid } from 'cc';
import { applyArt, itemArt } from './CocosArt';
import type { FirstUseHint } from '../../core/types';
import {
  CocosTheme,
  createUiNode,
  ensureTransform,
  makeLabel,
  paintRoundRect,
  hexColor,
  ensureOpacity,
} from './CocosTheme';

export class CocosTutorialView {
  readonly node: Node;
  private bubble: Node;
  private label: Label;
  private dismissedText = '';
  private guide: Node;
  private guideKey = '';
  private animation: Tween<{ t: number }> | null = null;
  private disposed = false;
  private activeHint: FirstUseHint | null = null;
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(parent: Node, width: number, height: number, private readonly onDismiss?: (hint: FirstUseHint) => void) {
    this.node = createUiNode('TutorialView');
    this.node.on(Node.EventType.NODE_DESTROYED, () => this.dispose());
    parent.addChild(this.node);
    ensureTransform(this.node, 0, 0);
    this.guide = createUiNode('TutorialGesture');
    this.node.addChild(this.guide);
    this.guide.pauseSystemEvents(true);
    this.guide.active = false;
    this.bubble = createUiNode('Bubble');
    this.node.addChild(this.bubble);
    const bw = Math.min(420, width * 0.7);
    ensureTransform(this.bubble, bw, 64);
    this.bubble.setPosition(0, height * 0.12, 0);
    const g = this.bubble.addComponent(Graphics);
    paintRoundRect(g, bw, 64, 18, CocosTheme.surface(), CocosTheme.primary(), 2);
    this.label = makeLabel('', 21, CocosTheme.textPrimary(), true);
    this.bubble.addChild(this.label.node);
    ensureTransform(this.label.node, bw - 58, 52);
    this.label.overflow = Label.Overflow.SHRINK;
    this.label.node.setPosition(-18, 0, 0);
    const close = createUiNode('DismissHint');
    this.bubble.addChild(close);
    ensureTransform(close, 44, 44);
    close.setPosition(bw / 2 - 22, 0, 0);
    const closeLabel = makeLabel('×', 25, CocosTheme.textSecondary(), true);
    close.addChild(closeLabel.node);
    close.addComponent(Button);
    close.on(Button.EventType.CLICK, () => this.dismiss());
    this.bubble.active = false;
  }

  show(text: string, hint?: FirstUseHint): void {
    if (this.disposed) return;
    if (this.label.string === text && this.activeHint === (hint ?? null) && this.bubble.active) return;
    this.clearDismissTimer();
    if (this.label.string !== text) this.stopGuide();
    this.activeHint = hint ?? null; this.label.string = text;
    this.bubble.active = text !== this.dismissedText;
    if (hint && this.bubble.active) this.dismissTimer = setTimeout(() => this.dismiss(), 6000);
  }

  private clearDismissTimer(): void {
    if (this.dismissTimer !== null) clearTimeout(this.dismissTimer);
    this.dismissTimer = null;
  }
  private dismiss(): void {
    const hint = this.activeHint; this.dismissedText = this.label.string; this.hide();
    if (hint) this.onDismiss?.(hint);
  }
  hide(): void {
    this.clearDismissTimer(); this.activeHint = null;
    if (isValid(this.bubble, true)) this.bubble.active = false;
    this.stopGuide();
  }

  showGesture(fromWorld: Vec3, toWorld: Vec3, definitionId = '', size = 64): void {
    if (this.disposed || !this.bubble.active) return;
    const tr = this.node.getComponent(UITransform)!;
    const from = tr.convertToNodeSpaceAR(fromWorld);
    const to = tr.convertToNodeSpaceAR(toWorld);
    const key = `${from.x}:${from.y}:${to.x}:${to.y}:${definitionId}`;
    if (this.guideKey === key && this.guide.active) return;
    this.stopGuide();
    this.guideKey = key;
    this.guide.active = true;
    for (const child of [...this.guide.children]) { child.removeFromParent(); child.destroy(); }
    const g = this.guide.getComponent(Graphics) ?? this.guide.addComponent(Graphics);
    g.clear();
    g.strokeColor = hexColor('#EA7C99', 220);
    g.fillColor = hexColor('#EA7C99', 230);
    g.lineWidth = 4;
    const lift = definitionId ? 40 : 0;
    const point = (t: number): Vec3 => new Vec3(from.x + (to.x - from.x) * t,
      from.y + (to.y - from.y) * t + (definitionId ? 4 * lift * t * (1 - t) : Math.sin(t * Math.PI * 2) * 7), 0);
    g.roundRect(to.x - size / 2, to.y - size / 2, size, size, 12); g.stroke();
    if (definitionId) {
      for (let step = 0; step < 18; step += 2) {
        const a = point(step / 18), b = point((step + 1) / 18);
        g.moveTo(a.x, a.y); g.lineTo(b.x, b.y);
      }
      g.stroke();
    }
    const moving = createUiNode('TutorialHand');
    this.guide.addChild(moving);
    if (definitionId) {
      const art = itemArt(definitionId);
      if (art) applyArt(moving, { ...art, preserveAspect: true }, size, size);
      ensureOpacity(moving).opacity = 225;
    }
    const finger = createUiNode('Pointer');
    moving.addChild(finger);
    finger.setPosition(size * 0.22, -size * 0.32, 0);
    const hand = finger.addComponent(Graphics);
    hand.fillColor = hexColor('#FFFCF7'); hand.strokeColor = hexColor('#87635B'); hand.lineWidth = 2;
    hand.roundRect(-5, -29, 29, 26, 10); hand.fill(); hand.stroke();
    hand.roundRect(-8, -8, 14, 34, 7); hand.fill(); hand.stroke();
    moving.setPosition(point(0));
    const state = { t: 0 };
    this.animation = tween(state).to(1.15, { t: 1 }, {
      onUpdate: (target) => {
        if (!this.disposed && isValid(moving, true) && isValid(this.guide, true)) moving.setPosition(point(target?.t ?? 0));
        else this.animation?.stop();
      },
    }).delay(0.45).call(() => { state.t = 0; }).union().repeatForever().start();
    this.guide.pauseSystemEvents(true);
  }

  private stopGuide(): void {
    this.animation?.stop();
    this.animation = null;
    this.guideKey = '';
    if (isValid(this.guide, true)) this.guide.active = false;
  }

  dispose(): void { this.disposed = true; this.clearDismissTimer(); this.stopGuide(); }
}
