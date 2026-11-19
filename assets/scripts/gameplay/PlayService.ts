import type {
  AdventureChapter,
  ChapterAvailability,
  ChapterProgress,
  JourneyProgress,
  PlayResult,
  PlayState,
  PuzzleDefinition,
  PuzzleDefinitionView,
  PuzzleProgress,
  ReplayProgress,
  ReplayStats,
  ReplaySummary,
  SmallDateDefinition,
} from '../core/play/types';
import {
  circuitState,
  createChapterProgress,
  createReplayProgress,
  createReplayStats,
  createSmallDateProgress,
} from '../core/play/types';
import { cloneBoard, cloneItem } from '../core/board/board';
import type { ConfigBundle } from '../config/ConfigRepository';
import type { GameEventBus } from '../events/GameEventBus';
import type { IdGenerator } from '../infrastructure/IdService';
import type { BoardService } from './BoardService';
import type { ProgressionService } from './ProgressionService';
import type { EnergyService } from './EnergyService';
import type { LifeService } from './LifeService';

export type SmallDateOrderView = {
  template: SmallDateDefinition;
  token: string;
  rotation: number;
  completed: number;
  requirements: ReturnType<BoardService['getOrderProgress']>['requirements'];
  ready: boolean;
};

/** Persistent story orders, free puzzle replays, repeatable small dates and reversible inventory tools. */
export class PlayService {
  private readonly data: PlayState;
  private deliveringSmallDate = false;
  constructor(state: PlayState, private readonly bundle: ConfigBundle, private readonly board: BoardService,
    private readonly ids: IdGenerator, private readonly bus: GameEventBus, private readonly progression: ProgressionService,
    private readonly energy: EnergyService, private readonly life: LifeService,
    private readonly projectItem: (id: string) => string = (id) => id) {
    const loaded = JSON.parse(JSON.stringify(state)) as Partial<PlayState>;
    this.data = {
      warehouse: Array.isArray(loaded.warehouse) ? loaded.warehouse : [],
      warehouseCapacity: Math.max(bundle.game.toolbox.warehouseSlots, Math.min(bundle.game.toolbox.backpackExpansion.maxSlots,
        Number.isSafeInteger(loaded.warehouseCapacity) ? loaded.warehouseCapacity! : 0)),
      scissors: typeof loaded.scissors === 'number' ? loaded.scissors : bundle.game.toolbox.startingScissors,
      chapters: loaded.chapters && typeof loaded.chapters === 'object' ? loaded.chapters : {},
      replays: loaded.replays && typeof loaded.replays === 'object' ? loaded.replays : {},
      replayStats: loaded.replayStats && typeof loaded.replayStats === 'object' ? loaded.replayStats : {},
      smallDate: { ...createSmallDateProgress(), ...(loaded.smallDate ?? {}) },
    };
    for (const chapter of bundle.adventures) {
      const p = this.data.chapters[chapter.id];
      if (p) {
        p.step = Math.min(chapter.steps.length, Math.max(0, p.step));
        p.hints = Math.min(chapter.hints.length, Math.max(0, p.hints));
        this.normalizePuzzle(chapter.puzzle, p);
        if (p.claimed) { p.step = chapter.steps.length; if (p.outcome === 'playing') p.outcome = 'solved'; }
        else if (p.step < chapter.steps.length) p.outcome = 'playing';
        // Material delivery is retired; unfinished legacy preparation moves to
        // the puzzle, but never becomes a solved/claimable outcome by migration.
        p.step = chapter.steps.length;
      }
      const replay = this.data.replays[chapter.id];
      if (replay && p?.claimed) {
        const definition = this.variantDefinition(chapter, replay.variantId);
        if (!definition) {
          replay.variantId = 'classic';
          replay.found = [];
          replay.selected = [];
          replay.rotations = [];
          replay.code = '';
        }
        const active = this.variantDefinition(chapter, replay.variantId) ?? this.classicDefinition(chapter);
        replay.hints = Math.max(0, Math.min(active.hints.length, replay.hints));
        this.normalizePuzzle(active.puzzle, replay);
        if (!this.data.replayStats[chapter.id]) {
          this.data.replayStats[chapter.id] = {
            ...createReplayStats(), started: 1,
            solved: replay.outcome === 'solved' ? 1 : 0,
            skipped: replay.outcome === 'skipped' ? 1 : 0,
            totalHints: replay.outcome === 'playing' ? 0 : replay.hints,
            bestSolvedHints: replay.outcome === 'solved' ? replay.hints : null,
            legacyHistoryIncomplete: true,
          };
        }
      } else if (replay) {
        delete this.data.replays[chapter.id];
      }
    }
    this.ensureSmallDate();
  }
  get state(): PlayState { return JSON.parse(JSON.stringify(this.data)) as PlayState; }

