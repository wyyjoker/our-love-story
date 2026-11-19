import { RewardPalette } from './CocosRewardEffects';
/**
 * CocosBoardView — per-cell touch binding.
 * CRITICAL: TOUCH_MOVE/END must be on the SAME node as TOUCH_START (Cocos
 * dispatches the gesture to the hit target, not the parent). Bind all 4 events
 * on every cell + board fallback.
 */
import { BlockInputEvents, Button, EventMouse, EventTouch, Input, input, isValid, tween, Tween, Vec2, Vec3, UITransform, Node, Graphics, Camera, Label } from 'cc';
import type { BoardVm, ItemVm } from '../../presentation/GameViewMapper';
import type { DropResolve } from '../../core/types';
import { CocosCellView } from './CocosCellView';
import { CocosItemView } from './CocosItemView';
import { applyArt, applyMaterialFrame, itemArt, openedChestArt } from './CocosArt';
import {
  CocosTheme,
  createUiNode,
  ensureOpacity,
  ensureTransform,
  hexColor,
  makeLabel,
  paintRoundRect,
} from './CocosTheme';

export type BoardDeps = {
  layout?: { cellSize: number; gap: number; toolbarHeight: number };
  previewDrop: (from: number, to: number | null) => DropResolve;
  onDrop: (from: number, to: number | null) => boolean;
  dropWarning?: (from: number, to: number | null) => string | null;
  dragThreshold: number;
  onDragStart?: () => void;
  onDragFinished?: () => void;
  onOpenAdventure?: () => void;
  onOpenTools?: () => void;
  onOpenBackpack?: () => void;
  onOpenOrangeTree?: () => void;
  onStore?: (index: number, uid: string) => boolean;
  onItemTap?: (index: number) => void;
  onItemLongPress?: (index: number) => void;
};

export class CocosBoardView {
  readonly node: Node;
  private cells: CocosCellView[] = [];
  private rows: number;
  private columns: number;
  private gap = 6;
  private cellSize = 64;
  private cellWidth = 64;
  private cellHeight = 64;
  private gridLeft = 0;
  private gridTop = 0;
  private boardW = 0;
  private boardH = 0;
  private deps: BoardDeps;
  private camera: Camera | null = null;
  private goalLabel: Label | null = null;
  private backpackLabel: Label | null = null;
  private backpackTarget: Node | null = null;
  private footerGoal: Label | null = null;
  private readonly chestEffects = new Set<Node>();
  private backpackFull = false;
  private backpackText = '0/6';
  private readonly tracked = new Map<number, 'exact' | 'precursor'>();
  private orderHints = new Map<number, boolean>();

  private drag: {
    fromIndex: number;
    uid: string;
    startUI: Vec2;
    active: boolean;
    ghost: Node | null;
    startedAt: number;
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
    this.layoutCells();
    this.buildToolbar();
    this.bindBoardTouch();
    // Desktop browsers may cancel a node touch as the pointer leaves the source
    // cell. Global release still arrives and must finish the drag.
    input.on(Input.EventType.MOUSE_MOVE, this.onTouchMove, this);
    input.on(Input.EventType.MOUSE_UP, this.onTouchEnd, this);
    input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
  }

  setDragLayer(layer: Node): void {
    this.dragLayer = layer;
  }
  setBackpackTarget(node: Node): void {
    this.backpackTarget = node;
    this.backpackLabel = node.getChildByName('BoardBackpackLabel')?.getComponent(Label) ?? null;
  }
  setFooterGoal(label: Label): void { this.footerGoal = label; }

  setCamera(camera: Camera | null): void {
    this.camera = camera;
  }

  hintAnchor(index: number): { position: Vec3; size: number } | null {
    const cell = this.cells[index];
    return cell ? { position: cell.node.worldPosition.clone(), size: this.cellSize } : null;
  }

