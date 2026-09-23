/**
 * CocosLevelUpView — short modal for LEVEL UP + unlock text.
 */
import { Node, Label, Graphics, UIOpacity, tween, Vec3 } from 'cc';
import {
  CocosTheme,
  createUiNode,
  ensureTransform,
  ensureOpacity,
  makeLabel,
  paintRoundRect,
} from './CocosTheme';

export class CocosLevelUpView {
  readonly node: Node;
  private card: Node;
  private titleLabel: Label;
  private levelLabel: Label;
  private descLabel: Label;

  constructor(parent: Node, width: number, height: number) {
    this.node = createUiNode('LevelUpView');
    parent.addChild(this.node);
    ensureTransform(this.node, width, height);
    this.node.active = false;

    this.card = createUiNode('Card');
    this.node.addChild(this.card);
    ensureTransform(this.card, 420, 240);
    const g = this.card.addComponent(Graphics);
    paintRoundRect(g, 420, 240, 24, CocosTheme.surface(), CocosTheme.border());
    ensureOpacity(this.card);

    this.titleLabel = makeLabel('LEVEL UP', 14, CocosTheme.textSecondary(), true);
    this.card.addChild(this.titleLabel.node);
    this.titleLabel.node.setPosition(0, 70, 0);

    this.levelLabel = makeLabel('Lv.2', 40, CocosTheme.primary(), true);
    this.card.addChild(this.levelLabel.node);
    this.levelLabel.node.setPosition(0, 20, 0);

    this.descLabel = makeLabel('', 16, CocosTheme.textPrimary());
    this.card.addChild(this.descLabel.node);
    this.descLabel.node.setPosition(0, -40, 0);
    void height;
  }

  show(level: number, unlockedChains: string[]): void {
    const names = unlockedChains.map((c) => {
      const map: Record<string, string> = {
        coffee: '咖啡',
        flower: '花艺',
        dessert: '甜品烤箱',
        gift: '礼物盒',
      };
      return map[c] ?? c;
    });
    this.levelLabel.string = `Lv.${level}`;
    this.descLabel.string = names.length
      ? `${names.join('、')}已解锁！`
      : '解锁新内容';
    this.node.active = true;
    this.card.setScale(0.9, 0.9, 1);
    tween(this.card)
      .to(0.15, { scale: new Vec3(1.05, 1.05, 1) })
      .to(0.1, { scale: new Vec3(1, 1, 1) })
      .delay(1.1)
      .call(() => {
        this.node.active = false;
      })
      .start();
    void (0 as unknown as UIOpacity);
  }
}
