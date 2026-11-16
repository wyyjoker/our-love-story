import { Graphics, isValid, Label, Node, Tween, tween, UITransform, Vec3 } from 'cc';
import { applyArt, itemArt } from './CocosArt';
import { createUiNode, ensureOpacity, ensureTransform, hexColor, makeLabel, paintRoundRect } from './CocosTheme';
import type { RewardAmounts, RewardKind } from './RewardUiMath';

export const RewardPalette = { paper: '#FFF9F3', edge: '#EBD6CB', coral: '#D88794', ink: '#75564D', gold: '#D9AF66', green: '#91B18A' };
export type DeliveryItem = { position: Vec3; size: number; definitionId: string };
type RewardDestination = (kind: RewardKind) => Vec3;

/** Short, pass-through visual jobs. No currency, inventory or save mutations. */
export class CocosRewardEffects {
  private readonly jobs = new Set<Node>();
  private notice: Node | null = null;
  private disposed = false;
  constructor(private readonly parent: Node, private readonly height: number) {}

  private local(world: Vec3): Vec3 { return this.parent.getComponent(UITransform)!.convertToNodeSpaceAR(world); }
  private job(name: string, done: () => void = () => {}): Node {
    const root = createUiNode(name); this.parent.addChild(root); ensureTransform(root, 0, 0);
    this.jobs.add(root);
    root.once(Node.EventType.NODE_DESTROYED, () => {
      this.jobs.delete(root);
      const stop = (node: Node): void => { Tween.stopAllByTarget(node); const op = node.getComponent('cc.UIOpacity'); if (op) Tween.stopAllByTarget(op); node.children.forEach(stop); };
      stop(root); done();
    });
    return root;
  }
  private end(root: Node): void {
    if (!isValid(root, true)) return;
    // Detach now: no invisible effects or stale input between frames.
    root.removeFromParent(); root.destroy();
  }
  private sparks(parent: Node, radius: number): void {
    const ink = parent.addComponent(Graphics);
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3, x = Math.cos(angle) * radius, y = Math.sin(angle) * radius * 0.65;
      ink.fillColor = hexColor(i % 2 ? '#E9B5BB' : '#E4C58B', 205);
      ink.moveTo(x, y + 5); ink.lineTo(x + 3, y); ink.lineTo(x, y - 5); ink.lineTo(x - 3, y); ink.close(); ink.fill();
    }
  }
  private badge(parent: Node, kind: RewardKind, amount: number): Node {
    const icon = createUiNode(`RewardFlight_${kind}`); parent.addChild(icon); ensureTransform(icon, 110, 44);
    paintRoundRect(icon.addComponent(Graphics), 110, 44, 22, hexColor(RewardPalette.paper), hexColor(RewardPalette.edge), 1);
    const mark = makeLabel(kind === 'coins' ? '●' : kind === 'xp' ? '✦' : '♥', 28, hexColor(kind === 'coins' ? RewardPalette.gold : kind === 'xp' ? '#A28AB9' : RewardPalette.coral), true);
    icon.addChild(mark.node); ensureTransform(mark.node, 32, 38); mark.node.setPosition(-32, 0, 0);
    const value = makeLabel(`+${amount}`, 24, hexColor(RewardPalette.ink), true); icon.addChild(value.node);
    ensureTransform(value.node, 70, 38); value.node.setPosition(15, 0, 0);
    return icon;
  }
  private flights(root: Node, origin: Vec3, amounts: RewardAmounts, destination: RewardDestination,
    arrive: (kind: RewardKind) => void, delay: number): number {
    let count = 0;
    for (const kind of ['coins', 'xp', 'hearts'] as const) {
      if (amounts[kind] <= 0) continue;
      const index = count++, chip = this.badge(root, kind, amounts[kind]);
      const start = origin.clone().add(new Vec3((index - 1) * 60, 0, 0)), end = this.local(destination(kind));
      const arc = new Vec3((start.x + end.x) / 2, Math.max(start.y, end.y) + 45, 0);
      chip.setPosition(start); chip.setScale(0, 0, 1);
      tween(chip).delay(delay + index * 0.07).to(0.1, { scale: new Vec3(1, 1, 1) })
        .to(0.17, { position: arc }).to(0.19, { position: end, scale: new Vec3(0.55, 0.55, 1) })
        .call(() => { if (!this.disposed) arrive(kind); }).to(0.06, { scale: new Vec3(0, 0, 1) }).start();
    }
    return delay + Math.max(0, count - 1) * 0.07 + 0.54;
  }

  delivery(items: DeliveryItem[], target: Vec3, amounts: RewardAmounts, destination: RewardDestination,
    received: () => void, arrive: (kind: RewardKind) => void, done: () => void): void {
    if (this.disposed) { done(); return; }
    const root = this.job('OrderDeliveryEffects', done), end = this.local(target);
    for (const [index, item] of items.entries()) {
      const icon = createUiNode('DeliveredItemFlight'); root.addChild(icon);
      const art = itemArt(item.definitionId); if (art) applyArt(icon, { ...art, preserveAspect: true }, item.size, item.size);
      const start = this.local(item.position); icon.setPosition(start);
      const arc = new Vec3(start.x + (end.x - start.x) * 0.3, (start.y + end.y) / 2 + 45, 0);
      tween(icon).delay(index * 0.025).to(0.15, { position: arc, scale: new Vec3(1.08, 1.08, 1) })
        .to(0.16, { position: end, scale: new Vec3(0.4, 0.4, 1) }).to(0.06, { scale: new Vec3(0, 0, 1) }).start();
    }
    const thanks = createUiNode('CustomerThanks'); root.addChild(thanks); thanks.setPosition(end.x, end.y + 30, 0); thanks.setScale(0, 0, 1);
    this.sparks(thanks, 48);
    const heart = makeLabel('♥', 35, hexColor(RewardPalette.coral), true); thanks.addChild(heart.node); ensureTransform(heart.node, 50, 50);
    tween(thanks).delay(0.3).call(received).to(0.12, { scale: new Vec3(1, 1, 1) })
      .to(0.23, { position: new Vec3(end.x, end.y + 62, 0), scale: new Vec3(0, 0, 1) }).start();
    const duration = this.flights(root, end, amounts, destination, arrive, 0.32);
    root.pauseSystemEvents(true);
    tween(root).delay(duration).call(() => this.end(root)).start();
  }

  payout(origin: Vec3, amounts: RewardAmounts, destination: RewardDestination, arrive: (kind: RewardKind) => void, done: () => void): void {
    const root = this.job('LevelRewardEffects', done);
    const duration = this.flights(root, this.local(origin), amounts, destination, arrive, 0);
    root.pauseSystemEvents(true); tween(root).delay(duration).call(() => this.end(root)).start();
  }

  discovery(definitionId: string, name: string, coins: number, anchor?: Vec3): void {
    if (this.notice) this.end(this.notice);
    const root = this.job('DiscoveryReward'); this.notice = root;
    const paper = createUiNode('DiscoveryCard'); root.addChild(paper);
    ensureTransform(paper, 440, 104); paper.setPosition(0, anchor ? this.local(anchor).y : -this.height / 2 + 400, 0);
    paintRoundRect(paper.addComponent(Graphics), 440, 104, 25, hexColor(RewardPalette.paper), hexColor(RewardPalette.edge), 1.5);
    const art = createUiNode('DiscoveryArt'); paper.addChild(art); art.setPosition(-165, 0, 0);
    const cell = itemArt(definitionId); if (cell) applyArt(art, { ...cell, preserveAspect: true }, 78, 78);
    const title = makeLabel('首次发现 · 图鉴已收录', 21, hexColor('#B68268'), true); paper.addChild(title.node);
    ensureTransform(title.node, 316, 30); title.node.setPosition(43, 27, 0);
    const description = makeLabel(`${name}　金币 +${coins}`, 25, hexColor(RewardPalette.ink), true); paper.addChild(description.node);
    ensureTransform(description.node, 310, 54); description.node.setPosition(43, -16, 0); description.enableWrapText = true; description.overflow = Label.Overflow.SHRINK;
    paper.setScale(0.92, 0.92, 1); const opacity = ensureOpacity(paper); opacity.opacity = 0;
    tween(paper).to(0.16, { scale: new Vec3(1, 1, 1) }).start();
    tween(opacity).to(0.16, { opacity: 255 }).delay(1.25).to(0.18, { opacity: 0 }).call(() => this.end(root)).start();
    root.pauseSystemEvents(true);
    root.once(Node.EventType.NODE_DESTROYED, () => { if (this.notice === root) this.notice = null; });
  }
  clear(): void { for (const root of Array.from(this.jobs)) this.end(root); this.notice = null; }
  dispose(): void { this.disposed = true; this.clear(); }
}
