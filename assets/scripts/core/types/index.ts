/** Core shared types — pure TypeScript, no Cocos. */

export type ChainId = 'coffee' | 'flower' | 'dessert' | 'gift' | (string & {});

export type ItemDefinition = {
  id: string;
  chainId: string;
  level: number;
  displayName: string;
  nextItemId?: string;
  maxLevel?: boolean;
  sellValue?: number;
  useValue?: number;
  maxUses?: number;
  wildcardEligible?: boolean;
  wildcard?: boolean;
  icon?: string;
  generator?: GeneratorItemRules;
};

/** Compiled from JSON generator configuration for one physical producer tier. */
export type GeneratorItemRules = { id: string; capacity: number; recoveryIntervalMs: number; cooldownMs: number; mergeRemainingRatio?: number };
export type GeneratorItemState = { remainingUses: number; recoveryAt: number; cooldownUntil: number | null; boosted: boolean };

export type ItemInstance = {
  uid: string;
  definitionId: string;
  remainingUses?: number;
  generatorState?: GeneratorItemState;
};

export type BoardPosition = {
  row: number;
  column: number;
};

export type BoardCellState = {
  index: number;
  locked?: boolean;
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
  diamonds: number;
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

export type OrderDynamicConfig = {
  pacedSlots?: boolean;
  difficulty?: Array<{ minPlayerLevel: number; regularMin: number; goalMin: number; maxItemLevel: number }>;
  quickMaxItemLevel?: number;
  regularTwoItemChance?: number;
  twoItemChance: number;
  rareChance: number;
  urgentChance: number;
  urgentDurationMs: number;
  rewardMultiplierMin: number;
  rewardMultiplierMax: number;
  rewardMultiplierMaxLevel: number;
};

export type ActiveOrder = {
  pace?: 'quick' | 'regular' | 'goal';
  longTerm?: boolean;
  urgentUntil?: number;
  urgentBaseCoins?: number;
  urgentBaseXp?: number;
  urgentBaseHearts?: number;
  uid: string;
  templateId: string;
  requirements: OrderRequirement[];
  rewardCoins: number;
  rewardXp: number;
  rewardHearts: number;
};

export type FirstUseHint = 'backpack' | 'scissors' | 'chest';

export type TutorialState = {
  firstUseHints?: FirstUseHint[];
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
  dateLabel?: string;
  artColumns?: number;
  artRows?: number;
  artMode?: 'cover' | 'contain';
  artFocusY?: number;
  artLabel?: string;
};

export type FurnitureDefinition = {
  id: string;
  title: string;
  category: string;
  room: 'living' | 'bedroom' | 'garden' | 'study' | 'terrace' | 'pool';
  placement: { x: number; y: number; width: number; height: number };
  coinCost: number;
  unlockLevel: number;
  decorPoints: number;
  art: string;
};

export type WishMetric = 'spawns' | 'merges' | 'orders' | 'level' | 'memories' | 'furniture' | 'decor';

export type WishDefinition = {
  generatorReward?: GeneratorGift;
  id: string;
  title: string;
  metric: WishMetric;
  target: number;
  rewardCoins: number;
  rewardHearts: number;
};

export type LevelReward = { coins: number; hearts: number; xp: number; generator?: GeneratorGift };

export type LevelRewardConfig = {
  generatorRotation?: string[];
  default: { coinsPerLevel: number; heartsPerLevel: number; xp: number };
  special: Array<LevelReward & { level: number }>;
};

export type LifeState = {
  furniturePositions: Record<string, { x: number; y: number; scale?: number; rotation?: number; flipped?: boolean }>;
  unlockedMemoryIds: string[];
  ownedFurnitureIds: string[];
  placedFurnitureIds: string[];
  claimedWishIds: string[];
  claimedLevelRewards: number[];
  photoPaths: string[];
  stats: GameStats;
};

export type GamePreferences = {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
};

export type GeneratorChargeState = { charges: number; lastRecoveryAt: number; capacity?: number };
export type GeneratorCooldownState = { streak: number; cooldownStartedAt: number | null };
export type GeneratorGift = { generatorId: string; level: number; count: number };
export type GeneratorReward = { id: string; generatorId: string; level: number; count: number; source: 'legacy' | 'unlock' | 'level_reward' | 'wish_reward' | 'chapter_reward'; state?: GeneratorItemState };
export type GeneratorBoardState = { ready: boolean; entitlements: string[]; rewards: GeneratorReward[]; grantedSourceIds?: string[] };

export type SaveData = {
  version: number;
  savedAt: number;
  preferences: GamePreferences;
  player: PlayerState;
  board: BoardCellState[];
  boardSize?: { rows: number; columns: number };
  legacyBoardEntitlement: boolean;
  retainedOpenCellIndices?: number[];
  rewardInbox: ItemInstance[];
  discoveredItemIds: string[];
  claimedDiscoveryIds: string[];
  checkIn: { lastClaimDay: number | null; claims: number };
  generatorCharges?: Record<string, GeneratorChargeState>;
  generatorInventory?: Record<string, number[]>;
  generatorCooldowns?: Record<string, GeneratorCooldownState>;
  generatorBoard?: GeneratorBoardState;
  claimedCollectionIds?: string[];
  orderRefreshAt?: Array<number | null>;
  dailyTasks?: { day: number; targetItemId: string; progress: Record<string, number>; claimedIds: string[] };
  weeklyChallenge?: WeeklyChallengeState;
  journal?: import('../../gameplay/JournalService').JournalState;
  activeOrders: ActiveOrder[];
  tutorial: TutorialState;
  recentOrderIds?: string[];
  life: LifeState;
  play: import('../play/types').PlayState;
};
export type WeeklyChallengeState = {
  week: number; orders: number; challengeOrders: number; advancedMerges: number;
  orderDays: number[]; claimed: boolean; completedWeeks: number;
  pendingRewardWeeks: number[];
};
export type WeeklyChallengeConfig = {
  minLevel: number;
  advancedItemLevel: number;
  themes: Array<{ title: string; days: number; orders: number; challengeOrders: number; advancedMerges: number; chains: string[] }>;
  reward: { coins: number; xp: number; energy: number; diamonds: number };
};

export type GameConfig = {
  generatorRestore: { cooldownCost: number; chargeCost: number };
  collection: { chainIds: string[]; energyPerChain: number; maxEnergyCap: number };
  generationBonusDrops: Array<{ generatorId: string; minLevel: number; chance: number; itemId: string; excludeRecharge?: boolean }>;
  gameTitle: string;
  saveKey: string;
  saveVersion: number;
  toolbox: { warehouseSlots: number; startingScissors: number; backpackExpansion: { maxSlots: number; baseDiamondCost: number; stepDiamondCost: number } };
  board: { rows: number; columns: number; unlocks: Array<{ level: number; rows: number; columns: number }> };
  rewards: { discoveryCoins: number; chestDropChance: number; chestLoot: Array<{ itemId: string; weight: number }>; chestLevels: Array<{ level: number; count: number; loot?: Array<{ itemId: string; weight: number }> }>; exchangeOffers: Array<{ id: string; diamonds: number; energy: number }>; checkIn: Array<{ coins: number; energy: number; diamonds: number; itemId?: string }>; dailyTasks: Array<{ id: string; kind: 'orders' | 'merges' | 'specific'; title: string; target: number; reward: { coins: number; xp: number; energy: number; diamonds: number } }>; weeklyChallenge?: WeeklyChallengeConfig };
  energy: {
    maxEnergy: number;
    maxByLevel?: number[];
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
    refreshCooldownMs: number;
    refreshDiamondCost: number;
    dynamic: OrderDynamicConfig;
  };
  couple: {
    gameTitle: string;
    coupleDisplayName: string;
    anniversary: string;
    metMonth?: string;
    metDate?: string;
    weddingDate?: string;
    theme: string;
    gift?: {
      coverMessage?: string;
      title?: string;
      salutation?: string;
      body?: string;
      signoff?: string;
      signature?: string;
    };
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
  purchaseCoins: number;
  recharge?: { capacity: number; intervalMs: number; legacyCapacity?: number };
  streakCooldown?: { uses: number; durationMs: number };
  upgrade?: { maxLevel: number; rechargeFactor: number; boostEnergyMultiplier: number; mergeRemainingRatio?: number; levels: Array<{ level: number; outputs: GeneratorOutput[]; boostOutputs?: GeneratorOutput[] }> };
  outputs: GeneratorOutput[];
};

export type OrderTemplate = {
  longTerm?: boolean;
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
  | { kind: 'SPLIT'; from: number; to: number }
  | { kind: 'MOVE'; from: number; to: number }
  | { kind: 'MERGE'; from: number; to: number }
  | { kind: 'SWAP'; from: number; to: number }
  | { kind: 'CANCEL' };
