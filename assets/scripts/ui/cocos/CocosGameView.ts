/**
 * CocosGameView — composes status/orders/board/dock/toast/tutorial/levelup/debug.
 * Merge/spawn VFX come from EventBus only (no double animation).
 */
import { Camera, Graphics } from 'cc';
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
import { CocosLifePages } from './CocosLifePages';
import { applyArt } from './CocosArt';
import { captureHomePhoto } from '../../platform/cocos/CocosPhotoService';
import {
  CocosTheme,
  createUiNode,
  ensureTransform,
  paintRoundRect,
} from './CocosTheme';

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
  private lifePages: CocosLifePages;
  private unsubs: Array<() => void> = [];

  constructor(
    private readonly game: GameContext,
    private readonly roots: UiRoots,
  ) {
    this.mapper = new GameViewMapper(game.bundle);
    this.controller = new GameController(game);
    this.controller.bootUi();

    const dw = roots.designWidth;
    const dh = roots.designHeight;

    const bg = createUiNode('BgFill');
    roots.background.addChild(bg);
    ensureTransform(bg, dw, dh);
    const bgG = bg.addComponent(Graphics);
    paintRoundRect(bgG, dw, dh, 0, CocosTheme.background());
    const bgArt = createUiNode('MergeBackgroundArt');
    roots.background.addChild(bgArt);
    applyArt(bgArt, { sheet: 'merge_background' }, dw, dh);

    const statusSize = sizeOf(roots.statusSlot, dw, Math.round(dh * 0.09));
    const ordersSize = sizeOf(roots.ordersSlot, dw, Math.round(dh * 0.16));
    const boardSize = sizeOf(roots.boardSlot, dw, Math.round(dh * 0.5));
    const dockSize = sizeOf(roots.dockSlot, dw, Math.round(dh * 0.14));

    this.status = new CocosStatusBar(
      roots.statusSlot,
      statusSize.width,
      statusSize.height,
      (kind) => this.toast.show(kind === 'energy' ? '每 4 分钟恢复 1 点体力' : kind === 'coins' ? '完成订单和心愿可获得金币' : '完成订单、心愿和升级礼包可获得爱心'),
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
    this.board.setCamera(roots.camera.getComponent(Camera));

    this.dock = new CocosGeneratorDock(
      roots.dockSlot,
      dockSize.width,
      dockSize.height,
    );
    this.toast = new CocosToastView(roots.toastLayer, dw, dh);
    this.tutorial = new CocosTutorialView(roots.tutorialLayer, dw, dh);
    this.levelUp = new CocosLevelUpView(roots.modalLayer, dw, dh);
    this.debug = new CocosDebugPanel(roots.debugLayer, dw, dh, {
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

    this.lifePages = new CocosLifePages(game, roots, (message) => this.toast.show(message), () => {
      void this.capturePhoto();
    }, () => this.renderTutorial());

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
    this.showNextReward();
  }

  private async capturePhoto(): Promise<void> {
    const result = await captureHomePhoto();
    if (!result.ok) {
      this.toast.show(result.reason, 'warn');
      return;
    }
    this.game.addPhoto(result.path);
    this.toast.show(result.albumSaved ? '照片已保存到相册 ♥' : '照片已保存在本机，系统相册权限未开启', 'success');
    this.lifePages.render();
  }

  private showNextReward(): void {
    if (this.levelUp.isShowing) return;
    const level = this.game.life.pendingLevelRewards()[0];
    if (!level) return;
    const chains = this.game.bundle.progression.levels.find((entry) => entry.level === level)?.unlockChains ?? [];
    this.levelUp.show(level, chains, this.game.life.rewardForLevel(level), () => {
      this.game.claimLevelReward(level);
      this.renderAll();
      this.showNextReward();
    });
  }

  private handleDrop(from: number, to: number | null): void {
    const result = this.controller.onDrop(from, to);
    if (result.ok && result.kind === 'MERGE' && result.toast) {
      this.toast.show(result.toast, result.tone ?? 'success');
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
        console.debug('[MERGE]', p.resultDefinitionId, '@', p.to);
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
          `交付成功！\n金币 +${p.rewardCoins}  爱心 +${p.rewardHearts}`,
          'success',
        );
      }),
    );
    this.unsubs.push(
      bus.on('LEVEL_UP', (p) => {
        void p;
        this.renderAll();
        this.showNextReward();
      }),
    );
    this.unsubs.push(bus.on('TUTORIAL_UPDATED', () => this.renderTutorial()));
    this.unsubs.push(bus.on('LIFE_CHANGED', () => {
      this.renderStatus();
      this.lifePages.render();
    }));
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
    this.lifePages.render();
  }

  renderClock(): void {
    this.renderStatus();
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
    if (this.lifePages.currentPage !== 'merge') {
      this.tutorial.hide();
      return;
    }
    const t = this.game.tutorial;
    const stats = this.game.life.state.stats;
    if (!t.generatorClicked && stats.spawns === 0 && !t.firstMergeCompleted && stats.merges === 0) {
      this.tutorial.show('点一下咖啡机吧～');
      return;
    }
    if (!t.firstMergeCompleted && stats.merges === 0) {
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
  }
}
