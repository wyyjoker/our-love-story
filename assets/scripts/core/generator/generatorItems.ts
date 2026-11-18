import type { GeneratorDefinition, GeneratorItemRules, GeneratorItemState, ItemDefinition } from '../types';

export function generatorItemId(id: string, level: number): string { return `generator_${id}_${String(level).padStart(2, '0')}`; }

/** Producer entities share the normal item model and run only on the board. */
export function generatorItemDefinitions(generators: readonly GeneratorDefinition[]): ItemDefinition[] {
  return generators.flatMap(generator => Array.from({ length: generator.upgrade?.maxLevel ?? 1 }, (_, index) => {
    const level = index + 1, factor = Math.pow(generator.upgrade?.rechargeFactor ?? 1, index);
    return { id: generatorItemId(generator.id, level), chainId: `generator_${generator.id}`, level,
      displayName: generator.displayName, sellValue: 0, wildcardEligible: false,
      ...(level < (generator.upgrade?.maxLevel ?? 1) ? { nextItemId: generatorItemId(generator.id, level + 1) } : { maxLevel: true }),
      generator: { id: generator.id, capacity: generator.recharge?.capacity ?? generator.streakCooldown?.uses ?? 0,
        mergeRemainingRatio: generator.upgrade?.mergeRemainingRatio ?? .5,
        recoveryIntervalMs: generator.recharge ? Math.max(1, Math.round(generator.recharge.intervalMs * factor)) : 0,
        cooldownMs: generator.streakCooldown ? Math.max(1, Math.round(generator.streakCooldown.durationMs * factor)) : 0 },
    };
  }));
}

export function freshGeneratorState(rules: GeneratorItemRules, now: number): GeneratorItemState {
  return { remainingUses: rules.capacity, recoveryAt: now, cooldownUntil: null, boosted: false };
}

const finite = (value: unknown, fallback: number): number => typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** A projection only. No clock reads, writes, RNG or hidden refills on movement. */
export function effectiveGeneratorState(rules: GeneratorItemRules, raw: GeneratorItemState, now: number): GeneratorItemState {
  const state: GeneratorItemState = { remainingUses: Math.max(0, Math.min(rules.capacity, Math.floor(finite(raw.remainingUses, 0)))),
    recoveryAt: finite(raw.recoveryAt, now), cooldownUntil: raw.cooldownUntil === null ? null : finite(raw.cooldownUntil, now + rules.cooldownMs), boosted: raw.boosted === true };
  if (!rules.capacity) return { ...state, remainingUses: 0, cooldownUntil: null };
  if (rules.recoveryIntervalMs > 0) {
    const steps = Math.floor(Math.max(0, now - state.recoveryAt) / rules.recoveryIntervalMs);
    state.remainingUses = Math.min(rules.capacity, state.remainingUses + steps);
    state.recoveryAt = state.remainingUses === rules.capacity ? Math.max(now, state.recoveryAt) : state.recoveryAt + steps * rules.recoveryIntervalMs;
    state.cooldownUntil = null;
  } else if (rules.cooldownMs > 0) {
    if (state.remainingUses > 0) state.cooldownUntil = null;
    else if (state.cooldownUntil !== null && now >= state.cooldownUntil) {
      state.remainingUses = rules.capacity; state.cooldownUntil = null;
    } else if (state.cooldownUntil === null) {
      // Damaged exhausted records begin a real cooldown, never regain a free batch.
      state.cooldownUntil = now + rules.cooldownMs;
    }
  }
  return state;
}

export function generatorAvailability(rules: GeneratorItemRules, state: GeneratorItemState, now: number): {
  state: GeneratorItemState; remainingCooldownMs: number; nextRecoveryMs: number | null;
} {
  const current = effectiveGeneratorState(rules, state, now);
  return { state: current, remainingCooldownMs: current.cooldownUntil === null ? 0 : Math.max(0, current.cooldownUntil - now),
    nextRecoveryMs: rules.recoveryIntervalMs > 0 && current.remainingUses < rules.capacity
      ? Math.max(0, current.recoveryAt + rules.recoveryIntervalMs - now) : null };
}

/** Consume one physical machine's budget after preflight succeeds. */
export function consumeGeneratorUse(rules: GeneratorItemRules, raw: GeneratorItemState, now: number): GeneratorItemState | null {
  const { state, remainingCooldownMs } = generatorAvailability(rules, raw, now);
  if (remainingCooldownMs > 0 || (rules.capacity > 0 && state.remainingUses === 0)) return null;
  if (!rules.capacity) return state;
  const remainingUses = state.remainingUses - 1;
  return { ...state, remainingUses,
    recoveryAt: state.remainingUses === rules.capacity ? Math.max(now, state.recoveryAt) : state.recoveryAt,
    cooldownUntil: remainingUses === 0 && rules.cooldownMs > 0 ? now + rules.cooldownMs : null };
}

/** Two budgets convert proportionally; merging never creates more available uses. */
export function mergeGeneratorStates(oldRules: GeneratorItemRules, nextRules: GeneratorItemRules,
  first: GeneratorItemState, second: GeneratorItemState, now: number): GeneratorItemState {
  const a = effectiveGeneratorState(oldRules, first, now), b = effectiveGeneratorState(oldRules, second, now);
  const total = a.remainingUses + b.remainingUses;
  const ratio=Math.max(0,Math.min(.5,finite(nextRules.mergeRemainingRatio,.5)));
  const remainingUses = oldRules.capacity ? Math.min(total, Math.floor(total * nextRules.capacity * ratio / oldRules.capacity)) : 0;
  const progress = (state: GeneratorItemState): number => oldRules.recoveryIntervalMs > 0
    ? Math.min(1, Math.max(0, now - state.recoveryAt) / oldRules.recoveryIntervalMs) : 0;
  const cooldownFraction = (state: GeneratorItemState): number => state.cooldownUntil === null || !oldRules.cooldownMs
    ? 0 : Math.max(0, state.cooldownUntil - now) / oldRules.cooldownMs;
  return { remainingUses, boosted: false,
    recoveryAt: now - Math.floor(Math.min(progress(a), progress(b)) * nextRules.recoveryIntervalMs),
    cooldownUntil: remainingUses === 0 && nextRules.cooldownMs > 0
      ? now + Math.ceil(Math.max(cooldownFraction(a), cooldownFraction(b), Number.EPSILON) * nextRules.cooldownMs) : null };
}
