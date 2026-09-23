/**
 * CocosGameView — composes status/orders/board/dock/toast/tutorial/levelup/debug.
 * Event-driven refresh only; never mutates domain state directly.
 */
import { Node, tween, UIOpacity, UITransform } from 'cc';
import type { GameContext } from '../../gameplay/GameContext';
import type { GameEventBus } from '../../events/GameEventBus';
import { GameController } from '../GameController';
import {
  GameViewMapper,
  type OrderVm,
  type StatusVm,
} from '../../presentation/GameViewMapper';
import type { UiRoots } from './UiFactory';
import { sizeOf } from './UiFactory';
import { CocosStatusBar } from './CocosStatusBar';
import { CocosOrderPanel } from './CocosOrderPanel';
import { CocosBoardView } from './CocosBoardView';
import { CocosGeneratorDock } from './CocosGeneratorDock';
import { CocosToastView, ToastMessages } from './CocosToastView';
import { CocosTutorialView } from './CocosTutorialView';
import { CocosLevelUpView } from './CocosLevelUpView';
import { CocosDebugPanel } from './CocosDebugPanel';
import {
  CocosTheme,
  createUiNode,
  ensureTransform,
  paintRoundRect,
} from './CocosTheme';
import { Graphics } from 'cc';

export class CocosGameView {
  private readonly mapper: GameViewMapper;
  private readonly controller: GameController;
  private status: CocosStatusBar;
  private orders: CocosOrderPanel;
  private board: CocosBoardView;
  private dock: CocosGeneratorDock;
  private toast: CocosToastView;
  private tutorial: CocosTutorialView;
  private levelUp: CocosLevelUpView;
  private debug: CocosDebugPanel;
  private unsubs: Array<() => void> = [];

  constructor(
    private readonly game: GameContext,
    private readonly roots: UiRoots,
  ) {
    this.mapper = new GameViewMapper(game.bundle);
    this.controller = new GameController(game);
    this.controller.bootUi();

    const bg = createUiNode('BgFill');
    roots.background.addChild(bg);
    ensureTransform(bg, 750, 1334);
    const bgG = bg.addComponent(Graphics);
    paintRoundRect(bgG, 750, 1334, 0, CocosTheme.background());

    const statusSize = sizeOf(roots.statusSlot, 750, 100);
    const ordersSize = sizeOf(roots.ordersSlot, 750, 220);
    const boardSize = sizeOf(roots.boardSlot, 750, 700);
    const dockSize = sizeOf(roots.dockSlot, 750, 180);

    this.status = new CocosStatusBar(
      roots.statusSlot,
      statusSize.width,
      statusSize.height,
    );
    this.orders = new CocosOrderPanel(
      roots.ordersSlot,
      ordersSize.width,
      ordersSize.height,
    );
    this.board = new CocosBoardView(
      roots.boardSlot,
      boardSize.width,
      boardSize.height,
      game.gameConfig.board.rows,
      game.gameConfig.board.columns,
      {
        dragThreshold: game.gameConfig.dragThresholdPx,
        previewDrop: (from, to) => game.board.previewDrop(from, to),
        onDrop: (from, to) => this.handleDrop(from, to),
      },
    );
    this.board.setDragLayer(roots.dragLayer);

    this.dock = new CocosGeneratorDock(
      roots.dockSlot,
      dockSize.width,
      dockSize.height,
    );
    this.toast = new CocosToastView(roots.toastLayer, 750, 1334);
    this.tutorial = new CocosTutorialView(roots.tutorialLayer, 750, 1334);
    this.levelUp = new CocosLevelUpView(roots.modalLayer, 750, 1334);
    this.debug = new CocosDebugPanel(roots.debugLayer, 750, 1334, {
      addEnergy: () => {
        game.debugAddEnergy(50);
        this.renderAll();
      },
      addXp: () => {
        game.debugAddXp(100);
        this.renderAll();
      },
      addCoins: () => {
        game.debugAddCoins(1000);
        this.renderAll();
      },
      clearBoard: () => {
        game.debugClearBoard();
        this.renderAll();
      },
      resetSave: () => {
        game.debugResetSave();
        this.renderAll();
        this.toast.show('存档已重置');
      },
      spawnItem: () => {
        game.debugSpawn('coffee_03');
        this.renderAll();
      },
    });

    this.orders.bind((uid) => {
      const msg = this.controller.onClaim(uid);
      if (msg.toast) this.toast.show(msg.toast, msg.tone ?? 'info');
      this.renderAll();
    });
    this.dock.bind((id) => {
      const beforeEnergy = game.player.energy;
      const msg = this.controller.onPointerTapGenerator(id);
      if (msg.toast) this.toast.show(msg.toast, msg.tone ?? 'warn');
      if (game.player.energy < beforeEnergy) this.dock.popMatching(id);
      this.renderAll();
    });

    this.subscribe(game.bus);
    this.renderAll();
  }

