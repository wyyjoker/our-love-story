import { BlockInputEvents, Button, Graphics, Label, Node, Tween, tween, Vec3 } from 'cc';
import type { OrderVm } from '../../presentation/GameViewMapper';
import { applyArt, applyMaterialFrame, customerBustArt, itemArt } from './CocosArt';
import { createUiNode, ensureTransform, ensureOpacity, hexColor, makeLabel, paintRoundRect } from './CocosTheme';

function text(parent:Node,name:string,value:string,x:number,y:number,width:number,height:number,size:number,color='#79574D'):Label {
  const label=makeLabel(value,size,hexColor(color),true);label.node.name=name;parent.addChild(label.node);ensureTransform(label.node,width,height);label.node.setPosition(x,y,0);label.overflow=Label.Overflow.SHRINK;return label;
}

/** A customer portrait above its own service tray. */
export class CocosOrderCard {
  readonly node:Node;
  private readonly avatar:Node;
  private readonly avatarFallback:Label;
  private readonly tray:Node;
  private readonly halo:Node;
  private readonly claim:Node;
  private readonly claimButton:Button;
  private readonly caption:Label;
  private readonly reward:Label;
  private readonly xpReward:Label;
  private readonly title:Label;
  private readonly urgentBadge:Node;
  private readonly countdown:Label;
  private readonly holders:Node[]=[];
  private readonly icons:Node[]=[];
  private readonly names:Label[]=[];
  private readonly quantities:Label[]=[];
  private readonly checks:Node[]=[];
  private uid='';
  private ready=false;
  private delivering=false;
  private pending:{vm:OrderVm;now:number}|null=null;
  private onClaim:(uid:string)=>void=()=>{};
  private onInspect:(uid:string,itemId:string)=>void=()=>{};
  private requirementIds:string[]=[];
  private readonly compact:boolean;
  private readonly trayHeight:number;

