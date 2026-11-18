import { BlockInputEvents, Button, Graphics, Label, Node } from 'cc';
import type { GameContext } from '../../gameplay/GameContext';
import type { UiRoots } from './UiFactory';
import { applyArt, applyMaterialFrame, itemArt } from './CocosArt';
import { createUiNode, ensureTransform, hexColor, makeLabel, paintRoundRect, paintTactileButton, pressButton } from './CocosTheme';

/** Inspection is read-only. Only the explicit confirm button can consume a UID. */
export class CocosSupplyInspect {
  private readonly root: Node;
  constructor(private readonly game: GameContext, private readonly roots: UiRoots,
    private readonly confirm: (index: number, uid: string, definitionId: string) => void,
    private readonly guide: (index: number) => void, private readonly onClose: () => void) {
    this.root = createUiNode('SupplyInspectOverlay'); roots.modalLayer.addChild(this.root);
    ensureTransform(this.root, roots.designWidth, roots.designHeight); this.root.addComponent(BlockInputEvents);
    paintRoundRect(this.root.addComponent(Graphics), roots.designWidth, roots.designHeight, 0, hexColor('#362B2B', 166)); this.root.active = false;
  }
  open(index: number, uid: string): boolean {
    const preview = this.game.getSupplyPreview(index, uid); if (!preview) return false;
    for (const child of [...this.root.children]) { child.removeFromParent(); child.destroy(); }
    const card = createUiNode('SupplyInspectCard'); this.root.addChild(card); ensureTransform(card, 640, 626);
    const scale = Math.min(1, (this.roots.designWidth - 36) / 640, (this.roots.designHeight - 48) / 626); card.setScale(scale, scale, 1);
    paintRoundRect(card.addComponent(Graphics), 640, 626, 32, hexColor('#FFF8EE'), hexColor('#E4CFBF'), 2);
    applyMaterialFrame(card,'paper',640,626,.70);
    const text = (name: string, value: string, x: number, y: number, w: number, h: number, size: number, color = '#79564D') => {
      const label = makeLabel(value, size, hexColor(color), true); label.node.name = name; card.addChild(label.node);
      ensureTransform(label.node, w, h); label.node.setPosition(x, y, 0); label.overflow = Label.Overflow.SHRINK; label.enableWrapText = true;
    };
    const action = (name: string, caption: string, x: number, y: number, width: number, callback: () => void, primary = false) => {
      const node = createUiNode(name); card.addChild(node); ensureTransform(node, width, 72); node.setPosition(x, y, 0);
      paintTactileButton(node.addComponent(Graphics),width,72,primary?'rose':'cream');
      const label = makeLabel(caption, 26, hexColor(primary ? '#FFFFFF' : '#826353'), true); node.addChild(label.node); ensureTransform(label.node, width - 18, 62); label.overflow = Label.Overflow.SHRINK;
      pressButton(node); node.on(Button.EventType.CLICK, callback);
    };
    text('SupplyInspectTitle', '物品详情', -120, 259, 340, 42, 30);
    action('SupplyInspectClose', '关闭', 235, 259, 112, () => this.close());
    const icon = createUiNode('SupplyInspectArt'); card.addChild(icon); icon.setPosition(0, 142, 0);
    const art = itemArt(preview.itemId); if (art) applyArt(icon, { ...art, preserveAspect: true }, 154, 154);
    text('SupplyInspectName', `${preview.name} · Lv${preview.level}`, 0, 37, 560, 48, 30);
    const unit = preview.chainId === 'coin' ? '金币' : preview.chainId === 'energy' ? '体力' : '钻石';
    const groups = new Map<string, number[]>();
    preview.loot.forEach(item => { const levels = groups.get(item.chainId) ?? []; levels.push(item.level); groups.set(item.chainId, levels); });
    const options = Array.from(groups, ([chain, levels]) => {
      const min = Math.min(...levels), max = Math.max(...levels);
      return `${chain === 'coin' ? '金币' : chain === 'energy' ? '体力瓶' : '钻石'} Lv${min}${max > min ? `–${max}` : ''}`;
    }).join('、');
    text('SupplyInspectBenefit', preview.chest ? `打开后随机获得 ${preview.lootCount} 件补给物品` : `确认使用后获得 ${preview.amount} ${unit}`, 0, -27, 566, 50, 27, '#AA7556');
    text('SupplyInspectDetails', preview.chest ? `有机会获得：${options}\n空间不足的补给会放进恢复箱` : preview.chainId === 'energy' ? '奖励体力可以超过上限，重启后仍然保留' : `使用后存入${unit}余额，物品会被消耗`, 0, -99, 562, 78, 22);
    text('SupplyInspectMerge', preview.level < 5 ? '也可以先留下，拖动两个同级物品合成升级' : '已达到最高等级 Lv5', 0, -171, 560, 38, 21, '#A18B7A');
    action('SupplyInspectGuide', '查看图鉴', -148, -248, 250, () => { this.close(); this.guide(index); });
    action('SupplyInspectConfirm', preview.chest ? '确认打开' : '确认使用', 135, -248, 284, () => {
      if (!this.root.active) return;
      this.root.active = false; this.confirm(index, preview.uid, preview.itemId); this.onClose();
    }, true);
    this.root.active = true; return true;
  }
  close(): void { this.root.active = false; this.onClose(); }
  get isOpen(): boolean { return this.root.active; }
}
