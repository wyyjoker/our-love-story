/**
 * Runtime UI hierarchy factory.
 * Uses the live design resolution (project settings) — no hardcoded 750 assumptions
 * beyond the portrait reference. Layout is widget/percent based so Status/Orders/Board/Dock
 * stay visible. Overlay layers are pass-through (0×0 hit) so they never block Board input.
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

/** Portrait reference (project settings should match). */
export const DESIGN_W = 750;
export const DESIGN_H = 1334;

export function applyDesignResolution(): void {
  // Keep project design resolution; only enforce portrait fit-width if wrong.
  const d = view.getDesignResolutionSize();
  if (d.width <= d.height) {
    // already portrait — leave as project settings
    return;
  }
  view.setDesignResolutionSize(DESIGN_W, DESIGN_H, 2);
}

/** Full-screen decorative layer must not swallow Board touches. */
export function makePassThrough(node: Node): void {
  const tr = node.getComponent(UITransform) ?? node.addComponent(UITransform);
  tr.setContentSize(0, 0);
  tr.setAnchorPoint(0.5, 0.5);
}

function contentSizeOf(node: Node, fallbackW: number, fallbackH: number) {
  const tr = node.getComponent(UITransform);
  return {
    width: tr?.width || fallbackW,
    height: tr?.height || fallbackH,
  };
}

export function buildUiTree(insets: SafeInsets): UiRoots {
  const design = view.getDesignResolutionSize();
  const designW = design.width > 0 ? design.width : DESIGN_W;
  const designH = design.height > 0 ? design.height : DESIGN_H;

  const cameraNode = new Node('UICamera');
  cameraNode.layer = Layers.Enum.UI_2D;
  const cam = cameraNode.addComponent(Camera);
  cam.projection = Camera.ProjectionType.ORTHO;
  cam.orthoHeight = designH / 2;
  cam.clearFlags = Camera.ClearFlag.SOLID_COLOR;
  cam.visibility = Layers.Enum.UI_2D;
  cam.priority = 10;

  const canvas = new Node('Canvas');
  canvas.layer = Layers.Enum.UI_2D;
  ensureTransform(canvas, designW, designH, 0.5, 0.5);
  const canvasComp = canvas.addComponent(Canvas);
  canvasComp.cameraComponent = cam;

  // Safe area: widget stretch with real device insets mapped to design units
  const safeArea = createUiNode('SafeArea');
  canvas.addChild(safeArea);
  ensureTransform(safeArea, designW, designH);
  const safeWidget = safeArea.addComponent(Widget);
  safeWidget.isAlignTop = true;
  safeWidget.isAlignBottom = true;
  safeWidget.isAlignLeft = true;
  safeWidget.isAlignRight = true;
  const visible = view.getVisibleSize();
  const scaleX = designW / Math.max(1, visible.width);
  const scaleY = designH / Math.max(1, visible.height);
  const insetTop = Math.min(Math.ceil(insets.top * scaleY), Math.floor(designH * 0.12));
  const insetBottom = Math.min(Math.ceil(insets.bottom * scaleY), Math.floor(designH * 0.1));
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

  const sa = contentSizeOf(safeArea, designW, designH);
  const contentW = sa.width;
  const contentH = sa.height;

  // Vertical slots as fractions of content (portrait)
  const topPad = 16;
  const bottomPad = 16;
  const gap = 8;
  const statusH = Math.round(contentH * 0.09);
  const ordersH = Math.round(contentH * 0.16);
  const dockH = Math.round(contentH * 0.14);
  const boardH = Math.max(280, contentH - topPad - bottomPad - statusH - ordersH - dockH - gap * 3);

  // Position from top of safeArea (local y up, origin center)
  let cursor = contentH / 2 - topPad;

  const statusSlot = createUiNode('StatusBar');
  safeArea.addChild(statusSlot);
  ensureTransform(statusSlot, contentW, statusH, 0.5, 1);
  statusSlot.setPosition(0, cursor, 0);
  cursor -= statusH + gap;

  const ordersSlot = createUiNode('OrderPanel');
  safeArea.addChild(ordersSlot);
  ensureTransform(ordersSlot, contentW, ordersH, 0.5, 1);
  ordersSlot.setPosition(0, cursor, 0);
  cursor -= ordersH + gap;

  const boardSlot = createUiNode('BoardPanel');
  safeArea.addChild(boardSlot);
  ensureTransform(boardSlot, contentW, boardH, 0.5, 1);
  boardSlot.setPosition(0, cursor, 0);
  cursor -= boardH + gap;

  const dockSlot = createUiNode('GeneratorDock');
  safeArea.addChild(dockSlot);
  ensureTransform(dockSlot, contentW, dockH, 0.5, 1);
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
    designWidth: designW,
    designHeight: designH,
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
  return contentSizeOf(node, fallbackW, fallbackH);
}