  private layoutCells(): void {
    this.gap = this.deps.layout?.gap ?? 2;
    this.cellWidth = this.deps.layout?.cellSize ?? Math.max(1,(this.boardW-16-(this.columns-1)*this.gap)/this.columns);
    this.cellHeight = this.cellWidth;
    this.cellSize = Math.min(this.cellWidth, this.cellHeight);
    const totalW = this.columns * this.cellWidth + (this.columns - 1) * this.gap;
    const totalH = this.rows * this.cellHeight + (this.rows - 1) * this.gap;
    const paperH = totalH + 16;
    const paperY = -this.boardH / 2 + paperH / 2 + 2;
    const paper = createUiNode('BoardPaper');
    this.node.addChild(paper);
    ensureTransform(paper, totalW + 16, paperH);
    paper.setPosition(0, paperY, 0);
    paintRoundRect(paper.addComponent(Graphics), totalW+16, paperH, 22, hexColor('#FFF4E9'), hexColor('#D8B68E'), 2);
    applyMaterialFrame(paper, 'wood', totalW+28, paperH+12);
    this.gridLeft = -totalW / 2;
    this.gridTop = paperY + totalH / 2;
    const originX = this.gridLeft + this.cellWidth / 2;
    const originY = this.gridTop - this.cellHeight / 2;
    this.cells = [];
    for (let r = 0; r < this.rows; r += 1) {
      for (let c = 0; c < this.columns; c += 1) {
        const index = r * this.columns + c;
        const cell = new CocosCellView(this.node, index, this.cellWidth, this.cellHeight);
        cell.node.setPosition(originX + c * (this.cellWidth + this.gap), originY - r * (this.cellHeight + this.gap), 0);
        this.cells.push(cell);
        this.bindNodeTouch(cell.node, index);
      }
    }
  }

  private addOrangeTreeNav(parent: Node, x: number, y: number, width: number, height: number): void {
    const nav = createUiNode('OpenOrangeTreeDock');
    parent.addChild(nav);
    ensureTransform(nav, width, height);
    nav.setPosition(x, y, 0);
    paintRoundRect(nav.addComponent(Graphics), width, height, height / 2, hexColor('#FFF0D4'), hexColor('#E8CB91'), 1);
    const label = makeLabel('› 橘树', 17, hexColor('#805A3B'), true);
    nav.addChild(label.node);
    ensureTransform(label.node, width - 6, height - 4);
    label.overflow = Label.Overflow.SHRINK;
    nav.addComponent(Button);
    nav.addComponent(BlockInputEvents);
    nav.on(Button.EventType.CLICK, () => this.deps.onOpenOrangeTree?.());
  }

  private buildToolbar(): void {
    const height = this.deps.layout?.toolbarHeight ?? 52;
    if (!height) return;
    const topY = this.boardH / 2 - height / 2 - 2;
    const summaryWidth = this.boardW - 88;
    const summary = createUiNode('BoardSummary'); this.node.addChild(summary);
    ensureTransform(summary, summaryWidth, height); summary.setPosition(-44, topY, 0);
    paintRoundRect(summary.addComponent(Graphics), summaryWidth, height, 22, hexColor('#FFF9F1'), hexColor('#E9D6C8'), 1);
    const adventure = createUiNode('OpenAdventure'); summary.addChild(adventure);
    ensureTransform(adventure, summaryWidth - 78, height); adventure.setPosition(-39, 0, 0);
    const heart = makeLabel('♥', 24, hexColor('#D78696'), true); adventure.addChild(heart.node);
    ensureTransform(heart.node, 32, 36); heart.node.setPosition(-summaryWidth / 2 + 62, 0, 0);
    const goal = makeLabel('今日约会 · 看看今天的小目标', 24, hexColor('#825A54'), true);
    adventure.addChild(goal.node); goal.node.name = 'BoardGoalText';
    ensureTransform(goal.node, summaryWidth - 130, 48); goal.node.setPosition(17, 0, 0);
    goal.enableWrapText = false; goal.overflow = Label.Overflow.SHRINK; this.goalLabel = goal;
    adventure.addComponent(Button); adventure.on(Button.EventType.CLICK, () => this.deps.onOpenAdventure?.());
    this.addOrangeTreeNav(summary, summaryWidth / 2 - 38, 0, 64, 48);

    const supplies = createUiNode('OpenTools'); this.node.addChild(supplies);
    ensureTransform(supplies, 78, height); supplies.setPosition(this.boardW / 2 - 40, topY, 0);
    paintRoundRect(supplies.addComponent(Graphics), 78, height, 20, hexColor('#FFF8EF'), hexColor('#E6CFC2'), 1);
    const gift = createUiNode('SupplyShortcutArt'); supplies.addChild(gift); gift.setPosition(0, 10, 0);
    const giftArt = itemArt('treasure_chest'); if (giftArt) applyArt(gift, { ...giftArt, preserveAspect: true }, 42, 38);
    const caption = makeLabel('补给', 19, hexColor('#825A54'), true); supplies.addChild(caption.node); ensureTransform(caption.node, 64, 25); caption.node.setPosition(0, -21, 0);
    const weeklyBadge = createUiNode('WeeklyRewardBadge'); supplies.addChild(weeklyBadge); weeklyBadge.setPosition(28, 18, 0);
    const dot = weeklyBadge.addComponent(Graphics); dot.fillColor = hexColor('#BC657B'); dot.circle(0, 0, 6); dot.fill();
    weeklyBadge.active = false;
    for (const [node, tap] of [[supplies, this.deps.onOpenTools]] as const) {
      node.addComponent(Button); node.addComponent(BlockInputEvents);
      let intentionalTap = false;
      node.on(Node.EventType.TOUCH_START, () => { intentionalTap = this.drag === null; });
      node.on(Node.EventType.TOUCH_CANCEL, () => { intentionalTap = false; });
      node.on(Button.EventType.CLICK, () => { if (!intentionalTap) return; intentionalTap = false; tap?.(); });
    }
  }

