import { RewardPalette } from './CocosRewardEffects';
import type { GeneratorDefinition, LevelReward } from '../../core/types';
import { Button, Graphics, Label, Node, Tween, tween, Vec3 } from 'cc';
import { applyArt, applyMaterialFrame, generatorArt } from './CocosArt';
import { CocosTheme, createUiNode, ensureTransform, hexColor, makeLabel, paintRoundRect, paintTactileButton, pressButton } from './CocosTheme';

export class CocosLevelUpView {
  readonly node: Node;
  private card: Node;
  private levelLabel: Label;
  private descLabel: Label;
  private rewardLabels: Label[] = [];
  private rewardCaptions: Label[] = [];
  private icon: Node;
  private claim: Node;
  private onClaim: (() => void) | null = null;
  private readonly baseScale: number;

  get isShowing(): boolean { return this.node.active; }

  constructor(parent: Node, width: number, height: number) {
    this.baseScale = Math.min(1, (height - 70) / 860, (width - 40) / 660);
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
    ensureTransform(this.card, 630, 790);
    paintRoundRect(this.card.addComponent(Graphics), 630, 790, 38, hexColor(RewardPalette.paper), hexColor(RewardPalette.edge), 1.5);
    applyMaterialFrame(this.card,'paper',630,790,.70);
    const ribbon = createUiNode('RewardRibbon');
    this.card.addChild(ribbon);
    ribbon.setPosition(0, 310, 0);
    paintRoundRect(ribbon.addComponent(Graphics), 540, 90, 28, hexColor('#F6E0DE'));
    const title = makeLabel('升级啦！', 44, hexColor(RewardPalette.ink), true);
    ribbon.addChild(title.node);
    ensureTransform(title.node, 530, 84);
    const crown = createUiNode('RewardCrown');
    this.card.addChild(crown);
    crown.setPosition(0, 392, 0);
    const crownG = crown.addComponent(Graphics);
    crownG.fillColor = hexColor('#DFBB7B');
    crownG.strokeColor = hexColor('#FFF7DF');
    crownG.lineWidth = 3;
    crownG.moveTo(-30, -12); crownG.lineTo(-40, 12); crownG.lineTo(-18, 4); crownG.lineTo(0, 28); crownG.lineTo(18, 4); crownG.lineTo(40, 12); crownG.lineTo(30, -12); crownG.close(); crownG.fill(); crownG.stroke();

    this.levelLabel = makeLabel('Lv.2', 37, CocosTheme.textPrimary(), true);
    this.card.addChild(this.levelLabel.node);
    ensureTransform(this.levelLabel.node, 520, 58);
    this.levelLabel.node.setPosition(0, 213, 0);

    const glow = createUiNode('GeneratorGlow');
    this.card.addChild(glow);
    glow.setPosition(0, 20, 0);
    const glowG = glow.addComponent(Graphics);
    glowG.fillColor = hexColor('#F5E1D6', 140);
    glowG.circle(0, 0, 123); glowG.fill();
    for (let i = 0; i < 12; i += 1) {
      const angle = i * Math.PI / 6;
      const x = Math.cos(angle) * 164;
      const y = Math.sin(angle) * 128;
      glowG.fillColor = hexColor(i % 2 ? '#E0AEB4' : '#DABB83', 190);
      glowG.moveTo(x, y + 7); glowG.lineTo(x + 4, y); glowG.lineTo(x, y - 7); glowG.lineTo(x - 4, y); glowG.close(); glowG.fill();
    }

    this.icon = createUiNode('UnlockedGenerator');
    this.card.addChild(this.icon);
    this.icon.setPosition(0, 20, 0);

    this.descLabel = makeLabel('', 27, hexColor('#8B5358'), true);
    this.card.addChild(this.descLabel.node);
    ensureTransform(this.descLabel.node, 530, 50);
    this.descLabel.node.setPosition(0, 164, 0);

    const note = makeLabel('另赠宝箱和生成器 · 可在「补给与签到」查看', 22, hexColor('#AE7471'));
    this.card.addChild(note.node);
    ensureTransform(note.node, 570, 38);
    note.node.setPosition(0, -122, 0);
    ['金币', '爱心', '经验'].forEach((name, index) => {
      const tile = createUiNode(`Reward_${name}`);
      this.card.addChild(tile);
      tile.setPosition(-182 + index * 182, -209, 0);
      paintRoundRect(tile.addComponent(Graphics), 164, 106, 22, hexColor('#F8EBE3'));
      const value = makeLabel('', 28, hexColor(index === 1 ? '#D46A87' : '#945C3C'), true);
      tile.addChild(value.node);
      ensureTransform(value.node, 156, 46);
      value.node.setPosition(0, 15, 0);
      this.rewardLabels.push(value);
      const caption = makeLabel(name, 21, hexColor('#8E6A5B'));
      tile.addChild(caption.node);
      ensureTransform(caption.node, 150, 34);
      caption.node.setPosition(0, -29, 0);
      this.rewardCaptions.push(caption);
    });

    this.claim = createUiNode('ClaimLevelReward');
    this.card.addChild(this.claim);
    ensureTransform(this.claim, 400, 76);
    this.claim.setPosition(0, -325, 0);
    paintTactileButton(this.claim.addComponent(Graphics),400,76,'rose');
    const caption = makeLabel('领取这份心意  ♥', 28, CocosTheme.surface(), true);
    this.claim.addChild(caption.node);
    ensureTransform(caption.node, 370, 66);
    pressButton(this.claim);
    this.claim.on(Button.EventType.CLICK, () => {
      const callback = this.onClaim;
      this.onClaim = null;
      this.node.active = false;
      callback?.();
    });
  }

  rewardOrigin(): Vec3 { return this.claim.worldPosition.clone(); }

  show(level: number, unlocked: Pick<GeneratorDefinition, 'id' | 'displayName'> | undefined, reward: LevelReward, onClaim: () => void, giftName?: string): void {
    this.onClaim = onClaim;
    this.levelLabel.string = `Lv.${level}`;
    this.descLabel.string = unlocked ? `${unlocked.displayName} 已解锁`
      : giftName && reward.generator ? `进阶礼包 · Lv.${reward.generator.level} ${giftName}` : '又靠近我们的浪漫小屋一步';
    const generatorId = unlocked?.id ?? reward.generator?.generatorId;
    const art = (generatorId && generatorArt(generatorId)) || { sheet: 'game_icon' };
    this.icon.active = true;
    applyArt(this.icon, { ...art, preserveAspect: true }, 250, 216);
    this.rewardLabels[0].string = `◉ +${reward.coins}`;
    this.rewardLabels[1].string = `♥ +${reward.hearts}`;
    this.rewardLabels[2].string = reward.xp > 0 ? `✦ +${reward.xp}` : '×1';
    this.rewardCaptions[2].string = reward.xp > 0 ? '经验' : '宝箱';
    this.node.active = true;
    Tween.stopAllByTarget(this.card);
    this.card.setScale(0.88 * this.baseScale, 0.88 * this.baseScale, 1);
    tween(this.card).to(0.16, { scale: new Vec3(1.03 * this.baseScale, 1.03 * this.baseScale, 1) }).to(0.1, { scale: new Vec3(this.baseScale, this.baseScale, 1) }).start();
  }
}
