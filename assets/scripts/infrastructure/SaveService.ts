import type {
  ActiveOrder,
  BoardCellState,
  GameConfig,
  GamePreferences,
  LifeState,
  PlayerState,
  ProgressionConfig,
  SaveData,
  TutorialState,
} from '../core/types';
import type { StorageAdapter } from './PlatformService';
import { normalizeJournal } from '../gameplay/JournalService';
import type { ClockService } from './ClockService';
import type { ChapterProgress, PlayState, PuzzleProgress, ReplayProgress, ReplayStats, SmallDateProgress } from '../core/play/types';
import { getLevelForXp } from '../core/progression/progression';
import { MAX_GENERATOR_TIER } from '../core/generator/generatorItems';

export type SaveLoadResult =
  | { ok: true; data: SaveData; repaired: boolean; notice?: 'MIGRATED' | 'REPAIRED' | 'BACKUP_RESTORED' }
  | { ok: false; reason: 'EMPTY' | 'CORRUPT' | 'UNAVAILABLE'; defaultData: SaveData; backupPreserved?: boolean };

export type SaveWriteResult = { ok: true; savedAt: number } | { ok: false; reason: 'STORAGE_UNAVAILABLE' };

export type SaveServiceOptions = {
  storage: StorageAdapter;
  clock: ClockService;
  saveKey: string;
  version: number;
  createDefault: () => SaveData;
  /** Debounce ms for scheduleSave; 0 = immediate */
  debounceMs?: number;
  logger?: (message: string) => void;
  onWrite?: (result: SaveWriteResult) => void;
  /** First starter furniture, used only to repair the former Creator Set-serialization bug. */
  legacyStarterFurnitureId?: string;
  energyCaps?: readonly number[];
  progression?: ProgressionConfig;
  collection?: GameConfig['collection'];
  backpack?: { initialSlots: number; maxSlots: number };
};

export class SaveService {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: SaveData | null = null;
  private readonly debounceMs: number;
  private readonly levelCap: number;

  constructor(private readonly options: SaveServiceOptions) {
    this.debounceMs = options.debounceMs ?? 200;
    this.levelCap = options.progression?.levels.length ?? 18;
  }

  load(): SaveLoadResult {
    let raw: string | null;
    try { raw = this.options.storage.getItem(this.options.saveKey); }
    catch { return { ok: false, reason: 'UNAVAILABLE', defaultData: this.options.createDefault() }; }
    if (raw == null || raw === '') {
      return { ok: false, reason: 'EMPTY', defaultData: this.options.createDefault() };
    }

    const loaded = this.parse(raw);
    if (loaded) {
      // Preserve the exact previous schema before the first successful upgraded write.
      if (loaded.notice === 'MIGRATED' && !this.backupCorrupt(raw)) {
        return { ok: false, reason: 'UNAVAILABLE', defaultData: this.options.createDefault() };
      }
      return loaded;
    }
    // Never overwrite an existing good backup with a corrupt primary save.
    let backup: string | null;
    try { backup = this.options.storage.getItem(`${this.options.saveKey}:backup`); }
    catch { return { ok: false, reason: 'UNAVAILABLE', defaultData: this.options.createDefault() }; }
    const recovered = backup ? this.parse(backup) : null;
    if (recovered) return { ...recovered, notice: 'BACKUP_RESTORED' };
    return {
      ok: false, reason: 'CORRUPT', defaultData: this.options.createDefault(),
      backupPreserved: backup === raw || this.backupCorrupt(raw),
    };
  }

  private parse(raw: string): Extract<SaveLoadResult, { ok: true }> | null {
    try {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      const migrated = this.migrate(parsed);
      if (!migrated) return null;
      const notice = parsed.version !== this.options.version ? 'MIGRATED'
        : migrated.repaired ? 'REPAIRED' : undefined;
      return { ok: true, ...migrated, notice };
    } catch { return null; }
  }

