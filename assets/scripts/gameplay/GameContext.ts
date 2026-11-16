import type { ItemInstance, GameConfig, GamePreferences, LifeState, PlayerState, SaveData, TutorialState, FirstUseHint } from '../core/types';
import { cloneBoard } from '../core/board/board';
import type { ConfigBundle } from '../config/ConfigRepository';
import { loadConfigBundle, assertConfigValid } from '../config/ConfigRepository';
import { GameEventBus } from '../events/GameEventBus';
import {
  ClockService,
  businessDayUtc8,
  FakeClockService,
  SystemClockService,
} from '../infrastructure/ClockService';
import {
  pickWeighted,
  FixedRandomService,
  RandomService,
  SystemRandomService,
} from '../infrastructure/RandomService';
import { IdService, SequentialIdService, type IdGenerator } from '../infrastructure/IdService';
import { PlatformService, type StorageAdapter } from '../infrastructure/PlatformService';
import { SaveService, createDefaultSaveData, type SaveWriteResult } from '../infrastructure/SaveService';
import { GameLogger } from '../infrastructure/GameLogger';
import { BoardService } from './BoardService';
import { EnergyService } from './EnergyService';
import { GeneratorService } from './GeneratorService';
import { OrderService } from './OrderService';
import { ProgressionService } from './ProgressionService';
import { LifeService, type LifeResult } from './LifeService';
import { PlayService } from './PlayService';
import { JournalService } from './JournalService';

export type GameContextOptions = {
  config?: ConfigBundle;
  storage?: StorageAdapter;
  clock?: ClockService;
  random?: RandomService;
  ids?: IdGenerator;
  logger?: GameLogger;
  saveDebounceMs?: number;
  /** Use FakeClock/FixedRandom automatically for tests */
  deterministic?: boolean;
};

export type BootState =
  | 'BOOT'
  | 'LOAD_CONFIG'
  | 'VALIDATE_CONFIG'
  | 'LOAD_SAVE'
  | 'RECOVER_ENERGY'
  | 'INIT_GAME'
  | 'READY'
  | 'ERROR';

export type GeneratorRestoreQuote =
  | { ok: true; generatorId: string; kind: 'cooldown' | 'charges'; cost: number; restoredUses: number; remainingMs: number }
  | { ok: false; reason: 'NOT_FOUND' | 'LOCKED' | 'NOT_NEEDED' };

export type GeneratorPurchaseQuote =
  | { ok: true; generatorId: string; cost: number }
  | { ok: false; reason: 'NOT_FOUND' | 'LOCKED' };

/**
 * Wires all services. UI talks only to this + EventBus.
 */
export class GameContext {
  readonly bus = new GameEventBus();
  readonly config: GameConfig;
  readonly bundle: ConfigBundle;
  readonly platform: PlatformService;
  readonly clock: ClockService;
  readonly random: RandomService;
  readonly ids: IdGenerator;
  readonly logger: GameLogger;
  readonly saveService: SaveService;

  private playerRef!: PlayerState;
  private tutorialRef!: TutorialState;
  private preferencesRef!: GamePreferences;
  private lifeRef!: LifeState;
  private inboxRef: ItemInstance[] = [];
  private readonly reservedIds = new Set<string>();
  private discovered: string[] = [];
  private claimedDiscoveries: string[] = [];
  private claimedCollections: string[] = [];
  private legacyBoardEntitlement = false;
  private retainedOpenCellIndices: number[] = [];
  private exchanging = false;
  private purchasingGenerator = false;
  private orderRefreshAt: Array<number | null> = [];
  private dailyTasks?: NonNullable<SaveData['dailyTasks']>;
  private checkIn = { lastClaimDay: null as number | null, claims: 0 };

  board!: BoardService;
  energy!: EnergyService;
  generators!: GeneratorService;
  orders!: OrderService;
  progression!: ProgressionService;
  life!: LifeService;
  play!: PlayService;
  journal!: JournalService;

  bootState: BootState = 'BOOT';
  bootError: string | null = null;
  saveFailed = false;
  loadNotice: string | null = null;

  constructor(options: GameContextOptions = {}) {
    this.logger = options.logger ?? new GameLogger(true);
    this.bundle = options.config ?? loadConfigBundle();
    this.config = this.bundle.game;
    this.bus.on('ITEM_SPAWNED', ({ definitionId }) => this.recordBaseAcquisition(definitionId));
    this.platform = new PlatformService(options.storage);
    this.clock =
      options.clock ??
      (options.deterministic
        ? new FakeClockService()
        : new SystemClockService());
    this.random =
      options.random ??
      (options.deterministic
        ? new FixedRandomService([0])
        : new SystemRandomService());
    const sourceIds = options.ids ?? (options.deterministic ? new SequentialIdService('det') : new IdService());
    this.ids = { next: () => {
      let id = sourceIds.next(); while (this.reservedIds.has(id)) id = sourceIds.next();
      this.reservedIds.add(id); return id;
    } };


    this.saveService = new SaveService({
      storage: this.platform.getStorage(),
      clock: this.clock,
      saveKey: this.config.saveKey,
      version: this.config.saveVersion,
      createDefault: () => createDefaultSaveData(this.config, this.clock.now()),
      debounceMs: options.saveDebounceMs ?? 200,
      logger: (m) => this.logger.debug('SAVE', m),
      legacyStarterFurnitureId: this.bundle.furniture[0]?.id,
      energyCaps: this.config.energy.maxByLevel,
      collection: this.config.collection,
      onWrite: (result) => {
        this.saveFailed = !result.ok;
        if (result.ok) this.bus.emit('GAME_SAVED', { savedAt: result.savedAt });
        this.bus.emit('SAVE_STATUS_CHANGED', { ok: result.ok });
      },
    });
  }

  get player(): PlayerState {
    return this.playerRef;
  }

