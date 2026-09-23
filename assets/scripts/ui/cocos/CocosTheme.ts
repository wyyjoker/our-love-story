/**
 * Cocos color + layout helpers. Single place for theme → cc.Color.
 */
import { Color, UIOpacity, UITransform, Node, Label, Graphics, Layers } from 'cc';
import { Theme } from '../Theme';

export function hexColor(hex: string, alpha = 255): Color {
  const c = new Color();
  Color.fromHEX(c, hex);
  c.a = alpha;
  return c;
}

export const CocosTheme = {
  background: () => hexColor(Theme.background),
  surface: () => hexColor(Theme.surface),
  primary: () => hexColor(Theme.primary),
  secondary: () => hexColor(Theme.secondary),
  accent: () => hexColor(Theme.accent),
  textPrimary: () => hexColor(Theme.textPrimary),
  textSecondary: () => hexColor(Theme.textSecondary),
  border: () => hexColor(Theme.border),
  danger: () => hexColor(Theme.danger),
  ok: () => hexColor(Theme.ok),
  chain(chainId: string): Color {
    const map = Theme.chains as Record<string, string>;
    return hexColor(map[chainId] ?? Theme.accent);
  },
};

export function setLayerTree(node: Node, layer = Layers.Enum.UI_2D): void {
  node.layer = layer;
  for (const child of node.children) {
    setLayerTree(child, layer);
  }
}

export function ensureTransform(
  node: Node,
  width: number,
  height: number,
  anchorX = 0.5,
  anchorY = 0.5,
): UITransform {
  let tr = node.getComponent(UITransform);
  if (!tr) tr = node.addComponent(UITransform);
  tr.setContentSize(width, height);
  tr.setAnchorPoint(anchorX, anchorY);
  return tr;
}

export function makeLabel(
  text: string,
  size: number,
  color: Color,
  bold = false,
): Label {
  const node = new Node('Label');
  const tr = node.addComponent(UITransform);
  tr.setContentSize(200, size + 8);
  const label = node.addComponent(Label);
  label.string = text;
  label.fontSize = size;
  label.lineHeight = size + 4;
  label.color = color;
  label.isBold = bold;
  label.horizontalAlign = Label.HorizontalAlign.CENTER;
  label.verticalAlign = Label.VerticalAlign.CENTER;
  return label;
}

export function paintRoundRect(
  g: Graphics,
  width: number,
  height: number,
  radius: number,
  fill: Color,
  stroke?: Color,
  strokeWidth = 1,
): void {
  g.clear();
  if (stroke) {
    g.strokeColor = stroke;
    g.lineWidth = strokeWidth;
  }
  g.fillColor = fill;
  const x = -width / 2;
  const y = -height / 2;
  const r = Math.min(radius, width / 2, height / 2);
  g.roundRect(x, y, width, height, r);
  if (stroke) g.stroke();
  g.fill();
}

export function ensureOpacity(node: Node): UIOpacity {
  let op = node.getComponent(UIOpacity);
  if (!op) op = node.addComponent(UIOpacity);
  return op;
}

export function createUiNode(name: string): Node {
  const node = new Node(name);
  node.layer = Layers.Enum.UI_2D;
  node.addComponent(UITransform);
  return node;
}
