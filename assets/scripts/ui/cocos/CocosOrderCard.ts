import { BlockInputEvents, Button, Event, Graphics, Label, Node, Tween, tween, Vec3 } from 'cc';
import type { OrderVm } from '../../presentation/GameViewMapper';
import { applyArt, itemArt } from './CocosArt';
import { createUiNode, ensureTransform, ensureOpacity, hexColor, makeLabel, paintRoundRect } from './CocosTheme';

function text(parent: Node, name: string, value: string, x: number, y: number, width: number, height: number, size: number, color = '#79574D'): Label {
  const label = makeLabel(value, size, hexColor(color), true); label.node.name = name; parent.addChild(label.node);
  ensureTransform(label.node, width, height); label.node.setPosition(x, y, 0); label.overflow = Label.Overflow.SHRINK; return label;
}

/** A customer is the hero; requested objects sit beside them. */
export class CocosOrderCard {
  readonly node: Node;
  private readonly avatar: Node;
  private readonly halo: Node;
  private readonly claim: Node;
  private readonly claimButton: Button;
  private readonly caption: Label;
  private readonly reward: Label;
  private readonly title: Label;
  private readonly urgentBadge: Node;
  private readonly countdown: Label;
  private readonly holders: Node[] = [];
  private readonly icons: Node[] = [];
  private readonly names: Label[] = [];
  private readonly quantities: Label[] = [];
  private uid = '';
  private ready = false;
  private delivering = false;
  private pending: { vm: OrderVm; now: number } | null = null;
  private onClaim: (uid: string) => void = () => {};

