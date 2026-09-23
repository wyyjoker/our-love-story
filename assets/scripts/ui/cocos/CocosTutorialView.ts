/**
 * CocosTutorialView — hint bubble (never blocks board input).
 */
import { Button, Node, Label, Graphics } from 'cc';
import {
  CocosTheme,
  createUiNode,
  ensureTransform,
  makeLabel,
  paintRoundRect,
} from './CocosTheme';

export class CocosTutorialView {
  readonly node: Node;
  private bubble: Node;
  private label: Label;
  private dismissedText = '';

  constructor(parent: Node, width: number, height: number) {
    this.node = createUiNode('TutorialView');
    parent.addChild(this.node);
    ensureTransform(this.node, 0, 0);
    this.bubble = createUiNode('Bubble');
    this.node.addChild(this.bubble);
    const bw = Math.min(420, width * 0.7);
    ensureTransform(this.bubble, bw, 64);
    this.bubble.setPosition(0, height * 0.12, 0);
    const g = this.bubble.addComponent(Graphics);
    paintRoundRect(g, bw, 64, 18, CocosTheme.surface(), CocosTheme.primary(), 2);
    this.label = makeLabel('', 16, CocosTheme.textPrimary(), true);
    this.bubble.addChild(this.label.node);
    const close = createUiNode('DismissHint');
    this.bubble.addChild(close);
    ensureTransform(close, 44, 44);
    close.setPosition(bw / 2 - 22, 0, 0);
    const closeLabel = makeLabel('×', 25, CocosTheme.textSecondary(), true);
    close.addChild(closeLabel.node);
    close.addComponent(Button);
    close.on(Button.EventType.CLICK, () => {
      this.dismissedText = this.label.string;
      this.bubble.active = false;
    });
    this.bubble.active = false;
  }

  show(text: string): void {
    this.label.string = text;
    this.bubble.active = text !== this.dismissedText;
  }

  hide(): void {
    this.bubble.active = false;
  }
}