  shortcutAnchor(name: 'BoardBackpackButton' | 'OpenTools'): Vec3 | null {
    if (name === 'BoardBackpackButton') return this.backpackTarget?.worldPosition.clone() ?? null;
    return this.node.getChildByName(name)?.worldPosition.clone() ?? null;
  }

  setBackpackUsage(used: number, capacity: number): void {
    this.backpackFull = used >= capacity; this.backpackText = `${used}/${capacity}`;
    if (this.backpackLabel) this.backpackLabel.string = this.backpackText;
  }
  setWeeklyRewardReady(ready: boolean): void {
    const badge = this.node.getChildByName('OpenTools')?.getChildByName('WeeklyRewardBadge');
    if (badge) badge.active = ready;
  }
  setOrderHints(hints: Array<{ index: number; ready: boolean }>): void {
    this.orderHints = new Map(hints.map(hint => [hint.index, hint.ready]));
    for (const cell of this.cells) cell.setOrderMark(this.orderHints.get(cell.index) ?? null);
  }
  trackOrder(exact: readonly number[], precursors: readonly number[]): void {
    this.tracked.clear(); precursors.forEach(index => this.tracked.set(index, 'precursor')); exact.forEach(index => this.tracked.set(index, 'exact'));
    for (const cell of this.cells) cell.setTracked(this.tracked.get(cell.index) ?? null);
  }

  setGoalText(text: string): void {
    if (this.goalLabel) this.goalLabel.string = text;
    else if (this.footerGoal) this.footerGoal.string = text;
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
      // Cocos turns a release outside the pickup node into a node-level cancel.
      // The original input type still distinguishes that release from a real cancel.
      if (e.getEventCode() === Input.EventType.TOUCH_END) this.onTouchEnd(e);
      else this.onTouchCancel();
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
    const totalW = this.columns * this.cellWidth + (this.columns - 1) * this.gap;
    const totalH = this.rows * this.cellHeight + (this.rows - 1) * this.gap;
    const x = local.x - this.gridLeft;
    const y = this.gridTop - local.y;
    if (x < 0 || y < 0 || x > totalW || y > totalH) return null;
    const stepX = this.cellWidth + this.gap;
    const stepY = this.cellHeight + this.gap;
    const c = Math.floor(x / stepX);
    const r = Math.floor(y / stepY);
    if (c < 0 || r < 0 || c >= this.columns || r >= this.rows) return null;
    const offsetX = x % stepX;
    const offsetY = y % stepY;
    if (offsetX > this.cellWidth || offsetY > this.cellHeight) return null;
    return r * this.columns + c;
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
    this.onTouchCancel();
    const index = this.resolveIndex(e, hintIndex >= 0 ? hintIndex : undefined);
    if (index === null || index < 0) return;
    const cell = this.cells[index];
    const item = cell?.itemView;
    if (!cell || cell.isLocked || !item || !item.node.active || !item.uid) return;

    this.drag = {
      fromIndex: index,
      uid: item.uid,
      startUI: this.uiPos(e),
      active: false,
      ghost: null,
      startedAt: Date.now(),
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
      this.deps.onDragStart?.();
      this.startGhost();
      this.cells[this.drag.fromIndex]?.setSourceDim(true);
    }
    const to = this.resolveIndex(e);
    this.moveGhost(e);
    this.highlightTarget(e, to);
    this.paintBackpack(this.overBackpack(e));
  }

