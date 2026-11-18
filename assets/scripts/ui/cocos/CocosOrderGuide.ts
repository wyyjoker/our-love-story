import { BlockInputEvents, Button, Graphics, Label, Mask, Node, ScrollView, UITransform } from 'cc';
import type { GameContext } from '../../gameplay/GameContext';
import type { UiRoots } from './UiFactory';
import { applyArt, applyMaterialFrame, itemArt } from './CocosArt';
import { createUiNode, ensureTransform, hexColor, makeLabel, paintRoundRect, paintTactileButton, pressButton } from './CocosTheme';

export class CocosOrderGuide {
  private readonly root: Node;
  constructor(private readonly game: GameContext, roots: UiRoots, private readonly onLocate: (uid: string, item: string, generator: string | null, storedUid?: string) => void, private readonly onClose: () => void) {
    this.root = createUiNode('OrderGuideOverlay'); roots.modalLayer.addChild(this.root);
    ensureTransform(this.root, roots.designWidth, roots.designHeight); this.root.addComponent(BlockInputEvents);
    paintRoundRect(this.root.addComponent(Graphics), roots.designWidth, roots.designHeight, 0, hexColor('#362B2B', 160)); this.root.active = false;
  }
  open(uid: string, itemId: string): boolean {
    const result = this.game.getOrderTracking(uid, itemId); if (!result.ok) return false;
    const g = result.guide;
    for (const node of [...this.root.children]) { node.removeFromParent(); node.destroy(); }
    const card = createUiNode('OrderGuideCard'); this.root.addChild(card); ensureTransform(card, 680, 590);
    // The modal's own rect already follows the safe-area canvas dimensions.
    const rect = this.root.getComponent(UITransform);
    const scale = Math.min(1, ((rect?.width ?? 750) - 32) / 680, ((rect?.height ?? 1334) - 48) / 590); card.setScale(scale, scale, 1);
    paintRoundRect(card.addComponent(Graphics), 680, 590, 30, hexColor('#FFF9F0'), hexColor('#E8D7C5'), 2);
    applyMaterialFrame(card,'paper',680,590,.70);
    const write = (name: string, value: string, x: number, y: number, w: number, h: number, size: number, color = '#79564D') => {
      const label = makeLabel(value, size, hexColor(color), true); label.node.name = name; card.addChild(label.node);
      ensureTransform(label.node, w, h); label.node.setPosition(x, y, 0); label.overflow = Label.Overflow.SHRINK; label.enableWrapText = true; return label;
    };
    const action = (name: string, caption: string, x: number, y: number, w: number, callback: () => void, primary = false) => {
      const node = createUiNode(name); card.addChild(node); ensureTransform(node, w, 66); node.setPosition(x, y, 0);
      paintTactileButton(node.addComponent(Graphics),w,66,primary?'rose':'cream');
      const label = makeLabel(caption, 24, hexColor(primary ? '#FFFFFF' : '#825F52'), true); node.addChild(label.node); ensureTransform(label.node, w - 16, 60); label.overflow = Label.Overflow.SHRINK;
      pressButton(node); node.on(Button.EventType.CLICK, callback);
    };
    write('OrderGuideTitle', '订单备货', -150, 243, 300, 44, 30);
    action('OrderGuideClose', '关闭', 254, 243, 104, () => this.close());
    const art = createUiNode('OrderGuideTargetArt'); card.addChild(art); art.setPosition(-246, 153, 0);
    const targetArt = itemArt(itemId); if (targetArt) applyArt(art, { ...targetArt, preserveAspect: true }, 96, 96);
    write('OrderGuideTarget', `${g.name} · Lv${g.level}`, 49, 177, 470, 40, 29);
    write('OrderGuideQuantity', g.missing ? `需要 ${g.count} · 棋盘已有 ${g.have} · 还缺 ${g.missing}` : '✓ 这件物品已备齐，优先交付订单', 49, 133, 470, 42, 23, g.missing ? '#A0775F' : '#64896B');
    const source = g.source;
    const time = source?.recoveryMs ? ` · 约 ${Math.ceil(source.recoveryMs / 60000)} 分钟恢复` : '';
    const sourceDetails = source?.storedUid ? ' · 在背包中' : source?.sideDrop ? ' · 概率副产物'
      : source?.charges != null ? ` · 剩余 ${source.charges} 次免费采摘` : ` · 每次 ${source?.energyCost} 体力`;
    write('OrderGuideSource', source ? `来源：${source.name} Lv${source.level}${sourceDetails}${time}` : '已有物品可用于交付，当前没有可生成的来源', 0, 77, 620, 52, 22);
    const viewport = createUiNode('OrderGuidePath'); card.addChild(viewport); ensureTransform(viewport, 616, 132); viewport.setPosition(0, -17, 0); viewport.addComponent(Mask);
    const content = createUiNode('OrderGuidePathContent'); viewport.addChild(content); const width = Math.max(616, g.path.length * 124);
    ensureTransform(content, width, 132, 0, .5); content.setPosition(-308, 0, 0);
    const scroll = viewport.addComponent(ScrollView); scroll.content = content; scroll.horizontal = true; scroll.vertical = false; scroll.elastic = false;
    g.path.forEach((entry, index) => {
      const tile = createUiNode(`OrderPath_${entry.id}`); content.addChild(tile); ensureTransform(tile, 112, 120); tile.setPosition(62 + index * 124, 0, 0);
      paintRoundRect(tile.addComponent(Graphics), 112, 120, 18, hexColor(entry.id === itemId ? '#F6DDE2' : '#F4EBDF'));
      const label = makeLabel(entry.discovered || entry.id === itemId ? `Lv${entry.level}` : '?', 22, hexColor('#9C7869'), true); tile.addChild(label.node); label.node.setPosition(0, -40, 0); ensureTransform(label.node, 100, 30);
      const icon = createUiNode('OrderPathArt'); tile.addChild(icon); icon.setPosition(0, 15, 0);
      const a = entry.discovered || entry.id === itemId ? itemArt(entry.id) : null;
      if (a) applyArt(icon, { ...a, preserveAspect: true }, 76, 76);
      else { const unknown = makeLabel('?', 42, hexColor('#B09B8C'), true); icon.addChild(unknown.node); ensureTransform(unknown.node, 76, 76); }
    });
    write('OrderGuideEstimate', g.missing ? `按最低产出估算：补生成 ${g.spawnEstimate} 件 · 合成 ${g.mergeEstimate} 次` : '棋盘上带绿色订单角标的物品，请先留给顾客', 0, -112, 620, 48, 23);
    write('OrderGuideNote', g.backpackCount ? `背包另有 ${g.backpackCount} 件，取回后才计入交付` : '两个同级合成下一级 · 路径可左右滑动查看', 0, -159, 610, 34, 20, '#AA8A78');
    action('OrderGuideLocate', source?.storedUid ? '打开背包 · 取回生成器' : source ? '定位来源 · 开始备货' : '定位棋盘物品',
      0, -236, 520, () => { this.close(); this.onLocate(uid, itemId, source?.id ?? null, source?.storedUid); }, true);
    this.root.active = true; return true;
  }
  close(): void { this.root.active = false; this.onClose(); }
  get isOpen(): boolean { return this.root.active; }
}
