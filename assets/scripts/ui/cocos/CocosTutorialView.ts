/**
 * CocosTutorialView — lightweight tutorial hint bubble.
 */
import { Node, Label, Graphics } from 'cc';
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

  constructor(parent: Node, width: number, height: number) {
    this.node = createUiNode('TutorialView');
    parent.addChild(this.node);
    ensureTransform(this.node, width, height);
    this.bubble = createUiNode('Bubble');
    this.node.addChild(this.bubble);
    ensureTransform(this.bubble, 420, 72);
    this.bubble.setPosition(0, height * 0.08, 0);
    const g = this.bubble.addComponent(Graphics);
    paintRoundRect(g, 420, 72, 18, CocosTheme.surface(), CocosTheme.primary(), 2);
    this.label = makeLabel('', 16, CocosTheme.textPrimary(), true);
    this.bubble.addChild(this.label.node);
    this.bubble.active = false;
  }

  show(text: string): void {
    this.label.string = text;
    this.bubble.active = true;
  }

  hide(): void {
    this.bubble.active = false;
  }
}