  onTouchEnd(e: EventTouch | EventMouse): void {
    if (!this.drag) return;
    const drag = this.drag;
    const to = this.resolveIndex(e);
    this.drag = null;
    let returnToSource = false;
    try {
      if (drag.active && this.overBackpack(e)) returnToSource = !this.deps.onStore?.(drag.fromIndex, drag.uid);
      else if (drag.active) returnToSource = !this.deps.onDrop(drag.fromIndex, to);
      else if (Date.now() - drag.startedAt >= 450) this.deps.onItemLongPress?.(drag.fromIndex);
      else this.deps.onItemTap?.(drag.fromIndex);
    } finally {
      const ghost = drag.ghost;
      if (returnToSource && ghost && isValid(ghost, true)) {
        ghost.getChildByName('OrderDragWarning')?.destroy();
        const layer = ghost.parent?.getComponent(UITransform);
        const target = layer?.convertToNodeSpaceAR(this.cells[drag.fromIndex].node.worldPosition) ?? this.cells[drag.fromIndex].node.position.clone();
        this.chestEffects.add(ghost); ghost.once(Node.EventType.NODE_DESTROYED, () => { this.chestEffects.delete(ghost); Tween.stopAllByTarget(ghost); });
        tween(ghost).to(.18, { position: target, scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' }).call(() => ghost.destroy()).start();
      } else ghost?.destroy();
      this.cells[drag.fromIndex]?.setSourceDim(false);
      this.clearHighlights();
      this.deps.onDragFinished?.();
    }
  }

  onTouchCancel(): void {
    if (!this.drag) return;
    const drag = this.drag;
    this.drag = null;
    drag.ghost?.destroy();
    this.cells[drag.fromIndex]?.setSourceDim(false);
    this.clearHighlights();
    this.deps.onDragFinished?.();
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
    const warning = makeLabel('', 23, hexColor('#A05C36'), true); warning.node.name = 'OrderDragWarning'; ghost.addChild(warning.node);
    ensureTransform(warning.node, 320, 64); warning.node.setPosition(0, -size / 2 - 36, 0); warning.overflow = Label.Overflow.SHRINK; warning.enableWrapText = true; warning.node.active = false;
    // The floating image follows the pointer but must not become its hit target.
    ghost.pauseSystemEvents(true);
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
    const index = to ?? this.resolveIndex(e);
    for (const cell of this.cells) {
      if (cell.index === this.drag.fromIndex || cell.isLocked) { cell.setHighlight('none'); continue; }
      const preview = this.deps.previewDrop(this.drag.fromIndex, cell.index);
      const mergeable = preview.kind === 'MERGE' || preview.kind === 'SPLIT';
      cell.setHighlight(cell.index === index ? mergeable ? 'merge' : preview.kind === 'MOVE' || preview.kind === 'SWAP' ? 'move' : 'invalid' : mergeable ? 'candidate' : 'none');
    }
    const warning = this.drag.ghost?.getChildByName('OrderDragWarning')?.getComponent(Label);
    if (warning) { warning.string = this.overBackpack(e) ? '' : this.deps.dropWarning?.(this.drag.fromIndex, index) ?? ''; warning.node.active = !!warning.string; }
  }

  private paintBackpack(hover: boolean): void {
    const node = this.backpackTarget; const tr = node?.getComponent(UITransform), ink = node?.getComponent(Graphics);
    if (tr && ink) paintRoundRect(ink, tr.width, tr.height, tr.height / 2, hexColor(hover ? this.backpackFull ? '#F9DDDA' : '#DFECCD' : '#FFF8EF'), hexColor(hover ? this.backpackFull ? '#C77C75' : '#9DBA8E' : '#E6CFC2'), hover ? 2 : 1);
    if (this.backpackLabel) this.backpackLabel.string = hover && this.backpackFull ? '已满' : this.backpackText;
  }

  private overBackpack(event: EventTouch | EventMouse): boolean {
    const node = this.backpackTarget; const tr = node?.getComponent(UITransform);
    if (!node || !tr) return false;
    const p = tr.convertToNodeSpaceAR(this.uiToWorld(event.getUILocation(), event));
    const icon = node.getChildByName('BackpackDropIcon')?.getComponent(UITransform);
    const q = icon?.convertToNodeSpaceAR(this.uiToWorld(event.getUILocation(), event));
    return (Math.abs(p.x) <= tr.width / 2 && Math.abs(p.y) <= tr.height / 2) || !!(icon && q && Math.abs(q.x) <= icon.width / 2 && Math.abs(q.y) <= icon.height / 2);
  }

  private clearHighlights(): void {
    this.paintBackpack(false);
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
    const lockedIndices = new Set((vm as BoardVm & { lockedIndices?: number[] }).lockedIndices ?? []);
    const unlockLevels = (vm as BoardVm & { lockedUnlockLevels?: Array<number | null> }).lockedUnlockLevels ?? [];
    for (const cell of this.cells) {
      cell.setLocked(lockedIndices.has(cell.index), unlockLevels[cell.index] ?? null);
      const item = byCell.get(cell.index) ?? null;
      cell.setItem(item);
      cell.setTracked(this.tracked.get(cell.index) ?? null); cell.setOrderMark(this.orderHints.get(cell.index) ?? null);
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

  get isChestOpening(): boolean {
    for (const effect of this.chestEffects) {
      if (effect.name === 'ChestOpenBurst' && isValid(effect, true)) return true;
    }
    return false;
  }

  playChestOpen(index: number, level: number, loot: ReadonlyArray<{ uid: string; definitionId: string; cellIndex: number | null }>, onFinished: () => void): void {
    const source = this.cells[index]; if (!source) return;
    const effect = createUiNode('ChestOpenBurst'); this.node.addChild(effect);
    this.chestEffects.add(effect);
    const origin = source.node.position.clone();
    const gridRight = this.gridLeft + this.columns * this.cellWidth + (this.columns - 1) * this.gap;
    const gridBottom = this.gridTop - this.rows * this.cellHeight - (this.rows - 1) * this.gap;
    const insideGrid = (x: number, y: number, inset: number): Vec3 => new Vec3(
      Math.max(this.gridLeft + inset, Math.min(gridRight - inset, x)),
      Math.max(gridBottom + inset, Math.min(this.gridTop - inset, y)),
      0,
    );
    const celebration = insideGrid(origin.x, origin.y, this.cellSize * 0.88 + 5);
    effect.once(Node.EventType.NODE_DESTROYED, () => {
      this.chestEffects.delete(effect); Tween.stopAllByTarget(effect);
      for (const child of effect.children) Tween.stopAllByTarget(child);
      onFinished();
    });
    const glow = createUiNode('ChestOpenGlow'); effect.addChild(glow); glow.setPosition(celebration);
    const ink = glow.addComponent(Graphics); ink.fillColor = hexColor('#F7DED3', 180); ink.circle(0, 0, this.cellSize * 0.7); ink.fill();
    for (let i = 0; i < 10; i += 1) {
      const angle = i * Math.PI / 5, radius = this.cellSize * 0.88;
      ink.fillColor = hexColor(i % 2 ? '#EDB7C3' : '#F1C46E');
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
      ink.moveTo(x, y + 5); ink.lineTo(x + 3, y); ink.lineTo(x, y - 5); ink.lineTo(x - 3, y); ink.close(); ink.fill();
    }
    const opened = createUiNode('OpenedChest'); effect.addChild(opened); opened.setPosition(celebration);
    applyArt(opened, { ...openedChestArt(), preserveAspect: true }, this.cellSize * 1.25, this.cellSize * 1.25);
    opened.setScale(0.45, 0.45, 1); tween(opened).to(0.16, { scale: new Vec3(1.06, 1.06, 1) }).to(0.12, { scale: new Vec3(1, 1, 1) }).delay(0.45).to(0.14, { scale: new Vec3(0, 0, 1) }).start();
    const inBox = loot.filter((entry) => entry.cellIndex === null).length;
    const summary = createUiNode('ChestLootSummary'); effect.addChild(summary);
    const summaryY = gridBottom + 40;
    summary.setPosition(0, summaryY, 0); ensureTransform(summary, Math.min(560, this.boardW - 16), 62);
    paintRoundRect(summary.addComponent(Graphics), Math.min(560, this.boardW - 16), 62, 24, hexColor(RewardPalette.paper), hexColor(RewardPalette.edge), 1.5);
    const caption = makeLabel(`Lv${level} 宝箱 · 随机获得 ${loot.length} 件补给${inBox ? `\n${inBox} 件已放入恢复箱` : ''}`, 23, hexColor('#9A6746'), true);
    summary.addChild(caption.node); ensureTransform(caption.node, Math.min(530, this.boardW - 40), 56); caption.enableWrapText = true; caption.overflow = Label.Overflow.SHRINK;
    for (const [i, entry] of loot.slice(0, 8).entries()) {
      const icon = createUiNode('ChestLootParticle'); effect.addChild(icon);
      const art = itemArt(entry.definitionId); if (art) applyArt(icon, { ...art, preserveAspect: true }, this.cellSize * 0.7, this.cellSize * 0.7);
      icon.setPosition(origin); icon.setScale(0.25, 0.25, 1); icon.pauseSystemEvents(true);
      const angle = -Math.PI / 2 + i * Math.PI * 2 / Math.min(8, loot.length);
      const bounce = insideGrid(celebration.x + Math.cos(angle) * this.cellSize * 0.8,
        celebration.y + Math.sin(angle) * this.cellSize * 0.8, this.cellSize * 0.42);
      const destination = entry.cellIndex === null ? this.node.getChildByName('OpenTools')?.position.clone() ?? origin : this.cells[entry.cellIndex]?.node.position.clone() ?? origin;
      tween(icon).delay(i * 0.055).to(0.18, { position: bounce, scale: new Vec3(1.2, 1.2, 1) }).to(0.34, { position: destination, scale: new Vec3(0.85, 0.85, 1) }).to(0.1, { scale: new Vec3(0, 0, 1) }).start();
    }
    effect.pauseSystemEvents(true);
    tween(effect).delay(1.5).call(() => { if (isValid(effect, true)) effect.destroy(); }).start();
  }

  clearChestEffects(): void {
    for (const effect of Array.from(this.chestEffects)) { Tween.stopAllByTarget(effect); effect.destroy(); }
    this.chestEffects.clear();
  }

  playResourceUse(index: number, definitionId: string, amount: number, unit: string): void {
    const source = this.cells[index]; if (!source) return;
    const effect = createUiNode('ResourceUseBurst'); this.node.addChild(effect); this.chestEffects.add(effect);
    effect.setPosition(source.node.position);
    effect.once(Node.EventType.NODE_DESTROYED, () => { this.chestEffects.delete(effect); Tween.stopAllByTarget(effect); });
    const art = itemArt(definitionId);
    if (art) { const icon = createUiNode('UsedResourceIcon'); effect.addChild(icon); applyArt(icon, { ...art, preserveAspect: true }, this.cellSize * 0.85, this.cellSize * 0.85); }
    const message = makeLabel(`+${amount} ${unit}`, 28, hexColor(unit === '体力' ? '#64825B' : unit === '钻石' ? '#9171B8' : '#AA763D'), true);
    message.node.name = 'ResourceUseAmount'; effect.addChild(message.node);
    ensureTransform(message.node, 210, 46); message.node.setPosition(0, this.cellSize * 0.65, 0); message.overflow = Label.Overflow.SHRINK;
    effect.pauseSystemEvents(true); effect.setScale(0.75, 0.75, 1);
    const destination = new Vec3(effect.position.x, effect.position.y + this.cellSize * 0.6, 0);
    tween(effect).to(0.12, { scale: new Vec3(1.12, 1.12, 1) }).to(0.4, { position: destination, scale: new Vec3(0.9, 0.9, 1) }).to(0.12, { scale: new Vec3(0, 0, 1) }).call(() => { if (isValid(effect, true)) effect.destroy(); }).start();
  }

  dispose(): void {
    this.clearChestEffects();
    input.off(Input.EventType.MOUSE_MOVE, this.onTouchMove, this);
    input.off(Input.EventType.MOUSE_UP, this.onTouchEnd, this);
    input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
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
