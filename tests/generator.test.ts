import { describe, expect, it } from 'vitest';
import { loadConfigBundle, validateConfig } from '../assets/scripts/config/ConfigRepository';
import { createEmptyBoard, findFirstEmptyIndex } from '../assets/scripts/core/board/board';
import { BoardService } from '../assets/scripts/gameplay/BoardService';
import { EnergyService } from '../assets/scripts/gameplay/EnergyService';
import { GeneratorService } from '../assets/scripts/gameplay/GeneratorService';
import { ProgressionService } from '../assets/scripts/gameplay/ProgressionService';
import { GameEventBus } from '../assets/scripts/events/GameEventBus';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';
import { FixedRandomService } from '../assets/scripts/infrastructure/RandomService';
import { SequentialIdService } from '../assets/scripts/infrastructure/IdService';
import type { PlayerState } from '../assets/scripts/core/types';
import { collectUnlockChains, getLevelForXp } from '../assets/scripts/core/progression/progression';

function makePlayer(): PlayerState {
  return {
    level: 1,
    xp: 0,
    coins: 0,
    hearts: 0,
    energy: 50,
    maxEnergy: 50,
    lastEnergyAt: 0,
    unlockedChainIds: ['coffee', 'flower'],
  };
}

describe('Config validation', () => {
  it('production config is valid', () => {
    const issues = validateConfig(loadConfigBundle()).filter((i) => i.level === 'error');
    expect(issues).toEqual([]);
  });

  it('has 4 chains × 8 levels', () => {
    const bundle = loadConfigBundle();
    expect(bundle.items).toHaveLength(32);
  });
});

describe('GeneratorService', () => {
  function setup(randomValues: number[] = [0]) {
    const bundle = loadConfigBundle();
    const bus = new GameEventBus();
    const player = makePlayer();
    const board = new BoardService(
      bundle.catalog,
      new SequentialIdService('g'),
      bus,
      bundle.game.board.rows,
      bundle.game.board.columns,
    );
    const energy = new EnergyService(player, new FakeClockService(), bus, 120_000);
    const progression = new ProgressionService(
      player,
      bundle.progression,
      bundle.generators,
      bus,
    );
    const gen = new GeneratorService(
      bundle.generators,
      bundle.catalog,
      board,
      energy,
      player,
      new FixedRandomService(randomValues),
      new FakeClockService(),
    );
    return { bundle, bus, player, board, energy, gen, progression };
  }

  it('spawns when energy > 0 and board not full', () => {
    const { gen, energy, player } = setup([0]);
    const result = gen.spawn('coffee_machine');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.itemDefinitionId).toBe('coffee_01');
      expect(result.cellIndex).toBe(0);
    }
    expect(energy.energy).toBe(49);
    expect(player.energy).toBe(49);
  });

  it('weighted output with high roll yields Lv2', () => {
    // 0.95 of total 100 �?coffee_02 (15 weight after 85)
    const { gen } = setup([0.95]);
    const result = gen.spawn('coffee_machine');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.itemDefinitionId).toBe('coffee_02');
  });

  it('fails when energy = 0 and does not spawn', () => {
    const { gen, player, board } = setup();
    player.energy = 0;
    const result = gen.spawn('coffee_machine');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('NOT_ENOUGH_ENERGY');
    expect(findFirstEmptyIndex(board.getBoard())).toBe(0);
  });

  it('board full �?fail and does not consume energy', () => {
    const { gen, player, board } = setup();
    const b = board.getBoard();
    for (let i = 0; i < b.cells.length; i += 1) {
      b.cells[i].item = { uid: `f${i}`, definitionId: 'coffee_01' };
    }
    board.replaceBoard(b);
    const before = player.energy;
    const result = gen.spawn('coffee_machine');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('BOARD_FULL');
    expect(player.energy).toBe(before);
  });

  it('locked generator fails', () => {
    const { gen, player, progression } = setup();
    player.level = 1;
    void progression;
    const result = gen.spawn('dessert_oven');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('LOCKED');
  });

  it('unlocks dessert at level 3', () => {
    const { gen, player, progression, bundle } = setup();
    progression.addXp(80);
    expect(player.level).toBe(3);
    expect(player.unlockedChainIds).toContain('dessert');
    expect(progression.isGeneratorUnlocked('dessert_oven')).toBe(true);
    void bundle;
    const result = gen.spawn('dessert_oven');
    expect(result.ok).toBe(true);
  });
});

describe('Progression', () => {
  it('xp thresholds', () => {
    const progression = loadConfigBundle().progression;
    expect(getLevelForXp(progression, 0)).toBe(1);
    expect(getLevelForXp(progression, 30)).toBe(2);
    expect(getLevelForXp(progression, 80)).toBe(3);
    expect(getLevelForXp(progression, 150)).toBe(4);
    expect(getLevelForXp(progression, 250)).toBe(5);
  });

  it('unlocks chains by level', () => {
    expect(collectUnlockChains(loadConfigBundle().progression, 1).sort()).toEqual(
      ['coffee', 'flower'].sort(),
    );
    expect(collectUnlockChains(loadConfigBundle().progression, 3)).toContain('dessert');
    expect(collectUnlockChains(loadConfigBundle().progression, 5)).toContain('gift');
  });
});

describe('Default board', () => {
  it('starts empty helper has 63', () => {
    expect(createEmptyBoard(9, 7).cells).toHaveLength(63);
  });
});
