/**
 * Platform-agnostic view model for status / orders / board / generators.
 * Cocos views map Domain state through this file — do not query config ad hoc.
 */
import type {
  ActiveOrder,
  GeneratorDefinition,
  ItemDefinition,
  PlayerState,
} from '../core/types';
import type { OrderProgress } from '../core/board/rules';
import type { ConfigBundle } from '../config/ConfigRepository';
import { getXpToNext } from '../core/progression/progression';

export type ItemVm = {
  uid: string;
  definitionId: string;
  displayName: string;
  level: number;
  chainId: string;
  code: string;
  cellIndex: number;
};

export type OrderReqVm = {
  itemId: string;
  displayName: string;
  have: number;
  count: number;
  done: boolean;
};

export type OrderVm = {
  uid: string;
  requirements: OrderReqVm[];
  rewardCoins: number;
  rewardXp: number;
  rewardHearts: number;
  ready: boolean;
  buttonText: string;
  rewardText: string;
};

export type GeneratorVm = {
  id: string;
  displayName: string;
  locked: boolean;
  unlockLevel: number;
  energyCost: number;
  lockText: string;
  costText: string;
  chainId: string;
};

export type StatusVm = {
  level: number;
  xp: number;
  xpText: string;
  xpRatio: number;
  energy: number;
  maxEnergy: number;
  energyText: string;
  energyCountdownText: string;
  coins: number;
  hearts: number;
  coinsText: string;
  heartsText: string;
};

export type BoardVm = {
  rows: number;
  columns: number;
  items: ItemVm[];
};

const CHAIN_CODE: Record<string, string> = {
  coffee: '咖',
  flower: '花',
  dessert: '甜',
  gift: '礼',
};

export function chainCode(chainId: string): string {
  return CHAIN_CODE[chainId] ?? chainId.slice(0, 1);
}

export function itemCode(def: Pick<ItemDefinition, 'chainId' | 'level'>): string {
  return `${chainCode(def.chainId)}${def.level}`;
}

export class GameViewMapper {
  constructor(private readonly bundle: ConfigBundle) {}

  mapStatus(
    player: PlayerState,
    nowMs: number,
    recoverIntervalMs: number,
  ): StatusVm {
    const xpInfo = getXpToNext(this.bundle.progression, player.xp);
    const currentFloor =
      this.bundle.progression.levels.find((l) => l.level === player.level)
        ?.xpRequired ?? 0;
    const span =
      xpInfo.nextThreshold !== null
        ? Math.max(1, xpInfo.nextThreshold - currentFloor)
        : 1;
    const xpRatio =
      xpInfo.nextThreshold === null
        ? 1
        : Math.min(1, Math.max(0, (player.xp - currentFloor) / span));

    const energyText = `${player.energy}/${player.maxEnergy}`;
    let energyCountdownText = '';
    if (player.energy < player.maxEnergy) {
      const interval = Math.max(1, recoverIntervalMs);
      const elapsed = Math.max(0, nowMs - player.lastEnergyAt);
      const remainMs = Math.max(0, interval - (elapsed % interval));
      const totalSec = Math.ceil(remainMs / 1000);
      const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
      const ss = String(totalSec % 60).padStart(2, '0');
      energyCountdownText = `${mm}:${ss}`;
    }

    return {
      level: player.level,
      xp: player.xp,
      xpText:
        xpInfo.nextThreshold === null
          ? `XP ${player.xp}`
          : `XP ${player.xp} / ${xpInfo.nextThreshold}`,
      xpRatio,
      energy: player.energy,
      maxEnergy: player.maxEnergy,
      energyText,
      energyCountdownText,
      coins: player.coins,
      hearts: player.hearts,
      coinsText: String(player.coins),
      heartsText: String(player.hearts),
    };
  }

  mapBoard(
    board: { rows: number; columns: number; cells: Array<{ index: number; item?: { uid: string; definitionId: string } }> },
  ): BoardVm {
    const items: ItemVm[] = [];
    for (const cell of board.cells) {
      if (!cell.item) continue;
      const def = this.bundle.catalog.get(cell.item.definitionId);
      if (!def) continue;
      items.push({
        uid: cell.item.uid,
        definitionId: def.id,
        displayName: def.displayName,
        level: def.level,
        chainId: def.chainId,
        code: itemCode(def),
        cellIndex: cell.index,
      });
    }
    return { rows: board.rows, columns: board.columns, items };
  }

  mapOrder(order: ActiveOrder, progress: OrderProgress): OrderVm {
    const requirements: OrderReqVm[] = progress.requirements.map((req) => {
      const def = this.bundle.catalog.get(req.itemId);
      return {
        itemId: req.itemId,
        displayName: def?.displayName ?? req.itemId,
        have: req.have,
        count: req.count,
        done: req.done,
      };
    });
    return {
      uid: order.uid,
      requirements,
      rewardCoins: order.rewardCoins,
      rewardXp: order.rewardXp,
      rewardHearts: order.rewardHearts,
      ready: progress.ready,
      buttonText: progress.ready ? '交付' : '还差一点',
      rewardText: `金币 ${order.rewardCoins}  爱心 ${order.rewardHearts}`,
    };
  }

  mapGenerators(
    generators: readonly GeneratorDefinition[],
    player: PlayerState,
  ): GeneratorVm[] {
    return generators.map((gen) => {
      const locked = player.level < gen.unlockLevel;
      return {
        id: gen.id,
        displayName: gen.displayName,
        locked,
        unlockLevel: gen.unlockLevel,
        energyCost: gen.energyCost,
        lockText: locked ? `Lv${gen.unlockLevel} 解锁` : '',
        costText: `⚡${gen.energyCost}`,
        chainId: gen.chainId,
      };
    });
  }
}
