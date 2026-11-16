import type {
  GeneratorDefinition,
  GeneratorOutput,
  GeneratorChargeState,
  GeneratorCooldownState,
  PlayerState,
} from '../core/types';
import type { ItemCatalog } from '../core/item/catalog';
import type { RandomService } from '../infrastructure/RandomService';
import { pickWeighted } from '../infrastructure/RandomService';
import type { BoardService } from './BoardService';
import type { EnergyService } from './EnergyService';
import type { ClockService } from '../infrastructure/ClockService';

export type SpawnResult =
  | { ok: true; itemDefinitionId: string; uid: string; cellIndex: number }
  | {
      ok: false;
      reason:
        | 'NOT_ENOUGH_ENERGY'
        | 'NO_CHARGES'
        | 'GENERATOR_COOLDOWN'
        | 'BOOST_UNAVAILABLE'
        | 'IN_PROGRESS'
        | 'BOARD_FULL'
        | 'LOCKED'
        | 'UNKNOWN_GENERATOR';
    };

export class GeneratorService {
  constructor(
    private readonly generators: readonly GeneratorDefinition[],
    private readonly catalog: ItemCatalog,
    private readonly board: BoardService,
    private readonly energy: EnergyService,
    private readonly player: PlayerState,
    private readonly random: RandomService,
    private readonly clock: ClockService,
    private readonly chargeStates: Record<string, GeneratorChargeState> = {},
    private readonly inventory: Record<string, number[]> = {},
    private readonly cooldownStates: Record<string, GeneratorCooldownState> = {},
  ) { this.ensureUnlockedCharges(); }

  ensureUnlockedCharges(): void {
    for (const gen of this.generators) {
      if (this.isUnlocked(gen) && !this.inventory[gen.id]) {
        this.inventory[gen.id] = Array.from({ length: gen.upgrade?.maxLevel ?? 1 }, (_, index) => index === 0 ? 1 : 0);
      }
      if (this.inventory[gen.id]) while (this.inventory[gen.id].length < (gen.upgrade?.maxLevel ?? 1)) this.inventory[gen.id].push(0);
      const savedCooldown = this.cooldownStates[gen.id];
      if (gen.streakCooldown && savedCooldown?.cooldownStartedAt != null && savedCooldown.streak < gen.streakCooldown.uses) {
        if (this.clock.now() >= savedCooldown.cooldownStartedAt + this.streakInterval(gen)) savedCooldown.streak = 0;
        savedCooldown.cooldownStartedAt = null;
      }
      if (!gen.recharge || !this.isUnlocked(gen)) continue;
      const rule = gen.recharge;
      if (!this.chargeStates[gen.id]) this.chargeStates[gen.id] = { charges: rule.capacity, lastRecoveryAt: this.clock.now(), capacity: rule.capacity };
      const saved = this.chargeStates[gen.id];
      const previousCapacity = saved.capacity ?? rule.legacyCapacity ?? rule.capacity;
      if (previousCapacity !== rule.capacity) {
        // Carry the old missing-charge count forward once when capacity grows.
        saved.charges = Math.max(0, Math.min(rule.capacity, saved.charges + rule.capacity - previousCapacity));
        if (saved.charges >= rule.capacity) saved.lastRecoveryAt = Math.max(this.clock.now(), saved.lastRecoveryAt);
      }
      saved.capacity = rule.capacity;
    }
  }

