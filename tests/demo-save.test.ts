import { describe, expect, it } from 'vitest';
import { loadConfigBundle } from '../assets/scripts/config/ConfigRepository';
import { createDemoSave, createDemoStorage } from '../assets/scripts/infrastructure/DemoSave';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';
import { GameViewMapper } from '../assets/scripts/presentation/GameViewMapper';

describe('isolated review save', () => {
  it('reproduces Lv12, 320/600, reference currencies and all 32 item definitions', () => {
    const bundle = loadConfigBundle();
    const data = createDemoSave(bundle, 1000);
    expect(data.player).toMatchObject({ level: 12, xp: 3620, energy: 86, coins: 12460, hearts: 520 });
    expect(data.board).toHaveLength(81);
    expect(new Set(data.board.flatMap((cell) => cell.item ? [cell.item.definitionId] : [])).size).toBe(32);
    const game = createGameContext({ storage: createDemoStorage(bundle, 1000), clock: new FakeClockService(1000) });
    expect(new GameViewMapper(bundle).mapStatus(game.player, 1000, bundle.game.energy.recoverIntervalMs).xpText).toBe('XP 320 / 600');
    expect(game.life.pendingLevelRewards()).toEqual([]);
    expect(game.board.previewDrop(0, 1).kind).toBe('MERGE');
  });
  it('resets only its in-memory fixture and never changes a normal save', () => {
    const bundle = loadConfigBundle();
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
    const clock = new FakeClockService(1000);
    const normal = createGameContext({ storage, clock, saveDebounceMs: 0 });
    normal.spawnFromGenerator('coffee_machine');
    normal.save(); normal.flushSave();
    const before = storage.getItem(bundle.game.saveKey);
    const preview = createGameContext({ storage: createDemoStorage(bundle, 1000), clock, saveDebounceMs: 0 });
    expect(preview.dropItem(0, 1).ok).toBe(true);
    preview.spawnFromGenerator('coffee_machine');
    preview.save(); preview.flushSave();
    expect(storage.getItem(bundle.game.saveKey)).toBe(before);
    const restored = createGameContext({ storage, clock });
    expect(restored.player).toMatchObject({ level: 1, coins: 0, energy: 99 });
    const reset = createGameContext({ storage: createDemoStorage(bundle, 1000), clock });
    expect(reset.player).toMatchObject({ level: 12, xp: 3620, energy: 86 });
    expect(reset.board.getBoard().cells[0].item?.definitionId).toBe('coffee_01');
    expect(reset.life.state.photoPaths).toEqual([]);
  });
});
