/** Core shared types — pure TypeScript, no Cocos. */

export type ChainId = 'coffee' | 'flower' | 'dessert' | 'gift' | (string & {});

export type ItemDefinition = {
  id: string;
  chainId: string;
  level: number;
  displayName: string;
  nextItemId?: string;
  sellValue?: number;
  icon?: string;
};

export type ItemInstance = {
  uid: string;
  definitionId: string;
};

export type BoardPosition = {
  row: number;
  column: number;
};

export type BoardCellState = {
  index: number;
  item?: ItemInstance;
};

export type BoardState = {
  rows: number;
  columns: number;
  cells: BoardCellState[];
};

export type PlayerState = {
  level: number;
  xp: number;
  coins: number;
  hearts: number;
  energy: number;
  maxEnergy: number;
  lastEnergyAt: number;
  unlockedChainIds: string[];
};

export type OrderRequirement = {
  itemId: string;
  count: number;
};

export type ActiveOrder = {
  uid: string;
  templateId: string;
  requirements: OrderRequirement[];
  rewardCoins: number;
  rewardXp: number;
  rewardHearts: number;
};

export type TutorialState = {
  generatorClicked: boolean;
  firstMergeCompleted: boolean;
  firstOrderCompleted: boolean;
  firstOrderHintShown?: boolean;
};

export type GameStats = {
  spawns: number;
  merges: number;
  orders: number;
};

export type MemoryDefinition = {
  id: string;
  title: string;
  summary: string;
  diary: string;
  heartCost: number;
  art: string;
};

export type FurnitureDefinition = {
  id: string;
  title: string;
  category: string;
  room: 'living' | 'bedroom' | 'garden';
  placement: { x: number; y: number; width: number; height: number };
  coinCost: number;
  unlockLevel: number;
  decorPoints: number;
  art: string;
};

export type WishMetric = 'spawns' | 'merges' | 'orders' | 'level' | 'memories' | 'furniture' | 'decor';

export type WishDefinition = {
  id: string;
  title: string;
  metric: WishMetric;
  target: number;
  rewardCoins: number;
  rewardHearts: number;
};

export type LevelRewardConfig = {
  default: { coinsPerLevel: number; heartsPerLevel: number; xp: number };
  special: Array<{ level: number; coins: number; hearts: number; xp: number }>;
};

export type LifeState = {
  unlockedMemoryIds: string[];
  ownedFurnitureIds: string[];
  placedFurnitureIds: string[];
  claimedWishIds: string[];
  claimedLevelRewards: number[];
  photoPaths: string[];
  stats: GameStats;
};

export type SaveData = {
  version: number;
  savedAt: number;
  player: PlayerState;
  board: BoardCellState[];
  activeOrders: ActiveOrder[];
  tutorial: TutorialState;
  recentOrderIds?: string[];
  life: LifeState;
};

export type GameConfig = {
  gameTitle: string;
  saveKey: string;
  saveVersion: number;
  board: { rows: number; columns: number };
  energy: {
    maxEnergy: number;
    initialEnergy: number;
    generatorCost: number;
    recoverIntervalMs: number;
  };
  dragThresholdPx: number;
  orders: {
    activeSlots: number;
    minRequirements: number;
    maxRequirements: number;
    minItemLevel: number;
    maxItemLevel: number;
  };
  couple: {
    gameTitle: string;
    coupleDisplayName: string;
    anniversary: string;
    theme: string;
  };
};

export type GeneratorOutput = {
  itemId: string;
  weight: number;
};

export type GeneratorDefinition = {
  id: string;
  displayName: string;
  chainId: string;
  unlockLevel: number;
  energyCost: number;
  outputs: GeneratorOutput[];
};

export type OrderTemplate = {
  id: string;
  minLevel: number;
  maxLevel: number;
  requirements: OrderRequirement[];
  rewardCoins: number;
  rewardXp: number;
  rewardHearts: number;
  tutorialOnly?: boolean;
};

export type ProgressionLevel = {
  level: number;
  xpRequired: number;
  unlockChains: string[];
};

export type ProgressionConfig = {
  levels: ProgressionLevel[];
};

export type DragKind = 'MOVE' | 'MERGE' | 'SWAP' | 'CANCEL';

export type DropResolve =
  | { kind: 'MOVE'; from: number; to: number }
  | { kind: 'MERGE'; from: number; to: number }
  | { kind: 'SWAP'; from: number; to: number }
  | { kind: 'CANCEL' };
