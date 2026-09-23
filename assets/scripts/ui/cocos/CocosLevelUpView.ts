import { Button, Graphics, Label, Node, tween, Vec3 } from 'cc';
import { applyArt, generatorArt } from './CocosArt';
import { CocosTheme, createUiNode, ensureTransform, hexColor, makeLabel, paintRoundRect } from './CocosTheme';

export class CocosLevelUpView {
  readonly node: Node;
  private card: Node;
  private levelLabel: Label;
  private descLabel: Label;
  private rewardLabel: Label;
  private icon: Node;
  private claim: Node;
  private onClaim: (() => void) | null = null;

  get isShowing(): boolean { return this.node.active; }

  constructor(parent: Node, width: number, height: number) {
    this.node = createUiNode('LevelUpView');
    parent.addChild(this.node);
    ensureTransform(this.node, width, height);
    this.node.active = false;

    const shade = createUiNode('Dimmer');
    this.node.addChild(shade);
    ensureTransform(shade, width, height);
    paintRoundRect(shade.addComponent(Graphics), width, height, 0, hexColor('#4B3D43', 150));
    shade.addComponent(Button);

    this.card = createUiNode('LevelRewardCard');
    this.node.addChild(this.card);
    ensureTransform(this.card, 590, 650);
    paintRoundRect(this.card.addComponent(Graphics), 590, 650, 30, CocosTheme.surface(), CocosTheme.primary(), 3);
    const title = makeLabel('升级啦！', 54, hexColor('#D9667B'), true);
    this.card.addChild(title.node);
    ensureTransform(title.node, 530, 75);
    title.node.setPosition(0, 245, 0);

    this.levelLabel = makeLabel('Lv.2', 37, CocosTheme.textPrimary(), true);
    this.card.addChild(this.levelLabel.node);
    ensureTransform(this.levelLabel.node, 520, 58);
    this.levelLabel.node.setPosition(0, 171, 0);

    this.icon = createUiNode('UnlockedGenerator');
    this.card.addChild(this.icon);
    this.icon.setPosition(0, 20, 0);

    this.descLabel = makeLabel('', 27, hexColor('#8B5358'), true);
    this.card.addChild(this.descLabel.node);
    ensureTransform(this.descLabel.node, 530, 50);
    this.descLabel.node.setPosition(0, -102, 0);

    this.rewardLabel = makeLabel('', 22, CocosTheme.textPrimary(), true);
    this.card.addChild(this.rewardLabel.node);
    ensureTransform(this.rewardLabel.node, 540, 98);
    this.rewardLabel.node.setPosition(0, -174, 0);

    this.claim = createUiNode('ClaimLevelReward');
    this.card.addChild(this.claim);
    ensureTransform(this.claim, 350, 72);
    this.claim.setPosition(0, -270, 0);
    paintRoundRect(this.claim.addComponent(Graphics), 350, 72, 30, CocosTheme.primary());
    const caption = makeLabel('太棒了！  ♥', 29, CocosTheme.surface(), true);
    this.claim.addChild(caption.node);
    ensureTransform(caption.node, 320, 64);
    this.claim.addComponent(Button);
    this.claim.on(Button.EventType.CLICK, () => {
      const callback = this.onClaim;
      this.onClaim = null;
      this.node.active = false;
      callback?.();
    });
  }

  show(level: number, unlockedChains: string[], reward: { coins: number; hearts: number; xp: number }, onClaim: () => void): void {
    this.onClaim = onClaim;
    this.levelLabel.string = `Lv.${level}`;
    const unlocked = unlockedChains[0];
    const names: Record<string, string> = { coffee: '咖啡机', flower: '花篮', dessert: '甜品烤箱', gift: '礼物盒' };
    this.descLabel.string = unlocked ? `${names[unlocked] ?? unlocked} 已解锁` : '又靠近我们的浪漫小屋一步';
    const generatorId: Record<string, string> = { coffee: 'coffee_machine', flower: 'flower_basket', dessert: 'dessert_oven', gift: 'gift_box' };
    const art = unlocked ? generatorArt(generatorId[unlocked]) : null;
    this.icon.active = !!art;
    if (art) applyArt(this.icon, art, 230, 190);
    this.rewardLabel.string = `金币 +${reward.coins}    爱心 +${reward.hearts}\n经验 +${reward.xp}`;
    this.node.active = true;
    this.card.setScale(0.88, 0.88, 1);
    tween(this.card).to(0.16, { scale: new Vec3(1.05, 1.05, 1) }).to(0.1, { scale: new Vec3(1, 1, 1) }).start();
  }
}