  get tutorial(): TutorialState {
    return this.tutorialRef;
  }

  get preferences(): GamePreferences {
    return { ...this.preferencesRef };
  }

  setPreferences(patch: Partial<GamePreferences>): void {
    this.preferencesRef = {
      soundEnabled: typeof patch.soundEnabled === 'boolean' ? patch.soundEnabled : this.preferencesRef.soundEnabled,
      vibrationEnabled: typeof patch.vibrationEnabled === 'boolean' ? patch.vibrationEnabled : this.preferencesRef.vibrationEnabled,
    };
    this.save();
  }

  get gameConfig(): GameConfig {
    return this.config;
  }

  boot(): void {
    try {
      this.bootState = 'LOAD_CONFIG';
      this.logger.debug('BOOT', 'load config');

      this.bootState = 'VALIDATE_CONFIG';
      assertConfigValid(this.bundle);

      this.bootState = 'LOAD_SAVE';
      const loaded = this.saveService.load();
      this.loadNotice = null;
      if (!loaded.ok && (loaded.reason === 'UNAVAILABLE' || (loaded.reason === 'CORRUPT' && !loaded.backupPreserved))) {
        throw new Error('暂时无法安全读取或备份存档，原进度未覆盖。请稍后点击重试。');
      }
      if (loaded.ok && loaded.notice) {
        this.loadNotice = loaded.notice === 'MIGRATED' ? '旧存档已升级，已有物品和资产已保留。'
          : loaded.notice === 'BACKUP_RESTORED' ? '当前存档异常，已从可用备份恢复进度。'
          : '存档中的异常数据已修复，请检查当前进度。';
      } else if (!loaded.ok && loaded.reason === 'CORRUPT') {
        this.loadNotice = '存档已损坏，原始数据已备份。未找到可用进度，已创建新的小屋。';
      }
      let data: SaveData;
      if (loaded.ok) {
        data = loaded.data;
        this.logger.debug('SAVE', `loaded v${data.version}`);
      } else {
        data = loaded.defaultData;
        this.logger.debug('SAVE', `using default (${loaded.reason})`);
      }

      for (const id of [...data.board.flatMap((c) => c.item ? [c.item.uid] : []), ...data.rewardInbox.map((i) => i.uid), ...data.play.warehouse.map((i) => i.uid), ...data.activeOrders.map((o) => o.uid)]) this.reservedIds.add(id);
      this.inboxRef = data.rewardInbox.map((i) => ({ ...i }));
      this.discovered = [...data.discoveredItemIds];
      for (const item of [...data.board.flatMap((cell) => cell.item ? [cell.item] : []), ...data.play.warehouse, ...data.rewardInbox]) this.recordBaseAcquisition(item.definitionId, false);
      this.claimedDiscoveries = [...data.claimedDiscoveryIds];
      this.claimedCollections = [...(data.claimedCollectionIds ?? [])];
      this.legacyBoardEntitlement = data.legacyBoardEntitlement;
      this.retainedOpenCellIndices = [...(data.retainedOpenCellIndices ?? [])];
      this.checkIn = { ...data.checkIn };
      this.orderRefreshAt = [...(data.orderRefreshAt ?? [])];
      this.dailyTasks = data.dailyTasks ? { ...data.dailyTasks, progress: { ...data.dailyTasks.progress }, claimedIds: [...data.dailyTasks.claimedIds] } : undefined;
      this.playerRef = {
        ...data.player,
        unlockedChainIds: [...data.player.unlockedChainIds],
      };
      this.tutorialRef = { ...data.tutorial };
      this.preferencesRef = { ...data.preferences };
      this.lifeRef = {
        ...data.life,
        unlockedMemoryIds: [...data.life.unlockedMemoryIds],
        ownedFurnitureIds: [...data.life.ownedFurnitureIds],
        placedFurnitureIds: [...data.life.placedFurnitureIds],
        claimedWishIds: [...data.life.claimedWishIds],
        claimedLevelRewards: [...data.life.claimedLevelRewards],
        photoPaths: [...data.life.photoPaths],
        stats: { ...data.life.stats },
        furniturePositions: Object.fromEntries(Object.entries(data.life.furniturePositions).map(([id, position]) => [id, { ...position }])),
      };

      this.board = new BoardService(
        this.bundle.catalog,
        this.ids,
        this.bus,
        this.config.board.rows,
        this.config.board.columns,
        cloneBoard({
          rows: this.config.board.rows,
          columns: this.config.board.columns,
          cells: data.board,
        }),
      );

      this.board.configureUnlocks(this.playerRef.level, this.config.board.unlocks, this.retainedOpenCellIndices);
      this.bus.on('LEVEL_UP', ({ level }) => this.board.configureUnlocks(level, this.config.board.unlocks, this.retainedOpenCellIndices));

      this.energy = new EnergyService(
        this.playerRef,
        this.clock,
        this.bus,
        this.config.energy.recoverIntervalMs,
      );

      this.progression = new ProgressionService(
        this.playerRef,
        this.bundle.progression,
        this.bundle.generators,
        this.bus,
        this.config.energy.maxByLevel,
        () => this.claimedCollections.length * this.config.collection.energyPerChain,
        this.config.collection.maxEnergyCap,
      );

      this.life = new LifeService(
        this.lifeRef,
        this.bundle.memories,
        this.bundle.furniture,
        this.bundle.wishes,
        this.bundle.levelRewards,
        this.playerRef,
        this.progression,
        this.bus,
      );

      this.generators = new GeneratorService(
        this.bundle.generators,
        this.bundle.catalog,
        this.board,
        this.energy,
        this.playerRef,
        this.random,
        this.clock,
        data.generatorCharges ?? {},
        data.generatorInventory ?? {},
        data.generatorCooldowns ?? {},
      );
      this.bus.on('LEVEL_UP', () => this.generators.ensureUnlockedCharges());
      this.bus.on('LEVEL_UP', () => this.energy.markRegenPoint());

      this.orders = new OrderService(
        this.bundle.orders,
        this.bundle.catalog,
        this.board,
        this.playerRef,
        this.progression,
        this.random,
        this.ids,
        this.bus,
        this.config.orders.activeSlots,
        this.config.orders.minItemLevel,
        this.config.orders.maxItemLevel,
        this.bundle.generators.filter((g) => g.recharge).map((g) => g.chainId),
        this.clock,
        this.config.orders.dynamic,
        (id) => this.projectProducerItem(id),
        (chain) => this.producerLevel(chain),
        (id) => this.canProduceOrderItem(id),
        (chain) => {
          const generator = this.bundle.generators.find((entry) => entry.chainId === chain);
          return this.player.level < 15 ? generator?.recharge?.capacity ?? Infinity : Infinity;
        },
      );
      this.orders.hydrate(data.activeOrders, data.recentOrderIds ?? []);
      this.orders.ensureFilled();
      this.play = new PlayService(data.play, this.bundle, this.board, this.ids, this.bus, this.progression, this.energy, this.life, (id) => this.projectProducerItem(id));
      this.journal = new JournalService(data.journal, this.clock, this.energy, () => { this.bus.emit('JOURNAL_CHANGED', {}); this.save(); });

      this.bootState = 'RECOVER_ENERGY';
      this.energy.tick();

      this.bootState = 'INIT_GAME';
      this.markTutorialFromBoard();

      this.bootState = 'READY';
      this.logger.info('BOOT', 'READY');
      this.save();
    } catch (err) {
      this.bootState = 'ERROR';
      this.bootError = err instanceof Error ? err.message : String(err);
      this.logger.error('BOOT', 'boot failed', err);
      throw err;
    }
  }