  private activeLevel(gen: GeneratorDefinition): number {
    const counts = this.inventory[gen.id] ?? [];
    for (let i = counts.length - 1; i >= 0; i--) if (counts[i] > 0) return i + 1;
    return 1;
  }
  private interval(gen: GeneratorDefinition, level = this.activeLevel(gen)): number {
    return gen.recharge ? Math.max(1, Math.round(gen.recharge.intervalMs * Math.pow(gen.upgrade?.rechargeFactor ?? 1, level - 1))) : 0;
  }
  private streakInterval(gen: GeneratorDefinition, level = this.activeLevel(gen)): number {
    return gen.streakCooldown ? Math.max(1, Math.round(gen.streakCooldown.durationMs * Math.pow(gen.upgrade?.rechargeFactor ?? 1, level - 1))) : 0;
  }
  getStatus(id: string): { unlocked: boolean; level: number; maxLevel: number; inventory: number[]; energyCost: number; boostEnergyCost: number | null; boostAvailable: boolean; cooldownMs: number; streak: number; streakLimit: number; remainingCooldownMs: number; charges: number | null; maxCharges: number | null; nextRecoveryMs: number | null } | null {
    const gen = this.get(id); if (!gen) return null;
    const unlocked = this.isUnlocked(gen), level = unlocked ? this.activeLevel(gen) : 0, rule = gen.recharge;
    const boostAvailable = unlocked && level > 1 && gen.energyCost > 0 && !!gen.upgrade?.levels.find((v) => v.level === level)?.boostOutputs;
    const cooldown = gen.streakCooldown ? this.cooldownStates[id] : undefined;
    const cooldownMs = gen.streakCooldown ? this.streakInterval(gen, level || 1) : (unlocked ? this.interval(gen, level) : rule?.intervalMs ?? 0);
    const remainingCooldownMs = cooldown?.cooldownStartedAt == null ? 0 : Math.max(0, cooldown.cooldownStartedAt + cooldownMs - this.clock.now());
    const streak = cooldown?.cooldownStartedAt != null && remainingCooldownMs === 0 ? 0 : Math.min(gen.streakCooldown?.uses ?? 0, cooldown?.streak ?? 0);
    const base = { unlocked, level, maxLevel: gen.upgrade?.maxLevel ?? 1, inventory: [...(this.inventory[id] ?? Array.from({ length: gen.upgrade?.maxLevel ?? 1 }, () => 0))], energyCost: gen.energyCost,
      boostAvailable, boostEnergyCost: boostAvailable ? gen.energyCost * (gen.upgrade?.boostEnergyMultiplier ?? 2) : null,
      cooldownMs, streak, streakLimit: gen.streakCooldown?.uses ?? 0, remainingCooldownMs };
    if (!rule) return { ...base, charges: null, maxCharges: null, nextRecoveryMs: null };
    if (!unlocked) return { ...base, charges: null, maxCharges: rule.capacity, nextRecoveryMs: null };
    const saved = this.chargeStates[id];
    if (!saved) return { ...base, charges: rule.capacity, maxCharges: rule.capacity, nextRecoveryMs: null };
    const elapsed = Math.max(0, this.clock.now() - saved.lastRecoveryAt), interval = this.interval(gen, level);
    const restored = Math.floor(elapsed / interval);
    const charges = Math.min(rule.capacity, saved.charges + restored);
    const anchor = saved.lastRecoveryAt + restored * interval;
    return { ...base, charges, maxCharges: rule.capacity, nextRecoveryMs: charges >= rule.capacity ? null : Math.max(0, anchor + interval - this.clock.now()) };
  }

  merge(id: string, level: number): { ok: true; level: number } | { ok: false; reason: 'NOT_FOUND' | 'LOCKED' | 'MAX_LEVEL' | 'NOT_ENOUGH_GENERATORS' } {
    const gen = this.get(id); if (!gen) return { ok: false, reason: 'NOT_FOUND' };
    if (!this.isUnlocked(gen)) return { ok: false, reason: 'LOCKED' };
    if (!Number.isInteger(level) || level < 1 || level >= (gen.upgrade?.maxLevel ?? 1)) return { ok: false, reason: 'MAX_LEVEL' };
    const inventory = this.inventory[id]; if (!inventory || (inventory[level - 1] ?? 0) < 2) return { ok: false, reason: 'NOT_ENOUGH_GENERATORS' };
    const previousLevel = this.activeLevel(gen), oldInterval = this.interval(gen, previousLevel);
    const saved = this.chargeStates[id], status = this.getStatus(id);
    if (saved && status && status.charges !== null && gen.recharge) {
      const now = this.clock.now(), elapsed = Math.max(0, now - saved.lastRecoveryAt), steps = Math.floor(elapsed / oldInterval);
      const anchor = saved.lastRecoveryAt + steps * oldInterval;
      saved.charges = status.charges;
      saved.lastRecoveryAt = status.charges >= gen.recharge.capacity ? Math.max(now, saved.lastRecoveryAt) : anchor;
    }
    inventory[level - 1] -= 2; inventory[level] = (inventory[level] ?? 0) + 1;
    const newInterval = this.interval(gen), now = this.clock.now();
    if (saved && gen.recharge && saved.charges < gen.recharge.capacity && newInterval !== oldInterval && now > saved.lastRecoveryAt) {
      const progress = now - saved.lastRecoveryAt;
      saved.lastRecoveryAt = now - Math.floor(progress * newInterval / oldInterval);
    }
    return { ok: true, level: level + 1 };
  }

