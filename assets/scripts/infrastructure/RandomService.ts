export interface RandomService {
  /** [0, 1) */
  next(): number;
  /** Integer in [0, maxExclusive) */
  pickIndex(maxExclusive: number): number;
}

export class SystemRandomService implements RandomService {
  next(): number {
    return Math.random();
  }

  pickIndex(maxExclusive: number): number {
    if (maxExclusive <= 0) return 0;
    return Math.floor(this.next() * maxExclusive);
  }
}

/** Deterministic RNG for tests: fixed sequence or constant value. */
export class FixedRandomService implements RandomService {
  private cursor = 0;

  constructor(private readonly values: number[] = [0]) {}

  next(): number {
    const v = this.values[this.cursor % this.values.length] ?? 0;
    this.cursor += 1;
    return v;
  }

  pickIndex(maxExclusive: number): number {
    if (maxExclusive <= 0) return 0;
    return Math.floor(this.next() * maxExclusive) % maxExclusive;
  }

  reset(): void {
    this.cursor = 0;
  }
}

export function pickWeighted<T extends { weight: number }>(
  items: readonly T[],
  random: RandomService,
): T | null {
  if (items.length === 0) return null;
  const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (total <= 0) return items[0] ?? null;
  let roll = random.next() * total;
  for (const item of items) {
    roll -= Math.max(0, item.weight);
    if (roll < 0) return item;
  }
  return items[items.length - 1] ?? null;
}
