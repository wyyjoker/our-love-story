/**
 * CocosToastView — unified toast layer (Chinese copy). Layer is pass-through.
 */
import { Node, Graphics, Label, Tween, tween, Vec3, UIOpacity } from 'cc';
import {
  CocosTheme,
  createUiNode,
  ensureTransform,
  ensureOpacity,
  makeLabel,
  paintRoundRect,
  hexColor,
} from './CocosTheme';

export type ToastTone = 'info' | 'success' | 'warn';

export const ToastMessages = {
  energyLow: '体力不足啦～\n休息一下再回来吧',
  boardFull: '棋盘满啦～\n先合成一些物品吧',
  locked: (level: number) => `达到 Lv${level} 后解锁`,
  mergeOk: '合成成功！',
  maxLevel: '已经是最高等级啦',
  orderReady: '订单完成啦，点击交付吧',
  generatorFail: '暂时无法生成',
} as const;

export class CocosToastView {
  readonly node: Node;
  private width: number;
  private current: Node | null = null;

  constructor(parent: Node, width: number, height: number) {
    this.width = width;
    this.node = createUiNode('ToastView');
    parent.addChild(this.node);
    ensureTransform(this.node, 0, 0);
    this.node.setPosition(0, height / 2 - 210, 0);
  }

  clear(): void {
    if (this.current?.isValid) {
      Tween.stopAllByTarget(this.current);
      const opacity = this.current.getComponent(UIOpacity);
      if (opacity) Tween.stopAllByTarget(opacity);
      this.current.removeFromParent();
      this.current.destroy();
    }
    this.current = null;
  }

  show(message: string, tone: ToastTone = 'info'): void {
    this.clear();
    const w = Math.min(620, this.width * 0.86);
    const multiline = message.includes('\n');
    const h = multiline ? 108 : 72;
    const item = createUiNode('Toast');
    this.current = item;
    this.node.addChild(item);
    ensureTransform(item, w, h);
    item.setPosition(0, 0, 0);
    const g = item.addComponent(Graphics);
    const accent =
      tone === 'success'
        ? hexColor('#6C8D63')
        : tone === 'warn'
          ? hexColor('#BE6F69')
          : hexColor('#9D7080');
    paintRoundRect(g, w, h, 24, hexColor('#FFFAF1', 252), accent, 2);
    const label = makeLabel(message, 26, accent, true);
    item.addChild(label.node);
    ensureTransform(label.node, w - 24, h - 6);
    label.overflow = Label.Overflow.SHRINK;
    label.enableWrapText = true;
    label.lineHeight = 34;
    const op = ensureOpacity(item);
    op.opacity = 0;
    item.setScale(0.96, 0.96, 1);
    tween(op).to(0.12, { opacity: 255 }).start();
    tween(item)
      .to(0.12, { scale: new Vec3(1, 1, 1) })
      .delay(multiline ? 2 : 1.4)
      .call(() => {
        tween(op)
          .to(0.2, { opacity: 0 })
          .call(() => item.destroy())
          .start();
      })
      .start();
  }
}