  private handleDrop(from: number, to: number | null): void {
    const result = this.controller.onDrop(from, to);
    if (result.ok && result.kind === 'MERGE' && to != null) {
      this.board.markMerge(to);
      if (result.toast) this.toast.show(result.toast, result.tone ?? 'success');
    } else if (result.ok && result.kind === 'MOVE' && to != null) {
      this.board.markSpawn(to);
    }
    this.renderAll();
    this.renderTutorial();
  }

  private subscribe(bus: GameEventBus): void {
    this.unsubs.push(
      bus.on('BOARD_CHANGED', () => {
        this.renderBoard();
        this.renderOrders();
      }),
    );
    this.unsubs.push(
      bus.on('ITEM_MERGED', (p) => {
        this.board.markMerge(p.to);
      }),
    );
    this.unsubs.push(
      bus.on('ITEM_SPAWNED', (p) => {
        this.board.markSpawn(p.cellIndex);
      }),
    );
    this.unsubs.push(
      bus.on('ENERGY_CHANGED', () => {
        this.renderStatus();
        this.status.pulseEnergy();
      }),
    );
    this.unsubs.push(bus.on('XP_CHANGED', () => this.renderStatus()));
    this.unsubs.push(bus.on('COINS_CHANGED', () => this.renderStatus()));
    this.unsubs.push(bus.on('HEARTS_CHANGED', () => this.renderStatus()));
    this.unsubs.push(bus.on('ORDER_UPDATED', () => this.renderOrders()));
    this.unsubs.push(
      bus.on('ORDER_COMPLETED', (p) => {
        this.toast.show(
          `交付成功！\n💰${p.rewardCoins}  ♥${p.rewardHearts}`,
          'success',
        );
      }),
    );
    this.unsubs.push(
      bus.on('LEVEL_UP', (p) => {
        this.levelUp.show(p.level, p.unlockedChains);
        this.renderAll();
      }),
    );
    this.unsubs.push(bus.on('TUTORIAL_UPDATED', () => this.renderTutorial()));
  }

  private statusVm(): StatusVm {
    return this.mapper.mapStatus(
      this.game.player,
      this.game.clock.now(),
      this.game.gameConfig.energy.recoverIntervalMs,
    );
  }

  private orderVms(): OrderVm[] {
    return this.game.orders.getOrders().map((order) => {
      const progress = this.game.board.getOrderProgress(order);
      return this.mapper.mapOrder(order, progress);
    });
  }

  renderAll(): void {
    this.renderStatus();
    this.renderBoard();
    this.renderOrders();
    this.renderDock();
    this.renderTutorial();
  }

  private renderStatus(): void {
    this.status.render(this.statusVm());
  }

  private renderBoard(): void {
    this.board.render(this.mapper.mapBoard(this.game.board.getBoard()));
  }

  private renderOrders(): void {
    this.orders.render(this.orderVms());
  }

  private renderDock(): void {
    this.dock.render(
      this.mapper.mapGenerators(this.game.bundle.generators, this.game.player),
    );
  }

  private renderTutorial(): void {
    const t = this.game.tutorial;
    if (!t.generatorClicked) {
      this.tutorial.show('点一下咖啡机吧～');
      return;
    }
    if (!t.firstMergeCompleted) {
      this.tutorial.show('把两个一样的东西拖到一起');
      return;
    }
    if (!t.firstOrderCompleted) {
      const ready = this.orderVms().some((o) => o.ready);
      if (ready) {
        this.tutorial.show(ToastMessages.orderReady);
        return;
      }
    }
    this.tutorial.hide();
  }

  dispose(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
    this.board.dispose();
    void (0 as unknown as UIOpacity);
    void (0 as unknown as UITransform);
    void tween;
    void new Node();
  }
}
