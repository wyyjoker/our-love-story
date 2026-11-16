import { Button, Graphics, Label, Node, Tween, tween, Vec3 } from 'cc';
import type { StatusVm } from '../../presentation/GameViewMapper';
import { CocosTheme, createUiNode, ensureTransform, hexColor, makeLabel, paintRoundRect } from './CocosTheme';
import { applyArt } from './CocosArt';
import { RewardArrivalLedger, type RewardAmounts, type RewardKind } from './RewardUiMath';

type ResourceKind = 'energy' | 'coins' | 'diamonds' | 'hearts';

function text(parent: Node, value: string, x: number, y: number, fontSize: number, width: number, color = CocosTheme.textPrimary(), bold = false): Label {
  const label = makeLabel(value, fontSize, color, bold);
  parent.addChild(label.node);
  ensureTransform(label.node, width, fontSize + 8);
  label.overflow = Label.Overflow.SHRINK;
  label.node.setPosition(x, y, 0);
  return label;
}

export class CocosStatusBar {
  private readonly arrivals = new RewardArrivalLedger();
  private latestVm: StatusVm | null = null;
  private heldXp: StatusVm | null = null;
  readonly node: Node;
  private levelLabel!: Label;
  private xpLabel!: Label;
  private xpBar!: Graphics;
  private energyLabel!: Label;
  private energyCdLabel!: Label;
  private coinsLabel!: Label;
  private heartsLabel!: Label;
  private diamondsLabel!: Label;
  private checkInLabel: Label | null = null;
  private checkInDot: Node | null = null;
  private sectionLabel!: Label;
  private readonly xpWidth = 146;

  constructor(parent: Node, width: number, height: number, onResourceTip?: (kind: ResourceKind) => void, demoPreview = false, onSettings?: () => void, onCheckIn?: () => void) {
    this.node = createUiNode('StatusBarView');
    parent.addChild(this.node);
    ensureTransform(this.node, width, height);
    this.build(width, onResourceTip, demoPreview, onSettings, onCheckIn);
  }

