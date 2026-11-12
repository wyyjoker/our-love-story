/**
 * CocosGameView — composes status/orders/board/dock/toast/tutorial/levelup/debug.
 * Merge/spawn VFX come from EventBus only (no double animation).
 */
import { BlockInputEvents, Button, Camera, Graphics, Label, Node, UITransform } from 'cc';
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
import { CocosLifePages } from './CocosLifePages';
import { CocosPlayPages } from './CocosPlayPages';
import { CocosCoverView } from './CocosCoverView';
import { applyArt } from './CocosArt';
import { captureHomePhoto } from '../../platform/cocos/CocosPhotoService';
import {
  CocosTheme,
  createUiNode,
  ensureTransform,
  paintRoundRect,
  hexColor,
  makeLabel,
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
  private lifePages: CocosLifePages;
  private playPages: CocosPlayPages;
  private unsubs: Array<() => void> = [];
  private storagePanel: Node;
  private entered = false;
  private pendingLoadNotice: string | null;
  private capturing = false;

  constructor(
    private readonly game: GameContext,
    private readonly roots: UiRoots,
    demoPreview = false,
  ) {
    this.pendingLoadNotice = game.loadNotice;
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
    applyArt(bgArt, { sheet: 'merge_background' }, roots.background.getComponent(UITransform)?.width ?? dw, roots.background.getComponent(UITransform)?.height ?? dh);

    const statusSize = sizeOf(roots.statusSlot, dw, Math.round(dh * 0.09));
    const ordersSize = sizeOf(roots.ordersSlot, dw, Math.round(dh * 0.16));
    const boardSize = sizeOf(roots.boardSlot, dw, Math.round(dh * 0.5));
    const dockSize = sizeOf(roots.dockSlot, dw, Math.round(dh * 0.14));

    this.status = new CocosStatusBar(
      roots.statusSlot,
      statusSize.width,
      statusSize.height,
      (kind) => this.toast.show(kind === 'energy' ? '每 4 分钟恢复 1 点体力' : kind === 'coins' ? '完成订单和心愿可获得金币' : '完成订单、心愿和升级礼包可获得爱心'),
      demoPreview,
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
        onDragStart: () => this.tutorial?.hide(),
        onDragFinished: () => this.renderTutorial(),
        onOpenAdventure: () => this.playPages.openHub(),
        onOpenTools: () => this.playPages.openTools(),
        onItemTap: (index) => this.playPages.openTools(index),
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
    this.levelUp = new CocosLevelUpView(roots.rewardLayer, dw, dh);

    this.lifePages = new CocosLifePages(game, roots, (message) => this.toast.show(message), () => {
      void this.capturePhoto();
    }, () => {
      this.playPages?.close();
      this.status.setSectionTitle(this.lifePages.currentPage === 'merge' ? '合成小屋' : this.lifePages.currentPage === 'home' ? '我的家园' : '回忆相册');
      this.renderTutorial();
    }, (id) => { if (id) this.playPages.openChapter(id); else this.playPages.openHub(); });

    this.playPages = new CocosPlayPages(game, roots, (message) => this.toast.show(message),
      () => this.renderTutorial(), (id) => this.lifePages.openMemory(id), () => this.toast.clear(), () => this.lifePages.setPage('merge'));

    this.orders.bind((uid) => {
      const msg = this.controller.onClaim(uid);
      // Successful delivery is announced by ORDER_COMPLETED exactly once.
      if (msg.toast && msg.tone !== 'success') this.toast.show(msg.toast, msg.tone ?? 'info');
      this.renderAll();
    });
    this.dock.bind((id) => {
      const beforeEnergy = game.player.energy;
      const msg = this.controller.onPointerTapGenerator(id);
      if (msg.toast) this.toast.show(msg.toast, msg.tone ?? 'warn');
      if (game.player.energy < beforeEnergy) this.dock.popMatching(id);
      this.renderAll();
    });

    this.storagePanel = createUiNode('StorageNotice');
    roots.toastLayer.addChild(this.storagePanel);
    ensureTransform(this.storagePanel, dw, dh);
    this.storagePanel.addComponent(BlockInputEvents);
    this.storagePanel.active = false;
    this.subscribe(game.bus);
    this.renderAll();
    this.showNextReward();
    const hasProgress = game.player.level > 1 || game.life.state.stats.spawns > 0 || game.life.state.stats.merges > 0;
    const metDate = game.config.couple.metDate ?? game.config.couple.metMonth;
    new CocosCoverView(roots.coverLayer, dw, dh, hasProgress, () => {
      this.entered = true;
      this.renderTutorial();
      this.renderStorageNotice();
    }, {
      width: roots.canvas.getComponent(UITransform)?.width ?? dw,
      height: roots.canvas.getComponent(UITransform)?.height ?? dh,
      x: -roots.safeArea.position.x,
      y: -roots.safeArea.position.y,
    }, demoPreview ? 'Lv12 演示存档 · 刷新重置 · 不影响正式进度' : metDate && game.config.couple.weddingDate
      ? `${metDate.replace(/-/g, '.')} 相遇  ·  ${game.config.couple.weddingDate.replace(/-/g, '.')} 成家`
      : undefined);
  }

  private renderStorageNotice(): void {
    const failed = this.game.saveFailed;
    this.storagePanel.active = this.entered && (failed || !!this.pendingLoadNotice);
    if (!this.storagePanel.active) return;
    for (const child of [...this.storagePanel.children]) child.destroy();
    paintRoundRect(this.storagePanel.getComponent(Graphics) ?? this.storagePanel.addComponent(Graphics), this.roots.designWidth, this.roots.designHeight, 0, hexColor('#362B2B', 180));
    const card = createUiNode('SaveMessageCard');
    this.storagePanel.addChild(card);
    ensureTransform(card, 620, 340);
    paintRoundRect(card.addComponent(Graphics), 620, 340, 26, CocosTheme.surface());
    const title = makeLabel(failed ? '进度尚未保存' : '存档提示', 30, CocosTheme.textPrimary(), true);
    card.addChild(title.node);
    title.node.setPosition(0, 115, 0);
    const body = makeLabel(failed ? '本机存储暂时不可用。\n当前进度已暂存在内存，请保持游戏打开并重试保存。' : this.pendingLoadNotice ?? '', 24, CocosTheme.textPrimary());
    card.addChild(body.node);
    ensureTransform(body.node, 550, 135);
    body.enableWrapText = true;
    body.overflow = Label.Overflow.SHRINK;
    body.lineHeight = 34;
    const retry = createUiNode('ConfirmStorageNotice');
    card.addChild(retry);
    ensureTransform(retry, 290, 64);
    retry.setPosition(0, -110, 0);
    paintRoundRect(retry.addComponent(Graphics), 290, 64, 26, CocosTheme.primary());
    const caption = makeLabel(failed ? '重试保存' : '我知道了', 26, CocosTheme.surface(), true);
    retry.addChild(caption.node);
    retry.addComponent(Button);
    retry.on(Button.EventType.CLICK, () => {
      if (this.game.saveFailed) {
        if (this.game.save().ok) this.toast.show('进度已成功保存', 'success');
      } else {
        this.pendingLoadNotice = null;
        this.renderStorageNotice();
      }
    });
  }

  private async capturePhoto(): Promise<void> {
    if (this.capturing) return;
    this.capturing = true;
    const result = await captureHomePhoto();
    this.capturing = false;
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
    if (result.ok && result.toast) {
      this.toast.show(result.toast, result.tone ?? 'success');
    }
    this.renderAll();
    this.renderTutorial();
  }

  private subscribe(bus: GameEventBus): void {
    this.unsubs.push(bus.on('PLAY_CHANGED', () => { this.playPages.render(); this.renderTutorial(); }));
    this.unsubs.push(bus.on('SAVE_STATUS_CHANGED', () => this.renderStorageNotice()));
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
    if (this.lifePages.currentPage !== 'merge' || this.playPages?.isOpen) {
      this.tutorial.hide();
      return;
    }
    const t = this.game.tutorial;
    const stats = this.game.life.state.stats;
    if (!t.generatorClicked && stats.spawns === 0 && !t.firstMergeCompleted && stats.merges === 0) {
      this.tutorial.show('点一下咖啡机吧～');
      const generator = this.dock.hintPosition(this.game.bundle.generators[0].id);
      if (generator) this.tutorial.showGesture(generator, generator, '', 80);
      return;
    }
    if (!t.firstMergeCompleted && stats.merges === 0) {
      this.tutorial.show('把两个一样的东西拖到一起');
      const hint = this.game.getMergeHint();
      if (hint) {
        const from = this.board.hintAnchor(hint.from);
        const to = this.board.hintAnchor(hint.to);
        if (from && to) this.tutorial.showGesture(from.position, to.position, hint.definitionId, from.size);
      }
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
    this.tutorial.dispose();
  }
}
