import { Button, Graphics, Label, Node } from 'cc';
import type { OrderVm } from '../../presentation/GameViewMapper';
import { applyArt, itemArt } from './CocosArt';
import { CocosTheme, createUiNode, ensureTransform, hexColor, makeLabel, paintRoundRect } from './CocosTheme';

const cardColors = [
  { fill: '#FFF0F0', edge: '#EAB0B2', badge: '#DB7C86' },
  { fill: '#F4F8EA', edge: '#C6D6B0', badge: '#83A67B' },
  { fill: '#F4F0FF', edge: '#D6C7EE', badge: '#9C84C4' },
];

function text(parent: Node, value: string, x: number, y: number, size: number, width: number, bold = false): Label {
  const label = makeLabel(value, size, CocosTheme.textPrimary(), bold);
  parent.addChild(label.node);
  ensureTransform(label.node, width, size + 6);
  label.overflow = Label.Overflow.SHRINK;
  label.node.setPosition(x, y, 0);
  return label;
}

export class CocosOrderCard {
  readonly node: Node;
  private readonly icons: Node[] = [];
  private readonly reqLabels: Label[] = [];
  private readonly rewardLabel: Label;
  private readonly buttonLabel: Label;
  private readonly buttonG: Graphics;
  private readonly onClaim: { callback: (orderUid: string) => void } = { callback: () => {} };
  private uid = '';

  constructor(parent: Node, private readonly width: number, private readonly height: number, index: number) {
    this.node = createUiNode('OrderCard');
    parent.addChild(this.node);
    ensureTransform(this.node, width, height);
    const palette = cardColors[index % cardColors.length];
    paintRoundRect(this.node.addComponent(Graphics), width, height, 24, hexColor(palette.fill, 246), hexColor(palette.edge), 3);
    text(this.node, '顾客订单', -48, height / 2 - 30, 25, 130, true);
    const badge = createUiNode('RewardBadge');
    this.node.addChild(badge);
    ensureTransform(badge, 70, 36);
    badge.setPosition(width / 2 - 46, height / 2 - 28, 0);
    paintRoundRect(badge.addComponent(Graphics), 70, 36, 18, hexColor(palette.badge));
    this.rewardLabel = text(badge, '+0', 0, 0, 20, 68, true);
    this.rewardLabel.color = hexColor('#FFFFFF');

    for (let i = 0; i < 2; i += 1) {
      const holder = createUiNode(`Required_${i}`);
      this.node.addChild(holder);
      ensureTransform(holder, 91, 82);
      holder.setPosition(i === 0 ? -52 : 52, 0, 0);
      paintRoundRect(holder.addComponent(Graphics), 91, 82, 16, hexColor('#FFFFFF', 240));
      const icon = createUiNode('Art');
      holder.addChild(icon);
      icon.setPosition(0, 10, 0);
      this.icons.push(icon);
      this.reqLabels.push(text(holder, '', 0, -31, 15, 87, true));
    }
    const button = createUiNode('ClaimButton');
    this.node.addChild(button);
    ensureTransform(button, 122, 30);
    button.setPosition(0, -height / 2 + 24, 0);
    this.buttonG = button.addComponent(Graphics);
    this.buttonLabel = text(button, '还差一点', 0, 0, 16, 114, true);
    button.addComponent(Button);
    button.on(Button.EventType.CLICK, () => { if (this.uid) this.onClaim.callback(this.uid); });
  }

  bind(onClaim: (orderUid: string) => void): void {
    this.onClaim.callback = onClaim;
  }

  render(vm: OrderVm): void {
    this.uid = vm.uid;
    this.rewardLabel.string = `★${vm.rewardCoins}`;
    const count = vm.requirements.length;
    for (let i = 0; i < 2; i += 1) {
      const holder = this.icons[i].parent!;
      const req = vm.requirements[i];
      holder.active = !!req;
      if (!req) continue;
      holder.setPosition(count === 1 ? 0 : i === 0 ? -52 : 52, 0, 0);
      const art = itemArt(req.itemId);
      if (art) applyArt(this.icons[i], art, 64, 54);
      this.reqLabels[i].string = `${req.have}/${req.count}`;
      this.reqLabels[i].color = req.done ? CocosTheme.ok() : CocosTheme.textPrimary();
    }
    this.buttonLabel.string = vm.ready ? '交付订单' : '还差一点';
    this.buttonLabel.color = vm.ready ? hexColor('#FFFFFF') : CocosTheme.textSecondary();
    paintRoundRect(this.buttonG, 122, 30, 15, vm.ready ? CocosTheme.primary() : hexColor('#F5E4DE'));
  }

  destroy(): void {
    this.node.destroy();
  }
}