  getGeneratorStatus(id: string): ReturnType<GeneratorService['getStatus']> { return this.generators.getStatus(id); }

  getGeneratorPurchaseQuote(id: string): GeneratorPurchaseQuote {
    const generator = this.generators.get(id);
    if (!generator) return { ok: false, reason: 'NOT_FOUND' };
    if (!this.generators.isUnlocked(generator)) return { ok: false, reason: 'LOCKED' };
    return { ok: true, generatorId: id, cost: generator.purchaseCoins };
  }

  purchaseGenerator(id: string): { ok: true; generatorId: string; cost: number; inventory: number[] }
    | { ok: false; reason: 'NOT_FOUND' | 'LOCKED' | 'NOT_ENOUGH_COINS' | 'IN_PROGRESS' } {
    if (this.purchasingGenerator) return { ok: false, reason: 'IN_PROGRESS' };
    const quote = this.getGeneratorPurchaseQuote(id); if (!quote.ok) return quote;
    if (this.player.coins < quote.cost) return { ok: false, reason: 'NOT_ENOUGH_COINS' };
    this.purchasingGenerator = true;
    try {
      if (!this.progression.spendCoins(quote.cost)) return { ok: false, reason: 'NOT_ENOUGH_COINS' };
      const result = this.generators.grantPurchased(id);
      if (!result.ok) { this.progression.addCoins(quote.cost); return result; }
      this.bus.emit('GENERATOR_CHANGED', { generatorId: id });
      this.save();
      return { ...quote, inventory: result.inventory };
    } finally { this.purchasingGenerator = false; }
  }

  getGeneratorRestoreQuote(id: string): GeneratorRestoreQuote {
    const generator = this.generators.get(id), status = this.generators.getStatus(id);
    if (!generator || !status) return { ok: false, reason: 'NOT_FOUND' };
    if (!status.unlocked) return { ok: false, reason: 'LOCKED' };
    if (generator.recharge && status.charges === 0) return {
      ok: true, generatorId: id, kind: 'charges', cost: this.config.generatorRestore.chargeCost,
      restoredUses: generator.recharge.capacity, remainingMs: status.nextRecoveryMs ?? 0,
    };
    if (generator.streakCooldown && status.remainingCooldownMs > 0 && status.streak >= generator.streakCooldown.uses) return {
      ok: true, generatorId: id, kind: 'cooldown', cost: this.config.generatorRestore.cooldownCost,
      restoredUses: generator.streakCooldown.uses, remainingMs: status.remainingCooldownMs,
    };
    return { ok: false, reason: 'NOT_NEEDED' };
  }

  restoreGenerator(id: string): GeneratorRestoreQuote | { ok: false; reason: 'NOT_ENOUGH_DIAMONDS' | 'IN_PROGRESS' } {
    if (this.exchanging) return { ok: false, reason: 'IN_PROGRESS' };
    const quote = this.getGeneratorRestoreQuote(id);
    if (!quote.ok) return quote;
    if (this.player.diamonds < quote.cost) return { ok: false, reason: 'NOT_ENOUGH_DIAMONDS' };
    this.exchanging = true;
    try {
      const restored = this.generators.restoreExhausted(id);
      if (!restored.ok) return restored;
      this.player.diamonds -= quote.cost;
      this.bus.emit('GENERATOR_CHANGED', { generatorId: id });
      this.bus.emit('REWARDS_CHANGED', { reason: 'exchange' });
      this.save();
      return { ...quote, kind: restored.kind, restoredUses: restored.restoredUses };
    } finally { this.exchanging = false; }
  }

  spawnFromGenerator(generatorId: string, boost = false): ReturnType<GeneratorService['spawn']> {
    const result = this.generators.spawn(generatorId, boost);
    if (result.ok) {
      const generator = this.generators.get(generatorId);
      const level = this.generators.getStatus(generatorId)?.level ?? 0;
      for (const drop of this.config.generationBonusDrops) {
        if (!generator || (drop.generatorId !== '*' && drop.generatorId !== generatorId) || level < drop.minLevel || (drop.excludeRecharge && generator.recharge)) continue;
        if (this.random.next() < drop.chance) {
          if (!this.board.spawn(drop.itemId).ok) this.enqueue(drop.itemId);
        }
      }
      this.bus.emit('GENERATOR_CHANGED', { generatorId });
      this.life.record('spawns');
      if (!this.tutorialRef.generatorClicked) {
        this.tutorialRef.generatorClicked = true;
        this.bus.emit('TUTORIAL_UPDATED', { ...this.tutorialRef });
      }
      this.orders.refreshProgressHints();
      this.save();
    }
    return result;
  }

