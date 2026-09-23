import type {
  ActiveOrder,
  BoardCellState,
  GameConfig,
  LifeState,
  PlayerState,
  SaveData,
  TutorialState,
} from '../core/types';
import type { StorageAdapter } from './PlatformService';
import type { ClockService } from './ClockService';

export type SaveLoadResult =
  | { ok: true; data: SaveData; repaired: boolean }
  | { ok: false; reason: 'EMPTY' | 'CORRUPT'; defaultData: SaveData };

export type SaveServiceOptions = {
  storage: StorageAdapter;
  clock: ClockService;
  saveKey: string;
  version: number;
  createDefault: () => SaveData;
  /** Debounce ms for scheduleSave; 0 = immediate */
  debounceMs?: number;
  logger?: (message: string) => void;
  /** First starter furniture, used only to repair the former Creator Set-serialization bug. */
  legacyStarterFurnitureId?: string;
};

export class SaveService {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: SaveData | null = null;
  private readonly debounceMs: number;

  constructor(private readonly options: SaveServiceOptions) {
    this.debounceMs = options.debounceMs ?? 200;
  }

  load(): SaveLoadResult {
    const raw = this.options.storage.getItem(this.options.saveKey);
    if (raw == null || raw === '') {
      return { ok: false, reason: 'EMPTY', defaultData: this.options.createDefault() };
    }

    try {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      const migrated = this.migrate(parsed);
      if (!migrated) {
        this.backupCorrupt(raw);
        this.options.logger?.('[SAVE] corrupt payload, using default');
        return {
          ok: false,
          reason: 'CORRUPT',
          defaultData: this.options.createDefault(),
        };
      }
      return { ok: true, data: migrated.data, repaired: migrated.repaired };
    } catch {
      this.backupCorrupt(raw);
      this.options.logger?.('[SAVE] JSON parse failed, using default');
      return {
        ok: false,
        reason: 'CORRUPT',
        defaultData: this.options.createDefault(),
      };
    }
  }

