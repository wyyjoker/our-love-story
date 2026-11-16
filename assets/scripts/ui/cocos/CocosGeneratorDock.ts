/**
 * CocosGeneratorDock — bottom generator buttons (locked shows unlock level).
 */
import { Node, Label, Graphics, Button, UIOpacity, tween, Vec3, UITransform, Mask, ScrollView } from 'cc';
import type { GeneratorVm } from '../../presentation/GameViewMapper';
import {
  CocosTheme,
  createUiNode,
  ensureTransform,
  makeLabel,
  paintRoundRect,
  hexColor,
} from './CocosTheme';
import { applyArt, generatorArt } from './CocosArt';

export type OrangeTreeStatus = { unlocked: boolean; charges: number | null; maxCharges: number | null; nextRecoveryMs: number | null };
type GeneratorClockStatus = OrangeTreeStatus & { level?: number; maxLevel?: number; inventory?: number[]; energyCost?: number; cooldownMs?: number; remainingCooldownMs?: number; streak?: number; streakLimit?: number; boostAvailable?: boolean };

function formatCountdown(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

class GenButton {
  readonly node: Node;
  private g!: Graphics;
  private nameLabel!: Label;
  private subLabel!: Label;
  private w: number;
  private h: number;
  private onTap: (id: string) => void = () => {};
  private id = '';
  private artNode: Node;
  private lock: Node;
  private timerLabel: Label;
  private cooldownFill: Node;
  private cooldownTrackWidth: number;
  private readonly palette: { fill: string; edge: string };

  constructor(parent: Node, width: number, height: number, index: number) {
    this.w = width;
    this.h = height;
    this.palette = [
      { fill: '#FFE1DB', edge: '#EFB5AE' }, { fill: '#E6ECD4', edge: '#C9D2B0' },
      { fill: '#EBDFF5', edge: '#D4BDE8' }, { fill: '#F1E2DA', edge: '#D9C4B6' },
      { fill: '#FFF0D4', edge: '#E8CB91' },
    ][index % 5];
    this.node = createUiNode(index === 4 ? 'GeneratorOrangeTree' : 'GenBtn');
    parent.addChild(this.node);
    ensureTransform(this.node, width, height);
    this.g = this.node.addComponent(Graphics);
    paintRoundRect(this.g, width, height, 14, CocosTheme.surface(), CocosTheme.border());
    this.artNode = createUiNode('GeneratorArt');
    this.node.addChild(this.artNode);
    this.artNode.setPosition(0, -5, 0);
    this.nameLabel = makeLabel('', 20, CocosTheme.textPrimary(), true);
    this.node.addChild(this.nameLabel.node);
    ensureTransform(this.nameLabel.node, width - 8, 30);
    this.nameLabel.overflow = Label.Overflow.SHRINK;
    this.nameLabel.node.setPosition(0, height / 2 - 22, 0);
    this.subLabel = makeLabel('', 16, CocosTheme.textSecondary());
    this.node.addChild(this.subLabel.node);
    ensureTransform(this.subLabel.node, width - 8, 24);
    this.subLabel.node.setPosition(0, -height / 2 + 18, 0);
    this.subLabel.node.name = index === 4 ? 'GeneratorCharges' : 'GeneratorSubLabel';
    this.timerLabel = makeLabel('', 14, CocosTheme.textSecondary(), true);
    this.node.addChild(this.timerLabel.node);
    ensureTransform(this.timerLabel.node, width - 10, 18);
    this.timerLabel.node.name = index === 4 ? 'GeneratorRecoveryCountdown' : 'GeneratorCountdown';
    this.timerLabel.node.setPosition(0, -height / 2 + 38, 0);
    this.timerLabel.node.active = false;
    this.cooldownTrackWidth = width - 24;
    const track = createUiNode('GeneratorCooldownTrack');
    this.node.addChild(track);
    ensureTransform(track, this.cooldownTrackWidth, 4);
    track.setPosition(0, -height / 2 + 4, 0);
    paintRoundRect(track.addComponent(Graphics), this.cooldownTrackWidth, 4, 2, hexColor('#E9DED7'));
    this.cooldownFill = createUiNode('GeneratorCooldownProgress');
    track.addChild(this.cooldownFill);
    ensureTransform(this.cooldownFill, this.cooldownTrackWidth, 4);
    this.cooldownFill.getComponent(UITransform)?.setAnchorPoint(0.5, 0.5);
    this.cooldownFill.setPosition(0, 0, 0);
    paintRoundRect(this.cooldownFill.addComponent(Graphics), this.cooldownTrackWidth, 4, 2, hexColor('#E5A995'));
    this.lock = createUiNode('GeneratorLock');
    this.node.addChild(this.lock);
    this.lock.setPosition(width / 2 - 23, -height / 2 + 44, 0);
    const lockGraphics = this.lock.addComponent(Graphics);
    paintRoundRect(lockGraphics, 34, 34, 17, hexColor('#988C91', 245), hexColor('#FFFFFF'), 2);
    lockGraphics.strokeColor = hexColor('#FFFFFF');
    lockGraphics.lineWidth = 2;
    lockGraphics.roundRect(-6, -1, 12, 11, 5); lockGraphics.stroke();
    lockGraphics.fillColor = hexColor('#FFFFFF');
    lockGraphics.roundRect(-8, -10, 16, 13, 3); lockGraphics.fill();
    this.node.addComponent(Button);
    this.node.on(Button.EventType.CLICK, this.handle, this);
    this.node.addComponent(UIOpacity);
  }

  private handle = (): void => {
    this.onTap(this.id);
  };

  bind(onTap: (id: string) => void): void {
    this.onTap = onTap;
  }

  render(vm: GeneratorVm, status?: GeneratorClockStatus | null): void {
    this.id = vm.id;
    const orangeTree = vm.id === 'orange_tree';
    this.nameLabel.string = vm.displayName;
    const locked = status ? !status.unlocked : vm.locked;
    if (orangeTree && status) {
      const charges = status.charges;
      const max = status.maxCharges;
      if (locked) {
        this.subLabel.string = `Lv${vm.unlockLevel} 解锁`;
        this.timerLabel.string = '';
        this.timerLabel.node.active = false;
      } else if (charges !== null && max !== null && charges <= 0) {
        this.subLabel.string = `已耗尽 0/${max}`;
        this.timerLabel.string = status.nextRecoveryMs === null ? '恢复准备中' : `下次恢复 ${formatCountdown(status.nextRecoveryMs)}`;
        this.timerLabel.node.active = true;
      } else if (charges !== null && max !== null && charges >= max) {
        this.subLabel.string = `次数已满 ${charges}/${max}`;
        this.timerLabel.string = '随时可采摘';
        this.timerLabel.node.active = true;
      } else if (charges !== null && max !== null) {
        this.subLabel.string = `剩余次数 ${charges}/${max}`;
        this.timerLabel.string = status.nextRecoveryMs === null ? '充能中' : `下次恢复 ${formatCountdown(status.nextRecoveryMs)}`;
        this.timerLabel.node.active = true;
      } else {
        this.subLabel.string = '免体力采摘';
        this.timerLabel.string = '';
        this.timerLabel.node.active = false;
      }
    } else {
      const level = status?.level ?? 1;
      const cooldownRemaining = status?.remainingCooldownMs ?? 0;
      this.subLabel.string = vm.locked ? `Lv${vm.unlockLevel} 解锁` : `Lv${level} · 体力${status?.energyCost ?? vm.energyCost}`;
      this.timerLabel.string = vm.locked ? '' : cooldownRemaining > 0
        ? `${formatCountdown(cooldownRemaining)} · ${status?.streak ?? 0}/${status?.streakLimit ?? 0}`
        : `连续 ${status?.streak ?? 0}/${status?.streakLimit ?? 0}`;
      this.timerLabel.node.active = !vm.locked;
    }
    this.updateCooldownProgress(status, orangeTree);
    this.layoutArtAndFooter(status, orangeTree);
    this.node.getComponent(UIOpacity)!.opacity = 255;
    this.lock.active = locked && this.h >= 140;
    const opacity = this.artNode.getComponent(UIOpacity) ?? this.artNode.addComponent(UIOpacity);
    opacity.opacity = locked ? 195 : 255;
    paintRoundRect(
      this.g,
      this.w,
      this.h,
      20,
      hexColor(this.palette.fill),
      hexColor(this.palette.edge),
      2,
    );
  }

  refreshClock(status: GeneratorClockStatus | null, orangeTree: boolean): void {
    if (!status) return;
    if (orangeTree) {
      const charges = status.charges;
      const max = status.maxCharges;
      if (status.unlocked && charges !== null && max !== null) {
        this.subLabel.string = charges >= max ? `次数已满 ${charges}/${max}` : charges <= 0 ? `已耗尽 0/${max}` : `剩余次数 ${charges}/${max}`;
        this.timerLabel.string = charges >= max ? '随时可采摘' : status.nextRecoveryMs === null ? '充能中' : `下次恢复 ${formatCountdown(status.nextRecoveryMs)}`;
        this.timerLabel.node.active = true;
      }
    } else if (status.unlocked) {
      const remaining = status.remainingCooldownMs ?? 0;
      this.subLabel.string = `Lv${status.level ?? 1} · 体力${status.energyCost ?? 0}`;
      this.timerLabel.string = remaining > 0 ? `${formatCountdown(remaining)} · ${status.streak ?? 0}/${status.streakLimit ?? 0}` : `连续 ${status.streak ?? 0}/${status.streakLimit ?? 0}`;
      this.timerLabel.node.active = true;
    }
    this.updateCooldownProgress(status, orangeTree);
    this.layoutArtAndFooter(status, orangeTree);
  }

  private layoutArtAndFooter(status: GeneratorClockStatus | null | undefined, orangeTree: boolean): void {
    const compact = this.h < 140;
    if (compact) {
      this.timerLabel.node.active = false;
      this.nameLabel.node.setPosition(31, 20, 0);
      ensureTransform(this.nameLabel.node, this.w - 82, 28);
      this.subLabel.fontSize = 18; this.subLabel.lineHeight = 21; this.subLabel.enableWrapText = true;
      ensureTransform(this.subLabel.node, this.w - 82, 44); this.subLabel.node.setPosition(31, -16, 0);
      if (status?.unlocked) {
        const remaining = orangeTree ? status.nextRecoveryMs ?? 0 : status.remainingCooldownMs ?? 0;
        this.subLabel.string = orangeTree ? `${status.charges ?? 0}/${status.maxCharges ?? 0}\n${remaining > 0 ? formatCountdown(remaining) : '免体力'}`
          : `Lv${status.level ?? 1}\n${remaining > 0 ? formatCountdown(remaining) : '体力' + (status.energyCost ?? 1)}`;
      }
    } else if (status?.unlocked) {
      this.timerLabel.node.active = orangeTree ? (status.nextRecoveryMs ?? 0) > 0 : (status.remainingCooldownMs ?? 0) > 0;
    }
    const art = generatorArt(this.id);
    const imageHeight = compact ? this.h - 18 : Math.max(24, Math.min(104, this.h - (this.timerLabel.node.active ? 92 : 70)));
    this.artNode.setPosition(compact ? -this.w / 2 + 36 : 0, compact ? 0 : this.timerLabel.node.active ? 6 : -5, 0);
    if (art) applyArt(this.artNode, { ...art, preserveAspect: true }, compact ? 64 : this.w - 16, imageHeight);
  }

  private updateCooldownProgress(status: GeneratorClockStatus | null | undefined, orangeTree: boolean): void {
    const duration = status?.cooldownMs ?? 0;
    const remaining = orangeTree ? status?.nextRecoveryMs ?? 0 : status?.remainingCooldownMs ?? 0;
    const progress = duration > 0 ? Math.max(0, Math.min(1, 1 - remaining / duration)) : 1;
    const width = Math.max(2, this.cooldownTrackWidth * progress);
    ensureTransform(this.cooldownFill, width, 4);
    this.cooldownFill.getComponent(UITransform)?.setAnchorPoint(0.5, 0.5);
    this.cooldownFill.setPosition((width - this.cooldownTrackWidth) / 2, 0, 0);
    paintRoundRect(this.cooldownFill.getComponent(Graphics)!, width, 4, 2, hexColor('#E5A995'));
  }

  pop(): void {
    tween(this.node)
      .to(0.06, { scale: new Vec3(0.96, 0.96, 1) })
      .to(0.08, { scale: new Vec3(1, 1, 1) })
      .start();
  }

  matches(id: string): boolean {
    return this.id === id;
  }

  worldPosition(): Vec3 { return this.node.worldPosition.clone(); }

  destroy(): void {
    this.node.off(Button.EventType.CLICK, this.handle, this);
    this.node.destroy();
  }
}

export class CocosGeneratorDock {
  readonly node: Node;
  private buttons: GenButton[] = [];
  private orangeVm: GeneratorVm | null = null;
  private orangeStatus: OrangeTreeStatus | null = null;
  private scroll: ScrollView | null = null;
  private lastList: GeneratorVm[] = [];

  constructor(parent: Node, width: number, height: number) {
    this.node = createUiNode('GeneratorDockView');
    parent.addChild(this.node);
    ensureTransform(this.node, width, height);
    const gap = 8;
    const btnW = (width - 24 - gap * 3) / 4;
    const btnH = height - 16;
    const viewport = createUiNode('GeneratorDockViewport');
    this.node.addChild(viewport);
    ensureTransform(viewport, width, height);
    viewport.addComponent(Mask);
    const scroll = viewport.addComponent(ScrollView);
    scroll.horizontal = true;
    scroll.vertical = false;
    this.scroll = scroll;
    const contentWidth = 24 + btnW * 5 + gap * 4;
    const content = createUiNode('GeneratorDockContent');
    viewport.addChild(content);
    ensureTransform(content, contentWidth, height);
    content.getComponent(UITransform)?.setAnchorPoint(0, 0.5);
    content.setPosition(-width / 2, 0, 0);
    scroll.content = content;
    for (let i = 0; i < 5; i += 1) {
      const btn = new GenButton(content, btnW, btnH, i);
      btn.node.setPosition(12 + btnW / 2 + i * (btnW + gap), 0, 0);
      this.buttons.push(btn);
    }
  }

  bind(onTap: (id: string) => void): void {
    for (const b of this.buttons) b.bind(onTap);
  }

  render(list: GeneratorVm[], orangeStatus: OrangeTreeStatus | null = null, getStatus?: (id: string) => GeneratorClockStatus | null): void {
    this.lastList = list;
    this.orangeVm = list.find((vm) => vm.id === 'orange_tree') ?? null;
    this.orangeStatus = orangeStatus;
    const regular = list.filter((entry) => entry.id !== 'orange_tree');
    for (let i = 0; i < this.buttons.length; i += 1) {
      const button = this.buttons[i];
      const vm = i === 4 ? this.orangeVm : regular[i];
      if (vm) button.render(vm, vm.id === 'orange_tree' ? orangeStatus : getStatus?.(vm.id) ?? null);
    }
  }

  renderOrangeTree(status: OrangeTreeStatus | null): void {
    this.orangeStatus = status;
    if (this.orangeVm) this.buttons.find((button) => button.matches('orange_tree'))?.render(this.orangeVm, status);
  }

  refreshClock(getStatus: (id: string) => GeneratorClockStatus | null): void {
    for (const button of this.buttons) {
      const id = button.matches('orange_tree') ? 'orange_tree' : this.getButtonId(button);
      if (id) button.refreshClock(getStatus(id), id === 'orange_tree');
    }
  }

  private getButtonId(button: GenButton): string | null {
    const mapped = (this.lastList ?? []).find((vm) => button.matches(vm.id));
    return mapped?.id ?? null;
  }

  scrollToOrangeTree(): void { this.scroll?.scrollToRight(0.25); }

  popMatching(id: string): void {
    this.buttons.find((button) => button.matches(id))?.pop();
  }

  hintPosition(id: string): Vec3 | null {
    return this.buttons.find((button) => button.matches(id))?.worldPosition() ?? null;
  }
}