  grantLevelReward(level: number, rotation: readonly string[]): string | null {
    const eligible = rotation.map((id) => this.get(id)).filter((g): g is GeneratorDefinition => !!g && this.isUnlocked(g));
    if (!eligible.length) return null;
    const gen = eligible[(level - 2) % eligible.length]; this.ensureUnlockedCharges(); this.inventory[gen.id][0] += 1; return gen.id;
  }

  grantPurchased(id: string): { ok: true; inventory: number[] } | { ok: false; reason: 'NOT_FOUND' | 'LOCKED' } {
    const gen = this.get(id); if (!gen) return { ok: false, reason: 'NOT_FOUND' };
    if (!this.isUnlocked(gen)) return { ok: false, reason: 'LOCKED' };
    this.ensureUnlockedCharges();
    this.inventory[id][0] += 1;
    return { ok: true, inventory: [...this.inventory[id]] };
  }

  getInventory(): Record<string, number[]> { return Object.fromEntries(Object.entries(this.inventory).map(([id, counts]) => [id, [...counts]])); }
  getCooldownStates(): Record<string, GeneratorCooldownState> { return Object.fromEntries(Object.entries(this.cooldownStates).map(([id, state]) => [id, { ...state }])); }

  restoreExhausted(id: string): { ok: true; kind: 'cooldown' | 'charges'; restoredUses: number }
    | { ok: false; reason: 'NOT_FOUND' | 'LOCKED' | 'NOT_NEEDED' | 'IN_PROGRESS' } {
    if (this.spawning) return { ok: false, reason: 'IN_PROGRESS' };
    const generator = this.get(id);
    if (!generator) return { ok: false, reason: 'NOT_FOUND' };
    const status = this.getStatus(id)!;
    if (!status.unlocked) return { ok: false, reason: 'LOCKED' };
    if (generator.recharge) {
      if (status.charges !== 0) return { ok: false, reason: 'NOT_NEEDED' };
      const saved = this.chargeStates[id];
      if (!saved) return { ok: false, reason: 'NOT_NEEDED' };
      saved.charges = generator.recharge.capacity;
      saved.capacity = generator.recharge.capacity;
      saved.lastRecoveryAt = Math.max(this.clock.now(), saved.lastRecoveryAt);
      return { ok: true, kind: 'charges', restoredUses: generator.recharge.capacity };
    }
    if (!generator.streakCooldown || status.remainingCooldownMs <= 0 || status.streak < generator.streakCooldown.uses) return { ok: false, reason: 'NOT_NEEDED' };
    this.cooldownStates[id] = { streak: 0, cooldownStartedAt: null };
    return { ok: true, kind: 'cooldown', restoredUses: generator.streakCooldown.uses };
  }

