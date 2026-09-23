import { createGameContext, type GameContext } from '../../assets/scripts/gameplay/GameContext';
import type { ItemDefinition, ItemInstance, ActiveOrder } from '../../assets/scripts/core/types';

const CHAIN_PREFIX: Record<string, string> = {
  coffee: 'C',
  flower: 'F',
  dessert: 'D',
  gift: 'G',
};

type Dom = {
  levelBadge: HTMLElement;
  xpFill: HTMLElement;
  xpText: HTMLElement;
  energyText: HTMLElement;
  coinsText: HTMLElement;
  heartsText: HTMLElement;
  orders: HTMLElement;
  board: HTMLElement;
  dockInner: HTMLElement;
  tutorial: HTMLElement;
  toastRoot: HTMLElement;
  levelup: HTMLElement;
  levelupLevel: HTMLElement;
  levelupDesc: HTMLElement;
  devBtn: HTMLElement;
  devPanel: HTMLElement;
  energyPill: HTMLElement;
};

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

function chainClass(chainId: string): string {
  return `chain-${chainId}`;
}

function itemCode(def: Pick<ItemDefinition, 'chainId' | 'level'>): string {
  const prefix = CHAIN_PREFIX[def.chainId] ?? def.chainId.slice(0, 1).toUpperCase();
  return `${prefix}${def.level}`;
}

class WebGameUI {
  private game: GameContext;
  private dom: Dom;
  private cells: HTMLElement[] = [];
  private itemEls = new Map<string, HTMLElement>();
  private drag: {
    uid: string;
    fromIndex: number;
    startX: number;
    startY: number;
    active: boolean;
    ghost: HTMLElement | null;
    threshold: number;
  } | null = null;