  mergeGenerators(id: string, level: number): ReturnType<GeneratorService['merge']> {
    const result = this.generators.merge(id, level);
    if (result.ok) { this.orders.reconcileRequirements(); this.ensureDailyTasks(); this.bus.emit('GENERATOR_CHANGED', { generatorId: id }); this.save(); }
    return result;
  }

  private producerLevel(chainId: string): number {
    const generator = this.bundle.generators.find((entry) => entry.chainId === chainId);
    return generator ? Math.max(1, this.generators.getStatus(generator.id)?.level ?? 1) : 1;
  }
  private canProduceOrderItem(id: string): boolean {
    const item = this.bundle.catalog.get(id); if (!item || item.wildcard || item.maxUses) return false;
    const direct = this.bundle.generators.find((generator) => generator.chainId === item.chainId);
    if (direct) return this.generators.getStatus(direct.id)?.unlocked === true;
    return this.config.generationBonusDrops.some((drop) => {
      const source = this.generators.getStatus(drop.generatorId);
      return drop.chance > 0 && source?.unlocked && source.level >= drop.minLevel && this.bundle.catalog.get(drop.itemId)?.chainId === item.chainId;
    });
  }
  private projectProducerItem(id: string, mergeResult = false): string {
    const item = this.bundle.catalog.get(id); if (!item) return id;
    const generator = this.bundle.generators.find((entry) => entry.chainId === item.chainId);
    if (!generator) return id;
    const level = Math.max(item.level, this.producerLevel(item.chainId) + (mergeResult ? 1 : 0));
    return this.bundle.items.find((candidate) => candidate.chainId === item.chainId && candidate.level === level)?.id ?? id;
  }

  dropItem(from: number, to: number | null): ReturnType<BoardService['tryDrop']> {
    const result = this.board.tryDrop(from, to);
    if (result.ok && result.kind === 'MERGE') {
      this.life.record('merges');
      this.handleMerge(result.resultDefinitionId);
      this.recordDaily('merges', result.resultDefinitionId);
      if (!this.tutorialRef.firstMergeCompleted) {
        this.tutorialRef.firstMergeCompleted = true;
        this.bus.emit('TUTORIAL_UPDATED', { ...this.tutorialRef });
      }
    }
    if (result.ok) {
      if (result.kind === 'SPLIT') this.acknowledgeFirstUseHint('scissors');
      if (result.kind === 'SPLIT' && to !== null) { const item = this.board.getBoard().cells[to].item; if (item) this.recordBaseAcquisition(item.definitionId); }
      this.orders.refreshProgressHints();
      this.save();
    }
    return result;
  }

  playAction(action: 'store' | 'withdraw' | 'split' | 'deliver' | 'hint' | 'solve' | 'skip' | 'claim'
    | 'replay' | 'replay_reset' | 'small_date' | 'take_scissors', value: string): ReturnType<PlayService['store']> {
    const result = action === 'take_scissors' ? this.play.takeScissors() : action === 'store' ? this.play.store(Number(value)) : action === 'withdraw' ? this.play.withdraw(value)
      : action === 'split' ? this.play.split(Number(value)) : action === 'deliver' ? this.play.deliver(value)
        : action === 'hint' ? this.play.hint(value) : action === 'claim' ? this.play.claim(value)
          : action === 'replay' ? this.play.startReplay(value) : action === 'replay_reset' ? this.play.restartReplay(value)
            : action === 'small_date' ? this.play.deliverSmallDate(value)
              : this.play.solve(value, action === 'skip');
    if (result.ok) {
      if (action === 'store') this.acknowledgeFirstUseHint('backpack');
      if (action === 'split') this.acknowledgeFirstUseHint('scissors');
      if (action === 'split') {
        const item = this.board.getBoard().cells[Number(value)]?.item;
        if (item) this.recordBaseAcquisition(item.definitionId);
      } else if (action === 'withdraw') {
        const item = this.board.getBoard().cells.find((cell) => cell.item?.uid === value)?.item;
        if (item) this.recordBaseAcquisition(item.definitionId);
      }
      this.orders.refreshProgressHints(); this.save();
    }
    return result;
  }

  puzzleAction(id: string, action: Parameters<PlayService['act']>[1], value = ''): ReturnType<PlayService['act']> {
    const result = this.play.act(id, action, value);
    if (result.ok) this.save();
    return result;
  }

  acknowledgeFirstUseHint(hint: FirstUseHint): { ok: true } | { ok: false; reason: 'ALREADY_ACKNOWLEDGED' | 'INVALID' } {
    if (!['backpack','scissors','chest'].includes(hint)) return { ok: false, reason: 'INVALID' };
    if (this.tutorialRef.firstUseHints?.includes(hint)) return { ok: false, reason: 'ALREADY_ACKNOWLEDGED' };
    this.tutorialRef.firstUseHints = [...this.tutorialRef.firstUseHints ?? [], hint];
    this.bus.emit('TUTORIAL_UPDATED', { ...this.tutorialRef }); this.save(); return { ok: true };
  }

