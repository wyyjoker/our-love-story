/**
 * Offline energy recovery — pure function.
 * Uses lastEnergyAt timestamps; never trusts setInterval alone.
 */
export type EnergyRecoverInput = {
  energy: number;
  maxEnergy: number;
  lastEnergyAt: number;
  now: number;
  recoverIntervalMs: number;
};

export type EnergyRecoverResult = {
  energy: number;
  maxEnergy: number;
  lastEnergyAt: number;
  recovered: number;
};

export function recoverEnergy(input: EnergyRecoverInput): EnergyRecoverResult {
  const maxEnergy = Math.max(0, input.maxEnergy);
  let energy = clampInt(input.energy, 0, maxEnergy);
  const interval = Math.max(1, input.recoverIntervalMs);
  const now = Number.isFinite(input.now) ? input.now : input.lastEnergyAt;
  const last = Number.isFinite(input.lastEnergyAt)
    ? input.lastEnergyAt
    : now;

  if (energy >= maxEnergy) {
    return {
      energy: maxEnergy,
      maxEnergy,
      lastEnergyAt: now,
      recovered: 0,
    };
  }

  // System clock skew / future lastEnergyAt → no negative progress
  const elapsed = Math.max(0, now - last);
  const ticks = Math.floor(elapsed / interval);
  if (ticks <= 0) {
    return {
      energy,
      maxEnergy,
      lastEnergyAt: last,
      recovered: 0,
    };
  }

  const room = maxEnergy - energy;
  const recovered = Math.min(room, ticks);
  energy += recovered;
  // Keep remainder time so partial intervals are not lost
  const consumedMs = recovered * interval;
  const newLast =
    recovered >= room && energy >= maxEnergy
      ? now
      : last + consumedMs;

  return {
    energy,
    maxEnergy,
    lastEnergyAt: newLast,
    recovered,
  };
}

export function spendEnergy(
  energy: number,
  cost: number,
): { ok: true; energy: number } | { ok: false; reason: 'NOT_ENOUGH_ENERGY' } {
  if (cost < 0) {
    return { ok: false, reason: 'NOT_ENOUGH_ENERGY' };
  }
  if (energy < cost) {
    return { ok: false, reason: 'NOT_ENOUGH_ENERGY' };
  }
  return { ok: true, energy: energy - cost };
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}
