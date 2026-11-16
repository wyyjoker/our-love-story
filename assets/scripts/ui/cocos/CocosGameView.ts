/**
 * CocosGameView — composes status/orders/board/dock/toast/tutorial/levelup/debug.
 * Merge/spawn VFX come from EventBus only (no double animation).
 */
import { BlockInputEvents, Button, Camera, Graphics, Label, Node, UITransform, Vec3 } from 'cc';
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
import { CocosRewardEffects, type DeliveryItem } from './CocosRewardEffects';
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
import { CocosSettingsPanel } from './CocosSettingsPanel';
import { CocosItemGuide } from './CocosItemGuide';
import { CocosRewardsPanel } from './CocosRewardsPanel';
import { CocosGeneratorWorkshop } from './CocosGeneratorWorkshop';
import { CocosJournalPanel } from './CocosJournalPanel';
import { CocosFeedback } from '../../platform/cocos/CocosFeedback';
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
  private readonly deliveries = new Map<string, { items: DeliveryItem[]; target: Vec3 }>();
  private effects: CocosRewardEffects;
  private levelRewardInFlight = false;
  private disposed = false;
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
  private settings: CocosSettingsPanel;
  private itemGuide: CocosItemGuide;
  private rewards: CocosRewardsPanel;
  private generatorWorkshop: CocosGeneratorWorkshop;
  private journal: CocosJournalPanel;
  private feedback: CocosFeedback;
  private unsubs: Array<() => void> = [];
  private storagePanel: Node;
  private entered = false;
  private pendingLoadNotice: string | null;
  private capturing = false;
  private generatorRestoreDialog: Node | null = null;

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

    const veil = createUiNode('MergeBackgroundVeil'); roots.background.addChild(veil);
    paintRoundRect(veil.addComponent(Graphics), roots.background.getComponent(UITransform)?.width ?? dw, roots.background.getComponent(UITransform)?.height ?? dh, 0, hexColor('#FFF7EB', 94));

    const statusSize = sizeOf(roots.statusSlot, dw, Math.round(dh * 0.09));
    const ordersSize = sizeOf(roots.ordersSlot, dw, Math.round(dh * 0.16));
    const boardSize = sizeOf(roots.boardSlot, dw, Math.round(dh * 0.5));
    const dockSize = sizeOf(roots.dockSlot, dw, Math.round(dh * 0.14));

    this.status = new CocosStatusBar(
      roots.statusSlot,
      statusSize.width,
      statusSize.height,
      (kind) => {
        if (kind === 'diamonds' || kind === 'energy') this.openRewards();
        else this.toast.show(kind === 'coins' ? '完成订单和心愿可获得金币' : '爱心用于解锁回忆，完成心愿和领取升级礼包可获得');
      },
      demoPreview,
      () => this.openSettings(),
      () => this.openRewards('checkin'),
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
        onOpenTools: () => this.openRewards(),
        onOpenBackpack: () => { this.hideTutorialAndClearToast(); this.playPages.openTools(); },
        onOpenOrangeTree: () => this.dock.scrollToOrangeTree(),
        onStore: (index, uid) => {
          if (game.board.getBoard().cells[index]?.item?.uid !== uid) { this.toast.show('物品已变化，请重新拖动', 'warn'); return; }
          const result = game.playAction('store', String(index));
          this.toast.show(result.ok ? '已收进背包' : result.reason === 'WAREHOUSE_FULL' ? '背包已满，先取回一些物品' : '暂时无法收纳', result.ok ? 'success' : 'warn');
          if (result.ok) this.feedback.play('reward'); this.renderAll();
        },
        onItemTap: (index) => this.openItemGuide(index),
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
    this.effects = new CocosRewardEffects(roots.dragLayer, dh);
    this.rewards = new CocosRewardsPanel(game, roots, (message, success) => {
      this.toast.show(message, success ? 'success' : 'warn');
      if (success) this.feedback.play('reward');
    }, () => this.renderTutorial(), () => this.playPages?.openTools(), () => this.openGeneratorWorkshop(), () => this.openJournal(), (chainId) => {
      this.hideTutorialAndClearToast();
      this.itemGuide.openChain(chainId);
    }, (index, uid) => this.openChest(index, uid));
    this.tutorial = new CocosTutorialView(roots.tutorialLayer, dw, dh, (hint) => game.acknowledgeFirstUseHint(hint));
    this.levelUp = new CocosLevelUpView(roots.rewardLayer, dw, dh);

    this.lifePages = new CocosLifePages(game, roots, (message) => this.toast.show(message), () => {
      void this.capturePhoto();
    }, () => {
      this.cancelRewardPresentation();
      this.board.clearChestEffects();
      this.playPages?.close();
      this.status.setSectionTitle(this.lifePages.currentPage === 'merge' ? '合成小屋' : this.lifePages.currentPage === 'home' ? '我的家园' : '回忆相册');
      this.renderTutorial();
    }, (id) => { if (id) this.playPages.openChapter(id); else this.playPages.openHub(); });

    this.playPages = new CocosPlayPages(game, roots, (message) => this.toast.show(message),
      () => { this.renderOrders(); this.renderTutorial(); }, (id) => this.lifePages.openMemory(id), () => this.toast.clear(), () => this.lifePages.setPage('merge'),
      () => this.feedback.play('puzzle'), (coins, xp, hearts) => {
        this.feedback.play('order');
        this.toast.show(`约会完成！\n金币 +${coins} · 经验 +${xp} · 爱心 +${hearts}`, 'success');
      }, () => this.lifePages.setPage('home'), () => this.lifePages.openWeddingEnding());
    this.feedback = new CocosFeedback(roots.rewardLayer, () => game.preferences);
    this.generatorWorkshop = new CocosGeneratorWorkshop(game, roots,
      (message, success) => {
        this.toast.show(message, success ? 'success' : 'warn');
        if (success) this.feedback.play('merge');
      },
      (id) => {
        this.generatorWorkshop.close();
        const result = game.spawnFromGenerator(id, true);
        if (!result.ok && (result.reason === 'GENERATOR_COOLDOWN' || result.reason === 'NO_CHARGES')) this.openGeneratorRestore(id);
        else if (!result.ok) this.toast.show(result.reason === 'NOT_ENOUGH_ENERGY' ? '体力不足，无法强化生成' : result.reason === 'BOARD_FULL' ? ToastMessages.boardFull : '强化生成暂时不可用', 'warn');
        else { this.feedback.play('merge'); this.dock.popMatching(id); }
        this.renderAll();
      }, () => this.renderTutorial(), (id) => this.openGeneratorRestore(id));
    this.journal = new CocosJournalPanel(game, roots,
      (message, success) => {
        this.toast.show(message, success ? 'success' : 'warn');
        if (success) this.feedback.play('reward');
      },
      () => this.renderTutorial());
    this.settings = new CocosSettingsPanel(game, roots, () => this.renderTutorial(), () => this.feedback.play('merge'));
    this.itemGuide = new CocosItemGuide(game, roots, () => this.playPages.openTools(), () => this.renderTutorial(), () => this.openRewards());

    this.orders.bind((uid) => {
      if (this.deliveries.has(uid)) return;
      game.refreshOrderClock();
      const order = game.orders.getOrders().find((entry) => entry.uid === uid);
      const locations = order && game.board.findItemsForRequirements(order.requirements);
      if (!order || !locations) return;
      const target = this.orders.beginDelivery(uid); if (!target) return;
      const items = locations.flatMap((entry) => {
        const anchor = this.board.hintAnchor(entry.cellIndex);
        return anchor ? [{ position: anchor.position, size: anchor.size * 0.85, definitionId: entry.definitionId }] : [];
      });
      this.deliveries.set(uid, { target, items });
      this.status.holdRewards(uid, { coins: order.rewardCoins, xp: order.rewardXp, hearts: order.rewardHearts });
      this.hideTutorialAndClearToast();
      const msg = this.controller.onClaim(uid);
      if (msg.tone !== 'success') {
        this.finishDelivery(uid);
        if (msg.toast) this.toast.show(msg.toast, msg.tone ?? 'warn');
      }
      this.renderAll();
    });
    this.dock.bind((id) => {
      const status = game.getGeneratorStatus(id);
      if (status?.unlocked && (status.remainingCooldownMs > 0 || status.charges === 0)) {
        this.openGeneratorRestore(id); return;
      }
      const beforeEnergy = game.player.energy;
      if (id === 'orange_tree') {
        const result = game.spawnFromGenerator(id);
        if (!result.ok) {
          this.toast.show(result.reason === 'NO_CHARGES'
            ? '橘树正在恢复，请稍后再来'
            : result.reason === 'LOCKED'
              ? '达到 Lv2 后解锁'
              : result.reason === 'BOARD_FULL' ? ToastMessages.boardFull : '橘树暂时无法采摘', 'warn');
        } else { this.feedback.play('merge'); this.dock.popMatching(id); }
      } else {
        const msg = this.controller.onPointerTapGenerator(id);
        if (msg.toast) this.toast.show(msg.toast, msg.tone ?? 'warn');
        if (game.player.energy < beforeEnergy) { this.feedback.play('merge'); this.dock.popMatching(id); }
      }
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
      : undefined, demoPreview ? undefined : {
        displayName: game.config.couple.coupleDisplayName,
        message: game.config.couple.gift?.coverMessage,
      });
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
    if (this.disposed || this.levelUp.isShowing || this.deliveries.size > 0 || this.levelRewardInFlight
      || this.rewards?.isOpen || this.settings?.isOpen || this.itemGuide?.isOpen || this.generatorWorkshop?.isOpen || this.journal?.isOpen) return;
    const level = this.game.life.pendingLevelRewards()[0];
    if (!level) return;
    const chains = this.game.bundle.progression.levels.find((entry) => entry.level === level)?.unlockChains ?? [];
    this.levelUp.show(level, chains, this.game.life.rewardForLevel(level), () => {
      const reward = this.game.life.rewardForLevel(level), id = `level_reward_${level}`;
      this.levelRewardInFlight = true;
      this.status.holdRewards(id, reward);
      const origin = this.levelUp.rewardOrigin();
      const result = this.game.claimLevelReward(level);
      this.renderAll();
      const finish = (): void => {
        if (this.disposed) return;
        for (const kind of ['coins', 'xp', 'hearts'] as const) this.status.arriveReward(id, kind);
        this.levelRewardInFlight = false; this.showNextReward(); this.renderTutorial();
      };
      if (result.ok) {
        this.feedback.play('reward');
        this.effects.payout(origin, reward, (kind) => this.status.rewardAnchor(kind), (kind) => this.status.arriveReward(id, kind), finish);
      } else finish();
    });
  }

  private handleDrop(from: number, to: number | null): void {
    const source = this.game.board.getBoard().cells[from]?.item;
    const tool = source && this.game.bundle.catalog.get(source.definitionId)?.maxUses;
    const result = this.controller.onDrop(from, to);
    if (result.ok && result.kind === 'SPLIT') { if (to !== null) this.board.markMerge(to); this.feedback.play('merge'); }
    if (!result.ok && tool && to !== null && to !== from) this.toast.show('请拖到2级以上物品；多次剪刀还需要一个空格', 'warn');
    if (result.ok && result.toast && result.kind !== 'MERGE') {
      this.toast.show(result.toast, result.tone ?? 'success');
    }
    this.renderAll();
    this.renderTutorial();
  }

  private subscribe(bus: GameEventBus): void {
    this.unsubs.push(bus.on('PLAY_CHANGED', () => { this.renderStatus(); this.playPages.render(); this.renderTutorial(); }));
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
        this.feedback.play('merge');
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
        const delivery = this.deliveries.get(p.orderUid);
        if (!delivery) { this.feedback.play('order'); return; }
        this.effects.delivery(delivery.items, delivery.target, { coins: p.rewardCoins, xp: p.rewardXp, hearts: p.rewardHearts },
          (kind) => this.status.rewardAnchor(kind),
          () => { this.orders.receiveDelivery(p.orderUid); this.feedback.play('order'); },
          (kind) => this.status.arriveReward(p.orderUid, kind), () => this.finishDelivery(p.orderUid));
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
    this.unsubs.push(bus.on('REWARDS_CHANGED', () => { this.renderStatus(); this.rewards.refresh(); }));
    this.unsubs.push(bus.on('CHECK_IN_CHANGED', () => { this.renderStatus(); this.rewards.refresh(); }));
    this.unsubs.push(bus.on('DAILY_TASKS_CHANGED', () => this.rewards.refresh()));
    this.unsubs.push(bus.on('COLLECTION_CHANGED', () => this.rewards.refresh()));
    this.unsubs.push(bus.on('GENERATOR_CHANGED', () => {
      this.renderDock();
      this.generatorWorkshop.render();
    }));
    this.unsubs.push(bus.on('DISCOVERY_CHANGED', (payload) => {
      this.renderBoard();
      this.rewards.refresh();
      this.feedback.play('reward');
      const name = this.game.bundle.catalog.get(payload.definitionId)?.displayName ?? '新物品';
      if (this.lifePages.currentPage === 'merge') {
        const anchor = this.board.hintAnchor((this.game.config.board.rows - 1) * this.game.config.board.columns);
        if (anchor) anchor.position.y += anchor.size / 2 + 62;
        this.effects.discovery(payload.definitionId, name, this.game.config.rewards.discoveryCoins, anchor?.position);
      }
    }));
  }

  private finishDelivery(uid: string): void {
    if (this.disposed) return;
    for (const kind of ['coins', 'xp', 'hearts'] as const) this.status.arriveReward(uid, kind);
    this.orders.finishDelivery(uid); this.deliveries.delete(uid); this.showNextReward(); this.renderTutorial();
  }

  private cancelRewardPresentation(): void {
    this.effects.clear(); this.orders.cancelDeliveries(); this.deliveries.clear();
    this.status.clearRewardHolds(); this.levelRewardInFlight = false;
  }

  private openItemGuide(index: number): void {
    this.hideTutorialAndClearToast();
    const item = this.mapper.mapBoard(this.game.board.getBoard()).items.find((entry) => entry.cellIndex === index);
    if (item?.chainId === 'treasure_chest') { this.openChest(index, item.uid); return; }
    if (item && ['coin', 'energy', 'diamond'].includes(item.chainId)) {
      const result = this.game.useBoardItem(index, item.uid);
      if (!result.ok) { this.toast.show('物品已经变化，请重新选择', 'warn'); return; }
      this.renderAll(); this.tutorial.hide(); this.toast.clear(); this.feedback.play('reward');
      this.board.playResourceUse(index, item.definitionId, result.amount, item.chainId === 'energy' ? '体力' : item.chainId === 'coin' ? '金币' : '钻石');
      return;
    }
    if (item) item.discovered = this.game.isItemDiscovered(item.definitionId);
    if (item) this.itemGuide.open(item);
  }

  private openChest(index: number, uid: string): void {
    const item = this.game.board.getBoard().cells[index]?.item;
    const definition = item && this.game.bundle.catalog.get(item.definitionId);
    if (!item || item.uid !== uid || definition?.chainId !== 'treasure_chest') return;
    this.hideTutorialAndClearToast();
    const result = this.game.useBoardItem(index, uid);
    if (!result.ok) { this.toast.show('宝箱已经变化，请重新选择', 'warn'); return; }
    this.renderAll(); this.tutorial.hide(); this.toast.clear();
    this.feedback.play('reward');
    this.board.playChestOpen(index, definition.level, result.loot ?? []);
  }

  private openGeneratorRestore(id: string): void {
    const quote = this.game.getGeneratorRestoreQuote(id);
    if (!quote.ok) { this.toast.show(quote.reason === 'LOCKED' ? '生成器尚未解锁' : '生成器已可使用，无需恢复'); return; }
    this.hideTutorialAndClearToast();
    this.generatorRestoreDialog?.destroy();
    const overlay = createUiNode('GeneratorRestoreOverlay'); this.roots.modalLayer.addChild(overlay);
    this.generatorRestoreDialog = overlay;
    ensureTransform(overlay, this.roots.designWidth, this.roots.designHeight); overlay.addComponent(BlockInputEvents);
    paintRoundRect(overlay.addComponent(Graphics), this.roots.designWidth, this.roots.designHeight, 0, hexColor('#362B2B', 174));
    const card = createUiNode('GeneratorRestoreCard'); overlay.addChild(card); ensureTransform(card, 600, 380);
    const scale = Math.min(1, (this.roots.designWidth - 40) / 600, (this.roots.designHeight - 48) / 380); card.setScale(scale, scale, 1);
    paintRoundRect(card.addComponent(Graphics), 600, 380, 30, hexColor('#FFF8F1'), hexColor('#E6CDBF'), 2);
    const write = (value: string, x: number, y: number, w: number, h: number, size: number, color = '#79564D'): void => {
      const label = makeLabel(value, size, hexColor(color), true); card.addChild(label.node); ensureTransform(label.node, w, h);
      label.node.setPosition(x, y, 0); label.enableWrapText = true; label.overflow = Label.Overflow.SHRINK;
    };
    const name = this.game.bundle.generators.find((entry) => entry.id === id)?.displayName ?? '生成器';
    write(`恢复${name}`, 0, 133, 540, 48, 31);
    write(`◆ ${quote.cost} 钻石  ·  恢复 ${quote.restoredUses} 次`, 0, 62, 540, 54, 29, '#9675B4');
    write(`当前钻石 ${this.game.player.diamonds}\n也可以等待自然恢复，计时不会中断`, 0, -3, 530, 68, 22);
    const close = (): void => { overlay.destroy(); if (this.generatorRestoreDialog === overlay) this.generatorRestoreDialog = null; };
    const action = (name: string, caption: string, x: number, primary: boolean, callback: () => void): void => {
      const button = createUiNode(name); card.addChild(button); ensureTransform(button, 248, 76); button.setPosition(x, -108, 0);
      paintRoundRect(button.addComponent(Graphics), 248, 76, 30, hexColor(primary ? '#E38F9F' : '#F1E5DC'), hexColor('#FFFFFF'), 2);
      const label = makeLabel(caption, 25, hexColor(primary ? '#FFFFFF' : '#86665B'), true); button.addChild(label.node); ensureTransform(label.node, 230, 64); label.overflow = Label.Overflow.SHRINK;
      button.addComponent(Button); button.on(Button.EventType.CLICK, callback);
    };
    action('GeneratorRestoreCancel', '等待恢复', -135, false, close);
    action('GeneratorRestoreConfirm', '确认恢复', 135, true, () => {
      const result = this.game.restoreGenerator(id); close();
      if (!result.ok) this.toast.show(result.reason === 'NOT_ENOUGH_DIAMONDS' ? '钻石不足，可以打开宝箱收集钻石' : result.reason === 'NOT_NEEDED' ? '已自然恢复，可以继续使用' : '暂时无法恢复，请重试', 'warn');
      else { this.feedback.play('reward'); this.toast.show(`${name}已恢复 ${result.restoredUses} 次`, 'success'); }
      this.renderAll();
    });
  }

  private hideTutorialAndClearToast(): void {
    this.tutorial.hide();
    this.toast.clear();
  }

  private openRewards(tab: 'checkin' | 'daily' | 'supplies' | 'collection' = 'supplies'): void {
    this.hideTutorialAndClearToast();
    this.rewards.open(tab);
  }

  private openGeneratorWorkshop(): void {
    this.hideTutorialAndClearToast();
    this.generatorWorkshop.open();
  }

  private openJournal(): void {
    this.hideTutorialAndClearToast();
    this.journal.open();
  }

  private openSettings(): void {
    this.hideTutorialAndClearToast();
    this.settings.open();
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
    this.game.refreshOrderClock();
    this.renderStatus();
    this.dock.refreshClock((id) => this.game.getGeneratorStatus(id));
    this.generatorWorkshop.refreshClock();
    this.renderOrders();
  }

  private renderStatus(): void {
    this.status.render(this.statusVm());
    this.status.setCheckInAvailable(this.game.getCheckInStatus().canClaim);
    this.board.setBackpackUsage(this.game.play.state.warehouse.length, this.game.config.toolbox.warehouseSlots);
  }

  private renderBoard(): void {
    const vm = this.mapper.mapBoard(this.game.board.getBoard());
    for (const item of vm.items) item.discovered = this.game.isItemDiscovered(item.definitionId);
    this.board.render(vm);
  }

  private renderOrders(): void {
    const orders = this.orderVms();
    this.orders.render(orders, this.game.clock.now());
    const date = this.game.play.smallDateOrder();
    if (date) {
      const have = date.requirements.filter((requirement) => requirement.done).length;
      this.board.setGoalText(`${date.template.title} · ${date.ready ? '已备齐，去赴约 ›' : `${have}/${date.requirements.length} 已备齐 ›`}`);
    } else {
      const order = orders[0];
      const requirements = order?.requirements.map((requirement) =>
        `${requirement.displayName} ${Math.min(requirement.have, requirement.count)}/${requirement.count}`).join('  ·  ');
      this.board.setGoalText(order?.ready ? '订单物品已备齐  ·  点击上方订单卡交付'
        : requirements ? `当前订单目标：${requirements}` : '点击物品查看合成链；拖动相同物品合成');
    }
  }

  private renderDock(): void {
    this.dock.render(
      this.mapper.mapGenerators(this.game.bundle.generators, this.game.player),
      this.game.getGeneratorStatus('orange_tree'),
      (id) => this.game.getGeneratorStatus(id),
    );
  }

  private renderTutorial(): void {
    if (this.entered) this.showNextReward();
    if (!this.entered || this.lifePages.currentPage !== 'merge' || this.levelUp.isShowing || this.levelRewardInFlight || this.deliveries.size > 0 || this.playPages?.isOpen || this.rewards?.isOpen || this.itemGuide?.isOpen || this.settings?.isOpen || this.generatorWorkshop?.isOpen || this.journal?.isOpen) {
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
    if (!t.firstOrderCompleted && stats.orders === 0) {
      const ready = this.orderVms().some((o) => o.ready);
      if (ready) {
        this.tutorial.show(ToastMessages.orderReady);
        const target = this.orders.readyHintPosition(); if (target) this.tutorial.showGesture(target, target, '', 72);
        return;
      }
    }
    const guide = this.game.getFirstUseGuide();
    if (guide) {
      const source = guide.sourceIndex === undefined ? null : this.board.hintAnchor(guide.sourceIndex);
      if (guide.hint === 'backpack') {
        this.tutorial.show('拖进背包收纳，点击背包可取回', 'backpack');
        const target = this.board.shortcutAnchor('BoardBackpackButton');
        if (source && target) this.tutorial.showGesture(source.position, target, this.game.board.getBoard().cells[guide.sourceIndex!].item?.definitionId, source.size);
      } else if (guide.hint === 'scissors') {
        this.tutorial.show(guide.targetIndex === undefined ? '先备好2级物品和空格，再使用剪刀' : '剪刀拖到2级以上物品可拆分', 'scissors');
        const target = guide.targetIndex === undefined ? null : this.board.hintAnchor(guide.targetIndex);
        if (source && target) this.tutorial.showGesture(source.position, target.position, this.game.board.getBoard().cells[guide.sourceIndex!].item?.definitionId, source.size);
      } else {
        this.tutorial.show(source ? '轻点宝箱开补给，相同宝箱可合成' : '补给里取出宝箱，再轻点打开', 'chest');
        const target = source?.position ?? this.board.shortcutAnchor('OpenTools');
        if (target) this.tutorial.showGesture(target, target, '', source?.size ?? 64);
      }
      return;
    }
    this.tutorial.hide();
  }

  dispose(): void {
    this.disposed = true; this.effects.dispose(); this.orders.cancelDeliveries();
    this.generatorRestoreDialog?.destroy(); this.generatorRestoreDialog = null;
    for (const u of this.unsubs) u();
    this.unsubs = [];
    this.board.dispose();
    this.tutorial.dispose();
    this.feedback.dispose();
    this.generatorWorkshop.close();
    this.journal.dispose();
  }
}
