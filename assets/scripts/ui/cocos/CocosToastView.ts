/**
 * CocosToastView — unified toast layer (Chinese copy). Layer is pass-through.
 */
import { Node, Graphics, tween, Vec3 } from 'cc';
import {
  CocosTheme,
  createUiNode,
  ensureTransform,
  ensureOpacity,
  makeLabel,
  paintRoundRect,
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

  constructor(parent: Node, width: number, height: number) {
    this.width = width;
    this.node = createUiNode('ToastView');
    parent.addChild(this.node);
    ensureTransform(this.node, 0, 0);
    this.node.setPosition(0, -height * 0.18, 0);
  }

  show(message: string, tone: ToastTone = 'info'): void {
    const w = Math.min(400, this.width * 0.7);
    const h = 56;
    const item = createUiNode('Toast');
    this.node.addChild(item);
    ensureTransform(item, w, h);
    item.setPosition(0, 0, 0);
    const g = item.addComponent(Graphics);
    const bg =
      tone === 'success'
        ? CocosTheme.ok()
        : tone === 'warn'
          ? CocosTheme.danger()
          : CocosTheme.textPrimary();
    paintRoundRect(g, w, h, 28, bg);
    const label = makeLabel(message, 15, CocosTheme.surface(), true);
    item.addChild(label.node);
    const op = ensureOpacity(item);
    op.opacity = 0;
    item.setScale(0.96, 0.96, 1);
    tween(op).to(0.12, { opacity: 255 }).start();
    tween(item)
      .to(0.12, { scale: new Vec3(1, 1, 1) })
      .delay(1.4)
      .call(() => {
        tween(op)
          .to(0.2, { opacity: 0 })
          .call(() => item.destroy())
          .start();
      })
      .start();
  }
}