  getFirstUseGuide(): { hint: FirstUseHint; sourceIndex?: number; targetIndex?: number } | undefined {
    if (this.bootState !== 'READY' || (!this.tutorialRef.firstOrderCompleted && this.life.state.stats.orders === 0)) return;
    const seen = new Set(this.tutorialRef.firstUseHints ?? []), board = this.board.getBoard();
    if (!seen.has('chest')) {
      const source = board.cells.find((cell) => cell.item && this.bundle.catalog.get(cell.item.definitionId)?.chainId === 'treasure_chest');
      if (source) return { hint: 'chest', sourceIndex: source.index };
      if (this.inboxRef.some((item) => this.bundle.catalog.get(item.definitionId)?.chainId === 'treasure_chest')) return { hint: 'chest' };
    }
    if (!seen.has('scissors')) {
      const source = board.cells.find((cell) => cell.item && this.bundle.catalog.get(cell.item.definitionId)?.maxUses);
      if (source) {
        const target = board.cells.find((cell) => this.board.previewDrop(source.index, cell.index).kind === 'SPLIT');
        return { hint: 'scissors', sourceIndex: source.index, ...(target ? { targetIndex: target.index } : {}) };
      }
    }
    const open = board.cells.filter((cell) => !cell.locked), occupied = open.filter((cell) => cell.item);
    if (!seen.has('backpack') && occupied.length >= Math.min(6, Math.max(2, open.length - 2)) && this.play.state.warehouse.length < this.config.toolbox.warehouseSlots) {
      const source = occupied.find((cell) => cell.item && !this.bundle.catalog.get(cell.item.definitionId)?.maxUses);
      if (source) return { hint: 'backpack', sourceIndex: source.index };
    }
  }

  getMergeHint(): ReturnType<BoardService['getMergeHint']> {
    return this.board.getMergeHint();
  }

  unlockMemory(id: string): LifeResult {
    const result = this.life.unlockMemory(id);
    if (result.ok) this.save();
    return result;
  }

  buyFurniture(id: string): LifeResult {
    const result = this.life.buyFurniture(id);
    if (result.ok) this.save();
    return result;
  }

  placeFurniture(id: string): LifeResult {
    const result = this.life.placeFurniture(id);
    if (result.ok) this.save();
    return result;
  }

  claimWish(id: string): LifeResult {
    const result = this.life.claimWish(id);
    if (result.ok) this.save();
    return result;
  }

  claimLevelReward(level: number): LifeResult {
    const result = this.life.claimLevelReward(level);
    if (result.ok) {
      this.enqueue('treasure_chest');
      const generatorId = this.generators.grantLevelReward(level, this.bundle.levelRewards.generatorRotation ?? []);
      if (generatorId) this.bus.emit('GENERATOR_CHANGED', { generatorId });
      this.save();
    }
    return result;
  }

  addPhoto(path: string): LifeResult {
    const result = this.life.addPhoto(path);
    if (result.ok) this.save();
    return result;
  }

  tick(): void {
    if (this.energy.tick().recovered > 0) this.scheduleSave();
  }

  claimOrder(orderUid: string): ReturnType<OrderService['claim']> {
    const result = this.orders.claim(orderUid);
    if (result.ok) {
      this.life.record('orders');
      this.recordDaily('orders');
      if (!this.tutorialRef.firstOrderCompleted) {
        this.tutorialRef.firstOrderCompleted = true;
        this.bus.emit('TUTORIAL_UPDATED', { ...this.tutorialRef });
      }
      this.save();
    }
    return result;
  }

  debugAddEnergy(amount: number): void {
    this.energy.add(amount);
    this.save();
  }

  debugAddXp(amount: number): void {
    this.progression.addXp(amount);
    this.save();
  }

  debugAddCoins(amount: number): void {
    this.progression.addCoins(amount);
    this.save();
  }

  debugClearBoard(): void {
    this.board.clearBoard();
    this.save();
  }

  debugSpawn(definitionId: string): void {
    this.board.spawn(definitionId);
    this.orders.refreshProgressHints();
    this.save();
  }

  debugResetSave(): void {
    this.saveService.reset();
    this.boot();
  }

  buildSaveData(): SaveData {
    return {
      version: this.config.saveVersion,
      savedAt: this.clock.now(),
      player: {
        ...this.playerRef,
        unlockedChainIds: [...this.playerRef.unlockedChainIds],
      },
      generatorCharges: this.generators.getChargeStates(),
      generatorInventory: this.generators.getInventory(),
      generatorCooldowns: this.generators.getCooldownStates(),
      claimedCollectionIds: [...this.claimedCollections],
      orderRefreshAt: [...this.orderRefreshAt],
      dailyTasks: this.dailyTasks ? { ...this.dailyTasks, progress: { ...this.dailyTasks.progress }, claimedIds: [...this.dailyTasks.claimedIds] } : undefined,
      journal: this.journal.state,
      legacyBoardEntitlement: this.legacyBoardEntitlement,
      retainedOpenCellIndices: [...this.retainedOpenCellIndices],
      rewardInbox: this.inboxRef.map((i) => ({ ...i })),
      discoveredItemIds: [...this.discovered],
      claimedDiscoveryIds: [...this.claimedDiscoveries],
      checkIn: { ...this.checkIn },
      board: this.board.getBoard().cells.map((c) => ({
        index: c.index,
        item: c.item ? { ...c.item } : undefined,
      })),
      activeOrders: this.orders.getOrders(),
      tutorial: { ...this.tutorialRef },
      preferences: { ...this.preferencesRef },
      play: this.play.state,
      recentOrderIds: this.orders.getRecentIds(),
      life: {
        ...this.lifeRef,
        unlockedMemoryIds: [...this.lifeRef.unlockedMemoryIds],
        ownedFurnitureIds: [...this.lifeRef.ownedFurnitureIds],
        placedFurnitureIds: [...this.lifeRef.placedFurnitureIds],
        claimedWishIds: [...this.lifeRef.claimedWishIds],
        claimedLevelRewards: [...this.lifeRef.claimedLevelRewards],
        photoPaths: [...this.lifeRef.photoPaths],
        stats: { ...this.lifeRef.stats },
        furniturePositions: Object.fromEntries(Object.entries(this.lifeRef.furniturePositions).map(([id, position]) => [id, { ...position }])),
      },
    };
  }

