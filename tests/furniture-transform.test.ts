import { describe, it, expect } from 'vitest';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';

function fixture() {
  const data = new Map<string,string>();
  const storage = { getItem:(key:string)=>data.get(key)??null, setItem:(key:string,value:string)=>{data.set(key,value);}, removeItem:(key:string)=>{data.delete(key);} };
  const open = () => createGameContext({ storage, deterministic:true, saveDebounceMs:0 });
  return {data,open};
}
describe('furniture transforms', () => {
  it('preserves position when first transforming, then preserves transform through movement and restart', () => {
    const f=fixture(), g=f.open(), item=g.bundle.furniture[0];
    g.debugAddCoins(item.coinCost); expect(g.buyFurniture(item.id).ok).toBe(true);
    expect(g.setFurnitureTransform(item.id,{scale:1.4})).toEqual({ok:false,reason:'NOT_READY'});
    expect(g.setFurnitureTransform(item.id,{x:0.23,y:0.36,scale:1.4,rotation:-45,flipped:true})).toEqual({ok:true});
    expect(g.life.state.furniturePositions[item.id]).toEqual({x:0.23,y:0.36,scale:1.4,rotation:-45,flipped:true});
    expect(g.setFurnitureTransform(item.id,{x:0.8,y:0.9,scale:1.6})).toEqual({ok:true});
    expect(g.life.state.furniturePositions[item.id]).toEqual({x:0.8,y:0.9,scale:1.6,rotation:-45,flipped:true});
    expect(g.moveFurniture(item.id,0.7,0.2)).toEqual({ok:true});
    const expected={x:0.7,y:0.2,scale:1.6,rotation:-45,flipped:true};
    expect(g.life.state.furniturePositions[item.id]).toEqual(expected);
    const snapshot=g.buildSaveData(); snapshot.life.furniturePositions[item.id].scale=0.5;
    expect(g.life.state.furniturePositions[item.id]).toEqual(expected);
    const restored=f.open(); expect(restored.life.state.furniturePositions[item.id]).toEqual(expected);
    expect(restored.resetFurniturePosition(item.id)).toEqual({ok:true});
    expect(restored.life.state.furniturePositions[item.id]).toBeUndefined();
    expect(f.open().life.state.furniturePositions[item.id]).toBeUndefined();
  });
  it('persists clamped coordinates with the transform and retains them when coordinates are omitted', () => {
    const f=fixture(), g=f.open(), item=g.bundle.furniture[0];
    g.debugAddCoins(item.coinCost); g.buyFurniture(item.id); g.moveFurniture(item.id,0.05,0.45);
    const reopened=f.open();
    expect(reopened.setFurnitureTransform(item.id,{scale:1.1,rotation:-15,x:0.18,y:0.45})).toEqual({ok:true});
    expect(f.open().life.state.furniturePositions[item.id]).toEqual({x:0.18,y:0.45,scale:1.1,rotation:-15,flipped:false});
    expect(reopened.setFurnitureTransform(item.id,{flipped:true})).toEqual({ok:true});
    const before=reopened.buildSaveData();
    expect(reopened.life.state.furniturePositions[item.id]).toEqual({x:0.18,y:0.45,scale:1.1,rotation:-15,flipped:true});
    expect(reopened.setFurnitureTransform(item.id,{x:-0.1,y:0.5,scale:1.3})).toEqual({ok:false,reason:'NOT_READY'});
    expect(reopened.buildSaveData()).toEqual(before);
  });
  it('rejects invalid values atomically and only edits owned, placed furniture', () => {
    const g=fixture().open(), item=g.bundle.furniture[0];
    expect(g.setFurnitureTransform('missing',{scale:1})).toEqual({ok:false,reason:'NOT_FOUND'});
    expect(g.setFurnitureTransform(item.id,{scale:1})).toEqual({ok:false,reason:'LOCKED'});
    g.debugAddCoins(item.coinCost); g.buyFurniture(item.id); g.moveFurniture(item.id,0.3,0.4);
    const before=g.buildSaveData();
    for (const patch of [{scale:0.49},{scale:1.81},{scale:Infinity},{rotation:-181},{rotation:181},{rotation:NaN},{x:1.1},{y:-0.1},{flipped:'yes'}]) {
      expect(g.setFurnitureTransform(item.id,patch as Parameters<typeof g.setFurnitureTransform>[1])).toEqual({ok:false,reason:'NOT_READY'});
      expect(g.buildSaveData()).toEqual(before);
    }
    expect(g.setFurnitureTransform(item.id,{scale:0.5,rotation:180,flipped:true}).ok).toBe(true);
    expect(g.setFurnitureTransform(item.id,{scale:1.8,rotation:-180,flipped:false}).ok).toBe(true);
    g.placeFurniture(item.id);
    expect(g.setFurnitureTransform(item.id,{scale:1})).toEqual({ok:false,reason:'LOCKED'});
  });
  it('restores old positions with default transform values and repairs invalid optional values', () => {
    const f=fixture(), g=f.open(), item=g.bundle.furniture[0];
    g.debugAddCoins(item.coinCost); g.buyFurniture(item.id); const saved=g.buildSaveData();
    saved.life.furniturePositions[item.id]={x:0.2,y:0.8}; f.data.set(g.config.saveKey,JSON.stringify(saved));
    let restored=f.open(); expect(restored.life.state.furniturePositions[item.id]).toEqual({x:0.2,y:0.8,scale:1,rotation:0,flipped:false});
    const malformed=restored.buildSaveData(); malformed.life.furniturePositions[item.id]={x:0.2,y:0.8,scale:4,rotation:181,flipped:'bad' as unknown as boolean};
    f.data.set(g.config.saveKey,JSON.stringify(malformed)); restored=f.open();
    expect(restored.life.state.furniturePositions[item.id]).toEqual({x:0.2,y:0.8,scale:1,rotation:0,flipped:false});
  });
});
