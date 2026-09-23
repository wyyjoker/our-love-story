import type {
  GeneratorDefinition,
  GeneratorOutput,
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
  ) {}

  list(): readonly GeneratorDefinition[] {
    return this.generators;
  }

  get(id: string): GeneratorDefinition | undefined {
    return this.generators.find((g) => g.id === id);
  }

  isUnlocked(generator: GeneratorDefinition): boolean {
    return this.player.level >= generator.unlockLevel || this.player.unlockedChainIds.includes(generator.chainId);
  }

  rollOutput(generator: GeneratorDefinition): GeneratorOutput | null {
    return pickWeighted(generator.outputs, this.random);
  }

  spawn(generatorId: string): SpawnResult {
    const generator = this.get(generatorId);
    if (!generator) {
      return { ok: false, reason: 'UNKNOWN_GENERATOR' };
    }
    if (!this.isUnlocked(generator)) {
      return { ok: false, reason: 'LOCKED' };
    }
    if (!this.energy.canSpend(generator.energyCost)) {
      return { ok: false, reason: 'NOT_ENOUGH_ENERGY' };
    }
    if (this.board.isFull()) {
      return { ok: false, reason: 'BOARD_FULL' };
    }

    const output = this.rollOutput(generator);
    if (!output || !this.catalog.has(output.itemId)) {
      return { ok: false, reason: 'UNKNOWN_GENERATOR' };
    }

    const spend = this.energy.spend(generator.energyCost);
    if (!spend.ok) {
      return spend;
    }

    if (this.player.energy < this.player.maxEnergy) {
      if (!this.player.lastEnergyAt) {
        this.player.lastEnergyAt = this.clock.now();
      }
    }

    const spawned = this.board.spawn(output.itemId);
    if (!spawned.ok) {
      this.energy.add(generator.energyCost);
      return { ok: false, reason: 'BOARD_FULL' };
    }

    return {
      ok: true,
      itemDefinitionId: output.itemId,
      uid: spawned.item.uid,
      cellIndex: spawned.cellIndex,
    };
  }
}
