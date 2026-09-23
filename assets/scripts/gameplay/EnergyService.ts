import type { PlayerState } from '../core/types';
import { recoverEnergy, spendEnergy } from '../core/energy/energy';
import type { ClockService } from '../infrastructure/ClockService';
import type { GameEventBus } from '../events/GameEventBus';

export type EnergyTickResult = {
  recovered: number;
  energy: number;
  maxEnergy: number;
};

export class EnergyService {
  constructor(
    private readonly player: PlayerState,
    private readonly clock: ClockService,
    private readonly bus: GameEventBus,
    private readonly recoverIntervalMs: number,
  ) {}

  get energy(): number {
    return this.player.energy;
  }

  get maxEnergy(): number {
    return this.player.maxEnergy;
  }

  /** Offline / resume recovery based on lastEnergyAt. */
  tick(): EnergyTickResult {
    const before = this.player.energy;
    const result = recoverEnergy({
      energy: this.player.energy,
      maxEnergy: this.player.maxEnergy,
      lastEnergyAt: this.player.lastEnergyAt,
      now: this.clock.now(),
      recoverIntervalMs: this.recoverIntervalMs,
    });
    this.player.energy = result.energy;
    this.player.lastEnergyAt = result.lastEnergyAt;
    const delta = result.energy - before;
    if (delta !== 0) {
      this.bus.emit('ENERGY_CHANGED', {
        energy: this.player.energy,
        maxEnergy: this.player.maxEnergy,
        delta,
      });
    }
    return {
      recovered: result.recovered,
      energy: result.energy,
      maxEnergy: result.maxEnergy,
    };
  }

  canSpend(cost: number): boolean {
    return this.player.energy >= cost;
  }

  spend(cost: number):
    | { ok: true; energy: number }
    | { ok: false; reason: 'NOT_ENOUGH_ENERGY' } {
    const result = spendEnergy(this.player.energy, cost);
    if (!result.ok) return result;
    this.player.energy = result.energy;
    // Spending should push lastEnergyAt forward only if we were at max
    // (standard energy timer starts after first spend from full).
    if (this.player.energy === this.player.maxEnergy - cost && this.player.lastEnergyAt === 0) {
      this.player.lastEnergyAt = this.clock.now();
    }
    this.bus.emit('ENERGY_CHANGED', {
      energy: this.player.energy,
      maxEnergy: this.player.maxEnergy,
      delta: -cost,
    });
    return result;
  }

  add(amount: number): void {
    const before = this.player.energy;
    this.player.energy = Math.min(
      this.player.maxEnergy,
      this.player.energy + amount,
    );
    const delta = this.player.energy - before;
    if (delta !== 0) {
      this.bus.emit('ENERGY_CHANGED', {
        energy: this.player.energy,
        maxEnergy: this.player.maxEnergy,
        delta,
      });
    }
  }

  /** Regen timestamp after a spend when player is below max. */
  markRegenPoint(): void {
    this.player.lastEnergyAt = this.clock.now();
  }
}
