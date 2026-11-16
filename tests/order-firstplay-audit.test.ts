import { describe, expect, it } from 'vitest';
import { generateOrder, requirementSignature } from '../assets/scripts/core/order/orders';
import { loadConfigBundle } from '../assets/scripts/config/ConfigRepository';
import { FixedRandomService } from '../assets/scripts/infrastructure/RandomService';
import { FakeClockService } from '../assets/scripts/infrastructure/ClockService';
import { createGameContext } from '../assets/scripts/gameplay/GameContext';
import { createDefaultSaveData } from '../assets/scripts/infrastructure/SaveService';
const bundle=loadConfigBundle();
describe('orders remain playable without manual replacement',()=>{
  it('selects actual unlocked producers and allows two early needs through GameContext',()=>{
    for(const level of [1,2,3,5,8]){
      const g=createGameContext({deterministic:true,random:new FixedRandomService([0])});
      if(level>1)g.debugAddXp(25*level*(level-1));
      expect(g.player.level).toBe(level);
      g.orders.hydrate([],[]);g.orders.ensureFilled();
      const orders=g.orders.getOrders();expect(orders).toHaveLength(3);
      expect(orders.some(order=>order.requirements.reduce((sum,r)=>sum+r.count,0)===2)).toBe(true);
      const fruitOrders=orders.filter(order=>order.requirements.some(r=>bundle.catalog.get(r.itemId)!.chainId==='fruit'));
      expect(fruitOrders.length).toBe(level>=2?1:0);
      for(const order of orders)for(const req of order.requirements){
        const chain=bundle.catalog.get(req.itemId)!.chainId;
        const producer=bundle.generators.find(generator=>generator.chainId===chain)!;
        expect(g.getGeneratorStatus(producer.id)?.unlocked).toBe(true);
      }
    }
  });
  it('fills three distinct early coffee needs, reusing the completed kind before duplicating an occupied slot',()=>{
    for(const level of [1,2,3,4,5]) {
      const slots=[1,2,3].map(n=>({templateId:'old',requirements:[{itemId:`coffee_0${n}`,count:1}]}));
      for(let turn=0;turn<60;turn++){
        const index=turn%3;
        const next=generateOrder({player:{level,unlockedChainIds:['coffee']},templates:bundle.orders,catalog:bundle.catalog,recentOrderIds:[],activeOrders:slots.filter((_,i)=>i!==index),replacingRequirements:slots[index].requirements,minItemLevel:1,maxItemLevel:12,random:new FixedRandomService([turn/60]),id:'new'})!;
        slots[index]=next;expect(new Set(slots.map(s=>requirementSignature(s.requirements))).size).toBe(3);
        expect(next.requirements.reduce((sum,r)=>sum+r.count,0)).toBeLessThanOrEqual(2);
      }
    }
  });
  it('still fills a narrow upgraded pool without asking below the producer floor',()=>{
    for(const floor of [2,3,5,8]){
      const next=generateOrder({player:{level:3,unlockedChainIds:['coffee']},templates:bundle.orders,catalog:bundle.catalog,recentOrderIds:[],activeOrders:[],minItemLevel:1,maxItemLevel:12,minimumLevelForChain:()=>floor,random:new FixedRandomService([.5]),id:'floor'})!;
      expect(bundle.catalog.get(next.requirements[0].itemId)!.level).toBeGreaterThanOrEqual(floor);
    }
  });
  it('filters unavailable production routes even if a legacy unlock list contains them',()=>{
    const next=generateOrder({player:{level:12,unlockedChainIds:['coffee','sugar','coin']},templates:bundle.orders,catalog:bundle.catalog,recentOrderIds:[],minItemLevel:1,maxItemLevel:12,canProduceItem:id=>id.startsWith('coffee_'),random:new FixedRandomService([.8]),id:'guard'})!;
    expect(next.requirements.every(r=>r.itemId.startsWith('coffee_'))).toBe(true);
  });
  it.each([false,true])('repairs a locked legacy need only when it is not already held (held=%s)',held=>{
    const clock=new FakeClockService(1_000_000),save=createDefaultSaveData(bundle.game,clock.now());
    save.activeOrders[0]={...save.activeOrders[0],uid:'legacy-uid',requirements:[{itemId:'gift_03',count:1}],rewardCoins:123,rewardXp:4,rewardHearts:7};
    if(held)save.board[0].item={uid:'owned-gift',definitionId:'gift_03'};
    const map=new Map([[bundle.game.saveKey,JSON.stringify(save)]]),storage={getItem:(key:string)=>map.get(key)??null,setItem:(key:string,value:string)=>{map.set(key,value);},removeItem:(key:string)=>{map.delete(key);}};
    const open=()=>createGameContext({storage,clock,deterministic:true,saveDebounceMs:0});const g=open(),order=g.orders.getOrders()[0];
    expect(order).toMatchObject({uid:'legacy-uid',rewardCoins:123,rewardXp:4,rewardHearts:7});
    expect(order.requirements[0].itemId==='gift_03').toBe(held);expect(g.refreshOrder(order.uid,'free').ok).toBe(false);
    expect(open().orders.getOrders()[0]).toEqual(order);
  });
  it('offers unlocked orange-tree orders at Lv2 and limits early requests to one full charge cycle',()=>{
    const g=createGameContext({deterministic:true});g.debugAddXp(50);
    expect(g.getGeneratorStatus('orange_tree')?.unlocked).toBe(true);
    for(const level of [2,3,5,10,14])for(let turn=0;turn<100;turn++){
      const order=generateOrder({player:{level,unlockedChainIds:['coffee','fruit']},templates:bundle.orders,catalog:bundle.catalog,recentOrderIds:[],minItemLevel:1,maxItemLevel:12,limitedChainIds:['fruit'],maxMergeCostForChain:chain=>chain==='fruit'?10:Infinity,random:new FixedRandomService([turn/500]),id:'early-fruit'})!;
      expect(order.requirements.some(r=>r.itemId.startsWith('fruit_'))).toBe(true);
      const picks=order.requirements.filter(r=>r.itemId.startsWith('fruit_')).reduce((sum,r)=>sum+2**(bundle.catalog.get(r.itemId)!.level-1)*r.count,0);
      expect(picks).toBeLessThanOrEqual(10);
      const other=generateOrder({player:{level,unlockedChainIds:['coffee','fruit']},templates:bundle.orders,catalog:bundle.catalog,recentOrderIds:[],activeOrders:[order],minItemLevel:1,maxItemLevel:12,limitedChainIds:['fruit'],random:new FixedRandomService([0]),id:'next'})!;
      expect(other.requirements.every(r=>!r.itemId.startsWith('fruit_'))).toBe(true);
    }
  });

});