  constructor(parent: Node, private readonly width: number, private readonly height: number, private readonly index: number) {
    this.node = createUiNode('OrderCard'); parent.addChild(this.node); ensureTransform(this.node, width, height);
    const colors = ['#FFF7F1', '#F6F7EE', '#F9F3F8'];
    paintRoundRect(this.node.addComponent(Graphics), width, height, 23, hexColor(colors[index % colors.length], 250), hexColor('#EAD9CE'), 1);
    this.halo = createUiNode('OrderReadyHalo'); this.node.addChild(this.halo);
    ensureTransform(this.halo, width - 4, height - 4);
    const hg = this.halo.addComponent(Graphics); hg.strokeColor = hexColor('#A8C5A1'); hg.lineWidth = 2;
    hg.roundRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4, 22); hg.stroke();
    this.avatar = createUiNode('CustomerAvatar'); this.node.addChild(this.avatar);
    const badge = createUiNode('RewardBadge'); this.node.addChild(badge); ensureTransform(badge, 68, 27);
    badge.setPosition(-width / 2 + 43, height / 2 - 22, 0);
    paintRoundRect(badge.addComponent(Graphics), 68, 27, 13, hexColor('#F7E8CB'));
    const coin = createUiNode('OrderCoin'); badge.addChild(coin); coin.setPosition(-22, 0, 0);
    applyArt(coin, { ...itemArt('coin_01')!, preserveAspect: true }, 23, 23);
    this.reward = text(badge, 'OrderReward', '0', 10, 0, 43, 25, 17, '#98713D');
    this.title = text(this.node, 'OrderTitle', '', 2, height / 2 - 22, 62, 25, 16, '#A58870');
    this.urgentBadge = createUiNode('OrderUrgentBadge'); this.node.addChild(this.urgentBadge);
    ensureTransform(this.urgentBadge, 34, 23); this.urgentBadge.setPosition(-16, height / 2 - 22, 0);
    paintRoundRect(this.urgentBadge.addComponent(Graphics), 34, 23, 10, hexColor('#F9DFD5'));
    text(this.urgentBadge, 'UrgentCaption', '急单', 0, 0, 32, 21, 14, '#AF6E5F');
    this.countdown = text(this.node, 'OrderUrgentCountdown', '', 34, height / 2 - 22, 56, 23, 15, '#A86B5E');
    for (let i = 0; i < 3; i++) {
      const holder = createUiNode(`Required_${i}`); this.node.addChild(holder); this.holders.push(holder);
      const icon = createUiNode('Art'); holder.addChild(icon); this.icons.push(icon);
      this.names.push(text(holder, 'RequiredName', '', 0, 8, 88, 38, 16));
      this.quantities.push(text(holder, 'RequiredQuantity', '', 0, -28, 88, 27, 24));
    }
    this.claim = createUiNode('ClaimButton'); this.node.addChild(this.claim);
    this.caption = text(this.claim, 'DeliveryCaption', '', 0, 0, width - 34, 38, 29, '#FFFFFF');
    this.claimButton = this.node.addComponent(Button);
    this.node.on(Button.EventType.CLICK, () => { if (!this.delivering && this.ready && this.uid) this.onClaim(this.uid); });
  }
  bind(onClaim: (uid: string) => void): void { this.onClaim = onClaim; }
  beginDelivery(uid: string): Vec3 | null {
    if (uid !== this.uid || !this.ready || this.delivering) return null;
    this.delivering = true; this.claimButton.interactable = false; this.caption.string = '正在送达';
    return this.avatar.worldPosition.clone();
  }
  receiveDelivery(): void {
    Tween.stopAllByTarget(this.avatar); this.avatar.setScale(1, 1, 1);
    tween(this.avatar).to(0.12, { scale: new Vec3(1.08, 1.08, 1) }).to(0.16, { scale: new Vec3(1, 1, 1) }).start();
    this.caption.string = '谢谢你 ♥';
  }
  finishDelivery(animate = true): void {
    if (!this.delivering) return; this.delivering = false;
    const pending = this.pending; this.pending = null; if (pending) this.render(pending.vm, pending.now);
    Tween.stopAllByTarget(this.node); this.node.setScale(animate ? .97 : 1, animate ? .97 : 1, 1);
    const opacity = ensureOpacity(this.node); Tween.stopAllByTarget(opacity); opacity.opacity = animate ? 180 : 255;
    if (animate) { tween(this.node).to(.18, { scale: new Vec3(1, 1, 1) }).start(); tween(opacity).to(.18, { opacity: 255 }).start(); }
  }
  render(vm: OrderVm, now = 0): void {
    if (this.delivering) { this.pending = { vm, now }; return; }
    this.uid = vm.uid; this.ready = vm.ready; this.claimButton.interactable = vm.ready;
    this.halo.active = vm.ready; this.reward.string = `+${vm.rewardCoins}`;
    const urgent = !!vm.urgentUntil && vm.urgentUntil > now;
    this.urgentBadge.active = urgent; this.countdown.node.active = urgent;
    if (urgent) { const seconds = Math.max(0, Math.ceil((vm.urgentUntil! - now) / 1000)); this.countdown.string = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
    this.title.node.active = !!vm.longTerm && !urgent; this.title.string = '长线'; this.title.node.name = vm.longTerm ? 'OrderLongTermLabel' : 'OrderTitle';
    const footerH = 46, footerY = -this.height / 2 + footerH / 2 + 8;
    ensureTransform(this.claim, this.width - 24, footerH); this.claim.setPosition(0, footerY, 0);
    paintRoundRect(this.claim.getComponent(Graphics) ?? this.claim.addComponent(Graphics), this.width - 24, footerH, footerH / 2, hexColor('#D88794'));
    ensureTransform(this.caption.node, this.width - 36, footerH - 4); this.caption.string = '交付订单'; this.claim.active = vm.ready;
    const bottom = footerY + footerH / 2 + 6, top = this.height / 2 - 39, bodyH = top - bottom;
    const count = vm.requirements.length, compactPair = this.height < 230 && count > 1;
    const personW = compactPair ? this.width * .34 : this.width * .44;
    applyArt(this.avatar, { sheet:'customer_bust_sheet', index:this.index % 3, columns:3, rows:1, preserveAspect:true }, Math.min(personW, bodyH * .75), bodyH);
    this.avatar.setPosition(-this.width * (compactPair ? .31 : .245), (top + bottom) / 2, 0);
    const rowH = compactPair ? Math.min(104, bodyH) : Math.min(count === 1 ? 126 : 88, (bodyH - (count - 1) * 4) / count);
    const holderW = this.width * (compactPair ? .25 : .47);
    for (let i = 0; i < 3; i++) {
      const req = vm.requirements[i], holder = this.holders[i]; holder.active = !!req; if (!req) continue;
      const centerY = (top + bottom) / 2 + (compactPair ? 0 : ((count - 1) / 2 - i) * (rowH + 4));
      holder.setPosition(this.width * (compactPair ? .065 + i * .28 : .25), centerY, 0); ensureTransform(holder, holderW, rowH);
      paintRoundRect(holder.getComponent(Graphics) ?? holder.addComponent(Graphics), holderW, rowH, 15, hexColor('#FFFFFF', 247));
      const artH = Math.max(28, Math.min(count === 1 ? 88 : 66, rowH - 30));
      const art = itemArt(req.itemId); this.icons[i].setPosition(0, 12, 0); this.names[i].string = req.displayName; this.names[i].node.active = true;
      if (art) applyArt(this.icons[i], { ...art, preserveAspect:true }, Math.min(holderW - 6, artH * 1.2), artH, ok => { this.names[i].node.active = !ok; });
      ensureTransform(this.names[i].node, holderW - 4, rowH - 26);
      ensureTransform(this.quantities[i].node, holderW - 2, 28); this.quantities[i].node.setPosition(0, -rowH / 2 + 15, 0);
      this.quantities[i].fontSize = compactPair ? 21 : 24;
      this.quantities[i].string = `${req.done ? '✓ ' : ''}${Math.min(req.have, req.count)}/${req.count}`; this.quantities[i].color = hexColor(req.done ? '#729E78' : '#8D7265');
    }
  }

  destroy(): void { Tween.stopAllByTarget(this.node); Tween.stopAllByTarget(this.avatar); this.node.destroy(); }
}
