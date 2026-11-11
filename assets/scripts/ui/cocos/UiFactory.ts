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
  ResolutionPolicy,
} from 'cc';
import { createUiNode, ensureTransform, setLayerTree } from './CocosTheme';
import type { SafeInsets } from '../../platform/cocos/CocosSafeArea';
import { safeContentRect } from '../../presentation/UiSafety';

export type UiRoots = {
  camera: Node;
  canvas: Node;
  safeArea: Node;
  background: Node;
  contentLayer: Node;
  statusSlot: Node;
  ordersSlot: Node;
  boardSlot: Node;
  dockSlot: Node;
  navLayer: Node;
  dragLayer: Node;
  toastLayer: Node;
  tutorialLayer: Node;
  modalLayer: Node;
  rewardLayer: Node;
  debugLayer: Node;
  coverLayer: Node;
  designWidth: number;
  designHeight: number;
};

export const DESIGN_W = 750;
export const DESIGN_H = 1334;

const TOP_BAR_H = 120;
const ORDERS_H = 180;
const DOCK_H = 140;
const NAV_H = 88;
const EDGE = 12;
const GAP = 8;

export function applyDesignResolution(): void {
  view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.FIXED_WIDTH);
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
  const visible = view.getVisibleSize();
  const fullW = visible.width;
  const fullH = visible.height;
  const safe = safeContentRect(fullW, fullH, insets);
  const layoutW = safe.width;
  const layoutH = safe.height;

  const cameraNode = new Node('UICamera');
  cameraNode.layer = Layers.Enum.UI_2D;
  const cam = cameraNode.addComponent(Camera);
  cam.projection = Camera.ProjectionType.ORTHO;
  cam.orthoHeight = fullH / 2;
  cam.clearFlags = Camera.ClearFlag.SOLID_COLOR;
  cam.visibility = Layers.Enum.UI_2D;
  cam.priority = 10;

  const canvas = new Node('Canvas');
  canvas.layer = Layers.Enum.UI_2D;
  ensureTransform(canvas, fullW, fullH, 0.5, 0.5);
  const canvasComp = canvas.addComponent(Canvas);
  canvasComp.cameraComponent = cam;

  const insetTop = 12;
  const insetBottom = 8;
  const dockHeight = layoutH < 1250 ? DOCK_H : 170;
  const orderHeight = layoutH < 1250 ? ORDERS_H : 212;

  const background = createUiNode('Background');
  canvas.addChild(background);
  pinFill(background, 0, 0);

  const safeArea = createUiNode('SafeArea');
  canvas.addChild(safeArea);
  ensureTransform(safeArea, layoutW, layoutH);
  safeArea.setPosition(safe.x, safe.y, 0);

  // Board first (under), then dock, then orders, then status (top chrome)
  const boardTop = insetTop + TOP_BAR_H + GAP + orderHeight + GAP;
  const boardBottom = insetBottom + dockHeight + GAP + NAV_H;

  const boardSlot = createUiNode('BoardPanel');
  safeArea.addChild(boardSlot);
  pinFill(boardSlot, boardTop, boardBottom);

  const dockSlot = createUiNode('GeneratorDock');
  safeArea.addChild(dockSlot);
  pinBox(dockSlot, dockHeight, { bottom: insetBottom + EDGE + NAV_H });

  const ordersSlot = createUiNode('OrderPanel');
  safeArea.addChild(ordersSlot);
  pinBox(ordersSlot, orderHeight, { top: insetTop + TOP_BAR_H + GAP });

  const contentLayer = createUiNode('PageContentLayer');
  safeArea.addChild(contentLayer);
  makePassThrough(contentLayer);

  const statusSlot = createUiNode('StatusBar');
  safeArea.addChild(statusSlot);
  pinBox(statusSlot, TOP_BAR_H, { top: insetTop });

  const navLayer = createUiNode('NavigationLayer');
  safeArea.addChild(navLayer);
  makePassThrough(navLayer);

  const dragLayer = createUiNode('DragLayer');
  safeArea.addChild(dragLayer);
  makePassThrough(dragLayer);

  const tutorialLayer = createUiNode('TutorialLayer');
  safeArea.addChild(tutorialLayer);
  makePassThrough(tutorialLayer);

  const modalLayer = createUiNode('ModalLayer');
  safeArea.addChild(modalLayer);
  makePassThrough(modalLayer);

  const rewardLayer = createUiNode('RewardLayer');
  safeArea.addChild(rewardLayer);
  makePassThrough(rewardLayer);

  // Feedback from modal actions must remain visible above the modal scrim.
  const toastLayer = createUiNode('ToastLayer');
  safeArea.addChild(toastLayer);
  makePassThrough(toastLayer);

  const debugLayer = createUiNode('DebugLayer');
  safeArea.addChild(debugLayer);
  makePassThrough(debugLayer);

  const coverLayer = createUiNode('CoverLayer');
  safeArea.addChild(coverLayer);
  makePassThrough(coverLayer);

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
    safeArea,
    background,
    contentLayer,
    statusSlot,
    ordersSlot,
    boardSlot,
    dockSlot,
    navLayer,
    dragLayer,
    toastLayer,
    tutorialLayer,
    modalLayer,
    rewardLayer,
    debugLayer,
    coverLayer,
    designWidth: layoutW,
    designHeight: layoutH,
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
