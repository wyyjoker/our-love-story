import { describe, expect, it } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';
import { FixedRandomService } from '../assets/scripts/infrastructure/RandomService';
import { createDefaultSaveData } from '../assets/scripts/infrastructure/SaveService';
import { loadConfigBundle } from '../assets/scripts/config/ConfigRepository';

function fixture() {
  const values = new Map<string, string>();
  const clock = new FakeClockService(1_000_000);
  const config = loadConfigBundle();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  const open = () => createGameContext({ storage, clock, random: new FixedRandomService([0.5]), deterministic: true, saveDebounceMs: 0 });
  const seed = (mutate: (save: ReturnType<typeof createDefaultSaveData>) => void): void => {
    const save = createDefaultSaveData(config.game, clock.now());
    save.version = config.game.saveVersion - 1;
    mutate(save);
    values.set(config.game.saveKey, JSON.stringify(save));
  };
  return { values, clock, config, open, seed };
}

describe('generator capacity and streak migrations', () => {
  it('expands a legacy full orange tree to configured capacity once', () => {
    const f = fixture();
    const tree = f.config.generators.find((generator) => generator.id === 'orange_tree')!;
    f.seed((save) => {
      save.player.level = tree.unlockLevel;
      save.player.xp = 50;
      save.generatorCharges = { orange_tree: { charges: tree.recharge!.legacyCapacity!, lastRecoveryAt: f.clock.now() - tree.recharge!.intervalMs / 2 } };
    });

    let game = f.open();
    expect(game.getGeneratorStatus('orange_tree')).toMatchObject({ charges: tree.recharge!.capacity, maxCharges: tree.recharge!.capacity, nextRecoveryMs: null });
    expect(game.buildSaveData().generatorCharges?.orange_tree).toMatchObject({ capacity: tree.recharge!.capacity, charges: tree.recharge!.capacity });
    game = f.open();
    expect(game.getGeneratorStatus('orange_tree')).toMatchObject({ charges: tree.recharge!.capacity, maxCharges: tree.recharge!.capacity, nextRecoveryMs: null });
  });

  it('carries a legacy missing-charge deficit forward once and keeps offline recovery phase', () => {
    const f = fixture();
    const tree = f.config.generators.find((generator) => generator.id === 'orange_tree')!;
    const legacyCharges = 0;
    const elapsed = tree.recharge!.intervalMs / 2;
    f.seed((save) => {
      save.player.level = tree.unlockLevel;
      save.player.xp = 50;
      save.generatorCharges = { orange_tree: { charges: legacyCharges, lastRecoveryAt: f.clock.now() - elapsed } };
    });

    let game = f.open();
    expect(game.getGeneratorStatus('orange_tree')).toMatchObject({
      charges: tree.recharge!.capacity - tree.recharge!.legacyCapacity! + legacyCharges,
      maxCharges: tree.recharge!.capacity,
      nextRecoveryMs: tree.recharge!.intervalMs - elapsed,
    });
    expect(game.buildSaveData().generatorCharges?.orange_tree).toMatchObject({ capacity: tree.recharge!.capacity });

    expect(game.spawnFromGenerator('orange_tree').ok).toBe(true);
    game = f.open();
    expect(game.getGeneratorStatus('orange_tree')).toMatchObject({
      charges: tree.recharge!.capacity - tree.recharge!.legacyCapacity! + legacyCharges - 1,
      maxCharges: tree.recharge!.capacity,
      nextRecoveryMs: tree.recharge!.intervalMs - elapsed,
    });
    f.clock.advance(tree.recharge!.intervalMs - elapsed);
    expect(game.getGeneratorStatus('orange_tree')?.charges).toBe(tree.recharge!.capacity - tree.recharge!.legacyCapacity! + legacyCharges);
  });

  it('migrates an unfinished legacy 12-use cooldown to retained streak progress', () => {
    const f = fixture();
    const coffee = f.config.generators.find((generator) => generator.id === 'coffee_machine')!;
    const oldStreak = 12;
    f.seed((save) => {
      save.generatorCooldowns = { coffee_machine: { streak: oldStreak, cooldownStartedAt: f.clock.now() - coffee.streakCooldown!.durationMs / 2 } };
    });

    const game = f.open();
    const limit = coffee.streakCooldown!.uses;
    expect(limit).toBeGreaterThan(oldStreak);
    expect(game.getGeneratorStatus('coffee_machine')).toMatchObject({ streak: oldStreak, streakLimit: limit, remainingCooldownMs: 0 });
    expect(game.buildSaveData().generatorCooldowns?.coffee_machine).toMatchObject({ streak: oldStreak, cooldownStartedAt: null });

    game.player.energy = game.player.maxEnergy;
    const remainingUses = limit - oldStreak;
    for (let index = 0; index < remainingUses - 1; index += 1) {
      expect(game.spawnFromGenerator('coffee_machine').ok).toBe(true);
      game.debugClearBoard();
    }
    expect(game.getGeneratorStatus('coffee_machine')).toMatchObject({ streak: limit - 1, remainingCooldownMs: 0 });
    expect(game.spawnFromGenerator('coffee_machine').ok).toBe(true);
    game.debugClearBoard();
    expect(game.getGeneratorStatus('coffee_machine')).toMatchObject({ streak: limit, remainingCooldownMs: coffee.streakCooldown!.durationMs });
    expect(game.spawnFromGenerator('coffee_machine')).toEqual({ ok: false, reason: 'GENERATOR_COOLDOWN' });
  });

  it('discards an expired legacy cooldown and resets its streak', () => {
    const f = fixture();
    const coffee = f.config.generators.find((generator) => generator.id === 'coffee_machine')!;
    f.seed((save) => {
      save.generatorCooldowns = { coffee_machine: { streak: 12, cooldownStartedAt: f.clock.now() - coffee.streakCooldown!.durationMs - 1 } };
    });

    const game = f.open();
    expect(game.getGeneratorStatus('coffee_machine')).toMatchObject({ streak: 0, streakLimit: coffee.streakCooldown!.uses, remainingCooldownMs: 0 });
    expect(game.buildSaveData().generatorCooldowns?.coffee_machine).toMatchObject({ streak: 0, cooldownStartedAt: null });
  });
});
