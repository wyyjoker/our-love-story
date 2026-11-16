/**
 * CocosItemView — colored chip + Chinese short code (咖1 / 花2 …).
 * Forwards touches to the board via bubbling parent cell handlers.
 */
import { Node, Label, Graphics, UIOpacity, tween, Vec3, EventTouch } from 'cc';
import type { ItemVm } from '../../presentation/GameViewMapper';
import {
  CocosTheme,
  createUiNode,
  ensureOpacity,
  ensureTransform,
  makeLabel,
  paintRoundRect,
} from './CocosTheme';
import { applyArt, itemArt } from './CocosArt';

export class CocosItemView {
  readonly node: Node;
  private g!: Graphics;
  private codeLabel!: Label;
  private size = 64;
  private width: number;
  private height: number;
  private currentUid = '';
  private artNode: Node;
  private levelBadge: Label;

  constructor(parent: Node, size: number, width = size, height = size) {
    this.size = size;
    this.width = width;
    this.height = height;
    this.node = createUiNode('ItemView');
    parent.addChild(this.node);
    ensureTransform(this.node, width, height);
    this.g = this.node.addComponent(Graphics);
    ensureOpacity(this.node);
    this.artNode = createUiNode('ItemArt');
    this.node.addChild(this.artNode);
    ensureTransform(this.artNode, size * 0.9, size * 0.9);
    this.codeLabel = makeLabel('', Math.floor(size * 0.34), CocosTheme.surface(), true);
    this.node.addChild(this.codeLabel.node);
    ensureTransform(this.codeLabel.node, width - 8, height - 4);
    this.codeLabel.overflow = Label.Overflow.SHRINK;
    const badge = createUiNode('ItemLevelBadge'); this.node.addChild(badge);
    ensureTransform(badge, 42, 22); badge.setPosition(width / 2 - 24, -height / 2 + 13, 0);
    paintRoundRect(badge.addComponent(Graphics), 42, 22, 10, CocosTheme.surface(), CocosTheme.primary(), 1);
    this.levelBadge = makeLabel('', 15, CocosTheme.textPrimary(), true); badge.addChild(this.levelBadge.node);
    ensureTransform(this.levelBadge.node, 40, 20); this.levelBadge.overflow = Label.Overflow.SHRINK;
  }

  get uid(): string {
    return this.currentUid;
  }

  render(vm: ItemVm): void {
    this.currentUid = vm.uid;
    paintRoundRect(this.g, this.width, this.height, 12, CocosTheme.surface());
    const art = itemArt(vm.definitionId);
    this.artNode.active = !!art;
    this.codeLabel.node.active = true;
    this.codeLabel.color = CocosTheme.chain(vm.chainId);
    this.codeLabel.string = `${vm.code}`;
    this.levelBadge.node.parent!.active = ['treasure_chest', 'coin', 'energy', 'diamond', 'scissors'].includes(vm.chainId) || vm.level >= 9;
    this.levelBadge.string = vm.chainId === 'scissors' ? `${vm.remainingUses}次` : `Lv${vm.level}`;
    if (art) applyArt(this.artNode, { ...art, preserveAspect: true }, this.size * 0.9, this.size * 0.9,
      (ready) => { this.codeLabel.node.active = !ready; });
    this.node.active = true;
  }

  clear(): void {
    this.currentUid = '';
    this.node.active = false;
    this.g.clear();
  }

  setDragging(dragging: boolean): void {
    const op = ensureOpacity(this.node);
    op.opacity = dragging ? 115 : 255;
    const s = dragging ? 0.95 : 1;
    this.node.setScale(s, s, 1);
  }

  playMergePop(): void {
    tween(this.node)
      .to(0.1, { scale: new Vec3(1.15, 1.15, 1) })
      .to(0.08, { scale: new Vec3(0.95, 0.95, 1) })
      .to(0.08, { scale: new Vec3(1, 1, 1) })
      .start();
  }

  playSpawnPop(): void {
    this.node.setScale(0.5, 0.5, 1);
    tween(this.node)
      .to(0.1, { scale: new Vec3(1.08, 1.08, 1) })
      .to(0.08, { scale: new Vec3(1, 1, 1) })
      .start();
  }

  /** Let board cell receive the same touch (item sits above cell). */
  bindForwardTouch(
    start: (e: EventTouch, index: number) => void,
    index: number,
  ): void {
    this.node.off(Node.EventType.TOUCH_START);
    this.node.on(
      Node.EventType.TOUCH_START,
      (e: EventTouch) => start(e, index),
      this,
    );
  }
}