  save(data: SaveData): SaveWriteResult {
    this.pending = data;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const payload: SaveData = {
      ...data,
      version: this.options.version,
      savedAt: this.options.clock.now(),
    };
    try { this.options.storage.setItem(this.options.saveKey, JSON.stringify(payload)); }
    catch {
      const failed: SaveWriteResult = { ok: false, reason: 'STORAGE_UNAVAILABLE' };
      this.options.onWrite?.(failed);
      return failed;
    }
    this.pending = null;
    const result: SaveWriteResult = { ok: true, savedAt: payload.savedAt };
    this.options.onWrite?.(result);
    return result;
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

    let repaired = parsed.version !== this.options.version;
    const defaults = this.options.createDefault();
    if (Object.keys(defaults).some((key) => !(key in parsed) && !['generatorInventory', 'generatorCharges', 'generatorCooldowns'].includes(key))) repaired = true;
    const version = typeof parsed.version === 'number' ? parsed.version : 0;

    if (version < 1) {
      // Future: v0 �?v1. For now treat as needing full default if nonsense.
      if (version !== 0) return null;
      repaired = true;
    }
    if (version > this.options.version) {
      return null;
    }

    const allowedCollection = new Set(this.options.collection?.chainIds ?? []);
    const claimedCollectionIds = Array.isArray(parsed.claimedCollectionIds)
      ? Array.from(new Set(parsed.claimedCollectionIds.filter((id): id is string => typeof id === 'string' && allowedCollection.has(id)))) : [];
    const collectionBonus = claimedCollectionIds.length * (this.options.collection?.energyPerChain ?? 0);
    const player = this.mergePlayer(parsed.player, defaults.player, version, collectionBonus);
    const overflow: import('../core/types').ItemInstance[] = [];
    const boardCells = this.mergeBoard(parsed.board, defaults.board, defaults.boardSize?.columns ?? 6, parsed.boardSize, overflow);
    if (!boardCells) return null;
    const sourceColumns = this.sourceBoardColumns(parsed.board, parsed.boardSize) || defaults.boardSize?.columns || 6;
    const targetColumns = defaults.boardSize?.columns ?? 6;
    const retainedOpenCellIndices = new Set<number>();
    for (const index of Array.isArray(parsed.retainedOpenCellIndices) ? parsed.retainedOpenCellIndices : []) {
      if (!Number.isInteger(index) || index < 0 || !Array.isArray(parsed.board) || index >= parsed.board.length) continue;
      const row = Math.floor(index / sourceColumns), column = index % sourceColumns;
      if (column < targetColumns && row < defaults.board.length / targetColumns) retainedOpenCellIndices.add(row * targetColumns + column);
    }
    // Old saves keep access to occupied cells, but empty legacy cells now follow level unlocks.
    if (version < 9) for (const cell of boardCells) if (cell.item) retainedOpenCellIndices.add(cell.index);

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

    if (version < 6) {
      const legacyMemoryRights: Record<string, string[]> = {
        anniversary: ['marriage_registration', 'wedding_thanksgiving'],
        letters: ['zhoushan_bonfire'],
        night_view: ['qinwang_palace', 'hengdian_hot_spring'],
        promise: ['huangshan_trip', 'qiandao_lake', 'wangchen_pavilion'],
        jeju_first: ['shanghai_departure'],
        barbie_summer: ['nanhu_boat'],
        snow_and_family: ['hengdian_family'],
        hangzhou_wedding: ['wedding_mv'],
        summer_before_wedding: ['concert', 'xian_terracotta'],
      };
      for (const [oldId, rights] of Object.entries(legacyMemoryRights)) {
        if (life.unlockedMemoryIds.includes(oldId)) for (const id of rights) {
          if (!life.unlockedMemoryIds.includes(id)) life.unlockedMemoryIds.push(id);
        }
      }
    }
    const rawWarehouse: unknown = parsed.play?.warehouse;
    const legacyWarehouse = Array.isArray(rawWarehouse) ? rawWarehouse.filter((item): item is import('../core/types').ItemInstance => !!item && typeof item === 'object' && typeof item.uid === 'string' && typeof item.definitionId === 'string') : [];
    if (rawWarehouse !== undefined && (!Array.isArray(rawWarehouse) || legacyWarehouse.length !== rawWarehouse.length)) repaired = true;
    const legacyItems = [...boardCells.flatMap((c) => c.item ? [c.item] : []), ...overflow, ...legacyWarehouse];
    const known = version < 6 ? legacyItems.map((item) => item.definitionId) : [];
    const strings = (v: unknown): string[] => Array.isArray(v) ? Array.from(new Set(v.filter((x): x is string => typeof x === 'string'))) : [];
    const inbox = Array.isArray(parsed.rewardInbox) ? parsed.rewardInbox.filter((i) => i && typeof i.uid === 'string' && typeof i.definitionId === 'string') : [];
    const data: SaveData = {
      version: this.options.version,
      savedAt:
        typeof parsed.savedAt === 'number' ? parsed.savedAt : this.options.clock.now(),
      player,
      board: boardCells,
      boardSize: defaults.boardSize ? { ...defaults.boardSize } : undefined,
      legacyBoardEntitlement: version < 6 || parsed.legacyBoardEntitlement === true,
      retainedOpenCellIndices: Array.from(retainedOpenCellIndices).sort((a, b) => a - b),
      rewardInbox: [...overflow, ...inbox],
      discoveredItemIds: Array.from(new Set([...strings(parsed.discoveredItemIds), ...known])),
      claimedDiscoveryIds: Array.from(new Set([...strings(parsed.claimedDiscoveryIds), ...known])),
      generatorCharges: this.mergeGeneratorCharges(parsed.generatorCharges),
      generatorInventory: this.mergeGeneratorInventory(parsed.generatorInventory),
      generatorCooldowns: this.mergeGeneratorCooldowns(parsed.generatorCooldowns),
      generatorBoard: this.mergeGeneratorBoard(parsed.generatorBoard),
      claimedCollectionIds,
      orderRefreshAt: Array.isArray(parsed.orderRefreshAt) ? parsed.orderRefreshAt.map((v) => typeof v === 'number' && Number.isFinite(v) ? v : null) : [],
      dailyTasks: this.mergeDailyTasks(parsed.dailyTasks),
      weeklyChallenge: this.mergeWeeklyChallenge(parsed.weeklyChallenge),
      journal: normalizeJournal(parsed.journal),
      checkIn: { lastClaimDay: typeof parsed.checkIn?.lastClaimDay === 'number' && Number.isFinite(parsed.checkIn.lastClaimDay) ? parsed.checkIn.lastClaimDay : null, claims: Math.max(0, Math.floor(num(parsed.checkIn?.claims, 0))) },
      activeOrders: activeOrders.length > 0 ? activeOrders : defaults.activeOrders,
      tutorial,
      recentOrderIds: Array.isArray(parsed.recentOrderIds)
        ? parsed.recentOrderIds.filter((x): x is string => typeof x === 'string')
        : [],
      life,
      preferences: this.mergePreferences(parsed.preferences, defaults.preferences),
      play: this.mergePlay(parsed.play, defaults.play, boardCells, version),
    };

    const maxSlots = this.options.backpack?.maxSlots ?? 36;
    if (data.play.warehouse.length > maxSlots) {
      data.rewardInbox.push(...data.play.warehouse.splice(maxSlots));
      repaired = true;
    }
    data.play.warehouseCapacity = Math.max(data.play.warehouse.length, data.play.warehouseCapacity ?? this.options.backpack?.initialSlots ?? 6);

    return { data, repaired };
  }

