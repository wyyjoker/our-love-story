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

export class CocosItemView {
  readonly node: Node;
  private g!: Graphics;
  private codeLabel!: Label;
  private size = 64;
  private currentUid = '';

  constructor(parent: Node, size: number) {
    this.size = size;
    this.node = createUiNode('ItemView');
    parent.addChild(this.node);
    ensureTransform(this.node, size, size);
    this.g = this.node.addComponent(Graphics);
    ensureOpacity(this.node);
    this.codeLabel = makeLabel('', Math.floor(size * 0.34), CocosTheme.surface(), true);
    this.node.addChild(this.codeLabel.node);
  }

  get uid(): string {
    return this.currentUid;
  }

  render(vm: ItemVm): void {
    this.currentUid = vm.uid;
    paintRoundRect(this.g, this.size, this.size, 12, CocosTheme.chain(vm.chainId));
    this.codeLabel.string = `${vm.code}`;
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
