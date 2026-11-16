import { describe, expect, it } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { loadConfigBundle } from '../assets/scripts/config/ConfigRepository';
import { createDefaultSaveData } from '../assets/scripts/infrastructure/SaveService';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';

function fixture() {
  const data = new Map<string, string>(); const clock = new FakeClockService(1000000);
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
  return { data, clock, open: () => createGameContext({ storage, clock, deterministic: true, saveDebounceMs: 0 }) };
}

describe('five-level supply chains', () => {
  it.each(['coin', 'energy', 'diamond'])('%s merges through level five and each level can be consumed once', (chain) => {
    const f = fixture(), g = f.open();
    for (let level = 1; level < 5; level++) {
      g.debugClearBoard(); const id = `${chain}_0${level}`;
      const a = g.board.placeAt(0, id)!, b = g.board.placeAt(1, id)!;
      expect(a.uid).not.toBe(b.uid);
      expect(g.dropItem(0, 1)).toMatchObject({ok:true,kind:'MERGE',resultDefinitionId:`${chain}_0${level + 1}`});
    }
    g.debugClearBoard(); g.board.placeAt(0, `${chain}_05`); g.board.placeAt(1, `${chain}_05`);
    expect(g.dropItem(0, 1)).toMatchObject({ok:true,kind:'SWAP'});
    const used = new Set<string>();
    for (let level = 1; level <= 5; level++) {
      g.debugClearBoard(); const id = `${chain}_0${level}`, item = g.board.placeAt(0, id)!;
      expect(used.has(item.uid)).toBe(false); used.add(item.uid);
      const before = chain === 'coin' ? g.player.coins : chain === 'energy' ? g.player.energy : g.player.diamonds;
      const value = g.bundle.catalog.get(id)!.useValue!;
      expect(g.useBoardItem(0, item.uid)).toEqual({ok:true, amount:value});
      expect(chain === 'coin' ? g.player.coins : chain === 'energy' ? g.player.energy : g.player.diamonds).toBe(before + value);
      expect(g.useBoardItem(0, item.uid).ok).toBe(false);
    }
    if (chain === 'energy') expect(g.player.energy).toBeGreaterThan(g.player.maxEnergy);
    expect(f.open().player).toMatchObject({ coins:g.player.coins, energy:g.player.energy, diamonds:g.player.diamonds });
  });
  it('keeps old level-three supply UIDs intact across migration and allows the next merge', () => {
    const f = fixture(); const config = loadConfigBundle().game; const old = createDefaultSaveData(config, f.clock.now());
    old.version = 6;
    for (const [index, chain] of ['coin','energy','diamond'].entries()) old.board[index].item = {uid:`old_${chain}`, definitionId:`${chain}_03`};
    f.data.set(config.saveKey, JSON.stringify(old)); const g = f.open();
    for (const chain of ['coin','energy','diamond']) {
      expect(g.board.getBoard().cells.some((cell) => cell.item?.uid === `old_${chain}` && cell.item.definitionId === `${chain}_03`)).toBe(true);
    }
    g.debugClearBoard(); g.board.placeAt(0,'coin_03'); g.board.placeAt(1,'coin_03');
    expect(g.dropItem(0,1)).toMatchObject({ok:true,kind:'MERGE',resultDefinitionId:'coin_04'});
  });
});
