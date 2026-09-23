/**
 * Runtime UI hierarchy factory (no prefab UUID required).
 * Builds Canvas + Camera + layered UI under SafeArea.
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

/** Design reference 750x1334 portrait. */
export const DESIGN_W = 750;
export const DESIGN_H = 1334;

export function applyDesignResolution(): void {
  // 2 = FIXED_WIDTH (Fit Width)
  view.setDesignResolutionSize(DESIGN_W, DESIGN_H, 2);
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
  safeWidget.top = Math.ceil((insets.top / Math.max(1, visible.height)) * DESIGN_H);
  safeWidget.bottom = Math.ceil((insets.bottom / Math.max(1, visible.height)) * DESIGN_H);
  safeWidget.left = Math.ceil((insets.left / Math.max(1, visible.width)) * DESIGN_W);
  safeWidget.right = Math.ceil((insets.right / Math.max(1, visible.width)) * DESIGN_W);
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

  const contentH = DESIGN_H - safeWidget.top - safeWidget.bottom;
  const statusH = Math.floor(contentH * 0.08);
  const ordersH = Math.floor(contentH * 0.18);
  const dockH = Math.floor(contentH * 0.16);
  const boardH = contentH - statusH - ordersH - dockH;

  const statusSlot = createUiNode('StatusBar');
  safeArea.addChild(statusSlot);
  ensureTransform(statusSlot, DESIGN_W, statusH, 0.5, 1);
  statusSlot.setPosition(0, contentH / 2, 0);

  const ordersSlot = createUiNode('OrderPanel');
  safeArea.addChild(ordersSlot);
  ensureTransform(ordersSlot, DESIGN_W, ordersH, 0.5, 1);
  ordersSlot.setPosition(0, contentH / 2 - statusH, 0);

  const boardSlot = createUiNode('BoardPanel');
  safeArea.addChild(boardSlot);
  ensureTransform(boardSlot, DESIGN_W, boardH, 0.5, 1);
  boardSlot.setPosition(0, contentH / 2 - statusH - ordersH, 0);

  const dockSlot = createUiNode('GeneratorDock');
  safeArea.addChild(dockSlot);
  ensureTransform(dockSlot, DESIGN_W, dockH, 0.5, 1);
  dockSlot.setPosition(0, contentH / 2 - statusH - ordersH - boardH, 0);

  const dragLayer = createUiNode('DragLayer');
  canvas.addChild(dragLayer);
  ensureTransform(dragLayer, DESIGN_W, DESIGN_H);

  const toastLayer = createUiNode('ToastLayer');
  canvas.addChild(toastLayer);
  ensureTransform(toastLayer, DESIGN_W, DESIGN_H);

  const tutorialLayer = createUiNode('TutorialLayer');
  canvas.addChild(tutorialLayer);
  ensureTransform(tutorialLayer, DESIGN_W, DESIGN_H);

  const modalLayer = createUiNode('ModalLayer');
  canvas.addChild(modalLayer);
  ensureTransform(modalLayer, DESIGN_W, DESIGN_H);

  const debugLayer = createUiNode('DebugLayer');
  canvas.addChild(debugLayer);
  ensureTransform(debugLayer, DESIGN_W, DESIGN_H);

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

export function sizeOf(node: Node, fallbackW: number, fallbackH: number): {
  width: number;
  height: number;
} {
  const tr = node.getComponent(UITransform);
  if (!tr) return { width: fallbackW, height: fallbackH };
  return { width: tr.width, height: tr.height };
}