  private mergePlayer(
    raw: unknown,
    fallback: PlayerState,
    version: number,
    collectionBonus: number,
  ): PlayerState {
    if (!raw || typeof raw !== 'object') return { ...fallback };
    const p = raw as Partial<PlayerState>;
    const progression = this.options.progression;
    const formerCap = 18;
    let level = Math.max(1, Math.min(this.levelCap, Math.floor(num(p.level, fallback.level))));
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
    if (progression && level >= formerCap) level = Math.max(level, getLevelForXp(progression, xp));
    const oldMax = Math.max(1, num(p.maxEnergy, fallback.maxEnergy));
    const oldEnergy = Math.max(0, num(p.energy, fallback.energy));
    const baseCap = this.options.energyCaps?.[Math.min(this.options.energyCaps.length - 1, level - 1)] ?? fallback.maxEnergy;
    const maxEnergy = Math.min(this.options.collection?.maxEnergyCap ?? Number.MAX_SAFE_INTEGER, baseCap + collectionBonus);
    const energy = Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, maxEnergy + oldEnergy - oldMax));
    return {
      level,
      xp,
      coins: Math.max(0, num(p.coins, fallback.coins)),
      diamonds: Math.max(0, num(p.diamonds, 0)),
      hearts: num(p.hearts, fallback.hearts),
      energy,
      maxEnergy,
      lastEnergyAt: num(p.lastEnergyAt, fallback.lastEnergyAt),
      unlockedChainIds: Array.isArray(p.unlockedChainIds)
        ? p.unlockedChainIds.filter((x): x is string => typeof x === 'string')
        : [...fallback.unlockedChainIds],
    };
  }

  private sourceBoardColumns(raw: unknown, size: SaveData['boardSize']): number {
    if (!Array.isArray(raw)) return 0;
    if (size && typeof size === 'object' && Number.isSafeInteger(size.rows) && Number.isSafeInteger(size.columns)
      && size.rows > 0 && size.columns > 0 && size.rows * size.columns === raw.length) return size.columns;
    if (raw.length === 81) return 9;
    if (raw.length === 63) return 7;
    if (raw.length === 48 || raw.length === 42) return 6;
    return 0;
  }

  private mergeBoard(raw: unknown, fallback: BoardCellState[], columns: number, size: SaveData['boardSize'], overflow: import('../core/types').ItemInstance[]): BoardCellState[] | null {
    if (!Array.isArray(raw)) return fallback.map((c) => ({ ...c, item: c.item ? { ...c.item } : undefined }));
    const oldWidth = this.sourceBoardColumns(raw, size) || (raw.length === fallback.length ? columns : 0);
    if (!oldWidth) return null;
    const cells: BoardCellState[] = fallback.map((c) => ({ index: c.index }));
    for (let i = 0; i < raw.length; i += 1) {
      const cell = raw[i] as Partial<BoardCellState> | null;
      if (!cell || typeof cell !== 'object') return null;
      if (!cell.item) continue;
      if (typeof cell.item.uid !== 'string' || typeof cell.item.definitionId !== 'string') return null;
      const item = { ...cell.item, uid: cell.item.uid, definitionId: cell.item.definitionId };
      const row = Math.floor(i / oldWidth), column = i % oldWidth;
      if (row < fallback.length / columns && column < columns) cells[row * columns + column].item = item;
      else overflow.push(item);
    }
    return cells;
  }

  private mergeWeeklyChallenge(raw: unknown): SaveData['weeklyChallenge'] {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const data = raw as NonNullable<SaveData['weeklyChallenge']>;
    if (!Number.isSafeInteger(data.week) || data.week < 0) return undefined;
    const count = (value: number): number => Number.isSafeInteger(value) && value >= 0 ? value : 0;
    return {
      week: data.week, orders: count(data.orders), challengeOrders: count(data.challengeOrders),
      advancedMerges: count(data.advancedMerges), completedWeeks: count(data.completedWeeks), claimed: data.claimed === true,
      orderDays: Array.isArray(data.orderDays)
        ? Array.from(new Set(data.orderDays.filter(day => Number.isInteger(day) && day >= 0 && day < 7))) : [],
      pendingRewardWeeks: Array.isArray(data.pendingRewardWeeks)
        ? Array.from(new Set(data.pendingRewardWeeks.filter(week => Number.isSafeInteger(week) && week >= 0 && week < data.week))) : [],
    };
  }

  private mergeDailyTasks(raw: unknown): SaveData['dailyTasks'] {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const d = raw as NonNullable<SaveData['dailyTasks']>;
    if (!Number.isSafeInteger(d.day) || typeof d.targetItemId !== 'string' || !d.progress || typeof d.progress !== 'object' || Array.isArray(d.progress)) return undefined;
    const progress: Record<string, number> = Object.create(null) as Record<string, number>;
    for (const [key, value] of Object.entries(d.progress)) if (/^[a-z][a-z0-9_]*$/.test(key) && Number.isSafeInteger(value) && value >= 0) progress[key] = value;
    return { day: d.day, targetItemId: d.targetItemId, progress, claimedIds: Array.isArray(d.claimedIds) ? Array.from(new Set(d.claimedIds.filter((id): id is string => typeof id === 'string'))) : [] };
  }

  private mergeGeneratorCooldowns(raw: unknown): Record<string, import('../core/types').GeneratorCooldownState> {
    const result: Record<string, import('../core/types').GeneratorCooldownState> = Object.create(null) as Record<string, import('../core/types').GeneratorCooldownState>;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result;
    for (const [id, value] of Object.entries(raw)) {
      if (!/^[a-z][a-z0-9_]*$/.test(id) || !value || typeof value !== 'object' || Array.isArray(value)) continue;
      const state = value as Partial<import('../core/types').GeneratorCooldownState>;
      if (Number.isSafeInteger(state.streak) && (state.streak ?? -1) >= 0 && (state.cooldownStartedAt === null || (typeof state.cooldownStartedAt === 'number' && Number.isFinite(state.cooldownStartedAt)))) result[id] = { streak: state.streak!, cooldownStartedAt: state.cooldownStartedAt! };
    }
    return result;
  }

  private mergeGeneratorBoard(raw: SaveData['generatorBoard']): SaveData['generatorBoard'] {
    if (!raw || typeof raw !== 'object' || raw.ready !== true) return undefined;
    const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-z][a-z0-9_]*$/.test(value);
    const seen = new Set<string>();
    const rewards = (Array.isArray(raw.rewards) ? raw.rewards : []).filter(r => r && typeof r === 'object' && validId(r.id) && validId(r.generatorId)
      && Number.isSafeInteger(r.level) && r.level >= 1 && r.level <= MAX_GENERATOR_TIER && Number.isSafeInteger(r.count) && r.count > 0
      && ['legacy', 'unlock', 'level_reward', 'wish_reward', 'chapter_reward'].includes(r.source) && !seen.has(r.id) && !!seen.add(r.id));
    return { ready: true, entitlements: Array.isArray(raw.entitlements) ? Array.from(new Set(raw.entitlements.filter(validId))) : [],
      grantedSourceIds:Array.isArray(raw.grantedSourceIds)?Array.from(new Set(raw.grantedSourceIds.filter(validId))):[],
      rewards: rewards.map(r => ({ id: r.id, generatorId: r.generatorId, level: r.level, count: r.count, source: r.source,
        ...(r.state && typeof r.state === 'object' ? { state: { ...r.state } } : {}) })) };
  }

  private mergeGeneratorInventory(raw: unknown): Record<string, number[]> {
    const result: Record<string, number[]> = Object.create(null) as Record<string, number[]>;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result;
    for (const [id, value] of Object.entries(raw)) {
      if (!/^[a-z][a-z0-9_]*$/.test(id) || !Array.isArray(value)) continue;
      const counts = Array.from({ length: MAX_GENERATOR_TIER }, (_, index) => Number.isSafeInteger(value[index]) && value[index] >= 0 ? value[index] as number : 0);
      if (counts.some((count) => count > 0)) result[id] = counts;
    }
    return result;
  }

  private mergeGeneratorCharges(raw: unknown): Record<string, import('../core/types').GeneratorChargeState> {
    const result: Record<string, import('../core/types').GeneratorChargeState> = Object.create(null) as Record<string, import('../core/types').GeneratorChargeState>;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result;
    for (const [id, value] of Object.entries(raw)) {
      if (!/^[a-z][a-z0-9_]*$/.test(id) || !value || typeof value !== 'object' || Array.isArray(value)) continue;
      const state = value as Partial<import('../core/types').GeneratorChargeState>;
      if (typeof state.charges === 'number' && Number.isSafeInteger(state.charges) && state.charges >= 0 && typeof state.lastRecoveryAt === 'number' && Number.isFinite(state.lastRecoveryAt)) result[id] = {
        charges: state.charges, lastRecoveryAt: state.lastRecoveryAt,
        ...(typeof state.capacity === 'number' && Number.isSafeInteger(state.capacity) && state.capacity > 0 ? { capacity: state.capacity } : {}),
      };
    }
    return result;
  }

  private mergePreferences(raw: unknown, fallback: GamePreferences): GamePreferences {
    if (!raw || typeof raw !== 'object') return { ...fallback };
    const value = raw as Partial<GamePreferences>;
    return {
      soundEnabled: typeof value.soundEnabled === 'boolean' ? value.soundEnabled : fallback.soundEnabled,
      vibrationEnabled: typeof value.vibrationEnabled === 'boolean' ? value.vibrationEnabled : fallback.vibrationEnabled,
    };
  }

  private mergePlay(raw: unknown, fallback: PlayState, board: BoardCellState[], version: number): PlayState {
    const p = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Partial<PlayState> : {};
    const used = new Set(board.flatMap((cell) => cell.item ? [cell.item.uid] : []));
    const warehouse = (Array.isArray(p.warehouse) ? p.warehouse : []).filter((item) => {
      if (!item || typeof item.uid !== 'string' || typeof item.definitionId !== 'string' || used.has(item.uid)) return false;
      used.add(item.uid); return true;
    }).map((item) => ({ ...item, uid: item.uid, definitionId: item.definitionId }));
    const strings = (value: unknown): string[] => Array.isArray(value)
      ? Array.from(new Set(value.filter((v): v is string => typeof v === 'string'))) : [];
    const puzzle = (value: Partial<PuzzleProgress>): PuzzleProgress => ({
      found: strings(value.found),
      selected: strings(value.selected),
      rotations: Array.isArray(value.rotations) && value.rotations.every((r) => Number.isInteger(r) && r >= 0 && r < 4) ? [...value.rotations] : [],
      code: typeof value.code === 'string' && /^\d{0,16}$/.test(value.code) ? value.code : '',
      hints: Math.max(0, Math.floor(num(value.hints, 0))),
      outcome: value.outcome === 'solved' || value.outcome === 'skipped' ? value.outcome : 'playing',
    });
    const chapters: Record<string, ChapterProgress> = Object.create(null) as Record<string, ChapterProgress>;
    if (p.chapters && typeof p.chapters === 'object') for (const [id, value] of Object.entries(p.chapters)) {
      if (!value || typeof value !== 'object' || !/^[a-z][a-z0-9_]*$/.test(id)) continue;
      chapters[id] = {
        ...puzzle(value),
        step: Math.max(0, Math.floor(num(value.step, 0))),
        claimed: value.claimed === true,
      };
    }
    // Optional v3 field: old saves simply start without any practice progress.
    const replays: Record<string, ReplayProgress> = Object.create(null) as Record<string, ReplayProgress>;
    if (p.replays && typeof p.replays === 'object' && !Array.isArray(p.replays)) {
      for (const [id, value] of Object.entries(p.replays)) {
        if (!value || typeof value !== 'object' || Array.isArray(value) || !/^[a-z][a-z0-9_]*$/.test(id)) continue;
        const replay = value as Partial<PuzzleProgress> & { variantId?: unknown };
        const variantId = typeof replay.variantId === 'string' && /^[a-z][a-z0-9_]*$/.test(replay.variantId)
          ? replay.variantId : 'classic';
        replays[id] = { ...puzzle(replay), variantId };
      }
    }
    const nonNegativeInt = (value: unknown): number =>
      typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    const replayStats: Record<string, ReplayStats> = Object.create(null) as Record<string, ReplayStats>;
    if (p.replayStats && typeof p.replayStats === 'object' && !Array.isArray(p.replayStats)) {
      for (const [id, value] of Object.entries(p.replayStats)) {
        if (!value || typeof value !== 'object' || Array.isArray(value) || !/^[a-z][a-z0-9_]*$/.test(id)) continue;
        const stats = value as Partial<ReplayStats>;
        const solved = nonNegativeInt(stats.solved);
        const skipped = nonNegativeInt(stats.skipped);
        const best = typeof stats.bestSolvedHints === 'number' && Number.isSafeInteger(stats.bestSolvedHints)
          && stats.bestSolvedHints >= 0 ? stats.bestSolvedHints : null;
        const activeRun = replays[id]?.outcome === 'playing' ? 1 : 0;
        replayStats[id] = {
          started: Math.max(nonNegativeInt(stats.started), solved + skipped + activeRun),
          solved,
          skipped,
          totalHints: nonNegativeInt(stats.totalHints),
          bestSolvedHints: solved > 0 ? best : null,
          legacyHistoryIncomplete: stats.legacyHistoryIncomplete === true || version < 5,
        };
      }
    }
    // v4 retained only the latest run. Preserve its known result but do not claim
    // that overwritten historical runs can be reconstructed.
    for (const [id, replay] of Object.entries(replays)) {
      if (replayStats[id]) continue;
      const solved = replay.outcome === 'solved' ? 1 : 0;
      const skipped = replay.outcome === 'skipped' ? 1 : 0;
      const finished = solved + skipped > 0;
      replayStats[id] = {
        started: 1,
        solved,
        skipped,
        totalHints: finished ? replay.hints : 0,
        bestSolvedHints: solved ? replay.hints : null,
        legacyHistoryIncomplete: true,
      };
    }
    const rawDate = p.smallDate && typeof p.smallDate === 'object' && !Array.isArray(p.smallDate)
      ? p.smallDate as Partial<SmallDateProgress>
      : {};
    const smallDate: SmallDateProgress = {
      currentId: typeof rawDate.currentId === 'string' && /^[a-z][a-z0-9_]*$/.test(rawDate.currentId) ? rawDate.currentId : '',
      rotation: Math.max(0, Math.floor(num(rawDate.rotation, fallback.smallDate?.rotation ?? 0))),
      completed: Math.max(0, Math.floor(num(rawDate.completed, fallback.smallDate?.completed ?? 0))),
    };
    return {
      warehouse,
      warehouseCapacity: Math.max(this.options.backpack?.initialSlots ?? fallback.warehouseCapacity ?? 6,
        Math.min(this.options.backpack?.maxSlots ?? 36, Number.isSafeInteger(p.warehouseCapacity) ? p.warehouseCapacity! : 0)),
      scissors: Math.max(0, Math.floor(num(p.scissors, fallback.scissors))),
      chapters,
      replays,
      replayStats,
      smallDate,
    };
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
      ? Array.from(new Set(state.claimedLevelRewards.filter((x): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 2
        && x <= this.levelCap)))
      : [];
    return {
      furniturePositions: state.furniturePositions && typeof state.furniturePositions === 'object' && !Array.isArray(state.furniturePositions)
        ? Object.fromEntries(Object.entries(state.furniturePositions)
          .filter(([, p]) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)
          .map(([id, p]) => [id, {
            x: p.x, y: p.y,
            scale: typeof p.scale === 'number' && Number.isFinite(p.scale) && p.scale >= 0.5 && p.scale <= 1.8 ? p.scale : 1,
            rotation: typeof p.rotation === 'number' && Number.isFinite(p.rotation) && p.rotation >= -180 && p.rotation <= 180 ? p.rotation : 0,
            flipped: typeof p.flipped === 'boolean' ? p.flipped : false,
          }])) : {},
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
      ...(Array.isArray(t.firstUseHints) ? { firstUseHints: Array.from(new Set(t.firstUseHints.filter((hint) => ['backpack','scissors','chest'].includes(hint)))) } : {}),
    };
  }

  private backupCorrupt(raw: string): boolean {
    try {
      this.options.storage.setItem(`${this.options.saveKey}:backup`, raw);
      return true;
    } catch {
      return false;
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
    board[columns].item = { uid: 'start_c1d', definitionId: 'coffee_01' };
  }

  const player: PlayerState = {
    level: 1,
    xp: 0,
    coins: 0,
    diamonds: 0,
    hearts: 0,
    energy: config.energy.initialEnergy,
    maxEnergy: config.energy.maxEnergy,
    lastEnergyAt: savedAt,
    unlockedChainIds: ['coffee'],
  };

  return {
    version: config.saveVersion,
    savedAt,
    preferences: { soundEnabled: true, vibrationEnabled: true },
    player,
    play: {
      warehouse: [],
      warehouseCapacity: config.toolbox.warehouseSlots,
      scissors: config.toolbox.startingScissors,
      chapters: {},
      replays: {},
      replayStats: {},
      smallDate: { currentId: '', rotation: 0, completed: 0 },
    },
    board,
    boardSize: { rows, columns },
    legacyBoardEntitlement: false,
    retainedOpenCellIndices: [],
    rewardInbox: [],
    discoveredItemIds: ['coffee_01'],
    claimedDiscoveryIds: [],
    checkIn: { lastClaimDay: null, claims: 0 },
    generatorCharges: {},
    generatorInventory: {},
    generatorCooldowns: {},
    claimedCollectionIds: [],
    orderRefreshAt: [],
    activeOrders: [
      {
        uid: 'order_start_1',
        templateId: 'order_tutorial_coffee',
        requirements: [{ itemId: 'coffee_02', count: 1 }],
        rewardCoins: 3,
        rewardXp: 10,
        rewardHearts: 1,
      },
      {
        uid: 'order_start_2',
        templateId: 'order_coffee_pair',
        requirements: [{ itemId: 'coffee_01', count: 1 }],
        rewardCoins: 5,
        rewardXp: 14,
        rewardHearts: 5,
      },
      {
        uid: 'order_start_3',
        templateId: 'order_coffee_cup',
        requirements: [{ itemId: 'coffee_03', count: 1 }],
        rewardCoins: 5,
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
    recentOrderIds: ['order_tutorial_coffee', 'order_coffee_pair', 'order_coffee_cup'],
    life: {
      furniturePositions: {},
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
