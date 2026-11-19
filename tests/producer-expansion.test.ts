import { describe, expect, it } from 'vitest';
import { loadConfigBundle } from '../assets/scripts/config/ConfigRepository';
import { generatorItemId } from '../assets/scripts/core/generator/generatorItems';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';
import { createDefaultSaveData } from '../assets/scripts/infrastructure/SaveService';

const bundle = loadConfigBundle();
const xp = (level: number) => bundle.progression.levels[level - 1].xpRequired;
const itemId = (chain: string, level: number) => `${chain}_${String(level).padStart(2, '0')}`;

function fixture() {
  const clock = new FakeClockService(1_000_000), saved = new Map<string, string>();
  const storage = { getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => { saved.set(key, value); }, removeItem: (key: string) => { saved.delete(key); } };
  let roll = 0;
  const open = () => createGameContext({ clock, storage, deterministic: true, saveDebounceMs: 0,
    random: { next: () => roll, pickIndex: (count) => Math.floor(roll * count) } });
  return { clock, saved, open, setRoll: (value: number) => { roll = value; } };
}

describe('seven-producer expansion', () => {
  it.each([['painting_easel', 'painting', 22], ['photo_station', 'photo', 32]] as const)(
    'unlocks %s once, makes it available to six-slot orders and restores it',
    (producer, chain, level) => {
      const f = fixture(), game = f.open();
      game.debugAddXp(xp(level - 1));
      expect(game.getGeneratorStatus(producer)?.unlocked).toBe(false);
      expect(game.purchaseGenerator(producer)).toEqual({ ok: false, reason: 'LOCKED' });
      game.debugAddXp(xp(level) - xp(level - 1));
      expect(game.player.unlockedChainIds).toContain(chain);
      expect(game.getGeneratorStatus(producer)).toMatchObject({ level: 1, maxLevel: 9 });
      expect(game.spawnFromGenerator(producer)).toMatchObject({ ok: true, itemDefinitionId: itemId(chain, 1) });
      let supplied = false;
      for (let i = 0; i < 32 && !supplied; i += 1) {
        f.setRoll((i + .5) / 32);
        game.orders.hydrate([], []);
        game.orders.ensureFilled();
        supplied = game.orders.getOrders().some((order) => order.requirements.some((req) => bundle.catalog.get(req.itemId)?.chainId === chain));
      }
      expect(supplied).toBe(true);
      game.save();
      expect(f.open().getGeneratorStatus(producer)?.inventory[0]).toBe(1);
    },
  );

  it('keeps old top items and collected bonuses, grants both newly eligible producers once', () => {
    const f = fixture();
    const old = createDefaultSaveData(bundle.game, f.clock.now());
    Object.assign(old.player, { level: 35, xp: xp(35), maxEnergy: 1000, energy: 872 });
    old.board[0].item = { uid: 'old-coffee-12-a', definitionId: 'coffee_12' };
    old.board[1].item = { uid: 'old-coffee-12-b', definitionId: 'coffee_12' };
    old.claimedCollectionIds = ['coffee'];
    old.discoveredItemIds = Array.from({ length: 12 }, (_, i) => itemId('coffee', i + 1));
    f.saved.set(bundle.game.saveKey, JSON.stringify(old));
    const game = f.open();
    expect(game.player.energy).toBe(872);
    expect(game.getCollectionProgress().find((row) => row.chainId === 'coffee')).toMatchObject({ total: 18, discovered: 12, claimed: true });
    expect(game.dropItem(0, 1)).toMatchObject({ ok: true, kind: 'MERGE', resultDefinitionId: 'coffee_13' });
    const restored = f.open();
    for (const producer of ['painting_easel', 'photo_station']) expect(restored.getGeneratorStatus(producer)?.inventory[0]).toBe(1);
    expect(restored.board.getBoard().cells[1].item?.definitionId).toBe('coffee_13');
    expect(restored.claimCollectionBonus('coffee')).toEqual({ ok: false, reason: 'ALREADY_CLAIMED' });
  });

  it('produces the Lv12 output tail and merges it to Lv18 on every real item chain', () => {
    const f = fixture(), game = f.open();
    game.debugAddXp(xp(50));
    f.setRoll(.99); // Upper tail of the configured Lv9 output; test maximum reachability.
    expect(bundle.generators).toHaveLength(7);
    for (const producer of bundle.generators) {
      game.debugClearBoard();
      const machine = game.board.placeAt(0, generatorItemId(producer.id, 9))!;
      expect(machine.uid).toBeTruthy();
      game.player.energy = 1000;
      function build(level: number): number {
        if (level > 12) {
          const a = build(level - 1), b = build(level - 1);
          expect(game.dropItem(a, b)).toMatchObject({ ok: true, kind: 'MERGE', resultDefinitionId: itemId(producer.chainId, level) });
          return b;
        }
        const status = game.getGeneratorStatus(producer.id)!;
        if (status.nextRecoveryMs && status.charges === 0) f.clock.advance(status.nextRecoveryMs);
        if (status.remainingCooldownMs) f.clock.advance(status.remainingCooldownMs);
        const result = game.spawnFromGenerator(machine.uid);
        expect(result).toMatchObject({ ok: true, itemDefinitionId: itemId(producer.chainId, 12) });
        if (!result.ok) throw new Error(result.reason);
        return result.cellIndex;
      }
      const index = build(18);
      expect(game.board.getBoard().cells[index].item?.definitionId).toBe(itemId(producer.chainId, 18));
      expect(bundle.catalog.get(itemId(producer.chainId, 18))?.nextItemId).toBeUndefined();
      game.board.consumeItems([{ cellIndex: 0, uid: machine.uid, definitionId: machine.definitionId }]);
    }
    expect(f.open().board.getBoard().cells.some((cell) => cell.item?.definitionId === 'photo_18')).toBe(true);
  });

  it('retains a pending ninth-tier producer through reload and consumes that reward once', () => {
    const f = fixture(), game = f.open();
    game.debugAddXp(xp(50));
    while (!game.board.isFull()) game.debugSpawn('coffee_01');
    expect(game.generators.grantEarned('test_late_gift', { generatorId: 'photo_station', level: 9, count: 1 }, 'wish_reward')).toBe(true);
    game.save();
    const restored = f.open();
    const gift = restored.generators.getRewards().find((entry) => entry.generatorId === 'photo_station' && entry.level === 9)!;
    expect(gift).toBeDefined();
    restored.debugClearBoard();
    expect(restored.claimGeneratorReward(gift.id).ok).toBe(true);
    expect(restored.claimGeneratorReward(gift.id).ok).toBe(false);
    expect(f.open().getGeneratorStatus('photo_station')?.level).toBe(9);
  });

  it('restores physical generators missing their use state so they can merge immediately after loading', () => {
    const f = fixture();
    const save = createDefaultSaveData(bundle.game, f.clock.now());
    Object.assign(save.player, { level: 32, xp: xp(32) });
    const definitionId = generatorItemId('painting_easel', 8);
    save.board[0].item = { uid: 'old-easel-a', definitionId };
    save.board[1].item = { uid: 'old-easel-b', definitionId };
    f.saved.set(bundle.game.saveKey, JSON.stringify(save));
    const game = f.open();
    expect(game.dropItem(0, 1)).toMatchObject({ ok: true, kind: 'MERGE', resultDefinitionId: generatorItemId('painting_easel', 9) });
    expect(f.open().getGeneratorStatus('painting_easel')).toMatchObject({ level: 9, maxLevel: 9 });
  });
});