  private build(width: number, onResourceTip?: (kind: ResourceKind) => void, demoPreview = false, onSettings?: () => void, onCheckIn?: () => void): void {
    const leftX = -width / 2 + 100;
    const rightX = width / 2 - 116;
    paintRoundRect(this.node.addComponent(Graphics), width, 124, 24, hexColor('#FFF8F0', 241), hexColor('#EADBD0'), 1);
    const levelCard = createUiNode('LevelCard');
    this.node.addChild(levelCard);
    ensureTransform(levelCard, 188, 116);
    levelCard.setPosition(leftX, 0, 0);
    paintRoundRect(levelCard.addComponent(Graphics), 188, 116, 25, hexColor('#FFFAF3', 245), hexColor('#F2DCD3'), 2);
    const home = createUiNode('HomeBrandIcon');
    levelCard.addChild(home);
    home.setPosition(-66, 29, 0);
    applyArt(home, { sheet: 'game_icon', preserveAspect: true }, 50, 50);
    this.levelLabel = text(levelCard, 'Lv.1', 5, 29, 29, 100, hexColor('#60423D'), true);
    const bar = createUiNode('XpBar');
    levelCard.addChild(bar);
    ensureTransform(bar, this.xpWidth, 14);
    bar.setPosition(0, -5, 0);
    paintRoundRect(bar.addComponent(Graphics), this.xpWidth, 14, 7, hexColor('#E8DBD6'));
    const fill = createUiNode('XpFill');
    bar.addChild(fill);
    ensureTransform(fill, this.xpWidth, 14);
    this.xpBar = fill.addComponent(Graphics);
    this.xpLabel = text(levelCard, '0/50', 0, -23, 16, 130, hexColor('#8E6D68'));
    const hearts = createUiNode('LevelHearts');
    levelCard.addChild(hearts);
    ensureTransform(hearts, 160, 28);
    hearts.setPosition(0, -42, 0);
    text(hearts, '♥', -39, 0, 23, 28, hexColor('#E77789'), true);
    this.heartsLabel = text(hearts, '0', 22, 0, 21, 92, hexColor('#A65B69'), true);
    this.heartsLabel.node.name = 'HeartsValue';
    hearts.addComponent(Button);
    hearts.on(Button.EventType.CLICK, () => onResourceTip?.('hearts'));

    const title = createUiNode('Title');
    this.node.addChild(title);
    ensureTransform(title, 270, 116); title.setPosition(-20, 0, 0);
    this.sectionLabel = text(title, '合成小屋', 0, 27, 29, 254, hexColor('#68423A'), true);
    if (onCheckIn) {
      const daily = createUiNode('DailyCheckInButton'); title.addChild(daily);
      ensureTransform(daily, 176, 48); daily.setPosition(-28, -29, 0);
      paintRoundRect(daily.addComponent(Graphics), 176, 48, 22, hexColor('#FFF2DC'), hexColor('#E8CDA4'), 1);
      const calendar = createUiNode('CheckInCalendar'); daily.addChild(calendar); calendar.setPosition(-62, 0, 0);
      const ink = calendar.addComponent(Graphics); ink.lineWidth = 2.5; ink.strokeColor = hexColor('#B58058');
      ink.roundRect(-12, -12, 24, 24, 4); ink.moveTo(-12, 5); ink.lineTo(12, 5);
      ink.moveTo(-6, 10); ink.lineTo(-6, 16); ink.moveTo(6, 10); ink.lineTo(6, 16);
      ink.moveTo(-5, -3); ink.lineTo(-1, -7); ink.lineTo(7, 1); ink.stroke();
      this.checkInLabel = text(daily, '每日签到', 10, 0, 22, 126, hexColor('#9E704E'), true);
      this.checkInDot = createUiNode('CheckInAvailable'); daily.addChild(this.checkInDot); this.checkInDot.setPosition(75, 18, 0);
      const dot = this.checkInDot.addComponent(Graphics); dot.fillColor = hexColor('#E17A8E'); dot.circle(0, 0, 7); dot.fill();
      daily.addComponent(Button); daily.on(Button.EventType.CLICK, onCheckIn);
    } else text(title, demoPreview ? '演示存档 · 不保存进度' : '我们的浪漫小屋  ♡', -8, -22, 18, 260, hexColor('#B37678'));
    if (onSettings) {
      const settings = createUiNode('SettingsButton');
      title.addChild(settings);
      ensureTransform(settings, 52, 52);
      settings.setPosition(105, -29, 0);
      paintRoundRect(settings.addComponent(Graphics), 44, 44, 20, hexColor('#FFF9F3'), hexColor('#EADBD4'), 1);
      text(settings, '⚙', 0, 0, 26, 40, hexColor('#805A50'), true);
      settings.addComponent(Button);
      settings.on(Button.EventType.CLICK, onSettings);
    }

    const right = createUiNode('Resources');
    this.node.addChild(right);
    ensureTransform(right, 220, 116);
    right.setPosition(rightX, 0, 0);
    const rows: Array<{ y: number; icon: string; kind: Exclude<ResourceKind, 'hearts'>; color: string }> = [
      { y: 39, icon: '⚡', kind: 'energy', color: '#EFB348' },
      { y: 0, icon: '★', kind: 'coins', color: '#E8AD46' },
      { y: -39, icon: '◆', kind: 'diamonds', color: '#9A84CB' },
    ];
    for (const row of rows) {
      const pill = createUiNode(`${row.kind}Pill`);
      right.addChild(pill);
      ensureTransform(pill, 220, 36);
      pill.setPosition(0, row.y, 0);
      paintRoundRect(pill.addComponent(Graphics), 220, 36, 18, hexColor('#FFF9F3', 240), hexColor('#EADBD4'), 1);
      if (row.kind === 'diamonds') {
        const gem = createUiNode('DiamondIcon'); pill.addChild(gem);
        gem.setPosition(-92, 0, 0);
        ensureTransform(gem, 34, 30);
        const facets = gem.addComponent(Graphics); facets.lineWidth = 1.5;
        facets.fillColor = hexColor('#C9B3EB'); facets.strokeColor = hexColor('#9275BD');
        facets.moveTo(-15, 5); facets.lineTo(-8, 13); facets.lineTo(8, 13); facets.lineTo(15, 5); facets.lineTo(0, -14); facets.close(); facets.fill(); facets.stroke();
        facets.moveTo(-15, 5); facets.lineTo(15, 5); facets.moveTo(-5, 5); facets.lineTo(0, -14); facets.lineTo(5, 5);
        facets.moveTo(-8, 13); facets.lineTo(-5, 5); facets.lineTo(5, 5); facets.lineTo(8, 13); facets.stroke();
      } else text(pill, row.icon, -92, 0, 27, 32, hexColor(row.color), true);
      const plus = createUiNode(`${row.kind}Plus`);
      pill.addChild(plus);
      ensureTransform(plus, 44, 38);
      plus.setPosition(94, 0, 0);
      paintRoundRect(plus.addComponent(Graphics), 36, 36, 18, hexColor('#7A9D74'));
      text(plus, '+', 0, 0, 29, 32, hexColor('#FFFFFF'), true);
      plus.addComponent(Button);
      plus.on(Button.EventType.CLICK, () => onResourceTip?.(row.kind));
    }
    this.energyLabel = text(right, '100/100', -1, 39, 23, 148, hexColor('#60423D'), true);
    this.coinsLabel = text(right, '0', -1, 0, 23, 148, hexColor('#60423D'), true);
    this.coinsLabel.node.name = 'CoinsValue';
    this.levelLabel.node.name = 'LevelValue'; this.xpLabel.node.name = 'XpValue';
    this.diamondsLabel = text(right, '0', -1, -39, 23, 148, hexColor('#60423D'), true);
    this.diamondsLabel.node.name = 'DiamondsValue';
    this.energyCdLabel = text(right, '', -1, 25, 11, 90, hexColor('#977A71'));
    ensureTransform(this.energyCdLabel.node, 90, 12);
    this.energyLabel.node.setPosition(-1, 44, 0); ensureTransform(this.energyLabel.node, 148, 24);
  }

