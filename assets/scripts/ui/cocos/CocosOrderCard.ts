/**
 * CocosOrderCard — one order card with requirements + claim button.
 */
import { Node, Label, Graphics, Button, UITransform } from 'cc';
import type { OrderVm } from '../../presentation/GameViewMapper';
import {
  CocosTheme,
  createUiNode,
  ensureTransform,
  makeLabel,
  paintRoundRect,
} from './CocosTheme';

export class CocosOrderCard {
  readonly node: Node;
  private reqLabels: Label[] = [];
  private rewardLabel!: Label;
  private buttonLabel!: Label;
  private buttonNode!: Node;
  private buttonG!: Graphics;
  private cardG!: Graphics;
  private cardW = 0;
  private cardH = 0;
  private onClaim: (orderUid: string) => void = () => {};
  private uid = '';
  private built = false;

  constructor(parent: Node, width: number, height: number) {
    this.cardW = width;
    this.cardH = height;
    this.node = createUiNode('OrderCard');
    parent.addChild(this.node);
    ensureTransform(this.node, width, height);
  }

  bind(onClaim: (orderUid: string) => void): void {
    this.onClaim = onClaim;
    if (!this.built) {
      this.buildChrome();
      this.built = true;
    }
    this.buttonNode.off(Button.EventType.CLICK, this.handleClick, this);
    this.buttonNode.on(Button.EventType.CLICK, this.handleClick, this);
  }

  private handleClick = (): void => {
    if (this.uid) this.onClaim(this.uid);
  };

  private buildChrome(): void {
    this.cardG = this.node.addComponent(Graphics);
    paintRoundRect(this.cardG, this.cardW, this.cardH, 14, CocosTheme.surface(), CocosTheme.border());

    for (let i = 0; i < 2; i += 1) {
      const label = makeLabel('', 14, CocosTheme.textPrimary());
      this.node.addChild(label.node);
      label.node.setPosition(0, this.cardH * 0.22 - i * 22, 0);
      this.reqLabels.push(label);
    }

    this.rewardLabel = makeLabel('', 12, CocosTheme.textSecondary());
    this.node.addChild(this.rewardLabel.node);
    this.rewardLabel.node.setPosition(0, -this.cardH * 0.08, 0);

    this.buttonNode = createUiNode('ClaimBtn');
    this.node.addChild(this.buttonNode);
    const tr = ensureTransform(this.buttonNode, Math.min(110, this.cardW - 16), 32);
    void tr;
    this.buttonNode.setPosition(0, -this.cardH * 0.32, 0);
    this.buttonG = this.buttonNode.addComponent(Graphics);
    paintRoundRect(this.buttonG, Math.min(110, this.cardW - 16), 32, 16, CocosTheme.primary());
    this.buttonLabel = makeLabel('还差一点', 14, CocosTheme.surface(), true);
    this.buttonNode.addChild(this.buttonLabel.node);
    this.buttonNode.addComponent(Button);
  }

  render(vm: OrderVm): void {
    this.uid = vm.uid;
    if (!this.built) {
      this.buildChrome();
      this.built = true;
    }
    for (let i = 0; i < this.reqLabels.length; i += 1) {
      const req = vm.requirements[i];
      const label = this.reqLabels[i];
      if (!req) {
        label.string = '';
        continue;
      }
      label.string = req.done
        ? `${req.displayName} ✓`
        : `${req.displayName}  ${req.have}/${req.count}`;
      label.color = req.done ? CocosTheme.ok() : CocosTheme.textPrimary();
    }
    this.rewardLabel.string = vm.rewardText;
    this.buttonLabel.string = vm.buttonText;
    const btnW = Math.min(110, this.cardW - 16);
    if (vm.ready) {
      paintRoundRect(this.buttonG, btnW, 32, 16, CocosTheme.primary());
      this.buttonLabel.color = CocosTheme.surface();
    } else {
      paintRoundRect(this.buttonG, btnW, 32, 16, CocosTheme.border());
      this.buttonLabel.color = CocosTheme.textSecondary();
    }
    void this.node.getComponent(UITransform);
  }

  destroy(): void {
    this.buttonNode?.off(Button.EventType.CLICK, this.handleClick, this);
    this.node.destroy();
  }
}