  constructor() {
    this.game = createGameContext({ saveDebounceMs: 150 });
    this.dom = {
      levelBadge: $('level-badge'),
      xpFill: $('xp-fill'),
      xpText: $('xp-text'),
      energyText: $('energy-text'),
      coinsText: $('coins-text'),
      heartsText: $('hearts-text'),
      orders: $('orders'),
      board: $('board'),
      dockInner: $('dock-inner'),
      tutorial: $('tutorial'),
      toastRoot: $('toast-root'),
      levelup: $('levelup'),
      levelupLevel: $('levelup-level'),
      levelupDesc: $('levelup-desc'),
      devBtn: $('dev-btn'),
      devPanel: $('dev-panel'),
      energyPill: $('energy-pill'),
    };
    this.bindBus();
    this.buildBoard();
    this.buildDock();
    this.renderAll();
    this.bindDev();
    this.dom.energyPill.addEventListener('click', () => {
      this.toast('每 2 分钟恢复 1 点体力');
    });
    window.addEventListener('beforeunload', () => this.game.flushSave());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.game.flushSave();
    });
    setInterval(() => {
      this.game.energy.tick();
      this.renderStatus();
    }, 5000);
  }

  private bindBus(): void {
    const bus = this.game.bus;
    bus.on('ORDER_COMPLETED', (p) => {
      this.toast(
        `交付成功！\n💰${p.rewardCoins} XP${p.rewardXp} ❤${p.rewardHearts}`,
        'success',
      );
    });
    bus.on('LEVEL_UP', (p) => {
      this.showLevelUp(p.level, p.unlockedChains);
    });
    bus.on('BOARD_CHANGED', () => {
      this.renderBoard();
      this.renderOrders();
    });
    bus.on('ENERGY_CHANGED', () => this.renderStatus());
    bus.on('XP_CHANGED', () => this.renderStatus());
    bus.on('COINS_CHANGED', () => this.renderStatus());
    bus.on('HEARTS_CHANGED', () => this.renderStatus());
    bus.on('ORDER_UPDATED', () => this.renderOrders());
    bus.on('TUTORIAL_UPDATED', () => this.renderTutorial());
    bus.on('ITEM_MERGED', () => {
      // toast on merge handled after drop result too; light feedback here
    });
  }

  private buildBoard(): void {
    const rows = this.game.gameConfig.board.rows;
    const cols = this.game.gameConfig.board.columns;
    this.dom.board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    this.dom.board.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    this.dom.board.innerHTML = '';
    this.cells = [];
    for (let i = 0; i < rows * cols; i += 1) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.index = String(i);
      this.dom.board.appendChild(cell);
      this.cells.push(cell);
    }

    this.dom.board.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('pointercancel', () => this.cancelDrag());
  }

  private buildDock(): void {
    this.dom.dockInner.innerHTML = '';
    for (const gen of this.game.bundle.generators) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gen-btn';
      btn.dataset.gen = gen.id;
      const map: Record<string, string> = {
        coffee_machine: '咖',
        flower_basket: '花',
        dessert_oven: '甜',
        gift_box: '礼',
      };
      btn.innerHTML = `
        <div class="gen-icon ${chainClass(gen.chainId)}">${map[gen.id] ?? gen.displayName.slice(0, 1)}</div>
        <div class="gen-name">${gen.displayName}</div>
        <div class="gen-lock"></div>
      `;
      btn.addEventListener('click', () => this.onGeneratorClick(gen.id));
      this.dom.dockInner.appendChild(btn);
    }
    this.renderDock();
  }

  private onGeneratorClick(id: string): void {
    const gen = this.game.generators.get(id);
    if (!gen) return;
    if (!this.game.generators.isUnlocked(gen)) {
      this.toast(`达到 Lv${gen.unlockLevel} 后解锁`, 'warn');
      return;
    }
    const result = this.game.spawnFromGenerator(id);
    if (result.ok) {
      this.renderAll();
      return;
    }
    if (result.reason === 'BOARD_FULL') {
      this.toast('棋盘满啦～\n先合成一些物品吧', 'warn');
    } else if (result.reason === 'NOT_ENOUGH_ENERGY') {
      this.toast('体力不足啦～\n休息一下再回来吧', 'warn');
    } else if (result.reason === 'LOCKED') {
      this.toast(`达到 Lv${gen.unlockLevel} 后解锁`, 'warn');
    } else {
      this.toast('暂时无法生成', 'warn');
    }
    this.renderAll();
  }

  private cellIndexFromEvent(e: PointerEvent): number | null {
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const cell = target?.closest('.cell') as HTMLElement | null;
    if (!cell) return null;
    const idx = Number(cell.dataset.index);
    return Number.isFinite(idx) ? idx : null;
  }

  private onPointerDown(e: PointerEvent): void {
    const itemEl = (e.target as HTMLElement).closest('.item') as HTMLElement | null;
    if (!itemEl) return;
    const uid = itemEl.dataset.uid;
    const index = Number(itemEl.dataset.index);
    if (!uid || !Number.isFinite(index)) return;

    this.drag = {
      uid,
      fromIndex: index,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      ghost: null,
      threshold: this.game.gameConfig.dragThresholdPx,
    };
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.drag) return;
    const dx = e.clientX - this.drag.startX;
    const dy = e.clientY - this.drag.startY;
    if (!this.drag.active) {
      if (Math.hypot(dx, dy) < this.drag.threshold) return;
      this.drag.active = true;
      this.startGhost(e);
    }
    this.moveGhost(e);
    this.highlightDropTarget(e);
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.drag) return;
    const drag = this.drag;
    this.drag = null;
    this.clearHighlights();
    this.removeGhost();

    if (!drag.active) {
      this.renderBoard();
      return;
    }

    const to = this.cellIndexFromEvent(e);
    const result = this.game.dropItem(drag.fromIndex, to);
    this.renderAll();
    if (result.ok && result.kind === 'MERGE') {
      this.popMerge(result.to);
      this.toast('合成成功！', 'success');
    }
  }

  private cancelDrag(): void {
    this.drag = null;
    this.clearHighlights();
    this.removeGhost();
    this.renderBoard();
  }

  private startGhost(e: PointerEvent): void {
    if (!this.drag) return;
    const inst = this.findItem(this.drag.fromIndex);
    const def = inst ? this.game.bundle.catalog.get(inst.definitionId) : undefined;
    if (!def) return;
    const ghost = document.createElement('div');
    ghost.className = `ghost ${chainClass(def.chainId)}`;
    ghost.innerHTML = `<div>${itemCode(def)}</div><div style="font-size:9px;font-weight:500">${def.displayName}</div>`;
    document.body.appendChild(ghost);
    this.drag.ghost = ghost;
    this.moveGhost(e);
    const src = this.cells[this.drag.fromIndex]?.querySelector('.item');
    src?.classList.add('dragging');
    this.cells[this.drag.fromIndex]?.classList.add('source-ghost');
  }

  private moveGhost(e: PointerEvent): void {
    if (!this.drag?.ghost) return;
    this.drag.ghost.style.left = `${e.clientX}px`;
    this.drag.ghost.style.top = `${e.clientY}px`;
  }

  private removeGhost(): void {
    this.drag?.ghost?.remove();
    if (this.drag) this.drag.ghost = null;
  }

  private highlightDropTarget(e: PointerEvent): void {
    if (!this.drag) return;
    this.clearHighlights();
    const to = this.cellIndexFromEvent(e);
    if (to === null || to === this.drag.fromIndex) return;
    const preview = this.game.board.previewDrop(this.drag.fromIndex, to);
    const cell = this.cells[to];
    if (!cell) return;
    if (preview.kind === 'MERGE') cell.classList.add('drop-merge');
    else if (preview.kind === 'MOVE' || preview.kind === 'SWAP')
      cell.classList.add('drop-ok');
  }

  private clearHighlights(): void {
    for (const c of this.cells) {
      c.classList.remove('drop-ok', 'drop-merge', 'source-ghost');
    }
    for (const el of this.itemEls.values()) {
      el.classList.remove('dragging');
    }
  }

  private findItem(index: number): ItemInstance | undefined {
    return this.game.board.getBoard().cells[index]?.item;
  }

  private renderAll(): void {
    this.renderStatus();
    this.renderBoard();
    this.renderOrders();
    this.renderDock();
    this.renderTutorial();
  }

  private renderStatus(): void {
    const p = this.game.player;
    this.dom.levelBadge.textContent = `Lv.${p.level}`;
    const xpInfo = this.game.progression.getXpToNext();
    const currentFloor = this.levelXpFloor(p.level);
    const span =
      xpInfo.nextThreshold !== null
        ? Math.max(1, xpInfo.nextThreshold - currentFloor)
        : 1;
    const progress =
      xpInfo.nextThreshold === null
        ? 1
        : Math.min(1, (p.xp - currentFloor) / span);
    this.dom.xpFill.style.width = `${Math.round(progress * 100)}%`;
    this.dom.xpText.textContent =
      xpInfo.nextThreshold === null
        ? `${p.xp} XP`
        : `${p.xp} / ${xpInfo.nextThreshold}`;
    this.dom.energyText.textContent = `${p.energy}/${p.maxEnergy}`;
    this.dom.coinsText.textContent = String(p.coins);
    this.dom.heartsText.textContent = String(p.hearts);
  }

  private levelXpFloor(level: number): number {
    const entry = this.game.bundle.progression.levels.find((l) => l.level === level);
    return entry?.xpRequired ?? 0;
  }

  private renderBoard(): void {
    const board = this.game.board.getBoard();
    for (const el of this.itemEls.values()) el.remove();
    this.itemEls.clear();

    for (const cellState of board.cells) {
      const cellEl = this.cells[cellState.index];
      if (!cellEl) continue;
      const old = cellEl.querySelector('.item');
      if (old) old.remove();
      const item = cellState.item;
      if (!item) continue;
      const def = this.game.bundle.catalog.get(item.definitionId);
      if (!def) continue;
      const el = document.createElement('div');
      el.className = `item ${chainClass(def.chainId)}`;
      el.dataset.uid = item.uid;
      el.dataset.index = String(cellState.index);
      el.innerHTML = `<div class="item-code">${itemCode(def)}</div><div class="item-name">${def.displayName}</div>`;
      cellEl.appendChild(el);
      this.itemEls.set(item.uid, el);
    }
  }

  private renderOrders(): void {
    const orders = this.game.orders.getOrders();
    this.dom.orders.innerHTML = '';
    for (const order of orders) {
      this.dom.orders.appendChild(this.buildOrderCard(order));
    }
  }

  private buildOrderCard(order: ActiveOrder): HTMLElement {
    const card = document.createElement('div');
    card.className = 'order-card';
    const progress = this.game.board.getOrderProgress(order);
    const reqs = document.createElement('div');
    reqs.className = 'order-reqs';
    for (const req of progress.requirements) {
      const def = this.game.bundle.catalog.get(req.itemId);
      const row = document.createElement('div');
      row.className = `order-req${req.done ? ' done' : ''}`;
      row.innerHTML = `<span>${def?.displayName ?? req.itemId}</span><span>${
        req.done ? '✓' : `${req.have}/${req.count}`
      }</span>`;
      reqs.appendChild(row);
    }
    const reward = document.createElement('div');
    reward.className = 'order-reward';
    reward.textContent = `💰${order.rewardCoins} ❤${order.rewardHearts}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `order-btn${progress.ready ? ' ready' : ''}`;
    btn.textContent = progress.ready ? '交付' : '还差一点';
    btn.disabled = !progress.ready;
    btn.addEventListener('click', () => {
      const result = this.game.claimOrder(order.uid);
      if (result.ok) {
        this.renderAll();
      } else if (result.reason === 'INVENTORY_RACE') {
        this.toast('还差一点，先凑齐物品吧', 'warn');
        this.renderAll();
      }
    });
    card.appendChild(reqs);
    card.appendChild(reward);
    card.appendChild(btn);
    return card;
  }

  private renderDock(): void {
    for (const gen of this.game.bundle.generators) {
      const btn = this.dom.dockInner.querySelector(
        `[data-gen="${gen.id}"]`,
      ) as HTMLElement | null;
      if (!btn) continue;
      const isUnlocked = this.game.generators.isUnlocked(gen);
      btn.classList.toggle('locked', !isUnlocked);
      const lock = btn.querySelector('.gen-lock');
      if (lock) {
        lock.textContent = isUnlocked
          ? `⚡${gen.energyCost}`
          : `🔒 Lv${gen.unlockLevel} 解锁`;
      }
    }
  }

  private renderTutorial(): void {
    const t = this.game.tutorial;
    let text = '';
    if (!t.generatorClicked) {
      text = '点一下咖啡机吧～';
    } else if (!t.firstMergeCompleted) {
      text = '试着把两个一样的东西拖到一起';
    } else if (!t.firstOrderCompleted) {
      const ready = this.game.orders
        .getOrders()
        .some((o) => this.game.board.getOrderProgress(o).ready);
      if (ready) text = '订单完成啦，点击交付吧 ❤️';
    }
    if (text) {
      this.dom.tutorial.hidden = false;
      this.dom.tutorial.textContent = text;
    } else {
      this.dom.tutorial.hidden = true;
    }
  }

  private toast(
    message: string,
    tone: 'info' | 'success' | 'warn' = 'info',
  ): void {
    const el = document.createElement('div');
    el.className = `toast ${tone}`;
    el.textContent = message;
    this.dom.toastRoot.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 1800);
  }

  private showLevelUp(level: number, unlockedChains: string[]): void {
    this.dom.levelup.hidden = false;
    this.dom.levelupLevel.textContent = `Lv.${level}`;
    const names = unlockedChains.map((c) => {
      const map: Record<string, string> = {
        coffee: '咖啡',
        flower: '花艺',
        dessert: '甜品烤箱',
        gift: '礼物盒',
      };
      return map[c] ?? c;
    });
    this.dom.levelupDesc.textContent = names.length
      ? `${names.join('、')}已解锁！`
      : '解锁新内容';
    setTimeout(() => {
      this.dom.levelup.hidden = true;
    }, 1600);
  }

  private popMerge(cellIndex: number): void {
    const cell = this.cells[cellIndex];
    const item = cell?.querySelector('.item');
    item?.classList.add('merge-pop');
    setTimeout(() => item?.classList.remove('merge-pop'), 300);
  }

  private bindDev(): void {
    this.dom.devBtn.addEventListener('click', () => {
      this.dom.devPanel.hidden = !this.dom.devPanel.hidden;
    });
    this.dom.devPanel.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest(
        'button',
      ) as HTMLButtonElement | null;
      if (!btn) return;
      const action = btn.dataset.dev;
      if (action === 'energy') this.game.debugAddEnergy(50);
      if (action === 'xp') this.game.debugAddXp(100);
      if (action === 'coins') this.game.debugAddCoins(1000);
      if (action === 'clear') this.game.debugClearBoard();
      if (action === 'reset') {
        if (confirm('确定重置存档？')) this.game.debugResetSave();
      }
      if (action === 'spawn') {
        const chain = (document.getElementById('dev-chain') as HTMLSelectElement)
          .value;
        const level = (document.getElementById('dev-level') as HTMLSelectElement)
          .value;
        this.game.debugSpawn(`${chain}_${level.padStart(2, '0')}`);
      }
      this.renderAll();
    });
  }
}

function main(): void {
  try {
    new WebGameUI();
  } catch (err) {
    document.body.innerHTML = `<pre style="padding:20px;color:#b00">Boot failed: ${
      err instanceof Error ? err.message : String(err)
    }</pre>`;
    console.error(err);
  }
}

main();
