/**
 * CocosBoardView — per-cell touch binding.
 * CRITICAL: TOUCH_MOVE/END must be on the SAME node as TOUCH_START (Cocos
 * dispatches the gesture to the hit target, not the parent). Bind all 4 events
 * on every cell + board fallback.
 */
import { EventMouse, EventTouch, Input, input, Vec2, Vec3, UITransform, Node, Graphics, Camera } from 'cc';
import type { BoardVm, ItemVm } from '../../presentation/GameViewMapper';
import type { DropResolve } from '../../core/types';
import { CocosCellView } from './CocosCellView';
import { CocosItemView } from './CocosItemView';
import {
  CocosTheme,
  createUiNode,
  ensureOpacity,
  ensureTransform,
  hexColor,
  paintRoundRect,
} from './CocosTheme';

export type BoardDeps = {
  previewDrop: (from: number, to: number | null) => DropResolve;
  onDrop: (from: number, to: number | null) => void;
  dragThreshold: number;
};

export class CocosBoardView {
  readonly node: Node;
  private cells: CocosCellView[] = [];
  private rows: number;
  private columns: number;
  private gap = 6;
  private cellSize = 64;
  private boardW = 0;
  private boardH = 0;
  private deps: BoardDeps;
  private camera: Camera | null = null;

  private drag: {
    fromIndex: number;
    uid: string;
    startUI: Vec2;
    active: boolean;
    ghost: Node | null;
  } | null = null;

  private dragLayer: Node | null = null;
  private pendingVm: Map<string, ItemVm> | null = null;
  private readonly boundItemNodes = new WeakSet<Node>();

  constructor(
    parent: Node,
    width: number,
    height: number,
    rows: number,
    columns: number,
    deps: BoardDeps,
  ) {
    this.rows = rows;
    this.columns = columns;
    this.deps = deps;
    this.boardW = width - 16;
    this.boardH = height - 12;
    this.node = createUiNode('BoardView');
    parent.addChild(this.node);
    ensureTransform(this.node, this.boardW, this.boardH);

    const g = this.node.addComponent(Graphics);
    paintRoundRect(
      g,
      this.boardW,
      this.boardH,
      20,
      hexColor('#FFF4E9', 244),
      hexColor('#FFFFFF'),
    );

    this.layoutCells();
    this.bindBoardTouch();
    // Desktop browsers may cancel a node touch as the pointer leaves the source
    // cell. Global release still arrives and must finish the drag.
    input.on(Input.EventType.MOUSE_MOVE, this.onTouchMove, this);
    input.on(Input.EventType.MOUSE_UP, this.onTouchEnd, this);
    input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
  }

  setDragLayer(layer: Node): void {
    this.dragLayer = layer;
  }

  setCamera(camera: Camera | null): void {
    this.camera = camera;
  }

  private layoutCells(): void {
    this.cellSize = Math.floor(
      Math.min(
        (this.boardW - (this.columns - 1) * this.gap) / this.columns,
        (this.boardH - (this.rows - 1) * this.gap) / this.rows,
      ),
    );
    const totalW = this.columns * this.cellSize + (this.columns - 1) * this.gap;
    const totalH = this.rows * this.cellSize + (this.rows - 1) * this.gap;
    const originX = -totalW / 2 + this.cellSize / 2;
    const originY = totalH / 2 - this.cellSize / 2;

    this.cells = [];
    for (let r = 0; r < this.rows; r += 1) {
      for (let c = 0; c < this.columns; c += 1) {
        const index = r * this.columns + c;
        const cell = new CocosCellView(this.node, index, this.cellSize);
        const x = originX + c * (this.cellSize + this.gap);
        const y = originY - r * (this.cellSize + this.gap);
        cell.node.setPosition(x, y, 0);
        this.cells.push(cell);
        this.bindNodeTouch(cell.node, index);
      }
    }
  }

