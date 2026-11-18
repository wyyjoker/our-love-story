/**
 * CocosCellView — one board cell shell (highlight states for drop).
 */
import { Node, Graphics, Vec3, tween, Tween, Color, UIOpacity, Label } from 'cc';
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
  private highlight = 'none';
  private orderMark: Node | null = null;
  private orderReady: boolean | null = null;
  private traceMark: Node | null = null;

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
    paintRoundRect(this.lockedOverlay.addComponent(Graphics), width - 4, height - 4, 8, hexColor('#EDE5D8', 210), hexColor('#F9F4EA'), 1);
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
      this.width - 2,
      this.height - 2,
      7,
      alpha(hexColor(this.orderReady === null ? '#F8EDDB' : this.orderReady ? '#D3E3BD' : '#E0E9D0'), 235),
      hexColor('#E5D7C3'),
    );
  }

  private paintHighlight(kind: 'move' | 'merge' | 'candidate' | 'invalid'): void {
    const fill =
      kind === 'invalid' ? alpha(hexColor('#EAA4A4'), 120) : kind === 'merge'
        ? alpha(CocosTheme.accent(), 80)
        : alpha(CocosTheme.primary(), 60);
    paintRoundRect(
      this.g,
      this.width - 4,
      this.height - 4,
      10,
      fill,
      kind === 'candidate' ? hexColor('#A2B995') : kind === 'invalid' ? hexColor('#C86E6E') : CocosTheme.primary(),
      kind === 'merge' ? 4 : 2,
    );
    if (kind === 'merge') {
      tween(this.node)
        .to(0.12, { scale: new Vec3(1.04, 1.04, 1) })
        .to(0.12, { scale: new Vec3(1, 1, 1) })
        .start();
    }
  }

  setHighlight(mode: 'none' | 'move' | 'merge' | 'candidate' | 'invalid'): void {
    if (this.highlight === mode) return;
    this.highlight = mode; Tween.stopAllByTarget(this.node);
    if (mode === 'none') {
      this.paintIdle();
      this.node.setScale(1, 1, 1);
      return;
    }
    this.paintHighlight(mode);
  }
  setOrderMark(ready: boolean | null): void {
    this.orderReady = ready;
    if (this.highlight === 'none') this.paintIdle();
    if (!this.orderMark && ready !== null) {
      this.orderMark = createUiNode('OrderNeedBadge'); this.node.addChild(this.orderMark);
      const span = Math.max(25, this.size * .43);
      ensureTransform(this.orderMark, span, span);
      this.orderMark.setPosition(this.width / 2 - span * .49 - 2, -this.height / 2 + span * .43 + 3, 0);
      this.orderMark.addComponent(Graphics);
      this.orderMark.pauseSystemEvents(true);
    }
    if (!this.orderMark) return;
    this.orderMark.active = ready !== null; this.orderMark.setSiblingIndex(this.node.children.length - 1);
    if (ready !== null) {
      const span = Math.max(25, this.size * .43), graphics = this.orderMark.getComponent(Graphics)!; graphics.clear();
      const stroke = (colour: string, thickness: number): void => {
        graphics.strokeColor = hexColor(colour); graphics.lineWidth = thickness;
        graphics.moveTo(-span * .40, 0); graphics.lineTo(-span * .10, -span * .27); graphics.lineTo(span * .43, span * .32); graphics.stroke();
      };
      stroke('#FFFCF0', span * .28); stroke(ready ? '#72A34E' : '#8CAC69', span * .17);
    }
  }
  setTracked(mode: 'exact' | 'precursor' | null): void {
    if (!this.traceMark && mode) { this.traceMark = createUiNode('OrderTraceOutline'); this.node.addChild(this.traceMark); this.traceMark.pauseSystemEvents(true); }
    if (!this.traceMark) return; this.traceMark.active = !!mode;
    if (mode) paintRoundRect(this.traceMark.getComponent(Graphics) ?? this.traceMark.addComponent(Graphics), this.width - 3, this.height - 3, 10, hexColor('#FFFFFF', 0), hexColor(mode === 'exact' ? '#648F69' : '#D69A74'), 3);
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
