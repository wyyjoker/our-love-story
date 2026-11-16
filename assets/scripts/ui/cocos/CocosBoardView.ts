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
import { applyArt, itemArt, openedChestArt } from './CocosArt';
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
  previewDrop: (from: number, to: number | null) => DropResolve;
  onDrop: (from: number, to: number | null) => void;
  dragThreshold: number;
  onDragStart?: () => void;
  onDragFinished?: () => void;
  onOpenAdventure?: () => void;
  onOpenTools?: () => void;
  onOpenBackpack?: () => void;
  onOpenOrangeTree?: () => void;
  onStore?: (index: number, uid: string) => void;
  onItemTap?: (index: number) => void;
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
  private readonly chestEffects = new Set<Node>();

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

  setCamera(camera: Camera | null): void {
    this.camera = camera;
  }

  hintAnchor(index: number): { position: Vec3; size: number } | null {
    const cell = this.cells[index];
    return cell ? { position: cell.node.worldPosition.clone(), size: this.cellSize } : null;
  }

  private layoutCells(): void {
    // Keep one clear objective row above the grid, then devote all remaining
    // height to the seven-row board. Width always fills all six columns;
    // shorter screens use wider tiles rather than empty side gutters.
    const toolbarHeight = 72;
    this.gap = this.boardH < 600 ? 4 : 6;
    this.cellWidth = Math.max(1, (this.boardW - 16 - (this.columns - 1) * this.gap) / this.columns);
    this.cellHeight = Math.max(1, Math.min(
      this.cellWidth,
      (this.boardH - toolbarHeight - 18 - (this.rows - 1) * this.gap) / this.rows,
    ));
    this.cellSize = Math.min(this.cellWidth, this.cellHeight);
    const totalW = this.columns * this.cellWidth + (this.columns - 1) * this.gap;
    const totalH = this.rows * this.cellHeight + (this.rows - 1) * this.gap;
    const paperH = totalH + 16;
    const paperY = -this.boardH / 2 + paperH / 2 + 2;
    const paper = createUiNode('BoardPaper');
    this.node.addChild(paper);
    ensureTransform(paper, this.boardW, paperH);
    paper.setPosition(0, paperY, 0);
    paintRoundRect(paper.addComponent(Graphics), this.boardW, paperH, 22, hexColor('#FFF4E9', 244), hexColor('#FFFFFF'), 2);
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
    const height = 64, topY = this.boardH / 2 - height / 2 - 2;
    const summaryWidth = this.boardW - 174;
    const summary = createUiNode('BoardSummary'); this.node.addChild(summary);
    ensureTransform(summary, summaryWidth, height); summary.setPosition(-87, topY, 0);
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

    const bag = createUiNode('BoardBackpackButton'); this.node.addChild(bag);
    ensureTransform(bag, 80, height); bag.setPosition(this.boardW / 2 - 126, topY, 0);
    paintRoundRect(bag.addComponent(Graphics), 80, height, 20, hexColor('#FFF8EF'), hexColor('#E6CFC2'), 1);
    const art = createUiNode('BackpackDropIcon'); bag.addChild(art); art.setPosition(0, 6, 0);
    applyArt(art, { sheet: 'scissors_backpack_sheet', index: 5, columns: 3, rows: 2, preserveAspect: true }, 60, 56);
    const count = createUiNode('BackpackCount'); bag.addChild(count); count.setPosition(18, -21, 0);
    paintRoundRect(count.addComponent(Graphics), 48, 26, 13, hexColor('#FFFFFF'), hexColor('#E6CFC2'), 1);
    this.backpackLabel = makeLabel('0/6', 18, hexColor('#825A54'), true);
    this.backpackLabel.node.name = 'BoardBackpackLabel'; count.addChild(this.backpackLabel.node); ensureTransform(this.backpackLabel.node, 44, 24);
    const supplies = createUiNode('OpenTools'); this.node.addChild(supplies);
    ensureTransform(supplies, 78, height); supplies.setPosition(this.boardW / 2 - 40, topY, 0);
    paintRoundRect(supplies.addComponent(Graphics), 78, height, 20, hexColor('#FFF8EF'), hexColor('#E6CFC2'), 1);
    const gift = createUiNode('SupplyShortcutArt'); supplies.addChild(gift); gift.setPosition(0, 10, 0);
    const giftArt = itemArt('treasure_chest'); if (giftArt) applyArt(gift, { ...giftArt, preserveAspect: true }, 42, 38);
    const caption = makeLabel('补给', 19, hexColor('#825A54'), true); supplies.addChild(caption.node); ensureTransform(caption.node, 64, 25); caption.node.setPosition(0, -21, 0);
    for (const [node, tap] of [[bag, this.deps.onOpenBackpack], [supplies, this.deps.onOpenTools]] as const) {
      node.addComponent(Button); node.addComponent(BlockInputEvents);
      let intentionalTap = false;
      node.on(Node.EventType.TOUCH_START, () => { intentionalTap = this.drag === null; });
      node.on(Node.EventType.TOUCH_CANCEL, () => { intentionalTap = false; });
      node.on(Button.EventType.CLICK, () => { if (!intentionalTap) return; intentionalTap = false; tap?.(); });
    }
  }

  shortcutAnchor(name: 'BoardBackpackButton' | 'OpenTools'): Vec3 | null {
    return this.node.getChildByName(name)?.worldPosition.clone() ?? null;
  }

  setBackpackUsage(used: number, capacity: number): void {
    if (this.backpackLabel) this.backpackLabel.string = `${used}/${capacity}`;
  }

  setGoalText(text: string): void {
    if (this.goalLabel) this.goalLabel.string = text;
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
    try {
      if (drag.active && this.overBackpack(e)) this.deps.onStore?.(drag.fromIndex, drag.uid);
      else if (drag.active) this.deps.onDrop(drag.fromIndex, to);
      else this.deps.onItemTap?.(drag.fromIndex);
    } finally {
      drag.ghost?.destroy();
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
    this.clearHighlights();
    const index = to ?? this.resolveIndex(e);
    if (index === null || index < 0 || index === this.drag.fromIndex) return;
    const preview = this.deps.previewDrop(this.drag.fromIndex, index);
    const cell = this.cells[index];
    if (!cell || cell.isLocked) return;
    if (preview.kind === 'MERGE' || preview.kind === 'SPLIT') cell.setHighlight('merge');
    else if (preview.kind === 'MOVE' || preview.kind === 'SWAP') {
      cell.setHighlight('move');
    }
  }

  private paintBackpack(hover: boolean): void {
    const node = this.node.getChildByName('BoardBackpackButton'); const tr = node?.getComponent(UITransform), ink = node?.getComponent(Graphics);
    if (tr && ink) paintRoundRect(ink, tr.width, tr.height, tr.height / 2, hexColor(hover ? '#DFECCD' : '#FFF8EF'), hexColor(hover ? '#9DBA8E' : '#E6CFC2'), hover ? 2 : 1);
  }

  private overBackpack(event: EventTouch | EventMouse): boolean {
    const node = this.node.getChildByName('BoardBackpackButton'); const tr = node?.getComponent(UITransform);
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

  playChestOpen(index: number, level: number, loot: ReadonlyArray<{ uid: string; definitionId: string; cellIndex: number | null }>): void {
    const source = this.cells[index]; if (!source) return;
    const effect = createUiNode('ChestOpenBurst'); this.node.addChild(effect);
    this.chestEffects.add(effect);
    const origin = source.node.position.clone();
    effect.once(Node.EventType.NODE_DESTROYED, () => {
      this.chestEffects.delete(effect); Tween.stopAllByTarget(effect);
      for (const child of effect.children) Tween.stopAllByTarget(child);
    });
    const glow = createUiNode('ChestOpenGlow'); effect.addChild(glow); glow.setPosition(origin);
    const ink = glow.addComponent(Graphics); ink.fillColor = hexColor('#F7DED3', 180); ink.circle(0, 0, this.cellSize * 0.7); ink.fill();
    for (let i = 0; i < 10; i += 1) {
      const angle = i * Math.PI / 5, radius = this.cellSize * 0.88;
      ink.fillColor = hexColor(i % 2 ? '#EDB7C3' : '#F1C46E');
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
      ink.moveTo(x, y + 5); ink.lineTo(x + 3, y); ink.lineTo(x, y - 5); ink.lineTo(x - 3, y); ink.close(); ink.fill();
    }
    const opened = createUiNode('OpenedChest'); effect.addChild(opened); opened.setPosition(origin);
    applyArt(opened, { ...openedChestArt(), preserveAspect: true }, this.cellSize * 1.25, this.cellSize * 1.25);
    opened.setScale(0.45, 0.45, 1); tween(opened).to(0.16, { scale: new Vec3(1.06, 1.06, 1) }).to(0.12, { scale: new Vec3(1, 1, 1) }).delay(0.45).to(0.14, { scale: new Vec3(0, 0, 1) }).start();
    const inBox = loot.filter((entry) => entry.cellIndex === null).length;
    const summary = createUiNode('ChestLootSummary'); effect.addChild(summary);
    const summaryY = this.gridTop - (this.rows * this.cellHeight + (this.rows - 1) * this.gap) + 40;
    summary.setPosition(0, summaryY, 0); ensureTransform(summary, Math.min(560, this.boardW - 16), 62);
    paintRoundRect(summary.addComponent(Graphics), Math.min(560, this.boardW - 16), 62, 24, hexColor(RewardPalette.paper), hexColor(RewardPalette.edge), 1.5);
    const caption = makeLabel(`Lv${level} 宝箱 · 随机获得 ${loot.length} 件补给${inBox ? `\n${inBox} 件已放入恢复箱` : ''}`, 23, hexColor('#9A6746'), true);
    summary.addChild(caption.node); ensureTransform(caption.node, Math.min(530, this.boardW - 40), 56); caption.enableWrapText = true; caption.overflow = Label.Overflow.SHRINK;
    for (const [i, entry] of loot.slice(0, 8).entries()) {
      const icon = createUiNode('ChestLootParticle'); effect.addChild(icon);
      const art = itemArt(entry.definitionId); if (art) applyArt(icon, { ...art, preserveAspect: true }, this.cellSize * 0.7, this.cellSize * 0.7);
      icon.setPosition(origin); icon.setScale(0.25, 0.25, 1); icon.pauseSystemEvents(true);
      const angle = -Math.PI / 2 + i * Math.PI * 2 / Math.min(8, loot.length);
      const bounce = new Vec3(origin.x + Math.cos(angle) * this.cellSize * 0.8, origin.y + Math.sin(angle) * this.cellSize * 0.8, 0);
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