  getStoredGenerator(generatorId: string): { uid: string; level: number } | undefined {
    let best: { uid: string; level: number } | undefined;
    for (const item of this.data.warehouse) {
      const definition = this.bundle.catalog.get(item.definitionId);
      if (definition?.generator?.id === generatorId && (!best || definition.level > best.level)) {
        best = { uid: item.uid, level: definition.level };
      }
    }
    return best;
  }
  progress(id: string): ChapterProgress {
    const chapter = this.bundle.adventures.find((entry) => entry.id === id);
    return { ...createChapterProgress(), ...this.state.chapters[id], ...(chapter ? { step: chapter.steps.length } : {}) };
  }
  hasReplay(id: string): boolean { return !!this.data.replays[id]; }
  replayProgress(id: string): ReplayProgress | undefined {
    const replay = this.data.replays[id];
    return replay ? JSON.parse(JSON.stringify(replay)) as ReplayProgress : undefined;
  }
  replaySummary(id: string): ReplaySummary {
    const stats = this.data.replayStats[id] ?? createReplayStats();
    return { ...stats };
  }
  /** Renderers read whichever independent progress is active: practice first, otherwise the chapter. */
  puzzleProgress(id: string): PuzzleProgress {
    return this.replayProgress(id) ?? this.progress(id);
  }
  puzzleDefinition(id: string): PuzzleDefinitionView | undefined {
    const chapter = this.bundle.adventures.find((entry) => entry.id === id);
    if (!chapter) return undefined;
    return JSON.parse(JSON.stringify(this.activeDefinition(chapter, id))) as PuzzleDefinitionView;
  }
  private activeDefinition(chapter: AdventureChapter, id: string): PuzzleDefinitionView {
    const replay = this.data.replays[id];
    return (replay && this.variantDefinition(chapter, replay.variantId)) ?? this.classicDefinition(chapter);
  }
  chapterAvailability(id: string): ChapterAvailability | undefined {
    return this.bundle.adventures.some((chapter) => chapter.id === id) ? { available: true } : undefined;
  }
  journeyProgress(): JourneyProgress {
    const pending = this.bundle.adventures.filter((chapter) => !this.state.chapters[chapter.id]?.claimed);
    const nextChapter = pending[0] ?? null;
    return {
      completed: this.bundle.adventures.length - pending.length,
      total: this.bundle.adventures.length,
      nextChapter,
      nextProgress: nextChapter ? this.progress(nextChapter.id) : null,
      availability: nextChapter ? this.chapterAvailability(nextChapter.id) ?? null : null,
    };
  }
  isAvailable(id: string): boolean { return this.chapterAvailability(id)?.available ?? false; }
  private current(id: string): { chapter: AdventureChapter; progress: ChapterProgress } | undefined {
    const chapter = this.bundle.adventures.find((c) => c.id === id);
    if (!chapter || !this.isAvailable(id)) return;
    const progress = this.data.chapters[id] ?? (this.data.chapters[id] = createChapterProgress());
    progress.step = chapter.steps.length;
    return { chapter, progress };
  }
  private classicDefinition(chapter: AdventureChapter): PuzzleDefinitionView {
    return { puzzle: chapter.puzzle, instruction: chapter.instruction, hints: chapter.hints, variantId: 'classic' };
  }
  private variantDefinition(chapter: AdventureChapter, variantId: string): PuzzleDefinitionView | undefined {
    if (variantId === 'classic') return this.classicDefinition(chapter);
    const variant = chapter.replayVariants?.find((candidate) => candidate.id === variantId);
    return variant ? { puzzle: variant.puzzle, instruction: variant.instruction, hints: variant.hints, variantId: variant.id } : undefined;
  }
  private normalizePuzzle(puzzle: PuzzleDefinition, progress: PuzzleProgress): void {
    if (puzzle.kind === 'find') {
      progress.found = progress.found.filter((id) => puzzle.hotspots.some((hotspot) => hotspot.id === id));
      progress.selected = [];
      progress.rotations = [];
      if (progress.code.length > puzzle.solution.length || !Array.from(progress.code).every((digit) => digit >= '0' && digit <= '9')) progress.code = '';
    } else if (puzzle.kind === 'sequence') {
      progress.found = [];
      progress.selected = progress.selected.filter((id) => puzzle.tiles.some((tile) => tile.id === id));
      progress.rotations = [];
      progress.code = '';
    } else {
      progress.found = [];
      progress.selected = [];
      progress.code = '';
      if (progress.rotations.length !== puzzle.ports.length
        || !progress.rotations.every((rotation) => Number.isInteger(rotation) && rotation >= 0 && rotation < 4)) {
        progress.rotations = [];
      }
    }
  }
  private changed(reason: 'warehouse' | 'scissors' | 'chapter' | 'reward'): PlayResult {
    this.bus.emit('PLAY_CHANGED', { reason }); return { ok: true };
  }
  store(index: number): PlayResult {
    const item = this.board.getBoard().cells[index]?.item;
    if (!item || this.board.getBoard().cells[index]?.locked) return { ok: false, reason: 'INVALID' };
    if (this.data.warehouse.length >= this.warehouseCapacity) return { ok: false, reason: 'WAREHOUSE_FULL' };
    const next = cloneBoard(this.board.getBoard());
    next.cells[index].item = undefined;
    this.data.warehouse.push(cloneItem(item));
    this.board.replaceBoard(next, 'tool');
    return this.changed('warehouse');
  }
  withdraw(uid: string): PlayResult {
    const at = this.data.warehouse.findIndex((item) => item.uid === uid);
    if (at < 0) return { ok: false, reason: 'INVALID' };
    const next = cloneBoard(this.board.getBoard());
    const empty = next.cells.find((cell) => !cell.locked && !cell.item);
    if (!empty) return { ok: false, reason: 'BOARD_FULL' };
    empty.item = cloneItem(this.data.warehouse[at]);
    this.data.warehouse.splice(at, 1);
    this.board.replaceBoard(next, 'tool');
    return this.changed('warehouse');
  }
  get warehouseCapacity(): number { return this.data.warehouseCapacity ?? this.bundle.game.toolbox.warehouseSlots; }

