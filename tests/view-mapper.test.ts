import { describe, expect, it } from 'vitest';
import { GameViewMapper, itemCode } from '../assets/scripts/presentation/GameViewMapper';
import { loadConfigBundle } from '../assets/scripts/config/ConfigRepository';
import type { PlayerState } from '../assets/scripts/core/types';

const bundle = loadConfigBundle();
const mapper = new GameViewMapper(bundle);

function player(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    level: 1,
    xp: 0,
    coins: 0,
    hearts: 0,
    energy: 50,
    maxEnergy: 50,
    lastEnergyAt: 0,
    unlockedChainIds: ['coffee', 'flower'],
    ...overrides,
  };
}

describe('GameViewMapper', () => {
  it('maps status with countdown when energy below max', () => {
    const vm = mapper.mapStatus(
      player({ energy: 40, lastEnergyAt: 0 }),
      30_000,
      120_000,
    );
    expect(vm.energyText).toBe('40/50');
    expect(vm.energyCountdownText).toMatch(/^\d{2}:\d{2}$/);
  });

  it('maps item codes in Chinese short form', () => {
    expect(itemCode({ chainId: 'coffee', level: 1 })).toBe('咖1');
    expect(itemCode({ chainId: 'flower', level: 2 })).toBe('花2');
  });

  it('maps order button text in Chinese', () => {
    const order = {
      uid: 'o1',
      templateId: 't',
      requirements: [{ itemId: 'coffee_02', count: 1 }],
      rewardCoins: 20,
      rewardXp: 10,
      rewardHearts: 1,
    };
    const ready = mapper.mapOrder(order, {
      requirements: [
        { itemId: 'coffee_02', count: 1, have: 1, done: true },
      ],
      ready: true,
    });
    expect(ready.buttonText).toBe('交付');
    const notReady = mapper.mapOrder(order, {
      requirements: [
        { itemId: 'coffee_02', count: 1, have: 0, done: false },
      ],
      ready: false,
    });
    expect(notReady.buttonText).toBe('还差一点');
  });

  it('maps locked generator text', () => {
    const list = mapper.mapGenerators(bundle.generators, player({ level: 1 }));
    const dessert = list.find((g) => g.id === 'dessert_oven');
    expect(dessert?.locked).toBe(true);
    expect(dessert?.lockText).toContain('Lv3');
  });
});
