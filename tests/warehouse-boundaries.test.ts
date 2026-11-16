import { describe, expect, it } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';
import { FixedRandomService } from '../assets/scripts/infrastructure/RandomService';
import { createDefaultSaveData } from '../assets/scripts/infrastructure/SaveService';
import { loadConfigBundle } from '../assets/scripts/config/ConfigRepository';

function fixture() {
  const values = new Map<string, string>();
  const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k,v); }, removeItem: (k: string) => { values.delete(k); } };
  const clock = new FakeClockService(1_000_000);
  const open = () => createGameContext({ storage, clock, deterministic: true, random: new FixedRandomService([0]), saveDebounceMs: 0 });
  return { values, clock, open };
}
describe('six-slot warehouse isolation', () => {
  it('does not replace anything at six slots and only withdraws into an open cell', () => {
    const f = fixture(); const g = f.open(); g.debugClearBoard();
    expect(g.config.toolbox.warehouseSlots).toBe(6);
    for (let i=0;i<6;i++) { g.board.placeAt(0, 'coffee_01'); expect(g.playAction('store','0').ok).toBe(true); }
    const stored = g.play.state.warehouse; g.board.placeAt(0, 'coffee_02'); const seventh = g.board.getBoard().cells[0].item;
    expect(g.playAction('store','0')).toEqual({ok:false,reason:'WAREHOUSE_FULL'});
    expect(g.play.state.warehouse).toEqual(stored); expect(g.board.getBoard().cells[0].item).toEqual(seventh);
    for (const cell of g.board.getBoard().cells) if (!cell.locked && !cell.item) g.board.placeAt(cell.index,'coffee_01');
    expect(g.playAction('withdraw',stored[0].uid)).toEqual({ok:false,reason:'BOARD_FULL'});
    expect(g.play.state.warehouse).toEqual(stored); expect(g.board.getBoard().cells[3].locked).toBe(true);
    g.board.getBoard().cells[8].item = undefined;
    expect(g.playAction('withdraw',stored[0].uid)).toEqual({ok:true});
    expect(g.board.getBoard().cells[8].item?.uid).toBe(stored[0].uid); expect(g.board.getBoard().cells[3].item).toBeUndefined();
  });
  it('excludes stored items from normal and small-date orders until withdrawn', () => {
    const g = fixture().open(); g.debugClearBoard();
    const order = g.orders.getOrders().find((o) => o.uid === 'order_start_1')!;
    for (const req of order.requirements) for (let i=0;i<req.count;i++) { g.board.placeAt(0, req.itemId); expect(g.playAction('store','0').ok).toBe(true); }
    expect(g.board.getOrderProgress(order).ready).toBe(false); expect(g.orders.canClaim(order.uid)).toBe(false);
    expect(g.claimOrder(order.uid).ok).toBe(false);
    for (const item of [...g.play.state.warehouse]) expect(g.playAction('withdraw',item.uid).ok).toBe(true);
    expect(g.orders.canClaim(order.uid)).toBe(true); g.debugClearBoard();
    const date = g.play.smallDateOrder()!;
    for (const req of date.template.requirements) for (let i=0;i<req.count;i++) { g.board.placeAt(0, req.itemId); expect(g.playAction('store','0').ok).toBe(true); }
    expect(g.play.smallDateOrder()?.ready).toBe(false); expect(g.playAction('small_date',date.token)).toEqual({ok:false,reason:'NOT_READY'});
    for (const item of [...g.play.state.warehouse]) expect(g.playAction('withdraw',item.uid).ok).toBe(true);
    expect(g.play.smallDateOrder()?.ready).toBe(true);
  });
  it('never uses warehouse items for board merges, chest drops or time-based production', () => {
    const f=fixture(); const g=f.open(); g.debugAddXp(50); g.debugClearBoard();
    const stored = g.board.placeAt(0,'coffee_01')!; expect(g.playAction('store','0').ok).toBe(true);
    g.board.placeAt(0,'coffee_01'); const merges=g.life.state.stats.merges;
    expect(g.dropItem(0,1)).toMatchObject({ok:true,kind:'MOVE'});
    expect(g.life.state.stats.merges).toBe(merges); expect(g.rewardInbox).toHaveLength(0);
    expect(g.board.getBoard().cells.some((c)=>c.item?.definitionId==='treasure_chest')).toBe(false);
    const orangeTree=g.generators.get('orange_tree')!, capacity=orangeTree.recharge!.capacity;
    for(let i=0;i<capacity;i++) { expect(g.spawnFromGenerator('orange_tree').ok).toBe(true); g.debugClearBoard(); }
    g.board.placeAt(0,'coffee_01');
    const beforeBoard=g.board.getBoard().cells.map((c)=>c.item?.uid ?? null); f.clock.advance(orangeTree.recharge!.intervalMs); g.tick();
    expect(g.getGeneratorStatus('orange_tree')?.charges).toBe(1);
    expect(g.board.getBoard().cells.map((c)=>c.item?.uid ?? null)).toEqual(beforeBoard);
    expect(g.play.state.warehouse).toEqual([stored]); expect(f.open().play.state.warehouse).toEqual([stored]);
  });
  it('migrates a v5 warehouse item retaining its UID and definition', () => {
    const f=fixture(), cfg=loadConfigBundle().game, old=createDefaultSaveData(cfg,f.clock.now());
    old.version=5; old.board=Array.from({length:81},(_,index)=>({index}));
    old.play.warehouse=[{uid:'legacy_warehouse_item',definitionId:'flower_03'}];
    f.values.set(cfg.saveKey,JSON.stringify(old)); const g=f.open();
    expect(g.play.state.warehouse).toEqual([{uid:'legacy_warehouse_item',definitionId:'flower_03'}]);
    expect(g.playAction('withdraw','legacy_warehouse_item')).toEqual({ok:true});
    expect(g.board.getBoard().cells[0].item).toEqual({uid:'legacy_warehouse_item',definitionId:'flower_03'});
    expect(f.open().board.getBoard().cells[0].item?.uid).toBe('legacy_warehouse_item');
  });
});