  setSectionTitle(title: string): void {
    this.sectionLabel.string = title;
  }

  setCheckInAvailable(available: boolean): void {
    if (this.checkInDot) this.checkInDot.active = available;
    if (this.checkInLabel) this.checkInLabel.string = available ? '每日签到' : '今日已签到';
  }

  render(vm: StatusVm): void {
    this.latestVm = vm;
    vm = { ...vm,
      coinsText: String(Math.max(0, vm.coins - this.arrivals.total('coins'))),
      heartsText: String(Math.max(0, vm.hearts - this.arrivals.total('hearts'))),
      ...(this.arrivals.total('xp') > 0 && this.heldXp ? { level: this.heldXp.level, xpText: this.heldXp.xpText, xpRatio: this.heldXp.xpRatio } : {}),
    };
    this.levelLabel.string = `Lv.${vm.level}`;
    this.xpLabel.string = vm.xpText.replace(/^XP /, '');
    this.energyLabel.string = vm.energyText;
    this.energyCdLabel.string = vm.energyCountdownText;
    this.coinsLabel.string = vm.coinsText;
    this.heartsLabel.string = vm.heartsText;
    this.diamondsLabel.string = vm.diamondsText;
    const filled = Math.max(2, this.xpWidth * vm.xpRatio);
    this.xpBar.node.setPosition((filled - this.xpWidth) / 2, 0, 0);
    paintRoundRect(this.xpBar, filled, 14, 7, hexColor('#E88694'));
  }

  pulseEnergy(): void {
    Tween.stopAllByTarget(this.energyLabel.node);
    tween(this.energyLabel.node)
      .to(0.08, { scale: new Vec3(1.08, 1.08, 1) })
      .to(0.1, { scale: new Vec3(1, 1, 1) })
      .start();
  }

  holdRewards(id: string, amounts: RewardAmounts): void {
    if (this.arrivals.total('xp') === 0 && amounts.xp > 0) this.heldXp = this.latestVm;
    this.arrivals.hold(id, amounts);
  }
  arriveReward(id: string, kind: RewardKind): void {
    const amount = this.arrivals.arrive(id, kind);
    if (this.arrivals.total('xp') === 0) this.heldXp = null;
    if (this.latestVm) this.render(this.latestVm);
    if (!amount) return;
    const node = this.resourceLabel(kind).node; Tween.stopAllByTarget(node); node.setScale(1, 1, 1);
    tween(node).to(0.1, { scale: new Vec3(1.16, 1.16, 1) }).to(0.16, { scale: new Vec3(1, 1, 1) }).start();
  }
  clearRewardHolds(): void {
    this.arrivals.clear(); this.heldXp = null;
    if (this.latestVm) this.render(this.latestVm);
  }
  rewardAnchor(kind: RewardKind): Vec3 { return this.resourceLabel(kind).node.worldPosition.clone(); }
  private resourceLabel(kind: RewardKind): Label { return kind === 'coins' ? this.coinsLabel : kind === 'xp' ? this.xpLabel : this.heartsLabel; }
}
