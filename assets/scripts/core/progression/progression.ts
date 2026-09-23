import type { ProgressionConfig, ProgressionLevel } from '../types';

export function getLevelForXp(
  progression: ProgressionConfig,
  xp: number,
): number {
  let level = 1;
  for (const entry of progression.levels) {
    if (xp >= entry.xpRequired) {
      level = entry.level;
    }
  }
  return level;
}

export function getLevelEntry(
  progression: ProgressionConfig,
  level: number,
): ProgressionLevel | undefined {
  return progression.levels.find((l) => l.level === level);
}

/** XP needed to reach the next level from current xp. Infinity if maxed. */
export function getXpToNext(
  progression: ProgressionConfig,
  xp: number,
): { need: number; nextThreshold: number | null; current: number } {
  const current = getLevelForXp(progression, xp);
  const next = progression.levels.find((l) => l.level === current + 1);
  if (!next) {
    return { need: 0, nextThreshold: null, current };
  }
  return {
    need: Math.max(0, next.xpRequired - xp),
    nextThreshold: next.xpRequired,
    current,
  };
}

export function collectUnlockChains(
  progression: ProgressionConfig,
  upToLevel: number,
): string[] {
  const chains = new Set<string>();
  for (const entry of progression.levels) {
    if (entry.level <= upToLevel) {
      for (const c of entry.unlockChains) chains.add(c);
    }
  }
  return [...chains];
}

export function chainsUnlockedAtLevel(
  progression: ProgressionConfig,
  level: number,
): string[] {
  return getLevelEntry(progression, level)?.unlockChains ?? [];
}
