/**
 * CocosStatusBar — Lv / XP / energy / coins / hearts.
 * Two-row layout to avoid text overlap.
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
    const cardW = width - 20;
    const cardH = height - 10;
    ensureTransform(card, cardW, cardH);
    const g = card.addComponent(Graphics);
    paintRoundRect(g, cardW, cardH, 14, CocosTheme.surface(), CocosTheme.border());

    // Row 1 (top half): Lv | XP bar | energy
    this.levelLabel = makeLabel('Lv.1', 20, CocosTheme.textPrimary(), true);
    this.node.addChild(this.levelLabel.node);
    this.levelLabel.node.setPosition(-cardW / 2 + 44, cardH * 0.2, 0);

    this.barBgW = Math.min(150, cardW * 0.28);
    const barNode = createUiNode('XpBar');
    this.node.addChild(barNode);
    ensureTransform(barNode, this.barBgW, 8);
    barNode.setPosition(-cardW * 0.05, cardH * 0.28, 0);
    const bgG = barNode.addComponent(Graphics);
    paintRoundRect(bgG, this.barBgW, 8, 4, CocosTheme.border());
    const fillNode = createUiNode('XpFill');
    barNode.addChild(fillNode);
    ensureTransform(fillNode, this.barBgW, 8);
    this.xpBar = fillNode.addComponent(Graphics);
    paintRoundRect(this.xpBar, this.barBgW, 8, 4, CocosTheme.primary());

    this.xpLabel = makeLabel('XP 0 / 30', 12, CocosTheme.textSecondary());
    this.node.addChild(this.xpLabel.node);
    this.xpLabel.node.setPosition(-cardW * 0.05, cardH * 0.05, 0);

    this.energyLabel = makeLabel('体力 50/50', 15, CocosTheme.textPrimary(), true);
    this.node.addChild(this.energyLabel.node);
    this.energyLabel.node.setPosition(cardW * 0.28, cardH * 0.22, 0);

    this.energyCdLabel = makeLabel('', 11, CocosTheme.textSecondary());
    this.node.addChild(this.energyCdLabel.node);
    this.energyCdLabel.node.setPosition(cardW * 0.28, cardH * 0.02, 0);

    // Row 2 (bottom): coins | hearts
    this.coinsLabel = makeLabel('金币 0', 14, CocosTheme.textPrimary());
    this.node.addChild(this.coinsLabel.node);
    this.coinsLabel.node.setPosition(-cardW * 0.18, -cardH * 0.22, 0);

    this.heartsLabel = makeLabel('爱心 0', 14, CocosTheme.primary());
    this.node.addChild(this.heartsLabel.node);
    this.heartsLabel.node.setPosition(cardW * 0.18, -cardH * 0.22, 0);
  }

  render(vm: StatusVm): void {
    this.levelLabel.string = `Lv.${vm.level}`;
    this.xpLabel.string = vm.xpText;
    this.energyLabel.string = `体力 ${vm.energyText}`;
    this.energyCdLabel.string = vm.energyCountdownText;
    this.coinsLabel.string = `金币 ${vm.coinsText}`;
    this.heartsLabel.string = `爱心 ${vm.heartsText}`;
    const w = Math.max(2, this.barBgW * vm.xpRatio);
    paintRoundRect(this.xpBar, w, 8, 4, CocosTheme.primary());
  }

  pulseEnergy(): void {
    tween(this.energyLabel.node)
      .to(0.08, { scale: new Vec3(1.08, 1.08, 1) })
      .to(0.1, { scale: new Vec3(1, 1, 1) })
      .start();
  }
}