  /** GameContext validates and charges the diamond quote before calling this. */
  expandWarehouse(expectedCapacity: number): PlayResult {
    if (expectedCapacity !== this.warehouseCapacity || this.warehouseCapacity >= this.bundle.game.toolbox.backpackExpansion.maxSlots) return { ok: false, reason: 'INVALID' };
    this.data.warehouseCapacity = this.warehouseCapacity + 1;
    return this.changed('warehouse');
  }
  takeScissors(): PlayResult {
    if (this.data.scissors <= 0) return { ok: false, reason: 'NO_SCISSORS' };
    if (this.board.isFull()) return { ok: false, reason: 'BOARD_FULL' };
    const result = this.board.spawn('scissors_01'); if (!result.ok) return result;
    this.data.scissors -= 1; return this.changed('scissors');
  }
  grantScissors(count: number): void { this.data.scissors += Math.max(0, Math.floor(count)); this.changed('scissors'); }
  split(index: number): PlayResult {
    const item = this.board.getBoard().cells[index]?.item;
    const previous = item && Array.from(this.bundle.catalog.values()).find((d) => d.nextItemId === item.definitionId);
    if (!item || !previous || this.bundle.catalog.get(item.definitionId)?.maxUses || this.bundle.catalog.get(item.definitionId)?.generator || this.board.getBoard().cells[index]?.locked) return { ok: false, reason: 'CANNOT_SPLIT' };
    if (this.data.scissors <= 0) return { ok: false, reason: 'NO_SCISSORS' };
    const next = cloneBoard(this.board.getBoard());
    const empty = next.cells.find((cell) => !cell.locked && !cell.item);
    if (!empty) return { ok: false, reason: 'BOARD_FULL' };
    const used = new Set([...next.cells.flatMap((c) => c.item ? [c.item.uid] : []), ...this.data.warehouse.map((i) => i.uid)]);
    let uid = this.ids.next();
    while (used.has(uid)) uid = this.ids.next();
    next.cells[index].item = { ...item, definitionId: previous.id };
    empty.item = { uid, definitionId: previous.id };
    this.data.scissors -= 1;
    this.board.replaceBoard(next, 'tool');
    return this.changed('scissors');
  }
  deliver(id: string): PlayResult {
    const current = this.current(id);
    if (!current) return { ok: false, reason: 'LOCKED' };
    const { chapter, progress } = current;
    if (progress.step >= chapter.steps.length) return { ok: false, reason: 'NOT_READY' };
    const locations = this.board.findItemsForRequirements(chapter.steps[progress.step].requirements);
    if (!locations) return { ok: false, reason: 'NOT_READY' };
    progress.step += 1;
    this.board.consumeItems(locations);
    this.life.record('orders');
    return this.changed('chapter');
  }
  private applyPuzzle(puzzle: PuzzleDefinition, progress: PuzzleProgress,
    action: 'find' | 'select' | 'rotate' | 'digit' | 'erase' | 'reset', value: string): boolean {
    if (action === 'find' && puzzle.kind === 'find' && puzzle.hotspots.some((h) => h.id === value)) {
      if (!progress.found.includes(value)) progress.found.push(value);
    } else if (action === 'select' && puzzle.kind === 'sequence' && puzzle.tiles.some((t) => t.id === value)) {
      const index = progress.selected.indexOf(value);
      if (index < 0) progress.selected.push(value); else progress.selected.splice(index);
    } else if (action === 'rotate' && puzzle.kind === 'circuit' && /^\d+$/.test(value) && Number(value) < puzzle.ports.length) {
      if (!progress.rotations.length) progress.rotations = [...puzzle.initial];
      const index = Number(value);
      progress.rotations[index] = (progress.rotations[index] + 1) % 4;
    } else if (action === 'digit' && puzzle.kind === 'find' && /^\d$/.test(value)) {
      if (progress.code.length < puzzle.solution.length) progress.code += value;
    } else if (action === 'erase') progress.code = progress.code.slice(0, -1);
    else if (action === 'reset') { progress.selected = []; progress.code = ''; progress.rotations = []; }
    else return false;
    return true;
  }
  act(id: string, action: 'find' | 'select' | 'rotate' | 'digit' | 'erase' | 'reset', value = ''): PlayResult {
    const current = this.current(id);
    if (!current) return { ok: false, reason: 'LOCKED' };
    const replay = this.data.replays[id];
    const progress = replay ?? current.progress;
    if (!replay && current.progress.step < current.chapter.steps.length) return { ok: false, reason: 'NOT_READY' };
    if (progress.outcome !== 'playing') return { ok: false, reason: 'NOT_READY' };
    const definition = this.activeDefinition(current.chapter, id);
    if (!this.applyPuzzle(definition.puzzle, progress, action, value)) return { ok: false, reason: 'INVALID' };
    return this.changed('chapter');
  }
  hint(id: string): PlayResult {
    const current = this.current(id);
    if (!current) return { ok: false, reason: 'LOCKED' };
    const replay = this.data.replays[id];
    const progress = replay ?? current.progress;
    if (!replay && current.progress.step < current.chapter.steps.length) return { ok: false, reason: 'LOCKED' };
    if (progress.outcome !== 'playing') return { ok: false, reason: 'NOT_READY' };
    progress.hints = Math.min(this.activeDefinition(current.chapter, id).hints.length, progress.hints + 1);
    return this.changed('chapter');
  }
  solve(id: string, skip = false): PlayResult {
    const current = this.current(id);
    if (!current) return { ok: false, reason: 'LOCKED' };
    const replay = this.data.replays[id];
    const progress = replay ?? current.progress;
    const { chapter } = current;
    if (!replay && current.progress.step < chapter.steps.length) return { ok: false, reason: 'NOT_READY' };
    if (progress.outcome !== 'playing') return { ok: false, reason: 'NOT_READY' };
    const puzzle = this.activeDefinition(chapter, id).puzzle;
    const correct = puzzle.kind === 'find'
      ? progress.found.length === puzzle.hotspots.length && progress.code === puzzle.solution
      : puzzle.kind === 'sequence' ? JSON.stringify(progress.selected) === JSON.stringify(puzzle.solution)
        : circuitState(puzzle, progress.rotations).solved;
    if (!skip && !correct) return { ok: false, reason: 'WRONG_ANSWER' };
    progress.outcome = skip ? 'skipped' : 'solved';
    if (replay) {
      const stats = this.replayStats(id);
      if (skip) stats.skipped += 1;
      else {
        stats.solved += 1;
        stats.bestSolvedHints = stats.bestSolvedHints === null
          ? progress.hints : Math.min(stats.bestSolvedHints, progress.hints);
      }
      stats.totalHints += progress.hints;
    }
    return this.changed('chapter');
  }
  circuit(id: string) {
    const definition = this.puzzleDefinition(id);
    return definition?.puzzle.kind === 'circuit'
      ? circuitState(definition.puzzle, this.puzzleProgress(id).rotations) : undefined;
  }
  private replayStats(id: string): ReplayStats {
    return this.data.replayStats[id] ?? (this.data.replayStats[id] = createReplayStats());
  }
  private beginReplay(chapter: AdventureChapter): void {
    const stats = this.replayStats(chapter.id);
    const variants: PuzzleDefinitionView[] = [
      this.classicDefinition(chapter),
      ...(chapter.replayVariants ?? []).map((variant) => ({
        puzzle: variant.puzzle,
        instruction: variant.instruction,
        hints: variant.hints,
        variantId: variant.id,
      })),
    ];
    const variant = variants[stats.started % variants.length];
    stats.started += 1;
    this.data.replays[chapter.id] = createReplayProgress(variant.variantId);
  }
  /** Start a free practice run, or resume the one already in progress. */
  startReplay(id: string): PlayResult {
    const chapter = this.bundle.adventures.find((c) => c.id === id);
    if (!chapter) return { ok: false, reason: 'LOCKED' };
    if (!this.progress(id).claimed) return { ok: false, reason: 'NOT_CLAIMED' };
    const existing = this.data.replays[id];
    if (!existing || existing.outcome !== 'playing') this.beginReplay(chapter);
    return this.changed('chapter');
  }
  /** Explicitly discard practice progress and begin a new counted run. */
  restartReplay(id: string): PlayResult {
    const chapter = this.bundle.adventures.find((c) => c.id === id);
    if (!chapter) return { ok: false, reason: 'LOCKED' };
    if (!this.progress(id).claimed) return { ok: false, reason: 'NOT_CLAIMED' };
    this.beginReplay(chapter);
    return this.changed('chapter');
  }
  claim(id: string): PlayResult {
    const current = this.current(id);
    if (!current) return { ok: false, reason: 'LOCKED' };
    const { chapter, progress } = current;
    if (progress.claimed) return { ok: false, reason: 'ALREADY_CLAIMED' };
    if (progress.outcome === 'playing' || progress.step < chapter.steps.length) return { ok: false, reason: 'NOT_READY' };
    progress.claimed = true;
    this.data.scissors += chapter.reward.scissors;
    this.progression.addCoins(chapter.reward.coins);
    this.progression.addHearts(chapter.reward.hearts);
    this.energy.add(chapter.reward.energy);
    this.life.grantMemory(chapter.memoryId);
    return this.changed('reward');
  }
  private smallDatePool(): SmallDateDefinition[] {
    const unlocked = new Set(this.progression.unlockedChains());
    return this.bundle.smallDates.filter((date) => this.progression.level >= date.minLevel
      && date.requirements.every((req) => {
        const definition = this.bundle.catalog.get(req.itemId);
        return !!definition && definition.level <= 3 && unlocked.has(definition.chainId);
      }));
  }
  /** Deterministic rotation that skips the theme just completed when another is available. */
  private nextSmallDateId(pool: readonly SmallDateDefinition[], rotation: number, avoidId: string): string {
    if (!pool.length) return '';
    const start = ((rotation % pool.length) + pool.length) % pool.length;
    for (let offset = 0; offset < pool.length; offset += 1) {
      const candidate = pool[(start + offset) % pool.length];
      if (pool.length === 1 || candidate.id !== avoidId) return candidate.id;
    }
    return pool[start].id;
  }
  private ensureSmallDate(): void {
    const pool = this.smallDatePool();
    if (!pool.some((date) => date.id === this.data.smallDate.currentId)) {
      this.data.smallDate.currentId = this.nextSmallDateId(pool, this.data.smallDate.rotation, '');
    }
  }
  smallDateOrder(): SmallDateOrderView | undefined {
    const original = this.bundle.smallDates.find((date) => date.id === this.data.smallDate.currentId);
    if (!original || !this.smallDatePool().some((date) => date.id === original.id)) return undefined;
    const counts = new Map<string, number>();
    for (const req of original.requirements) {
      const id = this.projectItem(req.itemId);
      counts.set(id, (counts.get(id) ?? 0) + req.count);
    }
    const template = { ...original, requirements: Array.from(counts.entries()).map(([itemId, count]) => ({ itemId, count })) };
    const progress = this.board.getOrderProgress(template);
    return {
      template,
      token: `${this.data.smallDate.currentId}:${this.data.smallDate.rotation}`,
      rotation: this.data.smallDate.rotation,
      completed: this.data.smallDate.completed,
      requirements: progress.requirements,
      ready: progress.ready,
    };
  }
  /** Bind delivery to the rendered order; a stale token never consumes, pays or rotates. */
  deliverSmallDate(expectedToken: string): PlayResult {
    if (this.deliveringSmallDate) return { ok: false, reason: 'STALE_DATE' };
    const order = this.smallDateOrder();
    if (!order) return { ok: false, reason: 'NO_DATE' };
    if (expectedToken !== order.token) return { ok: false, reason: 'STALE_DATE' };
    const locations = this.board.findItemsForRequirements(order.template.requirements);
    if (!locations) return { ok: false, reason: 'NOT_READY' };
    this.deliveringSmallDate = true;
    try {
      this.board.consumeItems(locations);
      this.progression.addCoins(order.template.rewardCoins);
      this.progression.addHearts(order.template.rewardHearts);
      this.progression.addXp(order.template.rewardXp);
      this.life.record('orders');
      this.data.smallDate.rotation += 1;
      this.data.smallDate.completed += 1;
      const pool = this.smallDatePool();
      this.data.smallDate.currentId = this.nextSmallDateId(pool, this.data.smallDate.rotation, order.template.id);
    } finally {
      this.deliveringSmallDate = false;
    }
    return this.changed('reward');
  }
}
