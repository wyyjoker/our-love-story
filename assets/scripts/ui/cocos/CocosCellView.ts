/**
 * CocosCellView — one board cell shell (highlight states for drop).
 */
import { Node, Graphics, Vec3, tween } from 'cc';
import {
  CocosTheme,
  createUiNode,
  ensureTransform,
  paintRoundRect,
} from './CocosTheme';
import { CocosItemView } from './CocosItemView';
import type { ItemVm } from '../../presentation/GameViewMapper';

export class CocosCellView {
  readonly node: Node;
  readonly index: number;
  private g!: Graphics;
  private item: CocosItemView | null = null;
  private size = 64;

  constructor(parent: Node, index: number, size: number) {
    this.index = index;
    this.size = size;
    this.node = createUiNode(`Cell_${index}`);
    parent.addChild(this.node);
    ensureTransform(this.node, size, size);
    this.g = this.node.addComponent(Graphics);
    this.paintIdle();
  }

  private paintIdle(): void {
    paintRoundRect(
      this.g,
      this.size - 4,
      this.size - 4,
      10,
      CocosTheme.surface().clone().set(255, 255, 255, 180),
      CocosTheme.border(),
    );
  }

  private paintHighlight(kind: 'move' | 'merge'): void {
    const fill =
      kind === 'merge'
        ? CocosTheme.accent().clone().set(
            CocosTheme.accent().r,
            CocosTheme.accent().g,
            CocosTheme.accent().b,
            70,
          )
        : CocosTheme.primary().clone().set(
            CocosTheme.primary().r,
            CocosTheme.primary().g,
            CocosTheme.primary().b,
            50,
          );
    paintRoundRect(this.g, this.size - 4, this.size - 4, 10, fill, CocosTheme.primary(), 2);
    if (kind === 'merge') {
      tween(this.node)
        .to(0.12, { scale: new Vec3(1.04, 1.04, 1) })
        .to(0.12, { scale: new Vec3(1, 1, 1) })
        .start();
    }
  }

  setHighlight(mode: 'none' | 'move' | 'merge'): void {
    if (mode === 'none') {
      this.paintIdle();
      this.node.setScale(1, 1, 1);
      return;
    }
    this.paintHighlight(mode);
  }

  setItem(vm: ItemVm | null): void {
    if (!vm) {
      this.item?.clear();
      return;
    }
    if (!this.item) {
      this.item = new CocosItemView(this.node, this.size - 8);
    }
    this.item.render(vm);
    this.item.setDragging(false);
  }

  playMergePop(): void {
    this.item?.playMergePop();
  }

  playSpawnPop(): void {
    this.item?.playSpawnPop();
  }

  setSourceDim(dim: boolean): void {
    this.item?.setDragging(dim);
  }

  get itemView(): CocosItemView | null {
    return this.item;
  }
}
