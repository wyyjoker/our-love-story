/**
 * CocosDebugPanel — DEV button + actions (panel only; layer is pass-through).
 */
import { Node, Graphics, Button } from 'cc';
import {
  CocosTheme,
  createUiNode,
  ensureTransform,
  makeLabel,
  paintRoundRect,
} from './CocosTheme';

export type DebugActions = {
  addEnergy: () => void;
  addXp: () => void;
  addCoins: () => void;
  clearBoard: () => void;
  resetSave: () => void;
  spawnItem: () => void;
};

export class CocosDebugPanel {
  readonly node: Node;
  private panel: Node;

  constructor(
    parent: Node,
    width: number,
    height: number,
    actions: DebugActions,
  ) {
    this.node = createUiNode('DebugView');
    parent.addChild(this.node);
    ensureTransform(this.node, 0, 0);

    const devBtn = createUiNode('DevBtn');
    this.node.addChild(devBtn);
    ensureTransform(devBtn, 56, 28);
    devBtn.setPosition(width / 2 - 40, height / 2 - 28, 0);
    const dg = devBtn.addComponent(Graphics);
    paintRoundRect(dg, 56, 28, 8, CocosTheme.accent());
    const devLabel = makeLabel('DEV', 12, CocosTheme.surface(), true);
    devBtn.addChild(devLabel.node);
    devBtn.addComponent(Button);
    devBtn.on(
      Button.EventType.CLICK,
      () => {
        this.panel.active = !this.panel.active;
      },
      this,
    );

    this.panel = createUiNode('Panel');
    this.node.addChild(this.panel);
    ensureTransform(this.panel, 160, 260);
    this.panel.setPosition(width / 2 - 90, height / 2 - 170, 0);
    const pg = this.panel.addComponent(Graphics);
    paintRoundRect(pg, 160, 260, 12, CocosTheme.surface(), CocosTheme.border());
    this.panel.active = false;

    const items: Array<[string, () => void]> = [
      ['+50 体力', actions.addEnergy],
      ['+100 XP', actions.addXp],
      ['+1000 金币', actions.addCoins],
      ['清空棋盘', actions.clearBoard],
      ['重置存档', actions.resetSave],
      ['生成物品', actions.spawnItem],
    ];
    items.forEach((entry, i) => {
      const [text, fn] = entry;
      const btn = createUiNode(`Btn${i}`);
      this.panel.addChild(btn);
      ensureTransform(btn, 140, 30);
      btn.setPosition(0, 100 - i * 38, 0);
      const bg = btn.addComponent(Graphics);
      paintRoundRect(bg, 140, 30, 8, CocosTheme.border());
      const label = makeLabel(text, 13, CocosTheme.textPrimary());
      btn.addChild(label.node);
      btn.addComponent(Button);
      btn.on(Button.EventType.CLICK, fn, this);
    });
  }
}