  save(data: SaveData): void {
    const payload: SaveData = {
      ...data,
      version: this.options.version,
      savedAt: this.options.clock.now(),
    };
    this.options.storage.setItem(this.options.saveKey, JSON.stringify(payload));
    this.pending = null;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  scheduleSave(data: SaveData): void {
    this.pending = data;
    if (this.debounceMs <= 0) {
      this.save(data);
      return;
    }
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.pending) {
        this.save(this.pending);
      }
    }, this.debounceMs);
  }

  /** Flush any pending debounced save (call on page hide / destroy). */
  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.pending) {
      this.save(this.pending);
    }
  }

  reset(): void {
    this.options.storage.removeItem(this.options.saveKey);
    this.options.storage.removeItem(`${this.options.saveKey}:backup`);
    this.pending = null;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  migrate(parsed: Partial<SaveData> | null | undefined):
    | { data: SaveData; repaired: boolean }
    | null {
    if (!parsed || typeof parsed !== 'object') return null;

    let repaired = false;
    const defaults = this.options.createDefault();
    const version = typeof parsed.version === 'number' ? parsed.version : 0;

    if (version < 1) {
      // Future: v0 �?v1. For now treat as needing full default if nonsense.
      if (version !== 0) return null;
      repaired = true;
    }
    if (version > this.options.version) {
      return null;
    }

    const player = this.mergePlayer(parsed.player, defaults.player, version);
    const boardCells = this.mergeBoard(
      parsed.board,
      defaults.board,
      version,
    );
    if (!boardCells) return null;

    const activeOrders = Array.isArray(parsed.activeOrders)
      ? parsed.activeOrders.filter(isActiveOrder)
      : defaults.activeOrders;
    if (activeOrders.length !== defaults.activeOrders.length && activeOrders.length === 0) {
      repaired = true;
    }

    const tutorial = this.mergeTutorial(parsed.tutorial, defaults.tutorial);

    const life = this.mergeLife(parsed.life, defaults.life);
    const rawLife = parsed.life as Partial<LifeState> | undefined;
    const brokenSet = (value: unknown): boolean => Array.isArray(value)
      && value.length === 1
      && value[0] !== null
      && typeof value[0] === 'object'
      && Object.keys(value[0]).length === 0;
    if (this.options.legacyStarterFurnitureId
      && brokenSet(rawLife?.ownedFurnitureIds)
      && brokenSet(rawLife?.placedFurnitureIds)
      && life.ownedFurnitureIds.length === 0
      && life.placedFurnitureIds.length === 0) {
      // Old Web Mobile builds wrote a Set as [{}] during readback. The exact
      // contents are gone; restore the known starter furnishing once.
      life.ownedFurnitureIds = [this.options.legacyStarterFurnitureId];
      life.placedFurnitureIds = [this.options.legacyStarterFurnitureId];
      repaired = true;
    }

    const data: SaveData = {
      version: this.options.version,
      savedAt:
        typeof parsed.savedAt === 'number' ? parsed.savedAt : this.options.clock.now(),
      player,
      board: boardCells,
      activeOrders: activeOrders.length > 0 ? activeOrders : defaults.activeOrders,
      tutorial,
      recentOrderIds: Array.isArray(parsed.recentOrderIds)
        ? parsed.recentOrderIds.filter((x): x is string => typeof x === 'string')
        : [],
      life,
    };

    return { data, repaired };
  }

  private mergePlayer(
    raw: unknown,
    fallback: PlayerState,
    version: number,
  ): PlayerState {
    if (!raw || typeof raw !== 'object') return { ...fallback };
    const p = raw as Partial<PlayerState>;
    const level = Math.max(1, Math.min(18, Math.floor(num(p.level, fallback.level))));
    const oldXp = Math.max(0, Math.floor(num(p.xp, fallback.xp)));
    let xp = oldXp;
    if (version === 1) {
      const oldFloors = [0, 30, 80, 150, 250];
      const oldFloor = oldFloors[Math.min(level - 1, 4)];
      const oldNext = oldFloors[level] ?? oldFloor;
      const newFloor = 25 * level * (level - 1);
      const progress = oldNext > oldFloor
        ? Math.min(1, Math.max(0, (oldXp - oldFloor) / (oldNext - oldFloor)))
        : 0;
      xp = newFloor + Math.round(progress * 50 * level) + (level >= 5 ? Math.max(0, oldXp - oldFloor) : 0);
    }
    const oldMax = Math.max(1, num(p.maxEnergy, fallback.maxEnergy));
    const oldEnergy = Math.min(oldMax, Math.max(0, num(p.energy, fallback.energy)));
    const energy = version === 1
      ? Math.max(0, fallback.maxEnergy - (oldMax - oldEnergy))
      : Math.min(fallback.maxEnergy, oldEnergy);
    return {
      level,
      xp,
      coins: num(p.coins, fallback.coins),
      hearts: num(p.hearts, fallback.hearts),
      energy,
      maxEnergy: fallback.maxEnergy,
      lastEnergyAt: num(p.lastEnergyAt, fallback.lastEnergyAt),
      unlockedChainIds: Array.isArray(p.unlockedChainIds)
        ? p.unlockedChainIds.filter((x): x is string => typeof x === 'string')
        : [...fallback.unlockedChainIds],
    };
  }

  private mergeBoard(
    raw: unknown,
    fallback: BoardCellState[],
    version: number,
  ): BoardCellState[] | null {
    if (!Array.isArray(raw)) {
      return fallback.map((c) => ({ ...c, item: c.item ? { ...c.item } : undefined }));
    }
    const legacy = version === 1 && raw.length === 63 && fallback.length === 81;
    if (raw.length !== fallback.length && !legacy) {
      return null; // board length invalid �?fail safe (caller uses default)
    }
    const cells: BoardCellState[] = fallback.map((c) => ({ index: c.index }));
    for (let i = 0; i < raw.length; i += 1) {
      const cell = raw[i] as Partial<BoardCellState> | null;
      if (!cell || typeof cell !== 'object') return null;
      const item = cell.item;
      if (item && typeof item === 'object') {
        const it = item as { uid?: unknown; definitionId?: unknown };
        if (typeof it.uid !== 'string' || typeof it.definitionId !== 'string') {
          return null;
        }
        const index = legacy ? Math.floor(i / 7) * 9 + (i % 7) : i;
        cells[index].item = { uid: it.uid, definitionId: it.definitionId };
      }
    }
    return cells;
  }

  private mergeLife(raw: unknown, fallback: LifeState): LifeState {
    if (!raw || typeof raw !== 'object') return {
      ...fallback,
      stats: { ...fallback.stats },
    };
    const state = raw as Partial<LifeState>;
    // Use Array.from: Creator's Web Mobile transpiler compiles a Set spread as
    // [].concat(set), which serializes the Set as {} in a saved array.
    const strings = (value: unknown): string[] => Array.isArray(value)
      ? Array.from(new Set(value.filter((x): x is string => typeof x === 'string')))
      : [];
    const claimedLevels = Array.isArray(state.claimedLevelRewards)
      ? Array.from(new Set(state.claimedLevelRewards.filter((x): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 2 && x <= 18)))
      : [];
    return {
      unlockedMemoryIds: strings(state.unlockedMemoryIds),
      ownedFurnitureIds: strings(state.ownedFurnitureIds),
      placedFurnitureIds: strings(state.placedFurnitureIds),
      claimedWishIds: strings(state.claimedWishIds),
      claimedLevelRewards: claimedLevels,
      photoPaths: strings(state.photoPaths),
      stats: {
        spawns: Math.max(0, Math.floor(num(state.stats?.spawns, 0))),
        merges: Math.max(0, Math.floor(num(state.stats?.merges, 0))),
        orders: Math.max(0, Math.floor(num(state.stats?.orders, 0))),
      },
    };
  }

  private mergeTutorial(raw: unknown, fallback: TutorialState): TutorialState {
    if (!raw || typeof raw !== 'object') return { ...fallback };
    const t = raw as Partial<TutorialState>;
    return {
      generatorClicked: !!t.generatorClicked,
      firstMergeCompleted: !!t.firstMergeCompleted,
      firstOrderCompleted: !!t.firstOrderCompleted,
      firstOrderHintShown: !!t.firstOrderHintShown,
    };
  }

  private backupCorrupt(raw: string): void {
    try {
      this.options.storage.setItem(`${this.options.saveKey}:backup`, raw);
    } catch {
      // ignore
    }
  }
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isActiveOrder(value: unknown): value is ActiveOrder {
  if (!value || typeof value !== 'object') return false;
  const o = value as Partial<ActiveOrder>;
  return (
    typeof o.uid === 'string' &&
    typeof o.templateId === 'string' &&
    Array.isArray(o.requirements)
  );
}

export function createDefaultSaveData(config: GameConfig, savedAt: number): SaveData {
  const rows = config.board.rows;
  const columns = config.board.columns;
  const board: BoardCellState[] = [];
  for (let index = 0; index < rows * columns; index += 1) {
    board.push({ index });
  }

  // Coffee-only starter items so the first merge and tutorial order are immediate.
  if (board.length >= 4) {
    board[0].item = { uid: 'start_c1a', definitionId: 'coffee_01' };
    board[1].item = { uid: 'start_c1b', definitionId: 'coffee_01' };
    board[2].item = { uid: 'start_c1c', definitionId: 'coffee_01' };
    board[3].item = { uid: 'start_c1d', definitionId: 'coffee_01' };
  }

  const player: PlayerState = {
    level: 1,
    xp: 0,
    coins: 0,
    hearts: 0,
    energy: config.energy.initialEnergy,
    maxEnergy: config.energy.maxEnergy,
    lastEnergyAt: savedAt,
    unlockedChainIds: ['coffee'],
  };

  return {
    version: config.saveVersion,
    savedAt,
    player,
    board,
    activeOrders: [
      {
        uid: 'order_start_1',
        templateId: 'order_tutorial_coffee',
        requirements: [{ itemId: 'coffee_02', count: 1 }],
        rewardCoins: 20,
        rewardXp: 10,
        rewardHearts: 1,
      },
      {
        uid: 'order_start_2',
        templateId: 'order_coffee_powder',
        requirements: [{ itemId: 'coffee_02', count: 1 }],
        rewardCoins: 18,
        rewardXp: 8,
        rewardHearts: 3,
      },
      {
        uid: 'order_start_3',
        templateId: 'order_coffee_cup',
        requirements: [{ itemId: 'coffee_03', count: 1 }],
        rewardCoins: 30,
        rewardXp: 12,
        rewardHearts: 5,
      },
    ],
    tutorial: {
      generatorClicked: false,
      firstMergeCompleted: false,
      firstOrderCompleted: false,
      firstOrderHintShown: false,
    },
    recentOrderIds: ['order_tutorial_coffee', 'order_coffee_powder', 'order_coffee_cup'],
    life: {
      unlockedMemoryIds: [],
      ownedFurnitureIds: [],
      placedFurnitureIds: [],
      claimedWishIds: [],
      claimedLevelRewards: [],
      photoPaths: [],
      stats: { spawns: 0, merges: 0, orders: 0 },
    },
  };
}
