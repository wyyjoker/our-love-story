/**
 * CocosDebugPanel — DEV button + actions (hidden in production feel; default collapsed).
 */
import { Node, Label, Graphics, Button } from 'cc';
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
  private actions: DebugActions;

  constructor(parent: Node, width: number, height: number, actions: DebugActions) {
    this.actions = actions;
    this.node = createUiNode('DebugView');
    parent.addChild(this.node);
    ensureTransform(this.node, width, height);

    const devBtn = createUiNode('DevBtn');
    this.node.addChild(devBtn);
    ensureTransform(devBtn, 64, 32);
    devBtn.setPosition(width / 2 - 40, height / 2 - 24, 0);
    const dg = devBtn.addComponent(Graphics);
    paintRoundRect(dg, 64, 32, 8, CocosTheme.accent());
    const devLabel = makeLabel('DEV', 12, CocosTheme.surface(), true);
    devBtn.addChild(devLabel.node);
    devBtn.addComponent(Button);
    devBtn.on(Button.EventType.CLICK, () => {
      this.panel.active = !this.panel.active;
    }, this);

    this.panel = createUiNode('Panel');
    this.node.addChild(this.panel);
    ensureTransform(this.panel, 180, 280);
    this.panel.setPosition(width / 2 - 100, height / 2 - 180, 0);
    const pg = this.panel.addComponent(Graphics);
    paintRoundRect(pg, 180, 280, 12, CocosTheme.surface(), CocosTheme.border());
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
      ensureTransform(btn, 150, 32);
      btn.setPosition(0, 110 - i * 40, 0);
      const bg = btn.addComponent(Graphics);
      paintRoundRect(bg, 150, 32, 8, CocosTheme.border());
      const label = makeLabel(text, 13, CocosTheme.textPrimary());
      btn.addChild(label.node);
      btn.addComponent(Button);
      btn.on(Button.EventType.CLICK, fn, this);
    });
  }
}
