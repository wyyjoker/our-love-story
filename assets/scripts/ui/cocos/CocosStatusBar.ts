/**
 * CocosStatusBar — Lv / XP / energy countdown / coins / hearts.
 * Event-driven refresh only.
 */
import { Node, Label, Graphics, UIOpacity, tween, Vec3 } from 'cc';
import type { StatusVm } from '../../presentation/GameViewMapper';
import {
  CocosTheme,
  createUiNode,
  ensureTransform,
  makeLabel,
  paintRoundRect,
} from './CocosTheme';

export class CocosStatusBar {
  readonly node: Node;
  private levelLabel!: Label;
  private xpLabel!: Label;
  private xpBar!: Graphics;
  private energyLabel!: Label;
  private energyCdLabel!: Label;
  private coinsLabel!: Label;
  private heartsLabel!: Label;
  private barBgW = 160;

  constructor(parent: Node, width: number, height: number) {
    this.node = createUiNode('StatusBarView');
    parent.addChild(this.node);
    ensureTransform(this.node, width, height, 0.5, 0.5);
    this.build(width, height);
  }

  private build(width: number, height: number): void {
    const card = createUiNode('Card');
    this.node.addChild(card);
    const pad = 12;
    const cardW = width - 24;
    const cardH = height - 8;
    ensureTransform(card, cardW, cardH);
    const g = card.addComponent(Graphics);
    paintRoundRect(g, cardW, cardH, 16, CocosTheme.surface(), CocosTheme.border());

    const level = makeLabel('Lv.1', 22, CocosTheme.surface(), true);
    this.node.addChild(level.node);
    level.node.setPosition(-cardW / 2 + 48, 0, 0);
    this.levelLabel = level;

    // xp track
    const barNode = createUiNode('XpBar');
    this.node.addChild(barNode);
    this.barBgW = Math.min(180, cardW * 0.35);
    ensureTransform(barNode, this.barBgW, 10);
    barNode.setPosition(-20, 8, 0);
    const bgG = barNode.addComponent(Graphics);
    paintRoundRect(bgG, this.barBgW, 10, 5, CocosTheme.border());
    const fillNode = createUiNode('XpFill');
    barNode.addChild(fillNode);
    ensureTransform(fillNode, this.barBgW, 10);
    this.xpBar = fillNode.addComponent(Graphics);
    paintRoundRect(this.xpBar, this.barBgW, 10, 5, CocosTheme.primary());

    this.xpLabel = makeLabel('XP 0 / 30', 14, CocosTheme.textSecondary());
    this.node.addChild(this.xpLabel.node);
    this.xpLabel.node.setPosition(-20, -12, 0);

    this.energyLabel = makeLabel('⚡ 50/50', 18, CocosTheme.textPrimary(), true);
    this.node.addChild(this.energyLabel.node);
    this.energyLabel.node.setPosition(cardW * 0.18, 0, 0);

    this.energyCdLabel = makeLabel('', 12, CocosTheme.textSecondary());
    this.node.addChild(this.energyCdLabel.node);
    this.energyCdLabel.node.setPosition(cardW * 0.18, -16, 0);

    this.coinsLabel = makeLabel('💰 0', 18, CocosTheme.textPrimary());
    this.node.addChild(this.coinsLabel.node);
    this.coinsLabel.node.setPosition(cardW * 0.36, 0, 0);

    this.heartsLabel = makeLabel('♥ 0', 18, CocosTheme.primary());
    this.node.addChild(this.heartsLabel.node);
    this.heartsLabel.node.setPosition(cardW * 0.48, 0, 0);
    void pad;
  }

  render(vm: StatusVm): void {
    this.levelLabel.string = `Lv.${vm.level}`;
    this.xpLabel.string = vm.xpText;
    this.energyLabel.string = `⚡ ${vm.energyText}`;
    this.energyCdLabel.string = vm.energyCountdownText;
    this.coinsLabel.string = `💰 ${vm.coinsText}`;
    this.heartsLabel.string = `♥ ${vm.heartsText}`;
    const w = Math.max(2, this.barBgW * vm.xpRatio);
    paintRoundRect(this.xpBar, w, 10, 5, CocosTheme.primary());
  }

  pulseEnergy(): void {
    tween(this.energyLabel.node)
      .to(0.08, { scale: new Vec3(1.1, 1.1, 1) })
      .to(0.1, { scale: new Vec3(1, 1, 1) })
      .start();
  }

  flash(): void {
    const op = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
    op.opacity = 200;
    tween(op).to(0.15, { opacity: 255 }).start();
  }
}
