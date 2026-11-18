import { describe, expect, it } from 'vitest';
import { mergePageLayout, safeContentRect } from '../assets/scripts/presentation/UiSafety';

describe('watercolor merge page geometry',()=>{
  it.each([[320,568],[375,667],[375,812],[390,844],[430,932]])('keeps all square cells and chrome inside %ix%i', (width,height)=>{
    const h=750*height/width, layout=mergePageLayout(750,h);
    const gridH=9*layout.cellSize+8*layout.gap,gridW=7*layout.cellSize+6*layout.gap;
    expect(gridW).toBeLessThanOrEqual(750-56);expect(gridW).toBeGreaterThan(750-82);expect(layout.cellSize).toBeGreaterThan(90);
    expect(layout.boardTop+layout.boardHeight+layout.boardBottom).toBeCloseTo(h);
    expect(layout.boardTop-layout.orderTop-layout.orderHeight).toBeCloseTo(8);
    expect(layout.orderTop).toBeGreaterThan(12+layout.statusHeight);
    expect(layout.boardHeight).toBeGreaterThan(gridH);expect(layout.orderHeight).toBeGreaterThanOrEqual(136);
    expect(layout.boardBottom-layout.footerHeight).toBe(28);
  });
  it('reserves asymmetric safe areas before allocating content and adapts the shortest case without overlapping controls',()=>{
    for(const rawHeight of [1331,1624,1780]){
      const safe=safeContentRect(750,rawHeight,{top:106,bottom:62,left:14,right:0});
      const layout=mergePageLayout(safe.width,safe.height);
      expect(layout.cellSize).toBeGreaterThan(60);expect(layout.orderHeight).toBeGreaterThanOrEqual(136);
      expect(layout.orderTop+layout.orderHeight).toBeLessThan(layout.boardTop);
      expect(layout.boardTop+layout.boardHeight).toBeLessThan(safe.height);
    }
  });
});
