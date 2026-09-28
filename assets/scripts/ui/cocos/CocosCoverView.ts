import { BlockInputEvents, Button, Graphics, Label, Node, tween, UIOpacity } from 'cc';
import { applyArt } from './CocosArt';
import { createUiNode, ensureOpacity, ensureTransform, hexColor, makeLabel, paintRoundRect } from './CocosTheme';

/** A quiet, full-screen entry before the interactive game UI. */
export class CocosCoverView {
  readonly node: Node;
  private entering = false;

  constructor(parent: Node, width: number, height: number, hasProgress: boolean, onEnter: () => void) {
    this.node = createUiNode('EntryCover');
    parent.addChild(this.node);
    ensureTransform(this.node, width, height);
    this.node.addComponent(BlockInputEvents);
    paintRoundRect(this.node.addComponent(Graphics), width, height, 0, hexColor('#F8EADB'));

    const illustration = createUiNode('CoverIllustration');
    this.node.addChild(illustration);
    applyArt(illustration, { sheet: 'cover_background' }, Math.max(width, height * 750 / 1334), height);
    illustration.pauseSystemEvents(true);

    const titlePanel = createUiNode('CoverTitlePanel');
    this.node.addChild(titlePanel);
    ensureTransform(titlePanel, Math.min(width - 64, 650), 198);
    titlePanel.setPosition(0, height * 0.31, 0);
    paintRoundRect(titlePanel.addComponent(Graphics), Math.min(width - 64, 650), 198, 30, hexColor('#FFF9F0', 214), hexColor('#FFFDF8', 240), 2);

    const title = makeLabel('我们的浪漫小屋', 52, hexColor('#744940'), true);
    titlePanel.addChild(title.node);
    ensureTransform(title.node, Math.min(width - 92, 610), 72);
    title.overflow = Label.Overflow.SHRINK;
    title.node.setPosition(0, 34, 0);

    const english = makeLabel('Our Love Story  ♡', 29, hexColor('#CD858B'));
    titlePanel.addChild(english.node);
    ensureTransform(english.node, 570, 43);
    english.node.setPosition(0, -22, 0);

    const subtitle = makeLabel('把每一个平凡的日子，拼成浪漫的家', 20, hexColor('#936E65'));
    titlePanel.addChild(subtitle.node);
    ensureTransform(subtitle.node, 590, 36);
    subtitle.overflow = Label.Overflow.SHRINK;
    subtitle.node.setPosition(0, -67, 0);

    const start = createUiNode('EnterGame');
    this.node.addChild(start);
    ensureTransform(start, 380, 86);
    start.setPosition(0, -height * 0.31, 0);
    paintRoundRect(start.addComponent(Graphics), 380, 86, 43, hexColor('#E9899B'), hexColor('#FFF9F5'), 4);
    const startLabel = makeLabel(hasProgress ? '继续我们的小屋  ›' : '开始布置小屋  ›', 31, hexColor('#FFFFFF'), true);
    start.addChild(startLabel.node);
    ensureTransform(startLabel.node, 350, 68);
    start.addComponent(Button);
    start.on(Button.EventType.CLICK, () => {
      if (this.entering) return;
      this.entering = true;
      const opacity: UIOpacity = ensureOpacity(this.node);
      tween(opacity).to(0.22, { opacity: 0 }).call(() => {
        this.node.active = false;
        onEnter();
      }).start();
    });
  }
}
