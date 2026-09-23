import type { ProgressionConfig, PlayerState } from '../core/types';
import {
  collectUnlockChains,
  getLevelForXp,
  getXpToNext,
} from '../core/progression/progression';
import type { GameEventBus } from '../events/GameEventBus';
import type { GeneratorDefinition } from '../core/types';

export type XpGainResult = {
  xp: number;
  delta: number;
  previousLevel: number;
  level: number;
  leveledUp: boolean;
  unlockedChains: string[];
};

export class ProgressionService {
  constructor(
    private readonly player: PlayerState,
    private readonly progression: ProgressionConfig,
    private readonly generators: readonly GeneratorDefinition[],
    private readonly bus: GameEventBus,
  ) {
    // Normalize unlocked chains from level on construct
    this.syncUnlocks();
  }

  get level(): number {
    return this.player.level;
  }

  get xp(): number {
    return this.player.xp;
  }

  getXpToNext(): ReturnType<typeof getXpToNext> {
    return getXpToNext(this.progression, this.player.xp);
  }

  addXp(amount: number): XpGainResult {
    const previousLevel = this.player.level;
    const delta = Math.max(0, Math.floor(amount));
    this.player.xp += delta;
    this.bus.emit('XP_CHANGED', { xp: this.player.xp, delta });

    const newLevel = getLevelForXp(this.progression, this.player.xp);
    let unlockedChains: string[] = [];

    if (newLevel > previousLevel) {
      this.player.level = newLevel;
      unlockedChains = this.syncUnlocks(previousLevel, newLevel);
      this.bus.emit('LEVEL_UP', {
        level: newLevel,
        previousLevel,
        unlockedChains,
      });
    }

    return {
      xp: this.player.xp,
      delta,
      previousLevel,
      level: this.player.level,
      leveledUp: newLevel > previousLevel,
      unlockedChains,
    };
  }

  addCoins(amount: number): void {
    const delta = Math.max(0, Math.floor(amount));
    this.player.coins += delta;
    this.bus.emit('COINS_CHANGED', { coins: this.player.coins, delta });
  }

  addHearts(amount: number): void {
    const delta = Math.max(0, Math.floor(amount));
    this.player.hearts += delta;
    this.bus.emit('HEARTS_CHANGED', { hearts: this.player.hearts, delta });
  }

  unlockedChains(): string[] {
    return [...this.player.unlockedChainIds];
  }

  isGeneratorUnlocked(generatorId: string): boolean {
    const gen = this.generators.find((g) => g.id === generatorId);
    if (!gen) return false;
    return this.player.level >= gen.unlockLevel;
  }

  private syncUnlocks(fromLevel = 0, toLevel = this.player.level): string[] {
    const expected = new Set(collectUnlockChains(this.progression, toLevel));
    const newly: string[] = [];
    for (const chain of expected) {
      if (!this.player.unlockedChainIds.includes(chain)) {
        this.player.unlockedChainIds.push(chain);
        if (fromLevel > 0) newly.push(chain);
      }
    }
    // Keep only chains from progression
    this.player.unlockedChainIds = this.player.unlockedChainIds.filter((c) =>
      expected.has(c),
    );
    return newly;
  }
}
