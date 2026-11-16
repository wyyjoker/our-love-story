export type GameEventMap = {
  COLLECTION_CHANGED: { chainId: string };
  JOURNAL_CHANGED: Record<string, never>;
  GENERATOR_CHANGED: { generatorId: string };
  DAILY_TASKS_CHANGED: { day: number };
  REWARDS_CHANGED: { reason: 'inbox' | 'used' | 'exchange' };
  DISCOVERY_CHANGED: { definitionId: string };
  CHECK_IN_CHANGED: { day: number };
  PLAY_CHANGED: { reason: 'warehouse' | 'scissors' | 'chapter' | 'reward' };
  ITEM_SPAWNED: {
    uid: string;
    definitionId: string;
    cellIndex: number;
  };
  ITEM_MOVED: {
    uid: string;
    from: number;
    to: number;
  };
  ITEM_SWAPPED: {
    fromUid: string;
    toUid: string;
    from: number;
    to: number;
  };
  ITEM_MERGED: {
    from: number;
    to: number;
    resultUid: string;
    resultDefinitionId: string;
  };
  ENERGY_CHANGED: {
    energy: number;
    maxEnergy: number;
    delta: number;
  };
  ORDER_UPDATED: {
    orderUid: string;
  };
  ORDER_COMPLETED: {
    orderUid: string;
    rewardCoins: number;
    rewardXp: number;
    rewardHearts: number;
  };
  XP_CHANGED: {
    xp: number;
    delta: number;
  };
  LEVEL_UP: {
    level: number;
    previousLevel: number;
    unlockedChains: string[];
  };
  COINS_CHANGED: {
    coins: number;
    delta: number;
  };
  HEARTS_CHANGED: {
    hearts: number;
    delta: number;
  };
  GAME_SAVED: {
    savedAt: number;
  };
  SAVE_STATUS_CHANGED: { ok: boolean };
  TUTORIAL_UPDATED: {
    generatorClicked: boolean;
    firstMergeCompleted: boolean;
    firstOrderCompleted: boolean;
  };
  TOAST: {
    message: string;
    tone?: 'info' | 'success' | 'warn';
  };
  BOARD_CHANGED: {
    reason: 'spawn' | 'move' | 'swap' | 'merge' | 'claim' | 'reset' | 'debug' | 'tool';
  };
  LIFE_CHANGED: {
    reason: 'memory' | 'furniture' | 'wish' | 'level-reward' | 'photo' | 'progress';
  };
};

export type GameEventType = keyof GameEventMap;
export type GameEventHandler<K extends GameEventType> = (
  payload: GameEventMap[K],
) => void;
