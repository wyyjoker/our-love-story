import type { ItemInstance, OrderRequirement } from '../types';

export type PlayResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'LOCKED'
        | 'NOT_READY'
        | 'ALREADY_CLAIMED'
        | 'NOT_CLAIMED'
        | 'NO_DATE'
        | 'STALE_DATE'
        | 'INVALID'
        | 'WAREHOUSE_FULL'
        | 'BOARD_FULL'
        | 'NO_SCISSORS'
        | 'CANNOT_SPLIT'
        | 'WRONG_ANSWER';
    };

/** Fields shared by the real chapter puzzle and an independent free replay. */
export type PuzzleProgress = {
  found: string[];
  selected: string[];
  rotations: number[];
  code: string;
  hints: number;
  outcome: 'playing' | 'solved' | 'skipped';
};
export type ChapterProgress = PuzzleProgress & {
  step: number;
  claimed: boolean;
};
export type ReplayProgress = PuzzleProgress;
export type SmallDateProgress = {
  currentId: string;
  rotation: number;
  completed: number;
};
export type PlayState = {
  warehouse: ItemInstance[];
  scissors: number;
  chapters: Record<string, ChapterProgress>;
  /** Free practice progress kept apart from the claimed chapter state. */
  replays: Record<string, ReplayProgress>;
  /** Current repeatable small-date order and its rotation counter. */
  smallDate: SmallDateProgress;
};
export type PuzzleDefinition =
  | { kind: 'find'; hotspots: Array<{ id: string; label: string; x: number; y: number; clue: string }>; solution: string }
  | { kind: 'sequence'; tiles: Array<{ id: string; label: string; clue: string }>; solution: string[] }
  | { kind: 'circuit'; columns: number; rows: number; ports: number[][]; initial: number[]; solution: number[]; start: number; end: number };
export type AdventureChapter = {
  id: string; memoryId: string; title: string; intro: string; unlockLevel: number;
  steps: Array<{ title: string; requirements: OrderRequirement[]; note: string }>;
  instruction: string; hints: string[]; puzzle: PuzzleDefinition;
  reward: { coins: number; hearts: number; energy: number; scissors: number };
  souvenir: { title: string; artItemId: string; room: 'living' | 'bedroom' | 'garden'; x: number; y: number };
};
/** A repeatable, low-cost date found in the independent small-date entry. */
export type SmallDateDefinition = {
  id: string;
  title: string;
  description: string;
  memoryId: string;
  minLevel: number;
  requirements: OrderRequirement[];
  rewardCoins: number;
  rewardXp: number;
  rewardHearts: number;
};

export function createChapterProgress(): ChapterProgress {
  return { step: 0, found: [], selected: [], rotations: [], code: '', hints: 0, outcome: 'playing', claimed: false };
}

export function createReplayProgress(): ReplayProgress {
  return { found: [], selected: [], rotations: [], code: '', hints: 0, outcome: 'playing' };
}

export function createSmallDateProgress(): SmallDateProgress {
  return { currentId: '', rotation: 0, completed: 0 };
}

/** Total level-1 items needed to craft one item at the given level. */
export function itemBaseCost(level: number): number {
  return level <= 1 ? 1 : 2 ** (level - 1);
}

/** Base-material cost used to keep small dates inexpensive. */
export function requirementsBaseCost(requirements: readonly OrderRequirement[], levelOf: (itemId: string) => number | undefined): number {
  let total = 0;
  for (const req of requirements) {
    const level = levelOf(req.itemId);
    if (!level) return Number.POSITIVE_INFINITY;
    total += itemBaseCost(level) * req.count;
  }
  return total;
}

/** Reciprocal connections only; ports are north/east/south/west = 0/1/2/3. */
export function circuitState(puzzle: Extract<PuzzleDefinition, { kind: 'circuit' }>, rotations: readonly number[]) {
  const ports = puzzle.ports.map((cell, i) => cell.map((p) => (p + (rotations[i] ?? puzzle.initial[i])) % 4));
  const lit: number[] = [];
  const queue = ports[puzzle.start]?.includes(3) ? [puzzle.start] : [];
  while (queue.length) {
    const index = queue.shift()!;
    if (lit.includes(index)) continue;
    lit.push(index);
    const row = Math.floor(index / puzzle.columns), column = index % puzzle.columns;
    for (const port of ports[index]) {
      const nr = row + [-1, 0, 1, 0][port], nc = column + [0, 1, 0, -1][port];
      if (nr < 0 || nc < 0 || nr >= puzzle.rows || nc >= puzzle.columns) continue;
      const next = nr * puzzle.columns + nc;
      if (ports[next].includes((port + 2) % 4) && !lit.includes(next)) queue.push(next);
    }
  }
  return { ports, lit, solved: lit.includes(puzzle.end) && ports[puzzle.end].includes(1) };
}
