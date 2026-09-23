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

  constructor(parent: Node, width: number, height: number) {
    this.w = width;
    this.h = height;
    this.node = createUiNode('GenBtn');
    parent.addChild(this.node);
    ensureTransform(this.node, width, height);
    this.g = this.node.addComponent(Graphics);
    paintRoundRect(this.g, width, height, 14, CocosTheme.surface(), CocosTheme.border());
    this.artNode = createUiNode('GeneratorArt');
    this.node.addChild(this.artNode);
    this.artNode.setPosition(0, height * 0.1, 0);
    this.nameLabel = makeLabel('', 14, CocosTheme.textPrimary(), true);
    this.node.addChild(this.nameLabel.node);
    this.nameLabel.node.setPosition(0, -height * 0.28, 0);
    this.subLabel = makeLabel('', 12, CocosTheme.textSecondary());
    this.node.addChild(this.subLabel.node);
    this.subLabel.node.setPosition(0, -height * 0.43, 0);
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
    if (art) applyArt(this.artNode, art, Math.min(this.w - 8, this.h * 0.85), this.h * 0.65);
    this.nameLabel.string = vm.displayName;
    this.subLabel.string = vm.locked ? `Lv${vm.unlockLevel} 解锁` : `体力${vm.energyCost}`;
    this.node.getComponent(UIOpacity)!.opacity = vm.locked ? 170 : 255;
    paintRoundRect(
      this.g,
      this.w,
      this.h,
      14,
      vm.locked ? CocosTheme.border() : CocosTheme.surface(),
      CocosTheme.border(),
    );
  }

  pop(): void {
    tween(this.node)
      .to(0.06, { scale: new Vec3(0.96, 0.96, 1) })
      .to(0.08, { scale: new Vec3(1, 1, 1) })
      .start();
  }

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
      const btn = new GenButton(this.node, btnW, btnH);
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
    // pop the matching button after spawn
    void id;
    for (const b of this.buttons) b.pop();
  }
}
