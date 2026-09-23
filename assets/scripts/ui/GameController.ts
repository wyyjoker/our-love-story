/**
 * Presentation controller contract shared by Cocos UI and Web UI.
 */
import type { GameContext } from '../gameplay/GameContext';

export type UIMessage = {
  toast?: string;
  levelUp?: { level: number; unlockedChains: string[] };
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
        return { toast: 'Board is full. Merge some items first.' };
      case 'NOT_ENOUGH_ENERGY':
        return { toast: 'Not enough energy. Take a short rest.' };
      case 'LOCKED':
        return { toast: 'Locked. Level up to unlock.' };
      default:
        return { toast: 'Unable to spawn right now.' };
    }
  }

  onDrop(from: number, to: number | null): UIMessage {
    const result = this.game.dropItem(from, to);
    if (!result.ok) return {};
    if (result.kind === 'MERGE') {
      return { toast: 'Merge success!' };
    }
    return {};
  }

  onClaim(orderUid: string): UIMessage {
    const result = this.game.claimOrder(orderUid);
    if (result.ok) {
      return {
        toast: `Delivered! coins ${result.rewardCoins} hearts ${result.rewardHearts}`,
      };
    }
    if (result.reason === 'INVENTORY_RACE') {
      return { toast: 'Need more items first.' };
    }
    return { toast: 'Order not ready.' };
  }
}