  private spendCharge(gen: GeneratorDefinition): GeneratorChargeState | null {
    const rule = gen.recharge; if (!rule) return null;
    this.ensureUnlockedCharges(); const saved = this.chargeStates[gen.id]; const previous = { ...saved };
    const now = this.clock.now(); const elapsed = Math.max(0, now - saved.lastRecoveryAt);
    const interval = this.interval(gen);
    const steps = Math.floor(elapsed / interval); const charges = Math.min(rule.capacity, saved.charges + steps);
    saved.charges = charges - 1;
    saved.lastRecoveryAt = charges === rule.capacity ? Math.max(now, saved.lastRecoveryAt) : saved.lastRecoveryAt + steps * interval;
    return previous;
  }

  getChargeStates(): Record<string, GeneratorChargeState> {
    return Object.fromEntries(Object.entries(this.chargeStates).map(([id, state]) => [id, { ...state }]));
  }

  list(): readonly GeneratorDefinition[] {
    return this.generators;
  }

  get(id: string): GeneratorDefinition | undefined {
    return this.generators.find((g) => g.id === id);
  }

  isUnlocked(generator: GeneratorDefinition): boolean {
    return this.player.level >= generator.unlockLevel || this.player.unlockedChainIds.includes(generator.chainId);
  }

  rollOutput(generator: GeneratorDefinition, level = 1, boost = false): GeneratorOutput | null {
    const upgrade = generator.upgrade?.levels.find((v) => v.level === level);
    return pickWeighted((boost ? upgrade?.boostOutputs : upgrade?.outputs) ?? generator.outputs, this.random);
  }

  private spawning = false;
  spawn(generatorId: string, boost = false): SpawnResult {
    if (this.spawning) return { ok: false, reason: 'IN_PROGRESS' };
    this.spawning = true;
    try { return this.spawnOnce(generatorId, boost); } finally { this.spawning = false; }
  }
  private spawnOnce(generatorId: string, boost: boolean): SpawnResult {
    const generator = this.get(generatorId);
    if (!generator) {
      return { ok: false, reason: 'UNKNOWN_GENERATOR' };
    }
    if (!this.isUnlocked(generator)) {
      return { ok: false, reason: 'LOCKED' };
    }
    const status = this.getStatus(generatorId)!;
    if (status.remainingCooldownMs > 0) return { ok: false, reason: 'GENERATOR_COOLDOWN' };
    if (boost && !status.boostAvailable) return { ok: false, reason: 'BOOST_UNAVAILABLE' };
    const energyCost = generator.energyCost * (boost ? (generator.upgrade?.boostEnergyMultiplier ?? 2) : 1);
    if (generator.recharge && status.charges === 0) return { ok: false, reason: 'NO_CHARGES' };
    if (!this.energy.canSpend(energyCost)) {
      return { ok: false, reason: 'NOT_ENOUGH_ENERGY' };
    }
    if (this.board.isFull()) {
      return { ok: false, reason: 'BOARD_FULL' };
    }

    const output = this.rollOutput(generator, status.level, boost);
    if (!output || !this.catalog.has(output.itemId)) {
      return { ok: false, reason: 'UNKNOWN_GENERATOR' };
    }

    const previousCharge = this.spendCharge(generator);
    const spend = energyCost > 0 ? this.energy.spend(energyCost) : { ok: true as const };
    if (!spend.ok) {
      if (previousCharge) this.chargeStates[generator.id] = previousCharge;
      return spend;
    }

    if (energyCost > 0 && this.player.energy < this.player.maxEnergy) {
      if (!this.player.lastEnergyAt) {
        this.player.lastEnergyAt = this.clock.now();
      }
    }

    const spawned = this.board.spawn(output.itemId);
    if (!spawned.ok) {
      if (previousCharge) this.chargeStates[generator.id] = previousCharge;
      if (energyCost > 0) this.energy.add(energyCost);
      return { ok: false, reason: 'BOARD_FULL' };
    }

    if (generator.streakCooldown) {
      const streak = status.streak + 1;
      this.cooldownStates[generatorId] = { streak, cooldownStartedAt: streak >= generator.streakCooldown.uses ? this.clock.now() : null };
    }

    return {
      ok: true,
      itemDefinitionId: output.itemId,
      uid: spawned.item.uid,
      cellIndex: spawned.cellIndex,
    };
  }
}