  save(): SaveWriteResult {
    const data = this.buildSaveData();
    return this.saveService.save(data);
  }

  scheduleSave(): void {
    this.saveService.scheduleSave(this.buildSaveData());
  }

  flushSave(): void {
    this.saveService.flush();
  }

  /** Legacy callers cannot replace an order or spend diamonds. */
  getOrderRefreshStatus(_uid: string): { freeAvailable: boolean; nextFreeMs: number; diamondCost: number } | null { return null; }
  refreshOrderClock(): void { if (this.orders.expireUrgentOrders()) { this.save(); this.orders.refreshProgressHints(); } }
  getTodayJournal(): ReturnType<JournalService['today']> { return this.journal.today(); }
  getJournalEntries(): ReturnType<JournalService['entries']> { return this.journal.entries(); }
  saveTodayJournal(text: string, photoPath: string): ReturnType<JournalService['saveToday']> { return this.journal.saveToday(text, photoPath); }
  refreshOrder(_uid: string, _mode: 'free' | 'diamond'): { ok: false; reason: 'DISABLED' } { return { ok: false, reason: 'DISABLED' }; }
  private ensureDailyTasks(): boolean {
    const day = businessDayUtc8(this.clock.now());
    if (this.dailyTasks && day <= this.dailyTasks.day) {
      const task = this.config.rewards.dailyTasks.find((entry) => entry.kind === 'specific');
      if (!task || this.dailyTasks.claimedIds.includes(task.id) || (this.dailyTasks.progress[task.id] ?? 0) >= task.target) return false;
      const target = this.projectProducerItem(this.dailyTasks.targetItemId, true);
      if (target === this.dailyTasks.targetItemId) return false;
      this.dailyTasks.targetItemId = target;
      this.bus.emit('DAILY_TASKS_CHANGED', { day: this.dailyTasks.day });
      return true;
    }
    const unlocked = new Set(this.player.unlockedChainIds);
    const producerChains = new Set(this.bundle.generators.filter((g) => unlocked.has(g.chainId)).map((g) => g.chainId));
    const choices = this.bundle.items.filter((item) => item.level === 2 && producerChains.has(item.chainId));
    const index = ((day % choices.length) + choices.length) % choices.length;
    this.dailyTasks = { day, targetItemId: this.projectProducerItem(choices[index]?.id ?? 'coffee_02', true), progress: {}, claimedIds: [] };
    return true;
  }
  private recordDaily(kind: 'orders' | 'merges', itemId?: string): void {
    this.ensureDailyTasks(); const state = this.dailyTasks!;
    for (const task of this.config.rewards.dailyTasks) {
      if (task.kind === kind || (kind === 'merges' && task.kind === 'specific' && state.targetItemId === itemId)) state.progress[task.id] = Math.min(task.target, (state.progress[task.id] ?? 0) + 1);
    }
    this.bus.emit('DAILY_TASKS_CHANGED', { day: state.day });
  }
  getDailyTasks(): { day: number; tasks: Array<{ id: string; title: string; target: number; progress: number; claimed: boolean; ready: boolean; reward: { coins: number; xp: number; energy: number; diamonds: number }; targetItemId?: string }> } {
    if (this.ensureDailyTasks()) this.save();
    const state = this.dailyTasks!;
    return { day: state.day, tasks: this.config.rewards.dailyTasks.map((task) => {
      const progress = state.progress[task.id] ?? 0, claimed = state.claimedIds.includes(task.id);
      return { id: task.id, title: task.title, target: task.target, progress, claimed, ready: !claimed && progress >= task.target, reward: { ...task.reward }, ...(task.kind === 'specific' ? { targetItemId: state.targetItemId } : {}) };
    }) };
  }
  claimDailyTask(id: string): { ok: true; coins: number; xp: number; energy: number; diamonds: number } | { ok: false; reason: 'NOT_FOUND' | 'ALREADY_CLAIMED' | 'NOT_READY' } {
    this.ensureDailyTasks(); const state = this.dailyTasks!, task = this.config.rewards.dailyTasks.find((t) => t.id === id);
    if (!task) return { ok: false, reason: 'NOT_FOUND' };
    if (state.claimedIds.includes(id)) return { ok: false, reason: 'ALREADY_CLAIMED' };
    if ((state.progress[id] ?? 0) < task.target) return { ok: false, reason: 'NOT_READY' };
    state.claimedIds.push(id); const { coins, xp, diamonds } = task.reward;
    const energy = task.reward.energy;
    this.progression.addCoins(coins); this.progression.addXp(xp); this.player.diamonds += diamonds; this.energy.add(energy);
    this.bus.emit('DAILY_TASKS_CHANGED', { day: state.day }); this.save(); return { ok: true, coins, xp, energy, diamonds };
  }

