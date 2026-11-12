import type {
  AdventureChapter,
  ChapterProgress,
  PlayResult,
  PlayState,
  PuzzleProgress,
  ReplayProgress,
  SmallDateDefinition,
} from '../core/play/types';
import {
  circuitState,
  createChapterProgress,
  createReplayProgress,
  createSmallDateProgress,
} from '../core/play/types';
import { cloneBoard } from '../core/board/board';
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
    private readonly energy: EnergyService, private readonly life: LifeService) {
    const loaded = JSON.parse(JSON.stringify(state)) as Partial<PlayState>;
    this.data = {
      warehouse: Array.isArray(loaded.warehouse) ? loaded.warehouse : [],
      scissors: typeof loaded.scissors === 'number' ? loaded.scissors : bundle.game.toolbox.startingScissors,
      chapters: loaded.chapters && typeof loaded.chapters === 'object' ? loaded.chapters : {},
      replays: loaded.replays && typeof loaded.replays === 'object' ? loaded.replays : {},
      smallDate: { ...createSmallDateProgress(), ...(loaded.smallDate ?? {}) },
    };
    for (const chapter of bundle.adventures) {
      const p = this.data.chapters[chapter.id];
      if (p) {
        p.step = Math.min(chapter.steps.length, Math.max(0, p.step));
        p.hints = Math.min(chapter.hints.length, Math.max(0, p.hints));
        this.normalizePuzzle(chapter, p);
        if (p.claimed) { p.step = chapter.steps.length; if (p.outcome === 'playing') p.outcome = 'solved'; }
        else if (p.step < chapter.steps.length) p.outcome = 'playing';
      }
      const replay = this.data.replays[chapter.id];
      if (replay && p?.claimed) {
        replay.hints = Math.max(0, Math.min(chapter.hints.length, replay.hints));
        this.normalizePuzzle(chapter, replay);
      } else if (replay) {
        delete this.data.replays[chapter.id];
      }
    }
    this.ensureSmallDate();
  }
  get state(): PlayState { return JSON.parse(JSON.stringify(this.data)) as PlayState; }
  progress(id: string): ChapterProgress { return { ...createChapterProgress(), ...this.state.chapters[id] }; }
  hasReplay(id: string): boolean { return !!this.data.replays[id]; }
  replayProgress(id: string): ReplayProgress | undefined {
    const replay = this.data.replays[id];
    return replay ? JSON.parse(JSON.stringify(replay)) as ReplayProgress : undefined;
  }
  /** Renderers read whichever independent progress is active: practice first, otherwise the chapter. */
  puzzleProgress(id: string): PuzzleProgress {
    return this.replayProgress(id) ?? this.progress(id);
  }
  isAvailable(id: string): boolean {
    const i = this.bundle.adventures.findIndex((c) => c.id === id);
    return i >= 0 && this.progression.level >= this.bundle.adventures[i].unlockLevel
      && (i === 0 || this.progress(this.bundle.adventures[i - 1].id).claimed);
  }
  private current(id: string): { chapter: AdventureChapter; progress: ChapterProgress } | undefined {
    const chapter = this.bundle.adventures.find((c) => c.id === id);
    if (!chapter || !this.isAvailable(id)) return;
    const progress = this.data.chapters[id] ?? (this.data.chapters[id] = createChapterProgress());
    return { chapter, progress };
  }
  private normalizePuzzle(chapter: AdventureChapter, progress: PuzzleProgress): void {
    if (chapter.puzzle.kind === 'find') {
      progress.found = progress.found.filter((id) => chapter.puzzle.kind === 'find' && chapter.puzzle.hotspots.some((h) => h.id === id));
    } else if (chapter.puzzle.kind === 'sequence') {
      progress.selected = progress.selected.filter((id) => chapter.puzzle.kind === 'sequence' && chapter.puzzle.tiles.some((t) => t.id === id));
    } else if (progress.rotations.length !== chapter.puzzle.ports.length) {
      progress.rotations = [];
    }
  }
  private changed(reason: 'warehouse' | 'scissors' | 'chapter' | 'reward'): PlayResult {
    this.bus.emit('PLAY_CHANGED', { reason }); return { ok: true };
  }
  store(index: number): PlayResult {
    const item = this.board.getBoard().cells[index]?.item;
    if (!item) return { ok: false, reason: 'INVALID' };
    if (this.data.warehouse.length >= this.bundle.game.toolbox.warehouseSlots) return { ok: false, reason: 'WAREHOUSE_FULL' };
    const next = cloneBoard(this.board.getBoard());
    next.cells[index].item = undefined;
    this.data.warehouse.push({ ...item });
    this.board.replaceBoard(next, 'tool');
    return this.changed('warehouse');
  }
  withdraw(uid: string): PlayResult {
    const at = this.data.warehouse.findIndex((item) => item.uid === uid);
    if (at < 0) return { ok: false, reason: 'INVALID' };
    const next = cloneBoard(this.board.getBoard());
    const empty = next.cells.find((cell) => !cell.item);
    if (!empty) return { ok: false, reason: 'BOARD_FULL' };
    empty.item = { ...this.data.warehouse[at] };
    this.data.warehouse.splice(at, 1);
    this.board.replaceBoard(next, 'tool');
    return this.changed('warehouse');
  }
  split(index: number): PlayResult {
    const item = this.board.getBoard().cells[index]?.item;
    const previous = item && Array.from(this.bundle.catalog.values()).find((d) => d.nextItemId === item.definitionId);
    if (!item || !previous) return { ok: false, reason: 'CANNOT_SPLIT' };
    if (this.data.scissors <= 0) return { ok: false, reason: 'NO_SCISSORS' };
    const next = cloneBoard(this.board.getBoard());
    const empty = next.cells.find((cell) => !cell.item);
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
  private applyPuzzle(chapter: AdventureChapter, progress: PuzzleProgress,
    action: 'find' | 'select' | 'rotate' | 'digit' | 'erase' | 'reset', value: string): boolean {
    const puzzle = chapter.puzzle;
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
    if (!this.applyPuzzle(current.chapter, progress, action, value)) return { ok: false, reason: 'INVALID' };
    return this.changed('chapter');
  }
  hint(id: string): PlayResult {
    const current = this.current(id);
    if (!current) return { ok: false, reason: 'LOCKED' };
    const replay = this.data.replays[id];
    const progress = replay ?? current.progress;
    if (!replay && current.progress.step < current.chapter.steps.length) return { ok: false, reason: 'LOCKED' };
    if (progress.outcome !== 'playing') return { ok: false, reason: 'NOT_READY' };
    progress.hints = Math.min(current.chapter.hints.length, progress.hints + 1);
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
    const puzzle = chapter.puzzle;
    const correct = puzzle.kind === 'find'
      ? progress.found.length === puzzle.hotspots.length && progress.code === puzzle.solution
      : puzzle.kind === 'sequence' ? JSON.stringify(progress.selected) === JSON.stringify(puzzle.solution)
        : circuitState(puzzle, progress.rotations).solved;
    if (!skip && !correct) return { ok: false, reason: 'WRONG_ANSWER' };
    progress.outcome = skip ? 'skipped' : 'solved';
    return this.changed('chapter');
  }
  circuit(id: string) {
    const chapter = this.bundle.adventures.find((c) => c.id === id);
    return chapter?.puzzle.kind === 'circuit' ? circuitState(chapter.puzzle, this.puzzleProgress(id).rotations) : undefined;
  }
  /** Start a free practice run, or resume the one already in progress. */
  startReplay(id: string): PlayResult {
    const chapter = this.bundle.adventures.find((c) => c.id === id);
    if (!chapter) return { ok: false, reason: 'LOCKED' };
    if (!this.progress(id).claimed) return { ok: false, reason: 'NOT_CLAIMED' };
    const existing = this.data.replays[id];
    if (!existing || existing.outcome !== 'playing') this.data.replays[id] = createReplayProgress();
    return this.changed('chapter');
  }
  /** Explicitly discard practice progress and begin the same chapter again. */
  restartReplay(id: string): PlayResult {
    const chapter = this.bundle.adventures.find((c) => c.id === id);
    if (!chapter) return { ok: false, reason: 'LOCKED' };
    if (!this.progress(id).claimed) return { ok: false, reason: 'NOT_CLAIMED' };
    this.data.replays[id] = createReplayProgress();
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
    const template = this.bundle.smallDates.find((date) => date.id === this.data.smallDate.currentId);
    if (!template || !this.smallDatePool().some((date) => date.id === template.id)) return undefined;
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
