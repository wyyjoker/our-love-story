import type { GameConfig, PlayerState, SaveData, TutorialState } from '../core/types';
import { cloneBoard } from '../core/board/board';
import type { ConfigBundle } from '../config/ConfigRepository';
import { loadConfigBundle, assertConfigValid } from '../config/ConfigRepository';
import { GameEventBus } from '../events/GameEventBus';
import {
  ClockService,
  FakeClockService,
  SystemClockService,
} from '../infrastructure/ClockService';
import {
  FixedRandomService,
  RandomService,
  SystemRandomService,
} from '../infrastructure/RandomService';
import { IdService, SequentialIdService, type IdGenerator } from '../infrastructure/IdService';
import { PlatformService, type StorageAdapter } from '../infrastructure/PlatformService';
import { SaveService, createDefaultSaveData } from '../infrastructure/SaveService';
import { GameLogger } from '../infrastructure/GameLogger';
import { BoardService } from './BoardService';
import { EnergyService } from './EnergyService';
import { GeneratorService } from './GeneratorService';
import { OrderService } from './OrderService';
import { ProgressionService } from './ProgressionService';

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

  board!: BoardService;
  energy!: EnergyService;
  generators!: GeneratorService;
  orders!: OrderService;
  progression!: ProgressionService;

  bootState: BootState = 'BOOT';
  bootError: string | null = null;

  constructor(options: GameContextOptions = {}) {
    this.logger = options.logger ?? new GameLogger(true);
    this.bundle = options.config ?? loadConfigBundle();
    this.config = this.bundle.game;
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
    this.ids =
      options.ids ??
      (options.deterministic
        ? new SequentialIdService('det')
        : new IdService());

    this.saveService = new SaveService({
      storage: this.platform.getStorage(),
      clock: this.clock,
      saveKey: this.config.saveKey,
      version: this.config.saveVersion,
      createDefault: () => createDefaultSaveData(this.config, this.clock.now()),
      debounceMs: options.saveDebounceMs ?? 200,
      logger: (m) => this.logger.debug('SAVE', m),
    });
  }

  get player(): PlayerState {
    return this.playerRef;
  }

  get tutorial(): TutorialState {
    return this.tutorialRef;
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
      let data: SaveData;
      if (loaded.ok) {
        data = loaded.data;
        this.logger.debug('SAVE', `loaded v${data.version}`);
      } else {
        data = loaded.defaultData;
        this.logger.debug('SAVE', `using default (${loaded.reason})`);
      }

      this.playerRef = {
        ...data.player,
        unlockedChainIds: [...data.player.unlockedChainIds],
      };
      this.tutorialRef = { ...data.tutorial };

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
      );

      this.generators = new GeneratorService(
        this.bundle.generators,
        this.bundle.catalog,
        this.board,
        this.energy,
        this.playerRef,
        this.random,
        this.clock,
      );

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
      );
      this.orders.hydrate(data.activeOrders, data.recentOrderIds ?? []);
      this.orders.ensureFilled();

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

  spawnFromGenerator(generatorId: string): ReturnType<GeneratorService['spawn']> {
    const result = this.generators.spawn(generatorId);
    if (result.ok) {
      if (!this.tutorialRef.generatorClicked) {
        this.tutorialRef.generatorClicked = true;
        this.bus.emit('TUTORIAL_UPDATED', { ...this.tutorialRef });
      }
      this.orders.refreshProgressHints();
      this.save();
    }
    return result;
  }

  dropItem(from: number, to: number | null): ReturnType<BoardService['tryDrop']> {
    const result = this.board.tryDrop(from, to);
    if (result.ok && result.kind === 'MERGE') {
      if (!this.tutorialRef.firstMergeCompleted) {
        this.tutorialRef.firstMergeCompleted = true;
        this.bus.emit('TUTORIAL_UPDATED', { ...this.tutorialRef });
      }
    }
    if (result.ok) {
      this.orders.refreshProgressHints();
      this.save();
    }
    return result;
  }

  claimOrder(orderUid: string): ReturnType<OrderService['claim']> {
    const result = this.orders.claim(orderUid);
    if (result.ok) {
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
      board: this.board.getBoard().cells.map((c) => ({
        index: c.index,
        item: c.item ? { ...c.item } : undefined,
      })),
      activeOrders: this.orders.getOrders(),
      tutorial: { ...this.tutorialRef },
      recentOrderIds: this.orders.getRecentIds(),
    };
  }

  save(): void {
    const data = this.buildSaveData();
    this.saveService.save(data);
    this.bus.emit('GAME_SAVED', { savedAt: data.savedAt });
  }

  scheduleSave(): void {
    this.saveService.scheduleSave(this.buildSaveData());
  }

  flushSave(): void {
    this.saveService.flush();
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
