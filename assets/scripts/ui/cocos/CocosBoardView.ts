/**
 * CocosBoardView — 7x9 cells, touch drag with threshold, drop resolution via Core.
 * Does not own board truth — renders GameContext BoardState only.
 */
import {
  EventTouch,
  Vec2,
  Vec3,
  UITransform,
  Node,
} from 'cc';
import type { BoardVm, ItemVm } from '../../presentation/GameViewMapper';
import type { DropResolve } from '../../core/types';
import { CocosCellView } from './CocosCellView';
import { CocosItemView } from './CocosItemView';
import { CocosTheme, createUiNode, ensureOpacity, ensureTransform, paintRoundRect } from './CocosTheme';
import { Graphics } from 'cc';

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

  private drag: {
    fromIndex: number;
    uid: string;
    startUI: Vec2;
    active: boolean;
    ghost: Node | null;
    ghostItem: CocosItemView | null;
  } | null = null;

  private lastMergedIndex = -1;

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
      }
    }
  }

  private bindTouch(): void {
    this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
    this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
  }

  private uiPos(touch: EventTouch): Vec2 {
    return touch.getUILocation();
  }

  private localPos(touch: EventTouch): Vec3 {
    const tr = this.node.getComponent(UITransform)!;
    const ui = touch.getUILocation();
    return tr.convertToNodeSpaceAR(new Vec3(ui.x, ui.y, 0));
  }

  private indexFromLocal(local: Vec3): number | null {
    const totalW = this.columns * this.cellSize + (this.columns - 1) * this.gap;
    const totalH = this.rows * this.cellSize + (this.rows - 1) * this.gap;
    const originX = -totalW / 2;
    const originY = -totalH / 2;
    const x = local.x - originX;
    const y = local.y - originY;
    if (x < 0 || y < 0 || x > totalW || y > totalH) return null;

    const stepX = this.cellSize + this.gap;
    const stepY = this.cellSize + this.gap;
    const c = Math.floor(x / stepX);
    const r = Math.floor(y / stepY);
    if (c < 0 || r < 0 || c >= this.columns || r >= this.rows) return null;

    // ignore gaps between cells
    const offsetX = x % stepX;
    const offsetY = y % stepY;
    if (offsetX > this.cellSize || offsetY > this.cellSize) {
      return null;
    }

    // local y grows up; row 0 is top
    const row = this.rows - 1 - r;
    const index = row * this.columns + c;
    if (index < 0 || index > this.rows * this.columns - 1) return null;
    return index;
  }

  private onTouchStart(e: EventTouch): void {
    const local = this.localPos(e);
    const index = this.indexFromLocal(local);
    console.debug('[BOARD_TOUCH_START]', {
      ui: e.getUILocation(),
      local,
      index,
    });
    if (index === null) return;
    const cell = this.cells[index];
    const item = cell?.itemView;
    if (!cell || !item || !item.node.active) return;

    console.debug('[BOARD_DRAG_ITEM]', {
      index,
      uid: item.uid,
    });

    this.drag = {
      fromIndex: index,
      uid: item.uid,
      startUI: this.uiPos(e),
      active: false,
      ghost: null,
      ghostItem: null,
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
      this.startGhost();
      this.cells[this.drag.fromIndex]?.setSourceDim(true);
    }
    this.moveGhost(e);
    this.highlightTarget(e);
  }

  private onTouchEnd(e: EventTouch): void {
    if (!this.drag) return;
    const drag = this.drag;
    this.drag = null;
    this.clearHighlights();
    this.endGhost();
    this.cells[drag.fromIndex]?.setSourceDim(false);

    if (!drag.active) return;

    const to = this.indexFromLocal(this.localPos(e));
    console.debug('[BOARD_TOUCH_END]', {
      from: drag.fromIndex,
      to,
      ui: e.getUILocation(),
    });
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
    const vm = source?.itemView?.uid
      ? this.pendingVm?.get(source.itemView.uid)
      : undefined;
    if (vm) item.render(vm);
    this.drag.ghost = ghost;
    this.drag.ghostItem = item;
    source?.setSourceDim(true);
  }

  private moveGhost(e: EventTouch): void {
    if (!this.drag?.ghost || !this.dragLayer) return;
    const ui = e.getUILocation();
    const transform = this.dragLayer.getComponent(UITransform);
    if (!transform) return;
    const local = transform.convertToNodeSpaceAR(new Vec3(ui.x, ui.y, 0));
    this.drag.ghost.setPosition(local);
  }

  private highlightTarget(e: EventTouch): void {
    if (!this.drag) return;
    this.clearHighlights();
    const to = this.indexFromLocal(this.localPos(e));
    if (to === null || to === this.drag.fromIndex) return;
    const preview = this.deps.previewDrop(this.drag.fromIndex, to);
    const cell = this.cells[to];
    if (!cell) return;
    if (preview.kind === 'MERGE') cell.setHighlight('merge');
    else if (preview.kind === 'MOVE' || preview.kind === 'SWAP') cell.setHighlight('move');
  }

  private dragLayer: Node | null = null;
  private pendingVm: Map<string, ItemVm> | null = null;

  setDragLayer(layer: Node): void {
    this.dragLayer = layer;
  }

  private clearHighlights(): void {
    for (const cell of this.cells) cell.setHighlight('none');
  }

  private endGhost(): void {
    this.drag?.ghost?.destroy();
    if (this.drag) {
      this.drag.ghost = null;
      this.drag.ghostItem = null;
    }
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
      const prev = cell.itemView?.uid;
      cell.setItem(item);
      if (item && prev !== item.uid && cell.index === this.lastMergedIndex) {
        cell.playMergePop();
      }
    }
  }

  markMerge(index: number): void {
    this.lastMergedIndex = index;
    this.cells[index]?.playMergePop();
  }

  markSpawn(index: number): void {
    this.cells[index]?.playSpawnPop();
  }

  dispose(): void {
    this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
    this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    this.endGhost();
  }
}
