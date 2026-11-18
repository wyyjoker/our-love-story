/**
 * Cocos color + layout helpers. Single place for theme → cc.Color.
 */
import { Button, Color, UIOpacity, UITransform, Node, Label, Graphics, Layers } from 'cc';
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
  const node = createUiNode('Label');
  const tr = node.getComponent(UITransform)!;
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

/** Shared shallow paper buttons, lit from the upper left like the cottage art. */
export function paintTactileButton(g:Graphics,width:number,height:number,tone:'rose'|'cream'|'sage'|'gold'='cream',enabled=true):void {
  const colors={rose:{fill:'#DFA0AD',edge:'#C98796',light:'#FFE8E7'},cream:{fill:'#FFF2DF',edge:'#D9C2A5',light:'#FFFFFF'},
    sage:{fill:'#DCE7CC',edge:'#B7C7A3',light:'#FBF9E6'},gold:{fill:'#F2DFB7',edge:'#D6B882',light:'#FFF8DB'}};
  const palette=enabled?colors[tone]:{fill:'#EAE2D6',edge:'#D7CABC',light:'#F6F0E7'};
  const radius=Math.min(23,height/2);g.clear();
  g.fillColor=hexColor('#70513B',enabled?30:14);g.roundRect(-width/2,-height/2-3,width,height,radius);g.fill();
  g.fillColor=hexColor(palette.fill);g.strokeColor=hexColor(palette.edge);g.lineWidth=1.5;g.roundRect(-width/2,-height/2,width,height,radius);g.fill();g.stroke();
  g.strokeColor=hexColor(palette.light,160);g.lineWidth=2;g.moveTo(-width/2+18,height/2-6);g.lineTo(width/2-18,height/2-6);g.stroke();
}

export function pressButton(node:Node):Button {
  const button=node.getComponent(Button)??node.addComponent(Button);
  button.transition=Button.Transition.SCALE;button.zoomScale=.975;button.duration=.07;return button;
}

export function createUiNode(name: string): Node {
  const node = new Node(name);
  node.layer = Layers.Enum.UI_2D;
  node.addComponent(UITransform);
  return node;
}