  constructor(parent:Node,private readonly width:number,private readonly height:number,private readonly index:number) {
    this.compact=height<265;
    this.node=createUiNode('OrderCard');parent.addChild(this.node);ensureTransform(this.node,width,height);
    this.avatar=createUiNode('CustomerAvatar');this.node.addChild(this.avatar);
    this.avatarFallback=text(this.avatar,'CustomerFallback','顾客',0,0,130,62,30);
    this.tray=createUiNode('OrderServiceTray');this.node.addChild(this.tray);
    const trayH=this.compact?68:104, buttonH=this.compact?40:52;
    this.trayHeight=trayH;
    const buttonY=-height/2+buttonH/2+3, trayY=buttonY+buttonH/2-7+trayH/2;
    ensureTransform(this.tray,width-2,trayH);this.tray.setPosition(0,trayY,0);
    paintRoundRect(this.tray.addComponent(Graphics),width-2,trayH,18,hexColor('#FFF4DE'),hexColor('#D7B990'),2);
    applyMaterialFrame(this.tray,'paper',width-2,trayH,.40);
    this.halo=createUiNode('OrderReadyHalo');this.tray.addChild(this.halo);ensureTransform(this.halo,width-8,trayH-4);
    const hg=this.halo.addComponent(Graphics);hg.strokeColor=hexColor('#A2BC8B');hg.lineWidth=2;hg.roundRect(-width/2+4,-trayH/2+2,width-8,trayH-4,16);hg.stroke();
    // Fit the entire portrait above the tray; only its bottom can tuck behind the counter.
    const portraitBottom=trayY+trayH/2-4;
    const heroH=Math.min(width*1.10,height/2-3-portraitBottom);
    applyArt(this.avatar,customerBustArt(index),width-10,heroH,ok=>{this.avatarFallback.node.active=!ok;});
    this.avatar.setPosition(-5,portraitBottom+heroH/2,0);

    const badgeW=this.compact?66:84,badgeH=this.compact?23:29;
    const badge=(name:string,y:number,icon:string,color:string):Label=>{
      const node=createUiNode(name);this.node.addChild(node);ensureTransform(node,badgeW,badgeH);node.setPosition(width/2-badgeW/2+2,y,0);
      paintRoundRect(node.addComponent(Graphics),badgeW,badgeH,badgeH/2,hexColor('#FFF0CD',246),hexColor('#D8B77B'),1);
      text(node,name+'Icon',icon,-badgeW/2+12,0,24,badgeH,20,color);
      return text(node,name+'Value','0',9,0,badgeW-26,badgeH-2,this.compact?15:19,color);
    };
    this.reward=badge('RewardBadge',portraitBottom+(this.compact?47:71),'●','#AA7837');
    this.reward.node.name='OrderReward';
    this.xpReward=badge('OrderXpBadge',portraitBottom+(this.compact?21:37),'✦','#B29149');
    this.xpReward.node.name='OrderXpReward';
    this.title=text(this.node,'OrderTitle','',-width/2+49,height/2-17,96,26,17,'#A58870');
    this.urgentBadge=createUiNode('OrderUrgentBadge');this.node.addChild(this.urgentBadge);ensureTransform(this.urgentBadge,56,25);this.urgentBadge.setPosition(-width/2+32,height/2-17,0);
    paintRoundRect(this.urgentBadge.addComponent(Graphics),56,25,12,hexColor('#F9E0D1'),hexColor('#DDB89B'),1);text(this.urgentBadge,'UrgentCaption','急单',0,0,52,23,16,'#A36B55');
    this.countdown=text(this.node,'OrderUrgentCountdown','',-width/2+44,height/2-43,84,23,17,'#A86B5E');
    for(let i=0;i<3;i++){
      const holder=createUiNode('Required_'+i);this.tray.addChild(holder);this.holders.push(holder);
      holder.addComponent(Button);holder.addComponent(BlockInputEvents);
      holder.on(Button.EventType.CLICK,()=>{if(!this.delivering&&this.requirementIds[i])this.onInspect(this.uid,this.requirementIds[i]);});
      const icon=createUiNode('Art');holder.addChild(icon);this.icons.push(icon);
      this.names.push(text(holder,'RequiredName','',0,8,100,48,19));
      this.quantities.push(text(holder,'RequiredQuantity','',0,-28,100,28,this.compact?24:23));
      const check=createUiNode('OrderItemCheck');holder.addChild(check);check.pauseSystemEvents(true);this.checks.push(check);check.addComponent(Graphics);
    }
    this.claim=createUiNode('ClaimButton');this.node.addChild(this.claim);ensureTransform(this.claim,width-25,buttonH);this.claim.setPosition(0,buttonY,0);
    const shadow=createUiNode('DeliveryButtonShadow');this.claim.addChild(shadow);shadow.setPosition(0,-3,0);paintRoundRect(shadow.addComponent(Graphics),width-25,buttonH,buttonH/2,hexColor('#496A42',60));
    paintRoundRect(this.claim.addComponent(Graphics),width-25,buttonH,buttonH/2,hexColor('#88A16F'),hexColor('#FFF6DB'),2);
    const light=createUiNode('DeliveryButtonHighlight');this.claim.addChild(light);light.setPosition(0,buttonH/2-7,0);paintRoundRect(light.addComponent(Graphics),width-52,4,2,hexColor('#EBF0C6',150));
    this.caption=text(this.claim,'DeliveryCaption','交付订单',0,0,width-38,buttonH-4,this.compact?24:29,'#FFFFFF');
    this.claimButton=this.claim.addComponent(Button);this.claim.addComponent(BlockInputEvents);
    this.claimButton.transition=Button.Transition.SCALE;this.claimButton.zoomScale=.96;this.claimButton.duration=.06;
    this.claim.on(Button.EventType.CLICK,()=>{if(!this.delivering&&this.ready&&this.uid)this.onClaim(this.uid);});
  }
  bind(onClaim:(uid:string)=>void,onInspect:(uid:string,itemId:string)=>void):void{this.onClaim=onClaim;this.onInspect=onInspect;}
  beginDelivery(uid:string, reveal:()=>void):Vec3|null{
    if(uid!==this.uid||!this.ready||this.delivering)return null;
    reveal();
    this.delivering=true;this.claimButton.interactable=false;this.caption.string='正在送达';return this.tray.worldPosition.clone();
  }
  receiveDelivery():void{
    Tween.stopAllByTarget(this.avatar);this.avatar.setScale(1,1,1);tween(this.avatar).to(.12,{scale:new Vec3(1.05,1.05,1)}).to(.16,{scale:new Vec3(1,1,1)}).start();this.caption.string='谢谢你 ♥';
  }
  finishDelivery(animate=true):void{
    if(!this.delivering)return;this.delivering=false;const pending=this.pending;this.pending=null;if(pending)this.render(pending.vm,pending.now);
    Tween.stopAllByTarget(this.node);this.node.setScale(animate?.97:1,animate?.97:1,1);const opacity=ensureOpacity(this.node);Tween.stopAllByTarget(opacity);opacity.opacity=animate?180:255;
    if(animate){tween(this.node).to(.18,{scale:new Vec3(1,1,1)}).start();tween(opacity).to(.18,{opacity:255}).start();}
  }
  render(vm:OrderVm,now=0):void{
    if(this.delivering){this.pending={vm,now};return;}
    this.uid=vm.uid;this.ready=vm.ready;this.claimButton.interactable=vm.ready;this.claim.active=vm.ready;
    this.requirementIds=vm.requirements.map(req=>req.itemId);this.halo.active=vm.ready;this.reward.string='+'+vm.rewardCoins;this.xpReward.string='+'+vm.rewardXp;
    const urgent=!!vm.urgentUntil&&vm.urgentUntil>now;this.urgentBadge.active=urgent;this.countdown.node.active=urgent;
    if(urgent){const sec=Math.max(0,Math.ceil((vm.urgentUntil!-now)/1000));this.countdown.string=String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');}
    const orderNames = { quick: '快单', regular: '常规单', goal: '挑战单' };
    this.title.node.active = !urgent && (!!vm.longTerm || !!vm.pace);
    this.title.string = vm.longTerm ? '长线订单' : vm.pace ? orderNames[vm.pace] : '';
    this.title.color = hexColor(vm.pace === 'goal' ? '#985441' : '#82614B');
    this.title.node.name = vm.longTerm ? 'OrderLongTermLabel' : 'OrderTitle';
    const count=vm.requirements.length,holderW=(this.width-22)/Math.max(1,count),trayH=this.trayHeight;
    for(let i=0;i<3;i++){
      const req=vm.requirements[i],holder=this.holders[i];holder.active=!!req;if(!req)continue;
      ensureTransform(holder,holderW,trayH-9);holder.setPosition((i-(count-1)/2)*holderW,7,0);
      const artH=this.compact?44:76, art=itemArt(req.itemId);this.icons[i].setPosition(0,this.compact?7:10,0);this.icons[i].active=!!art;
      this.names[i].string=req.displayName;this.names[i].node.active=true;
      if(art)applyArt(this.icons[i],{...art,preserveAspect:true},Math.min(holderW-7,artH*1.3),artH,ok=>{this.names[i].node.active=!ok;});
      ensureTransform(this.names[i].node,holderW-6,trayH-26);
      this.quantities[i].node.setPosition(0,this.compact?-23:-34,0);ensureTransform(this.quantities[i].node,holderW-4,25);
      const countText = Math.min(req.have, req.count) + '/' + req.count;
      this.quantities[i].string = req.level >= 4 ? `Lv${req.level} · ${countText}` : countText;
      this.quantities[i].color=hexColor(req.done?'#66834F':'#8D7265');
      const check=this.checks[i];check.active=req.done;check.setPosition(Math.min(holderW/2-14,artH*.44),this.compact?-4:-8,0);ensureTransform(check,this.compact?26:36,this.compact?26:36);
      if(req.done){const ink=check.getComponent(Graphics)!;ink.clear();const unit=this.compact?13:18;
        for(const [color,line]of [['#FFF8E3',8],['#70A04E',5]] as const){ink.strokeColor=hexColor(color);ink.lineWidth=this.compact?line*.8:line;ink.moveTo(-unit*.7,0);ink.lineTo(-unit*.15,-unit*.45);ink.lineTo(unit*.8,unit*.6);ink.stroke();}
      }
    }
    this.caption.string='交付订单';
  }
  destroy():void{Tween.stopAllByTarget(this.node);Tween.stopAllByTarget(this.avatar);this.node.destroy();}
}
