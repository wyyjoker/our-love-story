import type { GameConfig } from '../types';

export function energyCapacity(config: GameConfig['energy'], level: number): number {
  const caps = config.maxByLevel;
  return caps?.[Math.min(caps.length - 1, Math.max(0, Math.floor(level) - 1))] ?? config.maxEnergy;
}
