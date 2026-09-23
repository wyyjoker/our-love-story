import type {
  FurnitureDefinition,
  LifeState,
  LevelRewardConfig,
  MemoryDefinition,
  PlayerState,
  WishDefinition,
  WishMetric,
} from '../core/types';
import type { GameEventBus } from '../events/GameEventBus';
import type { ProgressionService } from './ProgressionService';

export type LifeResult =
  | { ok: true }
  | { ok: false; reason: 'NOT_FOUND' | 'LOCKED' | 'NOT_ENOUGH_HEARTS' | 'NOT_ENOUGH_COINS' | 'ALREADY_OWNED' | 'ALREADY_CLAIMED' | 'NOT_READY' };

export class LifeService {
  constructor(
    readonly state: LifeState,
    readonly memories: readonly MemoryDefinition[],
    readonly furniture: readonly FurnitureDefinition[],
    readonly wishes: readonly WishDefinition[],
    private readonly levelRewards: LevelRewardConfig,
    private readonly player: PlayerState,
    private readonly progression: ProgressionService,
    private readonly bus: GameEventBus,
  ) {}

  record(metric: 'spawns' | 'merges' | 'orders'): void {
    this.state.stats[metric] += 1;
    this.bus.emit('LIFE_CHANGED', { reason: 'progress' });
  }

  getDecorPoints(): number {
    const placed = new Set(this.state.placedFurnitureIds);
    return this.furniture.reduce((total, item) => total + (placed.has(item.id) ? item.decorPoints : 0), 0);
  }

  getWishProgress(wish: WishDefinition): number {
    const metric: WishMetric = wish.metric;
    switch (metric) {
      case 'spawns':
      case 'merges':
      case 'orders':
        return this.state.stats[metric];
      case 'level':
        return this.player.level;
      case 'memories':
        return this.state.unlockedMemoryIds.length;
      case 'furniture':
        return this.state.placedFurnitureIds.length;
      case 'decor':
        return this.getDecorPoints();
    }
  }

  unlockMemory(id: string): LifeResult {
    const index = this.memories.findIndex((item) => item.id === id);
    if (index < 0) return { ok: false, reason: 'NOT_FOUND' };
    if (this.state.unlockedMemoryIds.includes(id)) return { ok: false, reason: 'ALREADY_OWNED' };
    if (index > 0 && !this.state.unlockedMemoryIds.includes(this.memories[index - 1].id)) {
      return { ok: false, reason: 'LOCKED' };
    }
    if (!this.progression.spendHearts(this.memories[index].heartCost)) {
      return { ok: false, reason: 'NOT_ENOUGH_HEARTS' };
    }
    this.state.unlockedMemoryIds.push(id);
    this.bus.emit('LIFE_CHANGED', { reason: 'memory' });
    return { ok: true };
  }

  buyFurniture(id: string): LifeResult {
    const item = this.furniture.find((entry) => entry.id === id);
    if (!item) return { ok: false, reason: 'NOT_FOUND' };
    if (this.state.ownedFurnitureIds.includes(id)) return { ok: false, reason: 'ALREADY_OWNED' };
    if (this.player.level < item.unlockLevel) return { ok: false, reason: 'LOCKED' };
    if (!this.progression.spendCoins(item.coinCost)) {
      return { ok: false, reason: 'NOT_ENOUGH_COINS' };
    }
    this.state.ownedFurnitureIds.push(id);
    this.state.placedFurnitureIds.push(id);
    this.bus.emit('LIFE_CHANGED', { reason: 'furniture' });
    return { ok: true };
  }

  placeFurniture(id: string): LifeResult {
    if (!this.furniture.some((item) => item.id === id)) return { ok: false, reason: 'NOT_FOUND' };
    if (!this.state.ownedFurnitureIds.includes(id)) return { ok: false, reason: 'LOCKED' };
    if (this.state.placedFurnitureIds.includes(id)) {
      this.state.placedFurnitureIds = this.state.placedFurnitureIds.filter((value) => value !== id);
    } else {
      this.state.placedFurnitureIds.push(id);
    }
    this.bus.emit('LIFE_CHANGED', { reason: 'furniture' });
    return { ok: true };
  }

  claimWish(id: string): LifeResult {
    const wish = this.wishes.find((item) => item.id === id);
    if (!wish) return { ok: false, reason: 'NOT_FOUND' };
    if (this.state.claimedWishIds.includes(id)) return { ok: false, reason: 'ALREADY_CLAIMED' };
    if (this.getWishProgress(wish) < wish.target) return { ok: false, reason: 'NOT_READY' };
    this.state.claimedWishIds.push(id);
    this.progression.addCoins(wish.rewardCoins);
    this.progression.addHearts(wish.rewardHearts);
    this.bus.emit('LIFE_CHANGED', { reason: 'wish' });
    return { ok: true };
  }

  pendingLevelRewards(): number[] {
    const claimed = new Set(this.state.claimedLevelRewards);
    const levels: number[] = [];
    for (let level = 2; level <= this.player.level; level += 1) {
      if (!claimed.has(level)) levels.push(level);
    }
    return levels;
  }

  rewardForLevel(level: number): { coins: number; hearts: number; xp: number } {
    const special = this.levelRewards.special.find((reward) => reward.level === level);
    return special
      ? { coins: special.coins, hearts: special.hearts, xp: special.xp }
      : {
          coins: this.levelRewards.default.coinsPerLevel * level,
          hearts: this.levelRewards.default.heartsPerLevel * level,
          xp: this.levelRewards.default.xp,
        };
  }

  claimLevelReward(level: number): LifeResult {
    if (!Number.isInteger(level) || level < 2 || level > this.player.level) {
      return { ok: false, reason: 'LOCKED' };
    }
    if (this.state.claimedLevelRewards.includes(level)) {
      return { ok: false, reason: 'ALREADY_CLAIMED' };
    }
    this.state.claimedLevelRewards.push(level);
    const reward = this.rewardForLevel(level);
    this.progression.addCoins(reward.coins);
    this.progression.addHearts(reward.hearts);
    if (reward.xp > 0) this.progression.addXp(reward.xp);
    this.bus.emit('LIFE_CHANGED', { reason: 'level-reward' });
    return { ok: true };
  }

  addPhoto(path: string): LifeResult {
    if (!path || this.state.photoPaths.includes(path)) return { ok: false, reason: 'ALREADY_OWNED' };
    this.state.photoPaths.push(path);
    this.bus.emit('LIFE_CHANGED', { reason: 'photo' });
    return { ok: true };
  }
}
