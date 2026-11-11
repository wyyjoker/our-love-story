/**
 * CocosGeneratorDock — bottom generator buttons (locked shows unlock level).
 */
import { Node, Label, Graphics, Button, UIOpacity, tween, Vec3, UITransform } from 'cc';
import type { GeneratorVm } from '../../presentation/GameViewMapper';
import {
  CocosTheme,
  createUiNode,
  ensureTransform,
  makeLabel,
  paintRoundRect,
  hexColor,
} from './CocosTheme';
import { applyArt, generatorArt } from './CocosArt';

class GenButton {
  readonly node: Node;
  private g!: Graphics;
  private nameLabel!: Label;
  private subLabel!: Label;
  private w: number;
  private h: number;
  private onTap: (id: string) => void = () => {};
  private id = '';
  private artNode: Node;
  private lock: Node;
  private readonly palette: { fill: string; edge: string };

  constructor(parent: Node, width: number, height: number, index: number) {
    this.w = width;
    this.h = height;
    this.palette = [
      { fill: '#FFE1DB', edge: '#EFB5AE' }, { fill: '#E6ECD4', edge: '#C9D2B0' },
      { fill: '#EBDFF5', edge: '#D4BDE8' }, { fill: '#F1E2DA', edge: '#D9C4B6' },
    ][index % 4];
    this.node = createUiNode('GenBtn');
    parent.addChild(this.node);
    ensureTransform(this.node, width, height);
    this.g = this.node.addComponent(Graphics);
    paintRoundRect(this.g, width, height, 14, CocosTheme.surface(), CocosTheme.border());
    this.artNode = createUiNode('GeneratorArt');
    this.node.addChild(this.artNode);
    this.artNode.setPosition(0, -5, 0);
    this.nameLabel = makeLabel('', 20, CocosTheme.textPrimary(), true);
    this.node.addChild(this.nameLabel.node);
    ensureTransform(this.nameLabel.node, width - 8, 30);
    this.nameLabel.overflow = Label.Overflow.SHRINK;
    this.nameLabel.node.setPosition(0, height / 2 - 22, 0);
    this.subLabel = makeLabel('', 16, CocosTheme.textSecondary());
    this.node.addChild(this.subLabel.node);
    ensureTransform(this.subLabel.node, width - 8, 24);
    this.subLabel.node.setPosition(0, -height / 2 + 14, 0);
    this.lock = createUiNode('GeneratorLock');
    this.node.addChild(this.lock);
    this.lock.setPosition(width / 2 - 23, -height / 2 + 44, 0);
    const lockGraphics = this.lock.addComponent(Graphics);
    paintRoundRect(lockGraphics, 34, 34, 17, hexColor('#988C91', 245), hexColor('#FFFFFF'), 2);
    lockGraphics.strokeColor = hexColor('#FFFFFF');
    lockGraphics.lineWidth = 2;
    lockGraphics.roundRect(-6, -1, 12, 11, 5); lockGraphics.stroke();
    lockGraphics.fillColor = hexColor('#FFFFFF');
    lockGraphics.roundRect(-8, -10, 16, 13, 3); lockGraphics.fill();
    this.node.addComponent(Button);
    this.node.on(Button.EventType.CLICK, this.handle, this);
    this.node.addComponent(UIOpacity);
  }

  private handle = (): void => {
    this.onTap(this.id);
  };

  bind(onTap: (id: string) => void): void {
    this.onTap = onTap;
  }

  render(vm: GeneratorVm): void {
    this.id = vm.id;
    const art = generatorArt(vm.id);
    if (art) applyArt(this.artNode, { ...art, preserveAspect: true }, this.w - 16, this.h - 58);
    this.nameLabel.string = vm.displayName;
    this.subLabel.string = vm.locked ? `Lv${vm.unlockLevel} 解锁` : `体力${vm.energyCost}`;
    this.node.getComponent(UIOpacity)!.opacity = 255;
    this.lock.active = vm.locked;
    const opacity = this.artNode.getComponent(UIOpacity) ?? this.artNode.addComponent(UIOpacity);
    opacity.opacity = vm.locked ? 195 : 255;
    paintRoundRect(
      this.g,
      this.w,
      this.h,
      20,
      hexColor(this.palette.fill),
      hexColor(this.palette.edge),
      2,
    );
  }

  pop(): void {
    tween(this.node)
      .to(0.06, { scale: new Vec3(0.96, 0.96, 1) })
      .to(0.08, { scale: new Vec3(1, 1, 1) })
      .start();
  }

  matches(id: string): boolean {
    return this.id === id;
  }

  worldPosition(): Vec3 { return this.node.worldPosition.clone(); }

  destroy(): void {
    this.node.off(Button.EventType.CLICK, this.handle, this);
    this.node.destroy();
  }
}

export class CocosGeneratorDock {
  readonly node: Node;
  private buttons: GenButton[] = [];

  constructor(parent: Node, width: number, height: number) {
    this.node = createUiNode('GeneratorDockView');
    parent.addChild(this.node);
    ensureTransform(this.node, width, height);
    const gap = 8;
    const btnW = (width - 24 - gap * 3) / 4;
    const btnH = height - 16;
    for (let i = 0; i < 4; i += 1) {
      const btn = new GenButton(this.node, btnW, btnH, i);
      btn.node.setPosition(-width / 2 + 12 + btnW / 2 + i * (btnW + gap), 0, 0);
      this.buttons.push(btn);
    }
  }

  bind(onTap: (id: string) => void): void {
    for (const b of this.buttons) b.bind(onTap);
  }

  render(list: GeneratorVm[]): void {
    for (let i = 0; i < this.buttons.length; i += 1) {
      const vm = list[i];
      if (vm) this.buttons[i].render(vm);
    }
  }

  popMatching(id: string): void {
    this.buttons.find((button) => button.matches(id))?.pop();
  }

  hintPosition(id: string): Vec3 | null {
    return this.buttons.find((button) => button.matches(id))?.worldPosition() ?? null;
  }
}
