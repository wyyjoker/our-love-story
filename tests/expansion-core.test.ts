import { describe, it, expect } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { FakeClockService, businessDayUtc8 } from '../assets/scripts/infrastructure/ClockService';
import { FixedRandomService } from '../assets/scripts/infrastructure/RandomService';
import { loadConfigBundle } from '../assets/scripts/config/ConfigRepository';
import { createDefaultSaveData } from '../assets/scripts/infrastructure/SaveService';

function fixture() {
  const values = new Map<string, string>();
  const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } };
  const clock = new FakeClockService(0);
  const open = () => createGameContext({ storage, clock, random: new FixedRandomService([0.5]), deterministic: true, saveDebounceMs: 0 });
  return { values, storage, clock, open };
}

describe('expansion rules', () => {
  it('opens the rectangle by level and rejects locked-cell paths', () => {
    const g = fixture().open(); const b = g.board.getBoard();
    expect(b.cells.filter((c) => !c.locked).map((c) => c.index)).toEqual([0,1,2,6,7,8,12,13,14]);
    expect(g.board.getLockedUnlockLevel(3)).toBe(2);
    expect(g.dropItem(0,3).ok).toBe(false); expect(g.board.placeAt(3, 'coffee_01')).toBeNull();
    expect(g.playAction('store', '3').ok).toBe(false); expect(g.playAction('split', '3').ok).toBe(false);
    g.debugAddXp(50); expect(g.board.getBoard().cells[3].locked).toBe(false);
  });
  it('migrates every legacy UID into 42 open cells or inbox and preserves anniversary rights', () => {
    const f = fixture(); const cfg = loadConfigBundle().game; const old = createDefaultSaveData(cfg, 0);
    old.version = 5; old.board = Array.from({ length: 81 }, (_, index) => ({ index, item: { uid: `legacy_${index}`, definitionId: 'coffee_03' } }));
    old.life.unlockedMemoryIds = ['anniversary']; old.player.coins = 71; old.player.energy = 32;
    const raw = JSON.stringify(old); f.values.set(cfg.saveKey, raw); const g = f.open();
    expect(f.values.get(`${cfg.saveKey}:backup`)).toBe(raw);
    expect(g.board.getBoard().cells.every((c) => !c.locked)).toBe(true);
    const all = [...g.board.getBoard().cells.flatMap((c) => c.item ? [c.item.uid] : []), ...g.rewardInbox.map((i) => i.uid)];
    expect(new Set(all).size).toBe(81); expect(g.rewardInbox).toHaveLength(39);
    expect(g.player).toMatchObject({ coins: 71, energy: 32 });
    expect(g.life.state.unlockedMemoryIds).toEqual(expect.arrayContaining(['anniversary', 'marriage_registration', 'wedding_thanksgiving']));
    expect(g.claimInboxItem('legacy_80')).toEqual({ ok: false, reason: 'BOARD_FULL' });
    expect(g.isItemDiscovered('coffee_03')).toBe(true); expect(g.player.coins).toBe(71);
    g.board.clearBoard(); expect(g.claimInboxItem('legacy_80').ok).toBe(true);
    expect(f.open().board.getBoard().cells.some((c) => c.item?.uid === 'legacy_80')).toBe(true);
  });
  it('awards only genuine first merges and drops chests only for normal chains', () => {
    const f = fixture(); const g = f.open(); g.board.clearBoard();
    g.board.placeAt(0, 'coffee_01'); g.board.placeAt(1, 'coffee_01');
    expect(g.isItemDiscovered('coffee_02')).toBe(false); expect(g.dropItem(0,1).ok).toBe(true);
    expect(g.player.coins).toBe(10); expect(g.isItemDiscovered('coffee_02')).toBe(true);
    g.board.placeAt(0, 'coffee_01'); g.board.placeAt(6, 'coffee_01'); g.dropItem(0,6); expect(g.player.coins).toBe(10);
    expect(f.open().isItemDiscovered('coffee_02')).toBe(true);
    const h = createGameContext({ deterministic: true, random: new FixedRandomService([0]) }); h.board.clearBoard();
    h.board.placeAt(0, 'coin_01'); h.board.placeAt(1, 'coin_01'); h.dropItem(0,1);
    expect(h.board.getBoard().cells.some((c) => c.item?.definitionId === 'treasure_chest')).toBe(false);
    h.board.placeAt(0, 'coffee_01'); h.board.placeAt(6, 'coffee_01'); h.dropItem(0,6);
    expect(h.board.getBoard().cells.some((c) => c.item?.definitionId === 'treasure_chest')).toBe(true);
  });
  it('opens a full-board chest without losing loot and consumes all tiers safely', () => {
    const f = fixture(); const g = f.open(); g.board.clearBoard();
    for (const c of g.board.getBoard().cells.filter((c) => !c.locked)) g.board.placeAt(c.index, 'coffee_01');
    g.board.getBoard().cells[0].item!.definitionId = 'treasure_chest';
    expect(g.useBoardItem(0).ok).toBe(true); expect(g.rewardInbox).toHaveLength(1);
    expect(f.open().rewardInbox).toHaveLength(1);
    g.board.clearBoard();
    for (const chain of ['coin','energy','diamond']) for (let level=1; level<=3; level++) {
      g.board.clearBoard(); g.player.energy = 50; g.board.placeAt(0, `${chain}_0${level}`);
      expect(g.useBoardItem(0).ok).toBe(true);
    }
    g.board.placeAt(0, 'energy_01'); g.player.energy = g.player.maxEnergy;
    expect(g.useBoardItem(0)).toEqual({ ok: true, amount: 5 });
    expect(g.player.energy).toBe(g.player.maxEnergy + 5); expect(g.board.getBoard().cells[0].item).toBeUndefined();
    expect(f.open().player.energy).toBe(g.player.maxEnergy + 5);
  });
  it('delivers level chest once, exchanges diamonds and guards synchronous reentry', () => {
    const g = fixture().open(); g.debugAddXp(50); expect(g.claimLevelReward(2).ok).toBe(true); expect(g.rewardInbox).toHaveLength(1);
    expect(g.claimLevelReward(2).ok).toBe(false); expect(g.rewardInbox).toHaveLength(1);
    g.player.diamonds = 10; g.player.energy = g.player.maxEnergy - 10; let nested: unknown;
    g.bus.on('ENERGY_CHANGED', () => { nested = g.exchangeDiamonds('small'); });
    expect(g.exchangeDiamonds('small')).toEqual({ ok: true, energy: 10 });
    expect(nested).toEqual({ ok: false, reason: 'IN_PROGRESS' }); expect(g.player.diamonds).toBe(5);
    expect(g.exchangeDiamonds('small').ok).toBe(false); expect(g.player.diamonds).toBe(5);
  });
  it('uses UTC+8 days, survives restart and prevents clock rollback reclaims', () => {
    const f = fixture(); const g = f.open();
    expect(businessDayUtc8(-8 * 3600000)).toBe(0); expect(businessDayUtc8(-8 * 3600000 - 1)).toBe(-1);
    expect(g.claimDailyCheckIn()).toMatchObject({ ok: true, coins: 30 }); expect(g.claimDailyCheckIn().ok).toBe(false);
    f.clock.advance(86400000); const h = f.open(); h.player.energy = h.player.maxEnergy - 1;
    expect(h.claimDailyCheckIn()).toMatchObject({ ok: true, energy: 15 });
    expect(h.player.energy).toBe(h.player.maxEnergy + 14); f.clock.set(0);
    expect(f.open().claimDailyCheckIn().ok).toBe(false);
  });
});

