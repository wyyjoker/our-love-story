import { Button, Graphics, Label, Node, Tween, tween, Vec3 } from 'cc';
import type { StatusVm } from '../../presentation/GameViewMapper';
import { CocosTheme, createUiNode, ensureTransform, hexColor, makeLabel, paintRoundRect } from './CocosTheme';
import { applyArt, generatorArt, itemArt } from './CocosArt';
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
  private shopRewardBadge!: Node;
  private shopRewardCount!: Label;
  private readonly xpWidth = 146;

  constructor(parent: Node, width: number, height: number, onResourceTip?: (kind: ResourceKind) => void, demoPreview = false, onSettings?: () => void, onCheckIn?: () => void, onShop?: () => void) {
    this.node = createUiNode('StatusBarView');
    parent.addChild(this.node);
    ensureTransform(this.node, width, height);
    this.build(width, height, onResourceTip, demoPreview, onSettings, onCheckIn, onShop);
  }


  private build(width: number, height: number, onResourceTip?: (kind: ResourceKind) => void, demoPreview = false, onSettings?: () => void, onCheckIn?: () => void, onShop?: () => void): void {
    const compact=height<120, cardHeight=height-4;
    const levelCard=createUiNode('LevelCard');this.node.addChild(levelCard);ensureTransform(levelCard,158,cardHeight);levelCard.setPosition(-width/2+80,0,0);
    paintRoundRect(levelCard.addComponent(Graphics),158,cardHeight,24,hexColor('#FFF8E9',240),hexColor('#DDC4A5'),1);
    const avatar=createUiNode('PlayerAvatar');levelCard.addChild(avatar);avatar.setPosition(-43,compact?18:28,0);
    const size=compact?42:64;ensureTransform(avatar,size,size);
    const ring=avatar.addComponent(Graphics);ring.fillColor=hexColor('#F4DFC4');ring.strokeColor=hexColor('#CDA577');ring.lineWidth=2;ring.circle(0,0,size/2);ring.fill();ring.stroke();
    const face=createUiNode('PlayerAvatarArt');avatar.addChild(face);
    applyArt(face,{sheet:'customer_busts_sheet',region:{x:70,y:10,width:230,height:216},preserveAspect:true},size-4,size-4);
    this.levelLabel=text(levelCard,'Lv.1',32,compact?18:32,compact?24:28,77,hexColor('#664A3B'),true);
    const bar=createUiNode('XpBar');levelCard.addChild(bar);ensureTransform(bar,this.xpWidth,16);bar.setPosition(0,compact?-12:-14,0);
    paintRoundRect(bar.addComponent(Graphics),this.xpWidth,16,8,hexColor('#E7D8BE'));
    const fill=createUiNode('XpFill');bar.addChild(fill);ensureTransform(fill,this.xpWidth,16);this.xpBar=fill.addComponent(Graphics);
    this.xpLabel=text(bar,'0/50',0,0,15,this.xpWidth-6,hexColor('#654A37'),true);
    const hearts=createUiNode('LevelHearts');levelCard.addChild(hearts);ensureTransform(hearts,142,28);hearts.setPosition(0,compact?-32:-45,0);
    text(hearts,'♥',-43,0,22,28,hexColor('#DA8392'),true);this.heartsLabel=text(hearts,'0',18,0,21,98,hexColor('#A05C69'),true);this.heartsLabel.node.name='HeartsValue';
    hearts.addComponent(Button);hearts.on(Button.EventType.CLICK,()=>onResourceTip?.('hearts'));

    const resourceLeft=-width/2+174, resourceWidth=width-186, gap=8, pillWidth=(resourceWidth-2*gap)/3;
    const rowY=height/2-(compact?23:30), pillHeight=compact?42:52;
    const right=createUiNode('Resources');this.node.addChild(right);ensureTransform(right,resourceWidth,pillHeight);
    const values:Partial<Record<ResourceKind,Label>>={};
    const kinds=['energy','coins','diamonds'] as const;
    kinds.forEach((kind,index)=>{
      const pill=createUiNode(kind+'Pill');right.addChild(pill);ensureTransform(pill,pillWidth,pillHeight);
      pill.setPosition(resourceLeft+pillWidth/2+index*(pillWidth+gap),rowY,0);
      paintRoundRect(pill.addComponent(Graphics),pillWidth,pillHeight,pillHeight/2,hexColor('#FFF6E4',248),hexColor('#CCB58A'),1.5);
      const shine=createUiNode('ResourceHighlight');pill.addChild(shine);shine.setPosition(0,pillHeight/2-6,0);
      paintRoundRect(shine.addComponent(Graphics),pillWidth-26,3,1.5,hexColor('#FFFFFF',155));
      const icon=createUiNode(kind+'Icon');pill.addChild(icon);icon.setPosition(-pillWidth/2+21,0,0);
      if(kind==='energy') text(icon,'⚡',0,0,32,36,hexColor('#E2AA39'),true);
      else applyArt(icon,{...itemArt(kind==='coins'?'coin_02':'diamond_02')!,preserveAspect:true},35,35);
      const number=text(pill,'0',-1,kind==='energy'?7:0,compact?24:26,pillWidth-66,hexColor('#684A36'),true);
      number.node.name=kind==='coins'?'CoinsValue':kind==='diamonds'?'DiamondsValue':'EnergyValue';values[kind]=number;
      const plus=createUiNode(kind+'Plus');pill.addChild(plus);ensureTransform(plus,46,pillHeight);
      plus.setPosition(pillWidth/2-19,0,0);const ink=plus.addComponent(Graphics);
      ink.fillColor=hexColor('#8CA477');ink.strokeColor=hexColor('#F9F6DF');ink.lineWidth=1.5;ink.circle(0,0,compact?15:18);ink.fill();ink.stroke();
      text(plus,'+',0,0,compact?25:29,32,hexColor('#FFFFFF'),true);
      plus.addComponent(Button);plus.on(Button.EventType.CLICK,()=>onResourceTip?.(kind));
      if(kind==='energy'){this.energyCdLabel=text(pill,'',-2,compact?-13:-14,11,pillWidth-60,hexColor('#9A8062'));this.energyCdLabel.node.name='EnergyCountdown';}
    });
    this.energyLabel=values.energy!;this.coinsLabel=values.coins!;this.diamondsLabel=values.diamonds!;
    this.levelLabel.node.name='LevelValue';this.xpLabel.node.name='XpValue';
    const actionY=-height/2+(compact?23:31);
    this.sectionLabel=text(this.node,demoPreview?'演示小屋':'合成小屋',resourceLeft+52,actionY,compact?19:23,104,hexColor('#7B5542'),true);
    const daily=createUiNode('DailyCheckInButton');this.node.addChild(daily);ensureTransform(daily,140,compact?42:54);daily.setPosition(resourceLeft+186,actionY,0);
    paintRoundRect(daily.addComponent(Graphics),140,compact?40:50,20,hexColor('#FFF0D8'),hexColor('#E2C69D'),1);
    this.checkInLabel=text(daily,'每日签到',0,0,compact?19:22,128,hexColor('#AA7853'),true);
    this.checkInDot=createUiNode('CheckInAvailable');daily.addChild(this.checkInDot);this.checkInDot.setPosition(60,17,0);const dot=this.checkInDot.addComponent(Graphics);dot.fillColor=hexColor('#DC8593');dot.circle(0,0,5);dot.fill();
    daily.addComponent(Button);daily.on(Button.EventType.CLICK,()=>onCheckIn?.());
    const settings=createUiNode('SettingsButton');this.node.addChild(settings);ensureTransform(settings,52,compact?44:56);settings.setPosition(width/2-204,actionY,0);
    paintRoundRect(settings.addComponent(Graphics),44,44,22,hexColor('#FFF6E7'),hexColor('#D4B895'),1);text(settings,'⚙',0,0,28,40,hexColor('#977052'),true);
    settings.addComponent(Button);settings.on(Button.EventType.CLICK,()=>onSettings?.());
    const shop=createUiNode('ShopButton');this.node.addChild(shop);ensureTransform(shop,158,compact?44:58);shop.setPosition(width/2-84,actionY,0);
    paintRoundRect(shop.addComponent(Graphics),154,compact?42:54,18,hexColor('#F5E4CA'),hexColor('#CCAD83'),1.5);
    const basket=createUiNode('ShopBasketArt');shop.addChild(basket);basket.setPosition(-46,2,0);const art=generatorArt('flower_basket');if(art)applyArt(basket,art,48,48);
    text(shop,'商店',8,0,25,82,hexColor('#805238'),true);shop.addComponent(Button);shop.on(Button.EventType.CLICK,()=>onShop?.());
    this.shopRewardBadge=createUiNode('ShopRewardsBadge');shop.addChild(this.shopRewardBadge);this.shopRewardBadge.setPosition(64,0,0);ensureTransform(this.shopRewardBadge,23,23);
    const badge=this.shopRewardBadge.addComponent(Graphics);badge.fillColor=hexColor('#D98C99');badge.circle(0,0,11);badge.fill();
    this.shopRewardCount=text(this.shopRewardBadge,'0',0,0,14,22,hexColor('#FFFFFF'),true);this.shopRewardBadge.active=false;
  }

  setSectionTitle(title: string): void {
    this.sectionLabel.string = title;
  }

  setCheckInAvailable(available: boolean): void {
    if (this.checkInDot) this.checkInDot.active = available;
    if (this.checkInLabel) this.checkInLabel.string = available ? '每日签到' : '今日已签到';
  }
  setShopRewardCount(count:number):void{this.shopRewardBadge.active=count>0;this.shopRewardCount.string=count>99?'99+':String(count);}

  render(vm: StatusVm): void {
    this.latestVm = vm;
    vm = { ...vm,
      coinsText: String(Math.max(0, vm.coins - this.arrivals.total('coins'))),
      heartsText: String(Math.max(0, vm.hearts - this.arrivals.total('hearts'))),
      ...(this.arrivals.total('xp') > 0 && this.heldXp ? { level: this.heldXp.level, xpText: this.heldXp.xpText, xpRatio: this.heldXp.xpRatio } : {}),
    };
    this.levelLabel.string = `Lv.${vm.level}`;
    this.xpLabel.string = vm.xpText.replace(/^XP /, '');
    this.energyLabel.string = String(vm.energy);
    this.energyCdLabel.string = `/${vm.maxEnergy}${vm.energyCountdownText?' · '+vm.energyCountdownText:''}`;
    this.coinsLabel.string = vm.coinsText;
    this.heartsLabel.string = vm.heartsText;
    this.diamondsLabel.string = vm.diamondsText;
    const filled = Math.max(2, this.xpWidth * vm.xpRatio);
    this.xpBar.node.setPosition((filled - this.xpWidth) / 2, 0, 0);
    paintRoundRect(this.xpBar, filled, 16, 8, hexColor('#A3B07C'));
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
