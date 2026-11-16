import { BlockInputEvents, Button, Graphics, Label, Node } from 'cc';
import type { GameContext } from '../../gameplay/GameContext';
import type { UiRoots } from './UiFactory';
import { CocosTheme, createUiNode, ensureTransform, hexColor, makeLabel, paintRoundRect } from './CocosTheme';

function label(parent: Node, value: string, x: number, y: number, width: number, height: number, size: number, color = CocosTheme.textPrimary(), bold = false): void {
  const view = makeLabel(value, size, color, bold);
  parent.addChild(view.node);
  ensureTransform(view.node, width, height);
  view.enableWrapText = true;
  view.overflow = Label.Overflow.SHRINK;
  view.node.setPosition(x, y, 0);
}

export class CocosSettingsPanel {
  private readonly root: Node;
  private readonly soundValue: Node;
  private readonly vibrationValue: Node;
  private readonly soundLabel: ReturnType<typeof makeLabel>;
  private readonly vibrationLabel: ReturnType<typeof makeLabel>;

  constructor(private readonly game: GameContext, roots: UiRoots, private readonly onClose?: () => void, previewFeedback?: () => void) {
    this.root = createUiNode('SettingsOverlay');
    roots.modalLayer.addChild(this.root);
    ensureTransform(this.root, roots.designWidth, roots.designHeight);
    this.root.addComponent(BlockInputEvents);
    this.root.active = false;
    paintRoundRect(this.root.addComponent(Graphics), roots.designWidth, roots.designHeight, 0, hexColor('#362B2B', 174));

    const panel = createUiNode('SettingsPanel');
    this.root.addChild(panel);
    ensureTransform(panel, 580, 580);
    const scale = Math.min(1, (roots.designWidth - 32) / 580, (roots.designHeight - 48) / 580);
    panel.setScale(scale, scale, 1);
    paintRoundRect(panel.addComponent(Graphics), 580, 580, 28, hexColor('#FFF8F1'), hexColor('#EDD9CD'), 2);
    label(panel, '声音与触感', 0, 198, 390, 56, 32, hexColor('#68423A'), true);
    label(panel, '细腻轻柔，不打扰故事阅读', 0, 151, 470, 36, 20, hexColor('#9A7770'));

    const soundRow = createUiNode('SoundSettingsRow');
    panel.addChild(soundRow);
    ensureTransform(soundRow, 500, 90);
    soundRow.setPosition(0, 45, 0);
    paintRoundRect(soundRow.addComponent(Graphics), 500, 90, 22, hexColor('#FFFDF8'), hexColor('#F0DED5'), 1);
    label(soundRow, '合成与交付音效', -85, 0, 300, 44, 23, hexColor('#68423A'), true);
    this.soundValue = this.makeToggle(soundRow, 'SoundToggle', 170, () => this.toggle('soundEnabled'));
    this.soundLabel = this.findToggleLabel(this.soundValue);

    const vibrationRow = createUiNode('VibrationSettingsRow');
    panel.addChild(vibrationRow);
    ensureTransform(vibrationRow, 500, 90);
    vibrationRow.setPosition(0, -65, 0);
    paintRoundRect(vibrationRow.addComponent(Graphics), 500, 90, 22, hexColor('#FFFDF8'), hexColor('#F0DED5'), 1);
    label(vibrationRow, '轻微震动反馈', -85, 0, 300, 44, 23, hexColor('#68423A'), true);
    this.vibrationValue = this.makeToggle(vibrationRow, 'VibrationToggle', 170, () => this.toggle('vibrationEnabled'));
    this.vibrationLabel = this.findToggleLabel(this.vibrationValue);

    const preview = createUiNode('PreviewFeedback'); panel.addChild(preview); ensureTransform(preview, 320, 68); preview.setPosition(0, -133, 0);
    paintRoundRect(preview.addComponent(Graphics), 320, 68, 24, hexColor('#F6DDD1'));
    label(preview, '试听音效与试震', 0, 0, 300, 54, 24, hexColor('#805A50'), true);
    preview.addComponent(Button); preview.on(Button.EventType.CLICK, () => previewFeedback?.());
    label(panel, '按当前开关试听；震动需要设备支持。', 0, -193, 510, 38, 21, hexColor('#9A7770'));
    const close = createUiNode('SettingsClose');
    panel.addChild(close);
    ensureTransform(close, 240, 68);
    close.setPosition(0, -245, 0);
    paintRoundRect(close.addComponent(Graphics), 240, 68, 24, CocosTheme.primary());
    label(close, '完成', 0, 0, 160, 48, 23, hexColor('#FFFFFF'), true);
    close.addComponent(Button);
    close.on(Button.EventType.CLICK, () => this.close());
    this.renderValues();
  }

  open(): void {
    this.renderValues();
    this.root.active = true;
  }

  close(): void {
    this.root.active = false;
    this.onClose?.();
  }

  get isOpen(): boolean { return this.root.active; }

  private makeToggle(parent: Node, name: string, x: number, tap: () => void): Node {
    const toggle = createUiNode(name);
    parent.addChild(toggle);
    ensureTransform(toggle, 112, 68);
    toggle.setPosition(x, 0, 0);
    const g = toggle.addComponent(Graphics);
    paintRoundRect(g, 112, 68, 24, hexColor('#E8DED8'));
    const value = makeLabel('关', 20, hexColor('#FFFFFF'), true);
    toggle.addChild(value.node);
    ensureTransform(value.node, 96, 48);
    toggle.addComponent(Button);
    toggle.on(Button.EventType.CLICK, tap);
    return toggle;
  }

  private findToggleLabel(toggle: Node): ReturnType<typeof makeLabel> {
    const node = toggle.children[0];
    const label = node?.getComponent(Label);
    if (!label) throw new Error('Settings toggle label missing');
    return label as ReturnType<typeof makeLabel>;
  }

  private toggle(key: 'soundEnabled' | 'vibrationEnabled'): void {
    this.game.setPreferences({ [key]: !this.game.preferences[key] });
    this.renderValues();
  }

  private renderValues(): void {
    const preferences = this.game.preferences;
    this.soundLabel.string = preferences.soundEnabled ? '开' : '关';
    this.vibrationLabel.string = preferences.vibrationEnabled ? '开' : '关';
    const sound = this.soundValue.getComponent(Graphics);
    const vibration = this.vibrationValue.getComponent(Graphics);
    if (sound) paintRoundRect(sound, 112, 68, 24, preferences.soundEnabled ? CocosTheme.ok() : hexColor('#BDB2AD'));
    if (vibration) paintRoundRect(vibration, 112, 68, 24, preferences.vibrationEnabled ? CocosTheme.ok() : hexColor('#BDB2AD'));
  }
}