describe('legacy split memories and wallet', () => {
  const rights: Record<string, string[]> = {
    anniversary: ['marriage_registration', 'wedding_thanksgiving'], letters: ['zhoushan_bonfire'],
    night_view: ['qinwang_palace', 'hengdian_hot_spring'], promise: ['huangshan_trip', 'qiandao_lake', 'wangchen_pavilion'],
    jeju_first: ['shanghai_departure'], barbie_summer: ['nanhu_boat'], snow_and_family: ['hengdian_family'],
    hangzhou_wedding: ['wedding_mv'], summer_before_wedding: ['concert', 'xian_terracotta'],
  };
  it.each(Object.entries(rights))('migrates old %s without spending or granting twice', (source, expected) => {
    const f = fixture(); const config = loadConfigBundle().game; const old = createDefaultSaveData(config, 0);
    old.version = 5; old.life.unlockedMemoryIds = [source]; old.player.coins = 73; old.player.diamonds = 9;
    old.player.hearts = 28; old.player.energy = 42; old.player.lastEnergyAt = f.clock.now();
    f.values.set(config.saveKey, JSON.stringify(old)); const first = f.open();
    expect(first.life.state.unlockedMemoryIds).toEqual(expect.arrayContaining([source, ...expected]));
    expect(first.player).toMatchObject({ coins: 73, diamonds: 9, hearts: 28, energy: 42 });
    const again = f.open(); expect(again.life.state.unlockedMemoryIds).toEqual(first.life.state.unlockedMemoryIds);
    expect(again.player).toMatchObject({ coins: 73, diamonds: 9, hearts: 28, energy: 42 });
  });
  it('does not grant split memories for current-version saves', () => {
    const f = fixture(); const config = loadConfigBundle().game; const current = createDefaultSaveData(config, 0);
    current.life.unlockedMemoryIds = Object.keys(rights); f.values.set(config.saveKey, JSON.stringify(current));
    const g = f.open(); expect(g.life.state.unlockedMemoryIds).toEqual(Object.keys(rights));
  });
  it('retains actual coin, diamond and energy gains across reload without repeating consumption', () => {
    const f = fixture(); const g = f.open(); g.board.clearBoard(); g.player.energy = 40;
    g.board.placeAt(0, 'coin_03'); expect(g.useBoardItem(0)).toEqual({ ok: true, amount: 60 });
    g.board.placeAt(0, 'diamond_03'); expect(g.useBoardItem(0)).toEqual({ ok: true, amount: 8 });
    g.board.placeAt(0, 'energy_03'); expect(g.useBoardItem(0)).toEqual({ ok: true, amount: 30 });
    const again = f.open(); expect(again.player).toMatchObject({ coins: 60, diamonds: 8, energy: 70 });
    expect(again.useBoardItem(0).ok).toBe(false); expect(again.player).toMatchObject({ coins: 60, diamonds: 8, energy: 70 });
  });
});

