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
  private readonly itemNames: Label[] = [];
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
    const compact = height < 190;
    paintRoundRect(this.node.addComponent(Graphics), width, height, 24, hexColor(palette.fill, 246), hexColor(palette.edge), 3);
    const avatar = createUiNode('CustomerAvatar');
    this.node.addChild(avatar);
    avatar.setPosition(-width / 2 + 31, height / 2 - 30, 0);
    applyArt(avatar, { sheet: 'customer_sheet', index: index % 3, columns: 3, rows: 1, preserveAspect: true }, compact ? 36 : 46, compact ? 36 : 46);
    text(this.node, '顾客订单', -6, height / 2 - 28, compact ? 20 : 22, 100, true);
    const badge = createUiNode('RewardBadge');
    this.node.addChild(badge);
    ensureTransform(badge, 62, 32);
    badge.setPosition(width / 2 - 39, height / 2 - 28, 0);
    paintRoundRect(badge.addComponent(Graphics), 62, 32, 16, hexColor(palette.badge));
    this.rewardLabel = text(badge, '+0', 0, 0, 18, 60, true);
    this.rewardLabel.color = hexColor('#FFFFFF');

    for (let i = 0; i < 2; i += 1) {
      const holder = createUiNode(`Required_${i}`);
      this.node.addChild(holder);
      ensureTransform(holder, 91, compact ? 68 : 80);
      holder.setPosition(i === 0 ? -52 : 52, compact ? -4 : 4, 0);
      paintRoundRect(holder.addComponent(Graphics), 91, compact ? 68 : 80, 16, hexColor('#FFFFFF', 240));
      const icon = createUiNode('Art');
      holder.addChild(icon);
      icon.setPosition(0, compact ? 11 : 9, 0);
      this.icons.push(icon);
      const name = text(holder, '', 0, compact ? 11 : 9, 16, 86, true);
      ensureTransform(name.node, 86, 40);
      name.enableWrapText = true;
      this.itemNames.push(name);
      this.reqLabels.push(text(holder, '', 0, compact ? -24 : -29, compact ? 16 : 18, 87, true));
    }
    const button = createUiNode('ClaimButton');
    this.node.addChild(button);
    ensureTransform(button, 144, 32);
    button.setPosition(0, -height / 2 + (compact ? 23 : 43), 0);
    this.buttonG = button.addComponent(Graphics);
    this.buttonLabel = text(button, '还差一点', 0, 0, 18, 132, true);
    if (!compact) {
      text(this.node, ['一起喝杯下午茶', '给特别的你', '今天也要浪漫呀'][index % 3], 0, -height / 2 + 12, 17, width - 20);
    }
    // The whole order card is a generous delivery target, with one handler.
    this.node.addComponent(Button);
    this.node.on(Button.EventType.CLICK, () => { if (this.uid) this.onClaim.callback(this.uid); });
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
      holder.setPosition(count === 1 ? 0 : i === 0 ? -52 : 52, this.height < 190 ? -4 : 4, 0);
      const art = itemArt(req.itemId);
      this.itemNames[i].string = req.displayName;
      this.itemNames[i].node.active = true;
      if (art) applyArt(this.icons[i], { ...art, preserveAspect: true }, this.height < 190 ? 58 : 66, this.height < 190 ? 46 : 54,
        (ready) => { this.itemNames[i].node.active = !ready; });
      this.reqLabels[i].string = `${req.done ? '✓ ' : ''}${req.have}/${req.count}`;
      this.reqLabels[i].color = req.done ? CocosTheme.ok() : CocosTheme.textPrimary();
    }
    this.buttonLabel.string = vm.ready ? '交付订单' : '还差一点';
    this.buttonLabel.color = vm.ready ? hexColor('#FFFFFF') : CocosTheme.textSecondary();
    paintRoundRect(this.buttonG, 144, 32, 16, vm.ready ? CocosTheme.primary() : hexColor('#F5E4DE'));
  }

  destroy(): void {
    this.node.destroy();
  }
}