  get rewardInbox(): readonly ItemInstance[] { return this.inboxRef.map((i) => ({ ...i })); }
  isItemDiscovered(id: string): boolean { return this.bundle.catalog.has(id) && this.discovered.includes(id); }
  getDiscoveryProgress(): { discovered: number; total: number } { return { discovered: this.bundle.items.filter((i) => this.isItemDiscovered(i.id)).length, total: this.bundle.items.length }; }
  getCollectionProgress(): Array<{ chainId: string; discovered: number; total: number; claimed: boolean; ready: boolean; energyBonus: number }> {
    return this.config.collection.chainIds.map((chainId) => {
      const items = this.bundle.items.filter((item) => item.chainId === chainId);
      const discovered = items.filter((item) => this.isItemDiscovered(item.id)).length;
      const claimed = this.claimedCollections.includes(chainId);
      return { chainId, discovered, total: items.length, claimed, ready: !claimed && items.length > 0 && discovered === items.length, energyBonus: this.config.collection.energyPerChain };
    });
  }
  claimCollectionBonus(chainId: string): { ok: true; energyBonus: number } | { ok: false; reason: 'NOT_FOUND' | 'NOT_READY' | 'ALREADY_CLAIMED' } {
    const collection = this.getCollectionProgress().find((item) => item.chainId === chainId);
    if (!collection) return { ok: false, reason: 'NOT_FOUND' };
    if (collection.claimed) return { ok: false, reason: 'ALREADY_CLAIMED' };
    if (!collection.ready) return { ok: false, reason: 'NOT_READY' };
    this.claimedCollections.push(chainId);
    const previous = this.player.maxEnergy;
    this.progression.syncEnergyCap();
    this.bus.emit('COLLECTION_CHANGED', { chainId });
    this.bus.emit('ENERGY_CHANGED', { energy: this.player.energy, maxEnergy: this.player.maxEnergy, delta: 0 });
    this.save();
    return { ok: true, energyBonus: this.player.maxEnergy - previous };
  }
  private newItem(definitionId: string): ItemInstance {
    const used = new Set([...this.board.getBoard().cells.flatMap((c) => c.item ? [c.item.uid] : []), ...this.inboxRef.map((i) => i.uid), ...this.play.state.warehouse.map((i) => i.uid)]);
    let uid = this.ids.next(); while (used.has(uid)) uid = this.ids.next();
    return { uid, definitionId };
  }
  private recordBaseAcquisition(id: string, notify = true): void {
    const definition = this.bundle.catalog.get(id);
    if (!definition || definition.level !== 1 || this.discovered.includes(id)) return;
    this.discovered.push(id);
    if (notify) this.bus.emit('COLLECTION_CHANGED', { chainId: definition.chainId });
  }
  private enqueue(id: string): void { this.inboxRef.push(this.newItem(id)); this.recordBaseAcquisition(id); this.bus.emit('REWARDS_CHANGED', { reason: 'inbox' }); }
  private handleMerge(id: string): void {
    const chain = this.bundle.catalog.get(id)?.chainId;
    if (chain === 'treasure_chest') {
      if (!this.discovered.includes(id)) { this.discovered.push(id); this.bus.emit('COLLECTION_CHANGED', { chainId: chain }); }
      return;
    }
    if (!this.discovered.includes(id)) this.discovered.push(id);
    if (!this.claimedDiscoveries.includes(id)) { this.claimedDiscoveries.push(id); this.progression.addCoins(this.config.rewards.discoveryCoins); this.bus.emit('DISCOVERY_CHANGED', { definitionId: id }); }
    if (chain && this.config.collection.chainIds.includes(chain) && this.random.next() < this.config.rewards.chestDropChance) {
      const placed = this.board.spawn('treasure_chest'); if (!placed.ok) this.enqueue('treasure_chest');
    }
  }
  claimInboxItem(uid: string): { ok: true } | { ok: false; reason: 'NOT_FOUND' | 'BOARD_FULL' } {
    const at = this.inboxRef.findIndex((i) => i.uid === uid);
    if (at < 0) return { ok: false, reason: 'NOT_FOUND' };
    const cell = this.board.getBoard().cells.find((c) => !c.locked && !c.item);
    if (!cell) return { ok: false, reason: 'BOARD_FULL' };
    cell.item = this.inboxRef.splice(at, 1)[0]; this.bus.emit('BOARD_CHANGED', { reason: 'tool' }); this.bus.emit('REWARDS_CHANGED', { reason: 'inbox' }); this.save(); return { ok: true };
  }
  useBoardItem(index: number, expectedUid?: string): { ok: true; amount: number; loot?: Array<ItemInstance & { cellIndex: number | null }> } | { ok: false; reason: 'INVALID' | 'ENERGY_FULL' } {
    const cell = this.board.getBoard().cells[index]; const item = cell?.item; const def = item && this.bundle.catalog.get(item.definitionId);
    if (!cell || cell.locked || !item || (expectedUid !== undefined && item.uid !== expectedUid) || !def || (!['coin', 'energy', 'diamond', 'treasure_chest'].includes(def.chainId))) return { ok: false, reason: 'INVALID' };
    const chest = def.chainId === 'treasure_chest' ? this.config.rewards.chestLevels.find((entry) => entry.level === def.level) : undefined;
    if (def.chainId === 'treasure_chest' && !chest) return { ok: false, reason: 'INVALID' };
    const choices = chest ? Array.from({ length: chest.count }, () => pickWeighted(chest.loot ?? this.config.rewards.chestLoot, this.random)) : [];
    if (choices.some((entry) => !entry)) return { ok: false, reason: 'INVALID' };
    const items = choices.map((entry) => this.newItem(entry!.itemId));
    cell.item = undefined; let amount = def.useValue ?? 0;
    if (def.chainId === 'coin') this.progression.addCoins(amount);
    if (def.chainId === 'energy') this.energy.add(amount);
    if (def.chainId === 'diamond') this.player.diamonds += amount;
    const loot = items.map((created) => {
      const empty = this.board.getBoard().cells.find((candidate) => !candidate.locked && !candidate.item);
      if (empty) empty.item = created; else this.inboxRef.push(created);
      return { ...created, cellIndex: empty?.index ?? null };
    });
    for (const created of items) this.recordBaseAcquisition(created.definitionId);
    if (chest) this.acknowledgeFirstUseHint('chest');
    this.bus.emit('BOARD_CHANGED', { reason: 'tool' }); this.bus.emit('REWARDS_CHANGED', { reason: 'used' }); this.save();
    return chest ? { ok: true, amount, loot } : { ok: true, amount };
  }
  exchangeDiamonds(offerId: string): { ok: true; energy: number } | { ok: false; reason: 'INVALID' | 'ENERGY_FULL' | 'NOT_ENOUGH_DIAMONDS' | 'IN_PROGRESS' } {
    if (this.exchanging) return { ok: false, reason: 'IN_PROGRESS' };
    const offer = this.config.rewards.exchangeOffers.find((o) => o.id === offerId); if (!offer) return { ok: false, reason: 'INVALID' };
    if (this.player.energy >= this.player.maxEnergy) return { ok: false, reason: 'ENERGY_FULL' };
    if (this.player.diamonds < offer.diamonds) return { ok: false, reason: 'NOT_ENOUGH_DIAMONDS' };
    const energy = Math.min(offer.energy, this.player.maxEnergy - this.player.energy); this.exchanging = true;
    try { this.player.diamonds -= offer.diamonds; this.energy.add(energy); this.bus.emit('REWARDS_CHANGED', { reason: 'exchange' }); this.save(); return { ok: true, energy }; } finally { this.exchanging = false; }
  }
  moveFurniture(id: string, x: number, y: number): LifeResult {
    if (!this.life.state.ownedFurnitureIds.includes(id) || !this.life.state.placedFurnitureIds.includes(id)) return { ok: false, reason: 'LOCKED' };
    if (!this.bundle.furniture.some((f) => f.id === id)) return { ok: false, reason: 'NOT_FOUND' };
    if (![x, y].every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) return { ok: false, reason: 'NOT_READY' };
    const previous = this.life.state.furniturePositions[id];
    this.life.state.furniturePositions[id] = { ...previous, x, y }; this.bus.emit('LIFE_CHANGED', { reason: 'furniture' }); this.save(); return { ok: true };
  }
  setFurnitureTransform(id: string, patch: { x?: number; y?: number; scale?: number; rotation?: number; flipped?: boolean }): LifeResult {
    const furniture = this.bundle.furniture.find((item) => item.id === id);
    if (!furniture) return { ok: false, reason: 'NOT_FOUND' };
    if (!this.life.state.ownedFurnitureIds.includes(id) || !this.life.state.placedFurnitureIds.includes(id)) return { ok: false, reason: 'LOCKED' };
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)
      || (patch.scale !== undefined && (typeof patch.scale !== 'number' || !Number.isFinite(patch.scale) || patch.scale < 0.5 || patch.scale > 1.8))
      || (patch.rotation !== undefined && (typeof patch.rotation !== 'number' || !Number.isFinite(patch.rotation) || patch.rotation < -180 || patch.rotation > 180))
      || (patch.flipped !== undefined && typeof patch.flipped !== 'boolean')
      || (patch.x !== undefined && (typeof patch.x !== 'number' || !Number.isFinite(patch.x) || patch.x < 0 || patch.x > 1))
      || (patch.y !== undefined && (typeof patch.y !== 'number' || !Number.isFinite(patch.y) || patch.y < 0 || patch.y > 1))) return { ok: false, reason: 'NOT_READY' };
    const saved = this.life.state.furniturePositions[id];
    if (!saved && (patch.x === undefined || patch.y === undefined)) return { ok: false, reason: 'NOT_READY' };
    const previous = saved ?? { x: patch.x!, y: patch.y! };
    this.life.state.furniturePositions[id] = {
      ...previous,
      x: patch.x ?? previous.x,
      y: patch.y ?? previous.y,
      scale: patch.scale ?? previous.scale ?? 1,
      rotation: patch.rotation ?? previous.rotation ?? 0,
      flipped: patch.flipped ?? previous.flipped ?? false,
    };
    this.bus.emit('LIFE_CHANGED', { reason: 'furniture' }); this.save(); return { ok: true };
  }
  resetFurniturePosition(id: string): LifeResult {
    if (!this.bundle.furniture.some((f) => f.id === id)) return { ok: false, reason: 'NOT_FOUND' };
    if (!this.life.state.ownedFurnitureIds.includes(id)) return { ok: false, reason: 'LOCKED' };
    delete this.life.state.furniturePositions[id]; this.bus.emit('LIFE_CHANGED', { reason: 'furniture' }); this.save(); return { ok: true };
  }
  getCheckInStatus(): { day: number; claims: number; cycleIndex: number; canClaim: boolean; nextReward: { coins: number; energy: number; diamonds: number; itemId?: string }; lastClaimDay: number | null } {
    const day = businessDayUtc8(this.clock.now());
    return { day, claims: this.checkIn.claims, cycleIndex: this.checkIn.claims % this.config.rewards.checkIn.length, canClaim: this.checkIn.lastClaimDay === null || day > this.checkIn.lastClaimDay, nextReward: { ...this.config.rewards.checkIn[this.checkIn.claims % this.config.rewards.checkIn.length] }, lastClaimDay: this.checkIn.lastClaimDay };
  }
  claimDailyCheckIn(): { ok: true; coins: number; energy: number; diamonds: number; itemId?: string } | { ok: false; reason: 'ALREADY_CLAIMED' } {
    const status = this.getCheckInStatus(); if (!status.canClaim) return { ok: false, reason: 'ALREADY_CLAIMED' };
    const { coins, diamonds, energy } = status.nextReward;
    this.checkIn = { lastClaimDay: status.day, claims: this.checkIn.claims + 1 }; this.progression.addCoins(coins); this.player.diamonds += diamonds; this.energy.add(energy);
    const itemId = status.nextReward.itemId; if (itemId) this.enqueue(itemId);
    this.bus.emit('CHECK_IN_CHANGED', { day: status.day }); this.save(); return { ok: true, coins, energy, diamonds, ...(itemId ? { itemId } : {}) };
  }

  private markTutorialFromBoard(): void {
    // If save already has merges, keep flags
    this.bus.emit('TUTORIAL_UPDATED', { ...this.tutorialRef });
  }
}

export function createGameContext(options?: GameContextOptions): GameContext {
  const ctx = new GameContext(options);
  ctx.boot();
  return ctx;
}
