/**
 * Runtime UI hierarchy factory (no prefab UUID required).
 * Explicit pixel layout so Status/Orders/Board/Dock are fully visible.
 * Overlay layers are pass-through (0×0 hit area) so they never block Board input.
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
};

export const DESIGN_W = 750;
export const DESIGN_H = 1334;

/** Vertical rhythm (design px). */
export const LAYOUT = {
  topPad: 28,
  bottomPad: 28,
  statusH: 112,
  ordersH: 210,
  dockH: 168,
  gap: 10,
} as const;

export function applyDesignResolution(): void {
  // 2 = FIXED_WIDTH (Fit Width)
  view.setDesignResolutionSize(DESIGN_W, DESIGN_H, 2);
}

/** Full-screen decorative layer must not swallow Board touches. */
export function makePassThrough(node: Node): void {
  const tr = node.getComponent(UITransform) ?? node.addComponent(UITransform);
  tr.setContentSize(0, 0);
  tr.setAnchorPoint(0.5, 0.5);
}

export function buildUiTree(insets: SafeInsets): UiRoots {
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

  const safeArea = createUiNode('SafeArea');
  canvas.addChild(safeArea);
  ensureTransform(safeArea, DESIGN_W, DESIGN_H);
  const safeWidget = safeArea.addComponent(Widget);
  safeWidget.isAlignTop = true;
  safeWidget.isAlignBottom = true;
  safeWidget.isAlignLeft = true;
  safeWidget.isAlignRight = true;
  const visible = view.getVisibleSize();
  const scaleX = DESIGN_W / Math.max(1, visible.width);
  const scaleY = DESIGN_H / Math.max(1, visible.height);
  // Map real safe-area screen insets into design units
  const insetTop = Math.ceil(insets.top * scaleY);
  const insetBottom = Math.ceil(insets.bottom * scaleY);
  const insetLeft = Math.ceil(insets.left * scaleX);
  const insetRight = Math.ceil(insets.right * scaleX);
  safeWidget.top = insetTop;
  safeWidget.bottom = insetBottom;
  safeWidget.left = insetLeft;
  safeWidget.right = insetRight;
  safeWidget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;
  safeWidget.updateAlignment();

  const background = createUiNode('Background');
  safeArea.addChild(background);
  const bgWidget = background.addComponent(Widget);
  bgWidget.isAlignTop = true;
  bgWidget.isAlignBottom = true;
  bgWidget.isAlignLeft = true;
  bgWidget.isAlignRight = true;
  bgWidget.updateAlignment();

  const contentH = DESIGN_H - insetTop - insetBottom;
  const contentW = DESIGN_W - insetLeft - insetRight;
  const topPad = LAYOUT.topPad;
  const bottomPad = LAYOUT.bottomPad;
  const gap = LAYOUT.gap;
  const used =
    topPad +
    LAYOUT.statusH +
    gap +
    LAYOUT.ordersH +
    gap +
    LAYOUT.dockH +
    bottomPad +
    gap;
  const boardH = Math.max(420, contentH - used);

  // Stack from top of safe content area (y from center of safeArea)
  const topY = contentH / 2;
  let cursor = topY - topPad;

  const statusSlot = createUiNode('StatusBar');
  safeArea.addChild(statusSlot);
  ensureTransform(statusSlot, contentW, LAYOUT.statusH, 0.5, 1);
  statusSlot.setPosition(0, cursor, 0);
  cursor -= LAYOUT.statusH + gap;

  const ordersSlot = createUiNode('OrderPanel');
  safeArea.addChild(ordersSlot);
  ensureTransform(ordersSlot, contentW, LAYOUT.ordersH, 0.5, 1);
  ordersSlot.setPosition(0, cursor, 0);
  cursor -= LAYOUT.ordersH + gap;

  const boardSlot = createUiNode('BoardPanel');
  safeArea.addChild(boardSlot);
  ensureTransform(boardSlot, contentW, boardH, 0.5, 1);
  boardSlot.setPosition(0, cursor, 0);
  cursor -= boardH + gap;

  const dockSlot = createUiNode('GeneratorDock');
  safeArea.addChild(dockSlot);
  ensureTransform(dockSlot, contentW, LAYOUT.dockH, 0.5, 1);
  dockSlot.setPosition(0, cursor, 0);

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

  return {
    camera: cameraNode,
    canvas,
    safeArea,
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
  if (!tr) return { width: fallbackW, height: fallbackH };
  return { width: tr.width, height: tr.height };
}
