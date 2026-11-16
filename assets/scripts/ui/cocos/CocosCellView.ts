/**
 * CocosCellView — one board cell shell (highlight states for drop).
 */
import { Node, Graphics, Vec3, tween, Color, UIOpacity, Label } from 'cc';
import {
  CocosTheme,
  createUiNode,
  ensureTransform,
  hexColor,
  makeLabel,
  paintRoundRect,
} from './CocosTheme';
import { CocosItemView } from './CocosItemView';
import type { ItemVm } from '../../presentation/GameViewMapper';

function alpha(color: Color, a: number): Color {
  const c = new Color(color.r, color.g, color.b, a);
  return c;
}

export class CocosCellView {
  readonly node: Node;
  readonly index: number;
  private g!: Graphics;
  private item: CocosItemView | null = null;
  private lockedOverlay: Node;
  private size = 64;
  private width = 64;
  private height = 64;

  constructor(parent: Node, index: number, width: number, height = width) {
    this.index = index;
    this.width = width;
    this.height = height;
    const size = Math.min(width, height);
    this.size = size;
    this.node = createUiNode(`Cell_${index}`);
    parent.addChild(this.node);
    ensureTransform(this.node, width, height);
    this.g = this.node.addComponent(Graphics);
    this.paintIdle();
    this.lockedOverlay = createUiNode('LockedOverlay');
    this.node.addChild(this.lockedOverlay);
    ensureTransform(this.lockedOverlay, width - 4, height - 4);
    paintRoundRect(this.lockedOverlay.addComponent(Graphics), width - 4, height - 4, 10, hexColor('#E9DCCF', 240), hexColor('#F9F1E7'), 1);
    const lock = createUiNode('CellLockIcon'); this.lockedOverlay.addChild(lock); lock.setPosition(0, size * 0.06, 0);
    const glyph = lock.addComponent(Graphics); const unit = size * 0.13;
    glyph.strokeColor = hexColor('#B7A391'); glyph.lineWidth = Math.max(1.5, size * 0.025);
    glyph.roundRect(-unit * 0.62, 0, unit * 1.24, unit * 1.35, unit * 0.55); glyph.stroke();
    glyph.fillColor = hexColor('#B7A391'); glyph.roundRect(-unit, -unit * 0.72, unit * 2, unit * 1.3, unit * 0.23); glyph.fill();
    glyph.fillColor = hexColor('#FFF8EF'); glyph.circle(0, -unit * 0.07, unit * 0.16); glyph.fill();
    const level = makeLabel('Lv.1', Math.max(18, Math.floor(size * 0.2)), hexColor('#A08B7C'), true);
    this.lockedOverlay.addChild(level.node);
    ensureTransform(level.node, width - 8, 24);
    level.overflow = Label.Overflow.SHRINK;
    level.node.setPosition(0, -Math.floor(size * 0.22), 0);
    this.lockLevelLabel = level;
    this.lockedOverlay.active = false;
  }

  private lockLevelLabel: Label;

  setLocked(locked: boolean, unlockLevel: number | null): void {
    this.locked = locked;
    this.lockedOverlay.active = locked;
    if (locked) this.lockLevelLabel.string = unlockLevel === null ? '未开放' : `Lv.${unlockLevel}`;
  }

  get isLocked(): boolean { return this.locked; }
  private locked = false;

  private paintIdle(): void {
    paintRoundRect(
      this.g,
      this.width - 4,
      this.height - 4,
      10,
      alpha(hexColor('#F2E6DE'), 225),
      hexColor('#FFFFFF'),
    );
  }

  private paintHighlight(kind: 'move' | 'merge'): void {
    const fill =
      kind === 'merge'
        ? alpha(CocosTheme.accent(), 80)
        : alpha(CocosTheme.primary(), 60);
    paintRoundRect(
      this.g,
      this.width - 4,
      this.height - 4,
      10,
      fill,
      CocosTheme.primary(),
      2,
    );
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
      this.item = new CocosItemView(this.node, this.size - 8, this.width - 8, this.height - 8);
    }
    this.item.render(vm);
    this.item.setDragging(false);
  }

  bindPickup(fn: (e: unknown, index: number) => void): void {
    this.item?.bindForwardTouch(fn as never, this.index);
  }

  playMergePop(): void {
    this.item?.playMergePop();
    const burst = createUiNode('MergeSparkles');
    this.node.addChild(burst);
    ensureTransform(burst, this.size, this.size);
    const graphics = burst.addComponent(Graphics);
    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8;
      const distance = this.size * 0.2;
      graphics.fillColor = index % 2 === 0 ? CocosTheme.primary() : CocosTheme.accent();
      graphics.circle(Math.cos(angle) * distance, Math.sin(angle) * distance, Math.max(2, this.size * 0.045));
      graphics.fill();
    }
    const opacity = burst.addComponent(UIOpacity);
    opacity.opacity = 230;
    burst.setScale(0.65, 0.65, 1);
    tween(burst)
      .to(0.26, { scale: new Vec3(1.55, 1.55, 1) })
      .call(() => burst.destroy())
      .start();
    tween(opacity).to(0.26, { opacity: 0 }).start();
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
