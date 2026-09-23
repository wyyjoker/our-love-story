/**
 * CocosStatusBar — Lv / XP / energy countdown / coins / hearts (text labels, no emoji).
 */
import { Node, Label, Graphics, tween, Vec3 } from 'cc';
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
    const cardW = width - 24;
    const cardH = height - 8;
    ensureTransform(card, cardW, cardH);
    const g = card.addComponent(Graphics);
    paintRoundRect(g, cardW, cardH, 16, CocosTheme.surface(), CocosTheme.border());

    const level = makeLabel('Lv.1', 22, CocosTheme.textPrimary(), true);
    this.node.addChild(level.node);
    level.node.setPosition(-cardW / 2 + 48, 6, 0);
    this.levelLabel = level;

    const barNode = createUiNode('XpBar');
    this.node.addChild(barNode);
    this.barBgW = Math.min(180, cardW * 0.32);
    ensureTransform(barNode, this.barBgW, 10);
    barNode.setPosition(-10, 14, 0);
    const bgG = barNode.addComponent(Graphics);
    paintRoundRect(bgG, this.barBgW, 10, 5, CocosTheme.border());
    const fillNode = createUiNode('XpFill');
    barNode.addChild(fillNode);
    ensureTransform(fillNode, this.barBgW, 10);
    this.xpBar = fillNode.addComponent(Graphics);
    paintRoundRect(this.xpBar, this.barBgW, 10, 5, CocosTheme.primary());

    this.xpLabel = makeLabel('XP 0 / 30', 14, CocosTheme.textSecondary());
    this.node.addChild(this.xpLabel.node);
    this.xpLabel.node.setPosition(-10, -10, 0);

    this.energyLabel = makeLabel('体力 50/50', 16, CocosTheme.textPrimary(), true);
    this.node.addChild(this.energyLabel.node);
    this.energyLabel.node.setPosition(cardW * 0.16, 8, 0);

    this.energyCdLabel = makeLabel('', 12, CocosTheme.textSecondary());
    this.node.addChild(this.energyCdLabel.node);
    this.energyCdLabel.node.setPosition(cardW * 0.16, -14, 0);

    this.coinsLabel = makeLabel('金币 0', 16, CocosTheme.textPrimary());
    this.node.addChild(this.coinsLabel.node);
    this.coinsLabel.node.setPosition(cardW * 0.34, 0, 0);

    this.heartsLabel = makeLabel('爱心 0', 16, CocosTheme.primary());
    this.node.addChild(this.heartsLabel.node);
    this.heartsLabel.node.setPosition(cardW * 0.46, 0, 0);
  }

  render(vm: StatusVm): void {
    this.levelLabel.string = `Lv.${vm.level}`;
    this.xpLabel.string = vm.xpText;
    this.energyLabel.string = `体力 ${vm.energyText}`;
    this.energyCdLabel.string = vm.energyCountdownText;
    this.coinsLabel.string = `金币 ${vm.coinsText}`;
    this.heartsLabel.string = `爱心 ${vm.heartsText}`;
    const w = Math.max(2, this.barBgW * vm.xpRatio);
    paintRoundRect(this.xpBar, w, 10, 5, CocosTheme.primary());
  }

  pulseEnergy(): void {
    tween(this.energyLabel.node)
      .to(0.08, { scale: new Vec3(1.1, 1.1, 1) })
      .to(0.1, { scale: new Vec3(1, 1, 1) })
      .start();
  }
}
