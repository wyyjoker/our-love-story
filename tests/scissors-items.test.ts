import { describe, expect, it } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';

function fixture() {
  const saved = new Map<string, string>(), clock = new FakeClockService(1_000_000);
  const storage = { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key, value); }, removeItem: (key: string) => { saved.delete(key); } };
  const open = () => createGameContext({ storage, clock, deterministic: true, saveDebounceMs: 0 });
  return { open, clock };
}

describe('physical mergeable scissors', () => {
  it.each([[1,1],[2,3],[3,8],[4,20],[5,50]])('level %i has exactly %i finite uses', (level, uses) => {
    const game = fixture().open(); game.debugClearBoard(); const tool = game.board.placeAt(0, `scissors_0${level}`)!;
    const energy = game.player.energy;
    for (let use = 0; use < uses; use++) {
      game.board.placeAt(1, 'coffee_02');
      expect(game.dropItem(0, 1)).toMatchObject({ ok:true, kind:'SPLIT' });
      const board = game.board.getBoard();
       expect(board.cells.filter((cell) => cell.item?.definitionId === 'coffee_01')).toHaveLength(2);
      const current = board.cells[0].item;
      if (use + 1 < uses) expect(current).toMatchObject({ uid:tool.uid, remainingUses:uses-use-1 });
      else expect(current?.uid).not.toBe(tool.uid);
      game.board.consumeItems(board.cells.flatMap((cell) => cell.item?.definitionId === 'coffee_01' ? [{cellIndex:cell.index, ...cell.item}] : []));
    }
    expect(game.board.getBoard().cells.some((cell) => cell.item?.uid === tool.uid)).toBe(false);
    expect(game.player.energy).toBe(energy);
  });
  it.each([[1,3],[2,8],[3,20],[4,50]])('merges two full level %i scissors into %i uses', (level, uses) => {
    const game = fixture().open(); game.debugClearBoard();
    game.board.placeAt(0, `scissors_0${level}`); game.board.placeAt(1, `scissors_0${level}`);
    expect(game.dropItem(0,1)).toMatchObject({ok:true,kind:'MERGE',resultDefinitionId:`scissors_0${level+1}`});
    expect(game.board.getBoard().cells[1].item?.remainingUses).toBe(uses);
  });
  it('prorates worn scissors and preserves uses/UID in storage and after restart', () => {
    const f=fixture(), game=f.open(); game.debugClearBoard();
    for (const index of [0,1]) { const item=game.board.placeAt(index,'scissors_02')!; item.remainingUses=1; }
    expect(game.dropItem(0,1)).toMatchObject({ok:true,kind:'MERGE'});
    const tool={...game.board.getBoard().cells[1].item!}; expect(tool.remainingUses).toBe(2);
    expect(game.playAction('store','1')).toEqual({ok:true});
    expect(f.open().play.state.warehouse[0]).toEqual(tool);
    const restored=f.open(); expect(restored.playAction('withdraw',tool.uid)).toEqual({ok:true});
    expect(f.open().board.getBoard().cells.find((cell)=>cell.item?.uid===tool.uid)?.item).toEqual(tool);
  });
  it('uses its final charge to free a slot on a full board, and otherwise needs an empty slot', () => {
    const game=fixture().open();game.debugAddXp(7650);game.debugClearBoard();
    for(let i=0;i<42;i++)game.board.placeAt(i,i===0?'scissors_02':i===1?'coffee_02':'coffee_01');
    const before=game.buildSaveData().board;expect(game.dropItem(0,1).ok).toBe(false);expect(game.buildSaveData().board).toEqual(before);
    game.board.getBoard().cells[0].item!.remainingUses=1;
    expect(game.dropItem(0,1)).toMatchObject({ok:true,kind:'SPLIT'});
    expect(game.board.getBoard().cells.filter((cell)=>cell.item)).toHaveLength(42);
  });
  it('cannot split base objects, locked cells or scissors into extra tools', () => {
    const game=fixture().open();game.debugClearBoard();game.board.placeAt(0,'scissors_03');game.board.placeAt(1,'coffee_01');
    expect(game.dropItem(0,1)).toEqual({ok:false,reason:'INVALID'});
    game.board.placeAt(1,'scissors_02');expect(game.playAction('split','1')).toEqual({ok:false,reason:'CANNOT_SPLIT'});
    game.board.placeAt(4,'coffee_02');expect(game.dropItem(0,4).ok).toBe(false);
  });
  it('keeps legacy scissors as finite claimable stock', () => {
    const f=fixture(),game=f.open();game.debugClearBoard();const stock=game.play.state.scissors;
    for(let i=0;i<stock;i++)expect(game.playAction('take_scissors','')).toEqual({ok:true});
    expect(game.playAction('take_scissors','')).toEqual({ok:false,reason:'NO_SCISSORS'});
    expect(f.open().play.state.scissors).toBe(0);
    expect(f.open().board.getBoard().cells.filter((cell)=>cell.item?.definitionId==='scissors_01')).toHaveLength(stock);
  });
  it('does not spend claimable stock when every open cell is occupied', () => {
    const f=fixture(),game=f.open();game.debugClearBoard();
    for(const cell of game.board.getBoard().cells) if(!cell.locked) game.board.placeAt(cell.index,'coffee_01');
    const before=game.buildSaveData();
    expect(game.playAction('take_scissors','')).toEqual({ok:false,reason:'BOARD_FULL'});
    expect(game.play.state.scissors).toBe(before.play.scissors);
    expect(game.buildSaveData().board).toEqual(before.board);
    expect(f.open().play.state.scissors).toBe(before.play.scissors);
  });
  it('gives the configured weekly scissors once, without replacing the existing currency reward', () => {
    const f=fixture(),game=f.open();
    for(let i=0;i<7;i++){expect(game.claimDailyCheckIn().ok).toBe(true);f.clock.advance(86_400_000);}
    expect(game.rewardInbox.filter((item)=>item.definitionId==='scissors_02')).toHaveLength(1);
    const restored=f.open();expect(restored.rewardInbox.filter((item)=>item.definitionId==='scissors_02')).toHaveLength(1);
  });
});
