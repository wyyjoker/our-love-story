import { Button, Graphics, Label, Node, tween, Vec3 } from 'cc';
import type { StatusVm } from '../../presentation/GameViewMapper';
import { CocosTheme, createUiNode, ensureTransform, hexColor, makeLabel, paintRoundRect } from './CocosTheme';

function text(parent: Node, value: string, x: number, y: number, fontSize: number, width: number, color = CocosTheme.textPrimary(), bold = false): Label {
  const label = makeLabel(value, fontSize, color, bold);
  parent.addChild(label.node);
  ensureTransform(label.node, width, fontSize + 8);
  label.overflow = Label.Overflow.SHRINK;
  label.node.setPosition(x, y, 0);
  return label;
}

export class CocosStatusBar {
  readonly node: Node;
  private levelLabel!: Label;
  private xpLabel!: Label;
  private xpBar!: Graphics;
  private energyLabel!: Label;
  private energyCdLabel!: Label;
  private coinsLabel!: Label;
  private heartsLabel!: Label;
  private readonly xpWidth = 146;

  constructor(parent: Node, width: number, height: number, onResourceTip?: (kind: 'energy' | 'coins' | 'hearts') => void) {
    this.node = createUiNode('StatusBarView');
    parent.addChild(this.node);
    ensureTransform(this.node, width, height);
    this.build(width, onResourceTip);
  }

  private build(width: number, onResourceTip?: (kind: 'energy' | 'coins' | 'hearts') => void): void {
    const leftX = -width / 2 + 100;
    const rightX = width / 2 - 100;
    const levelCard = createUiNode('LevelCard');
    this.node.addChild(levelCard);
    ensureTransform(levelCard, 188, 106);
    levelCard.setPosition(leftX, 0, 0);
    paintRoundRect(levelCard.addComponent(Graphics), 188, 106, 25, hexColor('#FFFAF3', 235), hexColor('#F2DCD3'), 2);
    text(levelCard, '⌂', -69, 20, 32, 34, hexColor('#CE817B'), true);
    this.levelLabel = text(levelCard, 'Lv.1', 5, 19, 29, 100, hexColor('#60423D'), true);
    const bar = createUiNode('XpBar');
    levelCard.addChild(bar);
    ensureTransform(bar, this.xpWidth, 14);
    bar.setPosition(0, -16, 0);
    paintRoundRect(bar.addComponent(Graphics), this.xpWidth, 14, 7, hexColor('#E8DBD6'));
    const fill = createUiNode('XpFill');
    bar.addChild(fill);
    ensureTransform(fill, this.xpWidth, 14);
    this.xpBar = fill.addComponent(Graphics);
    this.xpLabel = text(levelCard, '0/50', 0, -38, 16, 130, hexColor('#8E6D68'));

    const title = createUiNode('Title');
    this.node.addChild(title);
    ensureTransform(title, 310, 110);
    text(title, '我们的浪漫小屋', 0, 24, 37, 310, hexColor('#68423A'), true);
    text(title, 'Our Love Story  ♡', 0, -12, 23, 300, hexColor('#D68B91'));
    text(title, '把每一个平凡的日子 · 拼成浪漫的家', 0, -43, 15, 310, hexColor('#A6756E'));

    const right = createUiNode('Resources');
    this.node.addChild(right);
    ensureTransform(right, 188, 115);
    right.setPosition(rightX, 0, 0);
    const rows: Array<{ y: number; icon: string; kind: 'energy' | 'coins' | 'hearts'; color: string }> = [
      { y: 39, icon: '⚡', kind: 'energy', color: '#EFB348' },
      { y: 0, icon: '★', kind: 'coins', color: '#E8AD46' },
      { y: -39, icon: '♥', kind: 'hearts', color: '#E77789' },
    ];
    for (const row of rows) {
      const pill = createUiNode(`${row.kind}Pill`);
      right.addChild(pill);
      ensureTransform(pill, 188, 36);
      pill.setPosition(0, row.y, 0);
      paintRoundRect(pill.addComponent(Graphics), 188, 36, 18, hexColor('#FFF9F3', 240), hexColor('#EADBD4'), 1);
      text(pill, row.icon, -76, 0, 27, 32, hexColor(row.color), true);
      const plus = createUiNode(`${row.kind}Plus`);
      pill.addChild(plus);
      ensureTransform(plus, 36, 36);
      plus.setPosition(77, 0, 0);
      paintRoundRect(plus.addComponent(Graphics), 36, 36, 18, hexColor('#7A9D74'));
      text(plus, '+', 0, 0, 29, 32, hexColor('#FFFFFF'), true);
      plus.addComponent(Button);
      plus.on(Button.EventType.CLICK, () => onResourceTip?.(row.kind));
    }
    this.energyLabel = text(right, '100/100', 8, 39, 20, 118, hexColor('#60423D'), true);
    this.coinsLabel = text(right, '0', 8, 0, 20, 118, hexColor('#60423D'), true);
    this.heartsLabel = text(right, '0', 8, -39, 20, 118, hexColor('#60423D'), true);
    this.energyCdLabel = text(right, '', 6, 23, 11, 90, hexColor('#977A71'));
  }

  render(vm: StatusVm): void {
    this.levelLabel.string = `Lv.${vm.level}`;
    this.xpLabel.string = vm.xpText.replace(/^XP /, '');
    this.energyLabel.string = vm.energyText;
    this.energyCdLabel.string = vm.energyCountdownText;
    this.coinsLabel.string = vm.coinsText;
    this.heartsLabel.string = vm.heartsText;
    paintRoundRect(this.xpBar, Math.max(2, this.xpWidth * vm.xpRatio), 14, 7, hexColor('#E88694'));
  }

  pulseEnergy(): void {
    tween(this.energyLabel.node)
      .to(0.08, { scale: new Vec3(1.08, 1.08, 1) })
      .to(0.1, { scale: new Vec3(1, 1, 1) })
      .start();
  }
}
