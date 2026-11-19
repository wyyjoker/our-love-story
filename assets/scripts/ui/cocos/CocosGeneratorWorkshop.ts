import { BlockInputEvents, Button, Event, Graphics, Label, Node } from 'cc';
import type { GameContext } from '../../gameplay/GameContext';
import type { UiRoots } from './UiFactory';
import { applyArt, applyMaterialFrame, generatorArt, itemArt } from './CocosArt';
import { CocosTheme, createUiNode, ensureTransform, hexColor, makeLabel, paintRoundRect, paintTactileButton, pressButton } from './CocosTheme';


const GENERATORS_PER_PAGE = 5;

function countdown(milliseconds: number): string {
  const seconds = Math.ceil(Math.max(0, milliseconds) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function label(parent: Node, name: string, value: string, x: number, y: number, width: number, height: number, size = 20, bold = false): Label {
  const node = createUiNode(name);
  parent.addChild(node);
  ensureTransform(node, width, height);
  node.setPosition(x, y, 0);
  const result = node.addComponent(Label);
  result.string = value;
  result.fontSize = size;
  result.lineHeight = size + 4;
  result.color = CocosTheme.textPrimary();
  result.isBold = bold;
  result.horizontalAlign = Label.HorizontalAlign.CENTER;
  result.verticalAlign = Label.VerticalAlign.CENTER;
  result.overflow = Label.Overflow.SHRINK;
  return result;
}

function button(parent: Node, name: string, caption: string, x: number, y: number, width: number, height: number, onClick: () => void, enabled = true, fontSize = 20): Node {
  const node = createUiNode(name);
  parent.addChild(node);
  ensureTransform(node, width, height);
  node.setPosition(x, y, 0);
  paintTactileButton(node.addComponent(Graphics),width,height,'cream',enabled);
  label(node, `${name}Label`, caption, 0, 0, width - 12, height - 8, fontSize, true).color = enabled ? hexColor('#704A43') : hexColor('#988F8A');
  pressButton(node);
  node.addComponent(BlockInputEvents);
  node.on(Button.EventType.CLICK, (event: Event) => { event.propagationStopped = true; if (enabled) onClick(); });
  return node;
}

export class CocosGeneratorWorkshop {
  private readonly root: Node;
  private readonly card: Node;
  private readonly content: Node;
  private selectedUid: string | undefined;
  private shopPage = 0;
  constructor(private readonly game: GameContext, roots: UiRoots,
    private readonly feedback: (message: string, success?: boolean) => void,
    private readonly onClose: () => void,
    private readonly onRestore: (id: string) => void,
    private readonly openSupplies: () => void,
    private readonly openBackpack: () => void) {
    this.root = createUiNode('GeneratorWorkshopPanel'); roots.modalLayer.addChild(this.root);
    ensureTransform(this.root, roots.designWidth, roots.designHeight); this.root.addComponent(BlockInputEvents);
    paintRoundRect(this.root.addComponent(Graphics), roots.designWidth, roots.designHeight, 0, hexColor('#362B2B', 178));
    this.card = createUiNode('GeneratorWorkshopCard'); this.root.addChild(this.card); ensureTransform(this.card, 650, 1020);
    const scale = Math.min(1, (roots.designHeight - 32) / 1020, (roots.designWidth - 28) / 650); this.card.setScale(scale, scale, 1);
    paintRoundRect(this.card.addComponent(Graphics), 650, 1020, 28, hexColor('#FFF8F1'), hexColor('#EDD9CD'), 2);
    applyMaterialFrame(this.card, 'paper', 650, 1020);
    button(this.card, 'GeneratorWorkshopCloseButton', '关闭', 253, 461, 100, 64, () => this.close());
    this.content = createUiNode('GeneratorShopContent'); this.card.addChild(this.content); ensureTransform(this.content, 620, 880); this.content.setPosition(0,-22,0);
    this.root.active = false;
  }
  get isOpen(): boolean { return this.root.active; }
  open(uid?: string): void { this.selectedUid = uid; this.shopPage = 0; this.root.active = true; this.render(); }
  close(): void { this.root.active = false; this.onClose(); }
  render(): void {
    if (!this.root.active) return;
    for (const child of [...this.content.children]) { child.active = false; child.destroy(); }
    const title = this.card.getChildByName('GeneratorWorkshopTitle');
    title?.destroy();
    label(this.card, 'GeneratorWorkshopTitle', this.selectedUid ? '生成器详情' : '小屋商店', -92, 461, 390, 50, 31, true);
    if (this.selectedUid) this.renderDetails(this.selectedUid); else this.renderShop();
  }
  private renderDetails(uid: string): void {
    const generator = this.game.generators.get(uid), status = this.game.getGeneratorStatus(uid);
    if (!generator || !status?.uid) { label(this.content, 'GeneratorGone', '这台生成器已经移动或合成，请重新选择', 0,0,570,90,25); return; }
    const art = createUiNode('GeneratorDetailArt'); this.content.addChild(art); art.setPosition(0,298,0);
    const image = generatorArt(generator.id); if (image) applyArt(art, image, 226,208);
    label(this.content,'GeneratorDetailName',generator.displayName + ' · Lv' + status.level,0,160,580,48,31,true);
    label(this.content,'GeneratorDetailUses','剩余 ' + status.remainingUses + '/' + status.capacity + ' 次 · ' + (generator.recharge ? '免体力采摘' : '每次 ' + status.energyCost + ' 体力'),0,106,570,42,25);
    const remaining = status.remainingCooldownMs || status.nextRecoveryMs || 0;
    label(this.content,'GeneratorCooldownLabel',remaining ? '恢复倒计时 ' + countdown(remaining) : generator.recharge ? '每 ' + countdown(status.cooldownMs) + ' 恢复一次' : '用满 ' + status.capacity + ' 次后休息',0,50,570,38,23);
    const track=createUiNode('GeneratorCooldownTrack');this.content.addChild(track);track.setPosition(0,14,0);
    paintRoundRect(track.addComponent(Graphics),510,14,7,hexColor('#E9DDD0'));
    const fill=createUiNode('GeneratorCooldownProgress');track.addChild(fill);
    const width=Math.max(2,506*(remaining ? 1-remaining/Math.max(1,status.cooldownMs) : 1));fill.setPosition(-253+width/2,0,0);
    paintRoundRect(fill.addComponent(Graphics),width,10,5,hexColor('#A8BA96'));
    if (status.boostAvailable) button(this.content,'GeneratorBoostToggle',status.boosted ? '2倍体力 · 已开启' : '开启2倍体力 · 提升高阶产出',0,-62,542,72,()=>{
      this.game.setGeneratorBoost(uid,!status.boosted);this.render();
    });
    const quote=this.game.getGeneratorRestoreQuote(uid);
    if (quote.ok) button(this.content,'GeneratorRestoreButton','钻石恢复 · ' + quote.cost + ' 钻石',0,-148,542,72,()=>this.onRestore(uid),this.game.player.diamonds>=quote.cost);
    const pool=generator.upgrade?.levels.find(level=>level.level===status.level);
    const outputs=(status.boosted?pool?.boostOutputs:pool?.outputs)??generator.outputs;
    const total=outputs.reduce((sum,entry)=>sum+entry.weight,0);
    label(this.content,'GeneratorOutputHeading',status.boosted?'强化产出概率':'普通产出概率',0,-200,570,32,22,true);
    const spacing = Math.min(184, 592 / outputs.length), tileWidth = spacing - 12;
    const iconSize = outputs.length > 3 ? 49 : 62;
    outputs.forEach((entry,index)=>{
      const tile=createUiNode('GeneratorOutput_'+entry.itemId);this.content.addChild(tile);tile.setPosition((index-(outputs.length-1)/2)*spacing,-263,0);
      ensureTransform(tile, tileWidth, 90);
      paintRoundRect(tile.addComponent(Graphics),tileWidth,90,14,hexColor('#FFF7E7'),hexColor('#E4CEB5'),1);
      const known=this.game.isItemDiscovered(entry.itemId),definition=this.game.bundle.catalog.get(entry.itemId);
      const art=known&&itemArt(entry.itemId);
      const iconX = -tileWidth * .28, textX = tileWidth * .23, textWidth = Math.min(68, tileWidth * .48);
      if(art){const icon=createUiNode('GeneratorOutputArt');tile.addChild(icon);icon.setPosition(iconX,7,0);applyArt(icon,{...art,preserveAspect:true},iconSize,iconSize);}
      else label(tile,'UnknownOutput','?',iconX,7,iconSize,62,32,true);
      label(tile,'OutputTier','Lv'+(definition?.level??1),textX,18,textWidth,28,20,true);
      label(tile,'OutputChance',Math.round(entry.weight/total*100)+'%',textX,-14,textWidth,28,21);
    });
    label(this.content,'GeneratorBoardInstruction','点击棋盘生成 · 长按查看详情\n拖动两台同级生成器可合成升级',0,-357,570,78,23,true);
    label(this.content,'GeneratorTierRule','最高 Lv' + status.maxLevel + ' · 当前最低产出' + status.level + '级主链物品',0,-420,570,42,21);
  }
  private renderShop(): void {
    const capacity = this.game.getBackpackStatus();
    const shortcuts = [
      { id: 'ShopSupplies', x: -151, icon: 'energy_04', title: '体力补给', detail: '查看兑换与补给', open: this.openSupplies },
      { id: 'ShopBackpack', x: 151, icon: null, title: '背包扩容', detail: `${capacity.capacity}/${capacity.maxCapacity} 格`, open: this.openBackpack },
    ];
    for (const entry of shortcuts) {
      const tile = button(this.content, entry.id, '', entry.x, 358, 282, 112, () => {
        this.close();
        entry.open();
      });
      const art = createUiNode('ShopShortcutArt');
      tile.addChild(art); art.setPosition(-85, 0, 0);
      const sprite = entry.icon ? itemArt(entry.icon) : { sheet: 'scissors_backpack_sheet', index: 5, columns: 3, rows: 2 };
      if (sprite) applyArt(art, { ...sprite, preserveAspect: true }, 74, 76);
      label(tile, 'ShopShortcutTitle', entry.title, 37, 18, 177, 34, 26, true);
      label(tile, 'ShopShortcutDetail', entry.detail, 37, -23, 180, 31, 20);
    }
    label(this.content, 'GeneratorShopHint', '生成器 · 购买或领取后放入空格', 0, 270, 580, 42, 23, true);
    const rewards=this.game.generators.getRewards();
    let y=201;
    if(rewards.length) {
      const reward=rewards[0], gen=this.game.generators.get(reward.generatorId);
      const plaque = createUiNode('PendingRewardShelf');
      this.content.addChild(plaque); plaque.setPosition(0, y, 0);
      paintRoundRect(plaque.addComponent(Graphics), 592, 83, 14, hexColor('#F4E6CB'), hexColor('#D7BF99'), 2);
      label(this.content,'PendingGeneratorReward',(gen?.displayName??'生成器')+' Lv'+reward.level+' · 待领 '+reward.count+' 台',-66,y,430,70,23,true);
      button(this.content,'ClaimGeneratorReward','领取',236,y,110,70,()=>{
        const result=this.game.claimGeneratorReward(reward.id);
        this.feedback(result.ok?'已放入棋盘空格':result.reason==='BOARD_FULL'?'棋盘已满，先腾出一个格子':'奖励已经领取',result.ok);this.render();
      });
      y-=90;
    }
    const generators = this.game.bundle.generators;
    const totalPages = Math.ceil(generators.length / GENERATORS_PER_PAGE);
    const start = this.shopPage * GENERATORS_PER_PAGE;
    const page = generators.slice(start, start + GENERATORS_PER_PAGE);
    const showcase = this.shopPage > 0 && page.length <= 2;
    for (const [index, gen] of page.entries()) {
      const unlocked = this.game.generators.isUnlocked(gen);
      const row = createUiNode('GeneratorShop_' + gen.id);
      this.content.addChild(row);
      row.setPosition(showcase ? (index - (page.length - 1) / 2) * 300 : 0, showcase ? y - 164 : y, 0);
      paintRoundRect(row.addComponent(Graphics), showcase ? 286 : 592, showcase ? 418 : 94, 18, hexColor('#F9EFE1'), hexColor('#EAD5BF'), 1);
      const icon = createUiNode('GeneratorShopArt');
      row.addChild(icon); icon.setPosition(showcase ? 0 : -224, showcase ? 26 : 0, 0);
      const art = generatorArt(gen.id);
      if (art) applyArt(icon, art, showcase ? 208 : 80, showcase ? 208 : 80);
      label(row, 'GeneratorShopName', gen.displayName + ' Lv1', showcase ? 0 : -37, showcase ? 170 : 23, 270, 36, showcase ? 30 : 24, true);
      label(row, 'GeneratorShopRule', unlocked ? '占1格 · 同级可拖动合成' : 'Lv' + gen.unlockLevel + ' 开放',
        showcase ? 0 : -37, showcase ? -108 : -24, 270, 32, showcase ? 23 : 20);
      button(row, 'PurchaseGenerator_' + gen.id, unlocked ? gen.purchaseCoins + ' 金币' : '未解锁',
        showcase ? 0 : 210, showcase ? -163 : 0, showcase ? 212 : 148, 72, () => {
        const result=this.game.purchaseGenerator(gen.id);
        this.feedback(result.ok?'已放入棋盘空格':result.reason==='BOARD_FULL'?'棋盘已满，购买未扣费':result.reason==='NOT_ENOUGH_COINS'?'金币不足':'暂时无法购买',result.ok);this.render();
      }, unlocked && this.game.player.coins >= gen.purchaseCoins);
      if (!showcase) y -= 102;
    }
    if (totalPages > 1) {
      const showPage = (page: number): void => { this.shopPage = page; this.render(); };
      button(this.content, 'GeneratorShopPrev', '‹ 上一页', -199, -390, 168, 72,
        () => showPage(this.shopPage - 1), this.shopPage > 0);
      label(this.content, 'GeneratorShopPage', `第 ${this.shopPage + 1}/${totalPages} 页 · 共 ${generators.length} 种`, 0, -390, 202, 50, 23, true);
      button(this.content, 'GeneratorShopNext', '下一页 ›', 199, -390, 168, 72,
        () => showPage(this.shopPage + 1), this.shopPage + 1 < totalPages);
    }
  }
  refreshClock(): void {
    if(!this.root.active||!this.selectedUid)return;
    const status=this.game.getGeneratorStatus(this.selectedUid),gen=this.game.generators.get(this.selectedUid);if(!status||!gen)return;
    const remaining=status.remainingCooldownMs||status.nextRecoveryMs||0;
    const text=this.content.getChildByName('GeneratorCooldownLabel')?.getComponent(Label);
    if(text)text.string=remaining?'恢复倒计时 '+countdown(remaining):gen.recharge?'每 '+countdown(status.cooldownMs)+' 恢复一次':'用满 '+status.capacity+' 次后休息';
    const uses=this.content.getChildByName('GeneratorDetailUses')?.getComponent(Label);
    if(uses)uses.string='剩余 '+status.remainingUses+'/'+status.capacity+' 次 · '+(gen.recharge?'免体力采摘':'每次 '+status.energyCost+' 体力');
    const fill=this.content.getChildByName('GeneratorCooldownTrack')?.getChildByName('GeneratorCooldownProgress'),ink=fill?.getComponent(Graphics);
    if(fill&&ink){const width=Math.max(2,506*(remaining?1-remaining/Math.max(1,status.cooldownMs):1));fill.setPosition(-253+width/2,0,0);paintRoundRect(ink,width,10,5,hexColor('#A8BA96'));}
  }
}