describe('stale item actions and damaged legacy warehouse', () => {
  it('does not consume a chest reward when its old confirmation fires again', () => {
    const g = createGameContext({ deterministic: true, random: new FixedRandomService([0]) });
    g.board.clearBoard(); const chest = g.board.placeAt(0, 'treasure_chest')!;
    const before = g.player.coins;
    expect(g.useBoardItem(0, chest.uid).ok).toBe(true);
    const replacement = g.board.getBoard().cells[0].item!;
    expect(replacement.definitionId).toBe('coin_01'); expect(replacement.uid).not.toBe(chest.uid);
    expect(g.useBoardItem(0, chest.uid)).toEqual({ ok: false, reason: 'INVALID' });
    expect(g.board.getBoard().cells[0].item).toEqual(replacement); expect(g.player.coins).toBe(before);
    expect(g.useBoardItem(0, replacement.uid)).toEqual({ ok: true, amount: 10 });
    expect(g.player.coins).toBe(before + 10);
  });
  it.each([{}, 'broken', 42, null, [{ uid: 'valid', definitionId: 'flower_02' }, { uid: 42 }, null]])('repairs malformed legacy warehouse %j without losing assets', (warehouse) => {
    const f = fixture(); const cfg = loadConfigBundle().game; const old = createDefaultSaveData(cfg, 0);
    old.version = 5; old.player.coins = 321; old.player.diamonds = 7; old.player.energy = 64;
    old.board[0].item = { uid: 'retained', definitionId: 'coffee_03' };
    const raw = { ...old, play: { ...old.play, warehouse } };
    f.values.set(cfg.saveKey, JSON.stringify(raw)); const g = f.open();
    expect(g.player).toMatchObject({ coins: 321, diamonds: 7, energy: 64 });
    expect(g.board.getBoard().cells[0].item?.uid).toBe('retained');
    if (Array.isArray(warehouse)) expect(g.play.state.warehouse).toEqual([{ uid: 'valid', definitionId: 'flower_02' }]);
    else expect(g.play.state.warehouse).toEqual([]);
    expect(f.open().player.coins).toBe(321);
  });
});
