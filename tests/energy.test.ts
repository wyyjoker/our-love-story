import { describe, expect, it } from 'vitest';
import { recoverEnergy, spendEnergy } from '../assets/scripts/core/energy/energy';

describe('Energy recovery', () => {
  it('120s â†?+1', () => {
    const r = recoverEnergy({
      energy: 10,
      maxEnergy: 50,
      lastEnergyAt: 0,
      now: 120_000,
      recoverIntervalMs: 120_000,
    });
    expect(r.recovered).toBe(1);
    expect(r.energy).toBe(11);
  });

  it('119s â†?+0', () => {
    const r = recoverEnergy({
      energy: 10,
      maxEnergy: 50,
      lastEnergyAt: 0,
      now: 119_000,
      recoverIntervalMs: 120_000,
    });
    expect(r.recovered).toBe(0);
    expect(r.energy).toBe(10);
  });

  it('240s â†?+2', () => {
    const r = recoverEnergy({
      energy: 10,
      maxEnergy: 50,
      lastEnergyAt: 0,
      now: 240_000,
      recoverIntervalMs: 120_000,
    });
    expect(r.recovered).toBe(2);
    expect(r.energy).toBe(12);
  });

  it('does not exceed max', () => {
    const r = recoverEnergy({
      energy: 48,
      maxEnergy: 50,
      lastEnergyAt: 0,
      now: 120_000 * 10,
      recoverIntervalMs: 120_000,
    });
    expect(r.energy).toBe(50);
    expect(r.recovered).toBe(2);
  });

  it('offline 1 hour recovers correctly', () => {
    const r = recoverEnergy({
      energy: 5,
      maxEnergy: 50,
      lastEnergyAt: 0,
      now: 3_600_000,
      recoverIntervalMs: 120_000,
    });
    // 3600/120 = 30
    expect(r.recovered).toBe(30);
    expect(r.energy).toBe(35);
  });

  it('full energy parks lastEnergyAt at now', () => {
    const r = recoverEnergy({
      energy: 50,
      maxEnergy: 50,
      lastEnergyAt: 0,
      now: 999_000,
      recoverIntervalMs: 120_000,
    });
    expect(r.energy).toBe(50);
    expect(r.lastEnergyAt).toBe(999_000);
    expect(r.recovered).toBe(0);
  });

  it('abnormal clock (now < last) produces no negative', () => {
    const r = recoverEnergy({
      energy: 10,
      maxEnergy: 50,
      lastEnergyAt: 1_000_000,
      now: 100_000,
      recoverIntervalMs: 120_000,
    });
    expect(r.recovered).toBe(0);
    expect(r.energy).toBe(10);
  });

  it('preserves remainder time', () => {
    const r = recoverEnergy({
      energy: 10,
      maxEnergy: 50,
      lastEnergyAt: 0,
      now: 130_000,
      recoverIntervalMs: 120_000,
    });
    expect(r.recovered).toBe(1);
    expect(r.lastEnergyAt).toBe(120_000);
  });
});

describe('Energy spend', () => {
  it('spends when enough', () => {
    const r = spendEnergy(5, 1);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.energy).toBe(4);
  });

  it('fails when not enough', () => {
    const r = spendEnergy(0, 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('NOT_ENOUGH_ENERGY');
  });
});
