/**
 * Runtime UI hierarchy factory.
 * Widget-pinned layout so Status/Orders/Board/Dock follow the real Canvas size
 * (Canvas component resizes to visible size — do not assume 750x1334 node size).
 * Overlay layers are pass-through (0x0 hit) so they never block Board input.
 */
import {
  Node,
  UITransform,
  Widget,
  Layers,
  view,
  Canvas,
  Camera,
} from 'cc';
import { createUiNode, ensureTransform, setLayerTree } from './CocosTheme';
import type { SafeInsets } from '../../platform/cocos/CocosSafeArea';

export type UiRoots = {
  camera: Node;
  canvas: Node;
  safeArea: Node;
  background: Node;
  statusSlot: Node;
  ordersSlot: Node;
  boardSlot: Node;
  dockSlot: Node;
  dragLayer: Node;
  toastLayer: Node;
  tutorialLayer: Node;
  modalLayer: Node;
  debugLayer: Node;
  designWidth: number;
  designHeight: number;
};

export const DESIGN_W = 750;
export const DESIGN_H = 1334;

const TOP_BAR_H = 120;
const ORDERS_H = 180;
const DOCK_H = 140;
const EDGE = 12;
const GAP = 8;

export function applyDesignResolution(): void {
  view.setDesignResolutionSize(DESIGN_W, DESIGN_H, 2); // FIXED_WIDTH
  const d = view.getDesignResolutionSize();
  const v = view.getVisibleSize();
  console.log('[UI] design', d.width, d.height, 'visible', v.width, v.height);
}

export function makePassThrough(node: Node): void {
  const tr = node.getComponent(UITransform) ?? node.addComponent(UITransform);
  tr.setContentSize(0, 0);
  tr.setAnchorPoint(0.5, 0.5);
}

function pinBox(
  node: Node,
  height: number,
  opts: { top?: number; bottom?: number },
): void {
  const tr = ensureTransform(node, 400, height, 0.5, 0.5);
  void tr;
  const w = node.addComponent(Widget);
  w.isAlignLeft = true;
  w.isAlignRight = true;
  w.isAlignHorizontalCenter = true;
  w.left = EDGE;
  w.right = EDGE;
  if (opts.top !== undefined) {
    w.isAlignTop = true;
    w.top = opts.top;
  }
  if (opts.bottom !== undefined) {
    w.isAlignBottom = true;
    w.bottom = opts.bottom;
  }
  w.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;
  w.updateAlignment();
}

function pinFill(
  node: Node,
  top: number,
  bottom: number,
): void {
  ensureTransform(node, 400, 100, 0.5, 0.5);
  const w = node.addComponent(Widget);
  w.isAlignTop = true;
  w.isAlignBottom = true;
  w.isAlignLeft = true;
  w.isAlignRight = true;
  w.top = top;
  w.bottom = bottom;
  w.left = EDGE;
  w.right = EDGE;
  w.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;
  w.updateAlignment();
}

export function buildUiTree(insets: SafeInsets): UiRoots {
  applyDesignResolution();

  const cameraNode = new Node('UICamera');
  cameraNode.layer = Layers.Enum.UI_2D;
  const cam = cameraNode.addComponent(Camera);
  cam.projection = Camera.ProjectionType.ORTHO;
  cam.orthoHeight = DESIGN_H / 2;
  cam.clearFlags = Camera.ClearFlag.SOLID_COLOR;
  cam.visibility = Layers.Enum.UI_2D;
  cam.priority = 10;

  const canvas = new Node('Canvas');
  canvas.layer = Layers.Enum.UI_2D;
  ensureTransform(canvas, DESIGN_W, DESIGN_H, 0.5, 0.5);
  const canvasComp = canvas.addComponent(Canvas);
  canvasComp.cameraComponent = cam;

  const insetTop = Math.min(56, 12 + Math.round(insets.top * 0.15));
  const insetBottom = Math.min(40, 8 + Math.round(insets.bottom * 0.15));

  const background = createUiNode('Background');
  canvas.addChild(background);
  pinFill(background, 0, 0);

  // Board first (under), then dock, then orders, then status (top chrome)
  const boardTop = insetTop + TOP_BAR_H + GAP + ORDERS_H + GAP;
  const boardBottom = insetBottom + DOCK_H + GAP;

  const boardSlot = createUiNode('BoardPanel');
  canvas.addChild(boardSlot);
  pinFill(boardSlot, boardTop, boardBottom);

  const dockSlot = createUiNode('GeneratorDock');
  canvas.addChild(dockSlot);
  pinBox(dockSlot, DOCK_H, { bottom: insetBottom + EDGE });

  const ordersSlot = createUiNode('OrderPanel');
  canvas.addChild(ordersSlot);
  pinBox(ordersSlot, ORDERS_H, { top: insetTop + TOP_BAR_H + GAP });

  const statusSlot = createUiNode('StatusBar');
  canvas.addChild(statusSlot);
  pinBox(statusSlot, TOP_BAR_H, { top: insetTop });

  const dragLayer = createUiNode('DragLayer');
  canvas.addChild(dragLayer);
  makePassThrough(dragLayer);

  const toastLayer = createUiNode('ToastLayer');
  canvas.addChild(toastLayer);
  makePassThrough(toastLayer);

  const tutorialLayer = createUiNode('TutorialLayer');
  canvas.addChild(tutorialLayer);
  makePassThrough(tutorialLayer);

  const modalLayer = createUiNode('ModalLayer');
  canvas.addChild(modalLayer);
  makePassThrough(modalLayer);

  const debugLayer = createUiNode('DebugLayer');
  canvas.addChild(debugLayer);
  makePassThrough(debugLayer);

  setLayerTree(cameraNode, Layers.Enum.UI_2D);
  setLayerTree(canvas, Layers.Enum.UI_2D);

  // Force alignment after hierarchy is complete
  for (const n of [background, boardSlot, dockSlot, ordersSlot, statusSlot]) {
    n.getComponent(Widget)?.updateAlignment();
  }

  const canvasTr = canvas.getComponent(UITransform);
  console.log('[UI] canvas size', canvasTr?.width, canvasTr?.height);
  console.log('[UI] slots', {
    status: statusSlot.getComponent(UITransform)?.height,
    orders: ordersSlot.getComponent(UITransform)?.height,
    board: boardSlot.getComponent(UITransform)?.height,
    dock: dockSlot.getComponent(UITransform)?.height,
  });

  return {
    camera: cameraNode,
    canvas,
    safeArea: canvas,
    background,
    statusSlot,
    ordersSlot,
    boardSlot,
    dockSlot,
    dragLayer,
    toastLayer,
    tutorialLayer,
    modalLayer,
    debugLayer,
    designWidth: DESIGN_W,
    designHeight: DESIGN_H,
  };
}

export function attachUiToScene(sceneRoot: Node, roots: UiRoots): void {
  sceneRoot.addChild(roots.camera);
  sceneRoot.addChild(roots.canvas);
}

export function sizeOf(
  node: Node,
  fallbackW: number,
  fallbackH: number,
): { width: number; height: number } {
  const tr = node.getComponent(UITransform);
  return {
    width: tr?.width || fallbackW,
    height: tr?.height || fallbackH,
  };
}
