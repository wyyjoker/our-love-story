/**
 * CocosBoardView — per-cell touch binding (reliable hit) + board-space drop resolve.
 * Pointer math uses getUILocation + UITransform.convertToNodeSpaceAR.
 */
import { EventTouch, Vec2, Vec3, UITransform, Node, Graphics, Camera } from 'cc';
import type { BoardVm, ItemVm } from '../../presentation/GameViewMapper';
import type { DropResolve } from '../../core/types';
import { CocosCellView } from './CocosCellView';
import { CocosItemView } from './CocosItemView';
import {
  CocosTheme,
  createUiNode,
  ensureOpacity,
  ensureTransform,
  paintRoundRect,
} from './CocosTheme';

export type BoardDeps = {
  previewDrop: (from: number, to: number | null) => DropResolve;
  onDrop: (from: number, to: number | null) => void;
  dragThreshold: number;
};

function logInput(tag: string, payload: unknown): void {
  console.debug(`[INPUT] ${tag}`, payload);
}

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
      CocosTheme.background(),
      CocosTheme.border(),
    );

    this.layoutCells();
    this.bindTouch();
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
        // Per-cell hit target — avoids fragile board-space conversion for pickup
        cell.node.on(
          Node.EventType.TOUCH_START,
          (e: EventTouch) => this.onCellTouchStart(e, index),
          this,
        );
        this.cells.push(cell);
      }
    }
  }

  private bindTouch(): void {
    // Board-level move/end still needed for drag continuation
    this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
    this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
  }

  private uiPos(touch: EventTouch): Vec2 {
    return touch.getUILocation();
  }

  /** UI → node local. convertToNodeSpaceAR expects world; map UI via camera when possible. */
  private localPos(touch: EventTouch, target: Node = this.node): Vec3 {
    const transform = target.getComponent(UITransform);
    if (!transform) {
      return new Vec3();
    }
    const ui = touch.getUILocation();
    const world = this.uiToWorld(ui, touch);
    return transform.convertToNodeSpaceAR(world);
  }

  private uiToWorld(ui: Vec2, touch: EventTouch): Vec3 {
    if (this.camera) {
      const screen = touch.getLocation();
      const world = new Vec3();
      this.camera.screenToWorld(world, new Vec3(screen.x, screen.y, 0));
      return world;
    }
    // Canvas UI fallback: UI location ≈ world in design space for standard canvas
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
    if (offsetX > this.cellSize || offsetY > this.cellSize) {
      return null;
    }

    const row = this.rows - 1 - r;
    const index = row * this.columns + c;
    if (index < 0 || index > this.rows * this.columns - 1) return null;
    return index;
  }

  /** Fallback: which cell UITransform contains this touch. */
  private indexFromHitTest(touch: EventTouch): number | null {
    const ui = touch.getUILocation();
    const world = this.uiToWorld(ui, touch);
    for (const cell of this.cells) {
      const tr = cell.node.getComponent(UITransform);
      if (!tr) continue;
      // hitTest accepts screen point in 3.8 — also try UI/world converted
      const local = tr.convertToNodeSpaceAR(world);
      const w = tr.width / 2;
      const h = tr.height / 2;
      if (local.x >= -w && local.x <= w && local.y >= -h && local.y <= h) {
        return cell.index;
      }
    }
    return null;
  }

  private resolveIndex(touch: EventTouch, hint?: number): number | null {
    if (hint !== undefined) return hint;
    const local = this.localPos(touch);
    return this.indexFromLocal(local) ?? this.indexFromHitTest(touch);
  }

  private onCellTouchStart(e: EventTouch, index: number): void {
    this.beginDrag(e, index);
  }

  private onTouchStart(e: EventTouch): void {
    this.beginDrag(e, this.resolveIndex(e));
  }

  beginDrag(e: EventTouch, index: number | null): void {
    const ui = e.getUILocation();
    const local = this.localPos(e);
    logInput('start', { ui, local, index });
    if (index === null) return;
    const cell = this.cells[index];
    const item = cell?.itemView;
    if (!cell || !item || !item.node.active || !item.uid) return;

    logInput('item', { index, uid: item.uid });
    this.drag = {
      fromIndex: index,
      uid: item.uid,
      startUI: this.uiPos(e),
      active: false,
      ghost: null,
    };
  }

  private onTouchMove(e: EventTouch): void {
    if (!this.drag) return;
    const ui = this.uiPos(e);
    const dx = ui.x - this.drag.startUI.x;
    const dy = ui.y - this.drag.startUI.y;
    if (!this.drag.active) {
      if (Math.hypot(dx, dy) < this.deps.dragThreshold) return;
      this.drag.active = true;
      logInput('drag-start', { fromIndex: this.drag.fromIndex });
      this.startGhost();
      this.cells[this.drag.fromIndex]?.setSourceDim(true);
    }
    const to = this.resolveIndex(e);
    logInput('drag-move', { toIndex: to });
    this.moveGhost(e);
    this.highlightTarget(e, to);
  }

  private onTouchEnd(e: EventTouch): void {
    if (!this.drag) return;
    const drag = this.drag;
    this.drag = null;
    this.clearHighlights();
    this.endGhost();
    this.cells[drag.fromIndex]?.setSourceDim(false);
    if (!drag.active) return;

    const to = this.resolveIndex(e);
    const preview = this.deps.previewDrop(drag.fromIndex, to);
    logInput('drop', { from: drag.fromIndex, to, preview });
    this.deps.onDrop(drag.fromIndex, to);
  }

  private onTouchCancel(): void {
    if (!this.drag) return;
    const from = this.drag.fromIndex;
    this.drag = null;
    this.clearHighlights();
    this.endGhost();
    this.cells[from]?.setSourceDim(false);
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

  private moveGhost(e: EventTouch): void {
    if (!this.drag?.ghost) return;
    const layer = this.dragLayer ?? this.node;
    const transform = layer.getComponent(UITransform);
    if (!transform) return;
    const world = this.uiToWorld(e.getUILocation(), e);
    const local = transform.convertToNodeSpaceAR(world);
    this.drag.ghost.setPosition(local);
  }

  private highlightTarget(e: EventTouch, to: number | null): void {
    if (!this.drag) return;
    this.clearHighlights();
    const index = to ?? this.resolveIndex(e);
    if (index === null || index === this.drag.fromIndex) return;
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
      cell.setItem(byCell.get(cell.index) ?? null);
      cell.bindPickup((e, index) => this.beginDrag(e as EventTouch, index));
    }
  }

  markMerge(index: number): void {
    this.cells[index]?.playMergePop();
  }

  markSpawn(index: number): void {
    this.cells[index]?.playSpawnPop();
  }

  dispose(): void {
    for (const cell of this.cells) {
      cell.node.off(Node.EventType.TOUCH_START);
    }
    this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
    this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    this.endGhost();
  }
}
