import { BlockInputEvents, Button, Graphics, Label, Node, tween, UIOpacity } from 'cc';
import { applyArt, applyMaterialFrame } from './CocosArt';
import { createUiNode, ensureOpacity, ensureTransform, hexColor, makeLabel, paintRoundRect, paintTactileButton, pressButton } from './CocosTheme';

/** A quiet, full-screen entry before the interactive game UI. */
export class CocosCoverView {
  readonly node: Node;
  private entering = false;

  constructor(parent: Node, width: number, height: number, hasProgress: boolean, onEnter: () => void,
    bleed?: { width: number; height: number; x: number; y: number },
    subtitleText = '把每一个平凡的日子，拼成浪漫的家',
    personal?: { displayName?: string; message?: string }) {
    this.node = createUiNode('EntryCover');
    parent.addChild(this.node);
    ensureTransform(this.node, width, height);
    this.node.addComponent(BlockInputEvents);
    paintRoundRect(this.node.addComponent(Graphics), width, height, 0, hexColor('#F8EADB'));

    const illustration = createUiNode('CoverIllustration');
    this.node.addChild(illustration);
    const artWidth = bleed?.width ?? width;
    const artHeight = bleed?.height ?? height;
    illustration.setPosition(bleed?.x ?? 0, bleed?.y ?? 0, 0);
    const gardenAspect = 787 / 1536;
    const imageWidth = Math.max(artWidth, artHeight * gardenAspect);
    applyArt(illustration, { sheet: 'cover_garden' }, imageWidth, imageWidth / gardenAspect);
    illustration.pauseSystemEvents(true);

    const titlePanel = createUiNode('CoverTitlePanel');
    this.node.addChild(titlePanel);
    const titleWidth = Math.min(width - 64, 620);
    ensureTransform(titlePanel, titleWidth, 200);
    titlePanel.setPosition(0, height * 0.28, 0);
    paintRoundRect(titlePanel.addComponent(Graphics), titleWidth, 200, 36,
      hexColor('#FFF8EC', 224), hexColor('#FFFCF3', 236), 3);
    applyMaterialFrame(titlePanel, 'paper', titleWidth, 200, .45);

    const title = makeLabel('我们的浪漫小屋', 59, hexColor('#744238'), true);
    titlePanel.addChild(title.node);
    ensureTransform(title.node, Math.min(width - 92, 610), 72);
    title.overflow = Label.Overflow.SHRINK;
    title.node.setPosition(0, 34, 0);

    const english = makeLabel(personal?.displayName?.trim() || 'Our Love Story  ♡', 29, hexColor('#CD858B'));
    titlePanel.addChild(english.node);
    ensureTransform(english.node, 570, 43);
    english.overflow = Label.Overflow.SHRINK;
    english.node.setPosition(0, -22, 0);

    const subtitle = makeLabel(subtitleText, 20, hexColor('#936E65'));
    titlePanel.addChild(subtitle.node);
    ensureTransform(subtitle.node, 590, 36);
    subtitle.overflow = Label.Overflow.SHRINK;
    subtitle.node.setPosition(0, -67, 0);

    if (personal?.message?.trim()) {
      const dedication = makeLabel(personal.message.trim(), 26, hexColor('#744940'), true);
      dedication.node.name = 'CoverDedication';
      this.node.addChild(dedication.node);
      ensureTransform(dedication.node, Math.min(width - 96, 590), 108);
      dedication.enableWrapText = true;
      dedication.overflow = Label.Overflow.SHRINK;
      dedication.lineHeight = 36;
      dedication.node.setPosition(0, height * 0.28 - 165, 0);
    }

    const start = createUiNode('EnterGame');
    this.node.addChild(start);
    ensureTransform(start, 380, 94);
    start.setPosition(0, -height * 0.36, 0);
    paintTactileButton(start.addComponent(Graphics), 380, 94, 'rose');
    const startLabel = makeLabel(hasProgress ? '回到我们的小屋  ›' : '进入我们的小屋  ›', 32, hexColor('#FFFFFF'), true);
    start.addChild(startLabel.node);
    ensureTransform(startLabel.node, 350, 68);
    pressButton(start);
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
