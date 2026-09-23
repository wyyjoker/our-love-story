/**
 * Presentation controller shared by Web UI and Cocos UI.
 * Chinese copy for product-facing messages.
 */
import type { GameContext } from '../gameplay/GameContext';

export type UIMessage = {
  toast?: string;
  tone?: 'info' | 'success' | 'warn';
};

export class GameController {
  constructor(protected readonly game: GameContext) {}

  bootUi(): void {
    if (this.game.bootState !== 'READY') {
      throw new Error(`Game not ready: ${this.game.bootState}`);
    }
  }

  onPointerTapGenerator(generatorId: string): UIMessage {
    const result = this.game.spawnFromGenerator(generatorId);
    if (result.ok) return {};
    switch (result.reason) {
      case 'BOARD_FULL':
        return { toast: '棋盘满啦～\n先合成一些物品吧', tone: 'warn' };
      case 'NOT_ENOUGH_ENERGY':
        return { toast: '体力不足啦～\n休息一下再回来吧', tone: 'warn' };
      case 'LOCKED': {
        const gen = this.game.generators.get(generatorId);
        const lv = gen?.unlockLevel ?? 3;
        return { toast: `达到 Lv${lv} 后解锁`, tone: 'warn' };
      }
      default:
        return { toast: '暂时无法生成', tone: 'warn' };
    }
  }

  onDrop(from: number, to: number | null): UIMessage & {
    ok: boolean;
    kind?: 'MOVE' | 'MERGE' | 'SWAP';
  } {
    const result = this.game.dropItem(from, to);
    if (!result.ok) {
      return { ok: false };
    }
    if (result.kind === 'MERGE') {
      return { ok: true, kind: 'MERGE', toast: '合成成功！', tone: 'success' };
    }
    return { ok: true, kind: result.kind };
  }

  onClaim(orderUid: string): UIMessage {
    const result = this.game.claimOrder(orderUid);
    if (result.ok) {
      return {
        toast: `交付成功！\n金币 +${result.rewardCoins}  爱心 +${result.rewardHearts}`,
        tone: 'success',
      };
    }
    if (result.reason === 'INVENTORY_RACE') {
      return { toast: '还差一点，先凑齐物品吧', tone: 'warn' };
    }
    return { toast: '订单未完成', tone: 'warn' };
  }
}