  /** Bind the full gesture on one node so MOVE/END arrive at the same target as START. */
  private bindNodeTouch(node: Node, index: number): void {
    node.on(
      Node.EventType.TOUCH_START,
      (e: EventTouch) => {
        e.propagationStopped = true;
        this.onTouchStart(e, index);
      },
      this,
    );
    node.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => {
      e.propagationStopped = true;
      this.onTouchMove(e);
    }, this);
    node.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
      e.propagationStopped = true;
      this.onTouchEnd(e);
    }, this);
    node.on(Node.EventType.TOUCH_CANCEL, (e: EventTouch) => {
      e.propagationStopped = true;
      this.onTouchCancel();
    }, this);
  }

  private bindBoardTouch(): void {
    // Fallback when touching empty board padding
    this.bindNodeTouch(this.node, -1);
  }

  private uiPos(touch: EventTouch | EventMouse): Vec2 {
    return touch.getUILocation();
  }

  private localPos(touch: EventTouch | EventMouse, target: Node = this.node): Vec3 {
    const transform = target.getComponent(UITransform);
    if (!transform) return new Vec3();
    const ui = touch.getUILocation();
    const world = this.uiToWorld(ui, touch);
    return transform.convertToNodeSpaceAR(world);
  }

  private uiToWorld(ui: Vec2, touch: EventTouch | EventMouse): Vec3 {
    if (this.camera) {
      const screen = touch.getLocation();
      const world = new Vec3();
      this.camera.screenToWorld(new Vec3(screen.x, screen.y, 0), world);
      return world;
    }
    return new Vec3(ui.x, ui.y, 0);
  }

  private indexFromLocal(local: Vec3): number | null {
    const totalW = this.columns * this.cellSize + (this.columns - 1) * this.gap;
    const totalH = this.rows * this.cellSize + (this.rows - 1) * this.gap;
    const originX = -totalW / 2;
    const originY = -totalH / 2;
    const x = local.x - originX;
    const y = local.y - originY;
    if (x < 0 || y < 0 || x > totalW || y > totalH) return null;
    const step = this.cellSize + this.gap;
    const c = Math.floor(x / step);
    const r = Math.floor(y / step);
    if (c < 0 || r < 0 || c >= this.columns || r >= this.rows) return null;
    const offsetX = x % step;
    const offsetY = y % step;
    if (offsetX > this.cellSize || offsetY > this.cellSize) return null;
    const row = this.rows - 1 - r;
    return row * this.columns + c;
  }

  private indexFromHitTest(touch: EventTouch | EventMouse): number | null {
    const ui = touch.getUILocation();
    const world = this.uiToWorld(ui, touch);
    for (const cell of this.cells) {
      const tr = cell.node.getComponent(UITransform);
      if (!tr) continue;
      const local = tr.convertToNodeSpaceAR(world);
      const w = tr.width / 2;
      const h = tr.height / 2;
      if (local.x >= -w && local.x <= w && local.y >= -h && local.y <= h) {
        return cell.index;
      }
    }
    return null;
  }

  private resolveIndex(touch: EventTouch | EventMouse, hint?: number): number | null {
    if (hint !== undefined && hint >= 0) return hint;
    const local = this.localPos(touch);
    return this.indexFromLocal(local) ?? this.indexFromHitTest(touch);
  }

  onTouchStart(e: EventTouch, hintIndex = -1): void {
    if (this.drag) {
      this.drag.ghost?.destroy();
      this.cells[this.drag.fromIndex]?.setSourceDim(false);
      this.clearHighlights();
      this.drag = null;
    }
    const index = this.resolveIndex(e, hintIndex >= 0 ? hintIndex : undefined);
    if (index === null || index < 0) return;
    const cell = this.cells[index];
    const item = cell?.itemView;
    if (!cell || !item || !item.node.active || !item.uid) return;

    this.drag = {
      fromIndex: index,
      uid: item.uid,
      startUI: this.uiPos(e),
      active: false,
      ghost: null,
    };
  }

  onTouchMove(e: EventTouch | EventMouse): void {
    if (!this.drag) return;
    const ui = this.uiPos(e);
    const dx = ui.x - this.drag.startUI.x;
    const dy = ui.y - this.drag.startUI.y;
    if (!this.drag.active) {
      if (Math.hypot(dx, dy) < this.deps.dragThreshold) return;
      this.drag.active = true;
      this.startGhost();
      this.cells[this.drag.fromIndex]?.setSourceDim(true);
    }
    const to = this.resolveIndex(e);
    this.moveGhost(e);
    this.highlightTarget(e, to);
  }

  onTouchEnd(e: EventTouch | EventMouse): void {
    if (!this.drag) return;
    const drag = this.drag;
    const to = this.resolveIndex(e);
    this.drag = null;
    try {
      if (drag.active) this.deps.onDrop(drag.fromIndex, to);
    } finally {
      drag.ghost?.destroy();
      this.cells[drag.fromIndex]?.setSourceDim(false);
      this.clearHighlights();
    }
  }

  onTouchCancel(): void {
    // A Cocos node-level cancel can mean the pointer left this item while the
    // mouse button is still held. Wait for the global up event to resolve it.
  }

  private startGhost(): void {
    if (!this.drag) return;
    const source = this.cells[this.drag.fromIndex];
    const ghost = createUiNode('DragGhost');
    if (this.dragLayer) this.dragLayer.addChild(ghost);
    else this.node.addChild(ghost);
    ghost.setScale(1.08, 1.08, 1);
    ensureOpacity(ghost).opacity = 242;
    const size = this.cellSize;
    ensureTransform(ghost, size, size);
    const item = new CocosItemView(ghost, size);
    const uid = source?.itemView?.uid;
    const vm = uid ? this.pendingVm?.get(uid) : undefined;
    if (vm) item.render(vm);
    this.drag.ghost = ghost;
    source?.setSourceDim(true);
  }

  private moveGhost(e: EventTouch | EventMouse): void {
    if (!this.drag?.ghost) return;
    const layer = this.dragLayer ?? this.node;
    const transform = layer.getComponent(UITransform);
    if (!transform) return;
    const world = this.uiToWorld(e.getUILocation(), e);
    const local = transform.convertToNodeSpaceAR(world);
    this.drag.ghost.setPosition(local);
  }

  private highlightTarget(e: EventTouch | EventMouse, to: number | null): void {
    if (!this.drag) return;
    this.clearHighlights();
    const index = to ?? this.resolveIndex(e);
    if (index === null || index < 0 || index === this.drag.fromIndex) return;
    const preview = this.deps.previewDrop(this.drag.fromIndex, index);
    const cell = this.cells[index];
    if (!cell) return;
    if (preview.kind === 'MERGE') cell.setHighlight('merge');
    else if (preview.kind === 'MOVE' || preview.kind === 'SWAP') {
      cell.setHighlight('move');
    }
  }

  private clearHighlights(): void {
    for (const cell of this.cells) cell.setHighlight('none');
  }

  private endGhost(): void {
    this.drag?.ghost?.destroy();
    if (this.drag) this.drag.ghost = null;
  }

  render(vm: BoardVm): void {
    const byCell = new Map<number, ItemVm>();
    const byUid = new Map<string, ItemVm>();
    for (const item of vm.items) {
      byCell.set(item.cellIndex, item);
      byUid.set(item.uid, item);
    }
    this.pendingVm = byUid;
    for (const cell of this.cells) {
      const item = byCell.get(cell.index) ?? null;
      cell.setItem(item);
      if (item && cell.itemView && !this.boundItemNodes.has(cell.itemView.node)) {
        // Item sits above cell — bind full gesture on the item node too
        this.bindNodeTouch(cell.itemView.node, cell.index);
        this.boundItemNodes.add(cell.itemView.node);
      }
    }
  }

  markMerge(index: number): void {
    this.cells[index]?.playMergePop();
  }

  markSpawn(index: number): void {
    this.cells[index]?.playSpawnPop();
  }

  dispose(): void {
    input.off(Input.EventType.MOUSE_MOVE, this.onTouchMove, this);
    input.off(Input.EventType.MOUSE_UP, this.onTouchEnd, this);
    input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    for (const cell of this.cells) {
      cell.node.off(Node.EventType.TOUCH_START);
      cell.node.off(Node.EventType.TOUCH_MOVE);
      cell.node.off(Node.EventType.TOUCH_END);
      cell.node.off(Node.EventType.TOUCH_CANCEL);
      cell.itemView?.node.off(Node.EventType.TOUCH_START);
      cell.itemView?.node.off(Node.EventType.TOUCH_MOVE);
      cell.itemView?.node.off(Node.EventType.TOUCH_END);
      cell.itemView?.node.off(Node.EventType.TOUCH_CANCEL);
    }
    this.node.off(Node.EventType.TOUCH_START);
    this.node.off(Node.EventType.TOUCH_MOVE);
    this.node.off(Node.EventType.TOUCH_END);
    this.node.off(Node.EventType.TOUCH_CANCEL);
    this.endGhost();
  }
}
