"use strict";
(() => {
  // assets/scripts/core/board/board.ts
  function createEmptyBoard(rows, columns) {
    const cells = [];
    for (let index = 0; index < rows * columns; index += 1) {
      cells.push({ index });
    }
    return { rows, columns, cells };
  }
  function isValidIndex(index, rows, columns) {
    return Number.isInteger(index) && index >= 0 && index < rows * columns;
  }
  function findFirstEmptyIndex(board) {
    for (const cell of board.cells) {
      if (!cell.item) return cell.index;
    }
    return null;
  }
  function isBoardFull(board) {
    return findFirstEmptyIndex(board) === null;
  }
  function getCellItem(board, index) {
    return board.cells[index]?.item;
  }
  function cloneBoard(board) {
    return {
      rows: board.rows,
      columns: board.columns,
      cells: board.cells.map((cell) => ({
        index: cell.index,
        item: cell.item ? { ...cell.item } : void 0
      }))
    };
  }

  // assets/scripts/core/item/catalog.ts
  function createItemCatalog(items) {
    const map = /* @__PURE__ */ new Map();
    for (const item of items) {
      if (map.has(item.id)) {
        throw new Error(`Duplicate item id: ${item.id}`);
      }
      map.set(item.id, item);
    }
    return map;
  }

  // assets/resources/config/game.json
  var game_default = {
    gameTitle: "\u6211\u4EEC\u7684\u6D6A\u6F2B\u5C0F\u5C4B",
    saveKey: "our-love-story-save",
    saveVersion: 1,
    board: {
      rows: 9,
      columns: 7
    },
    energy: {
      maxEnergy: 50,
      initialEnergy: 50,
      generatorCost: 1,
      recoverIntervalMs: 12e4
    },
    dragThresholdPx: 12,
    orders: {
      activeSlots: 3,
      minRequirements: 1,
      maxRequirements: 2,
      minItemLevel: 2,
      maxItemLevel: 5
    },
    couple: {
      gameTitle: "\u6211\u4EEC\u7684\u6D6A\u6F2B\u5C0F\u5C4B",
      coupleDisplayName: "",
      anniversary: "",
      theme: "warm-romantic"
    }
  };

  // assets/resources/config/items.json
  var items_default = [
    { id: "coffee_01", chainId: "coffee", level: 1, displayName: "\u5496\u5561\u8C46", nextItemId: "coffee_02", sellValue: 1 },
    { id: "coffee_02", chainId: "coffee", level: 2, displayName: "\u5496\u5561\u7C89", nextItemId: "coffee_03", sellValue: 2 },
    { id: "coffee_03", chainId: "coffee", level: 3, displayName: "\u6D53\u7F29\u5496\u5561", nextItemId: "coffee_04", sellValue: 4 },
    { id: "coffee_04", chainId: "coffee", level: 4, displayName: "\u7F8E\u5F0F\u5496\u5561", nextItemId: "coffee_05", sellValue: 8 },
    { id: "coffee_05", chainId: "coffee", level: 5, displayName: "\u62FF\u94C1", nextItemId: "coffee_06", sellValue: 16 },
    { id: "coffee_06", chainId: "coffee", level: 6, displayName: "\u7231\u5FC3\u62FF\u94C1", nextItemId: "coffee_07", sellValue: 32 },
    { id: "coffee_07", chainId: "coffee", level: 7, displayName: "\u53CC\u4EBA\u5496\u5561", nextItemId: "coffee_08", sellValue: 64 },
    { id: "coffee_08", chainId: "coffee", level: 8, displayName: "\u7EAA\u5FF5\u65E5\u5496\u5561", sellValue: 128 },
    { id: "flower_01", chainId: "flower", level: 1, displayName: "\u82B1\u79CD", nextItemId: "flower_02", sellValue: 1 },
    { id: "flower_02", chainId: "flower", level: 2, displayName: "\u82B1\u82D7", nextItemId: "flower_03", sellValue: 2 },
    { id: "flower_03", chainId: "flower", level: 3, displayName: "\u90C1\u91D1\u9999", nextItemId: "flower_04", sellValue: 4 },
    { id: "flower_04", chainId: "flower", level: 4, displayName: "\u73AB\u7470", nextItemId: "flower_05", sellValue: 8 },
    { id: "flower_05", chainId: "flower", level: 5, displayName: "\u5C0F\u82B1\u675F", nextItemId: "flower_06", sellValue: 16 },
    { id: "flower_06", chainId: "flower", level: 6, displayName: "\u7231\u5FC3\u82B1\u675F", nextItemId: "flower_07", sellValue: 32 },
    { id: "flower_07", chainId: "flower", level: 7, displayName: "\u7EAA\u5FF5\u65E5\u82B1\u675F", nextItemId: "flower_08", sellValue: 64 },
    { id: "flower_08", chainId: "flower", level: 8, displayName: "\u6D6A\u6F2B\u82B1\u675F", sellValue: 128 },
    { id: "dessert_01", chainId: "dessert", level: 1, displayName: "\u9762\u7C89", nextItemId: "dessert_02", sellValue: 1 },
    { id: "dessert_02", chainId: "dessert", level: 2, displayName: "\u9762\u56E2", nextItemId: "dessert_03", sellValue: 2 },
    { id: "dessert_03", chainId: "dessert", level: 3, displayName: "\u5C0F\u86CB\u7CD5", nextItemId: "dessert_04", sellValue: 4 },
    { id: "dessert_04", chainId: "dessert", level: 4, displayName: "\u8349\u8393\u86CB\u7CD5", nextItemId: "dessert_05", sellValue: 8 },
    { id: "dessert_05", chainId: "dessert", level: 5, displayName: "\u53CC\u5C42\u86CB\u7CD5", nextItemId: "dessert_06", sellValue: 16 },
    { id: "dessert_06", chainId: "dessert", level: 6, displayName: "\u5FC3\u5F62\u86CB\u7CD5", nextItemId: "dessert_07", sellValue: 32 },
    { id: "dessert_07", chainId: "dessert", level: 7, displayName: "\u7EAA\u5FF5\u65E5\u86CB\u7CD5", nextItemId: "dessert_08", sellValue: 64 },
    { id: "dessert_08", chainId: "dessert", level: 8, displayName: "\u68A6\u5E7B\u86CB\u7CD5", sellValue: 128 },
    { id: "gift_01", chainId: "gift", level: 1, displayName: "\u4E1D\u5E26", nextItemId: "gift_02", sellValue: 1 },
    { id: "gift_02", chainId: "gift", level: 2, displayName: "\u793C\u7269\u888B", nextItemId: "gift_03", sellValue: 2 },
    { id: "gift_03", chainId: "gift", level: 3, displayName: "\u5C0F\u793C\u76D2", nextItemId: "gift_04", sellValue: 4 },
    { id: "gift_04", chainId: "gift", level: 4, displayName: "\u7CBE\u81F4\u793C\u76D2", nextItemId: "gift_05", sellValue: 8 },
    { id: "gift_05", chainId: "gift", level: 5, displayName: "\u60CA\u559C\u793C\u76D2", nextItemId: "gift_06", sellValue: 16 },
    { id: "gift_06", chainId: "gift", level: 6, displayName: "\u5FC3\u610F\u793C\u7269", nextItemId: "gift_07", sellValue: 32 },
    { id: "gift_07", chainId: "gift", level: 7, displayName: "\u7EAA\u5FF5\u793C\u7269", nextItemId: "gift_08", sellValue: 64 },
    { id: "gift_08", chainId: "gift", level: 8, displayName: "\u73CD\u85CF\u793C\u7269", sellValue: 128 }
  ];

  // assets/resources/config/generators.json
  var generators_default = [
    {
      id: "coffee_machine",
      displayName: "\u5496\u5561\u673A",
      chainId: "coffee",
      unlockLevel: 1,
      energyCost: 1,
      outputs: [
        { itemId: "coffee_01", weight: 85 },
        { itemId: "coffee_02", weight: 15 }
      ]
    },
    {
      id: "flower_basket",
      displayName: "\u82B1\u7BEE",
      chainId: "flower",
      unlockLevel: 1,
      energyCost: 1,
      outputs: [
        { itemId: "flower_01", weight: 85 },
        { itemId: "flower_02", weight: 15 }
      ]
    },
    {
      id: "dessert_oven",
      displayName: "\u751C\u54C1\u70E4\u7BB1",
      chainId: "dessert",
      unlockLevel: 3,
      energyCost: 1,
      outputs: [
        { itemId: "dessert_01", weight: 85 },
        { itemId: "dessert_02", weight: 15 }
      ]
    },
    {
      id: "gift_box",
      displayName: "\u793C\u7269\u76D2",
      chainId: "gift",
      unlockLevel: 5,
      energyCost: 1,
      outputs: [
        { itemId: "gift_01", weight: 85 },
        { itemId: "gift_02", weight: 15 }
      ]
    }
  ];

  // assets/resources/config/orders.json
  var orders_default = [
    {
      id: "order_tutorial_coffee",
      minLevel: 1,
      maxLevel: 99,
      requirements: [{ itemId: "coffee_02", count: 1 }],
      rewardCoins: 20,
      rewardXp: 10,
      rewardHearts: 1,
      tutorialOnly: true
    },
    {
      id: "order_coffee_bean_bundle",
      minLevel: 1,
      maxLevel: 99,
      requirements: [{ itemId: "coffee_01", count: 2 }],
      rewardCoins: 12,
      rewardXp: 6,
      rewardHearts: 1
    },
    {
      id: "order_coffee_powder",
      minLevel: 1,
      maxLevel: 99,
      requirements: [{ itemId: "coffee_02", count: 1 }],
      rewardCoins: 18,
      rewardXp: 8,
      rewardHearts: 1
    },
    {
      id: "order_flower_seed",
      minLevel: 1,
      maxLevel: 99,
      requirements: [{ itemId: "flower_01", count: 2 }],
      rewardCoins: 12,
      rewardXp: 6,
      rewardHearts: 1
    },
    {
      id: "order_flower_sprout",
      minLevel: 1,
      maxLevel: 99,
      requirements: [{ itemId: "flower_02", count: 1 }],
      rewardCoins: 18,
      rewardXp: 8,
      rewardHearts: 1
    },
    {
      id: "order_morning_set",
      minLevel: 1,
      maxLevel: 99,
      requirements: [
        { itemId: "coffee_02", count: 1 },
        { itemId: "flower_02", count: 1 }
      ],
      rewardCoins: 28,
      rewardXp: 14,
      rewardHearts: 2
    },
    {
      id: "order_latte_date",
      minLevel: 2,
      maxLevel: 99,
      requirements: [{ itemId: "coffee_05", count: 1 }],
      rewardCoins: 45,
      rewardXp: 22,
      rewardHearts: 2
    },
    {
      id: "order_tulip_pair",
      minLevel: 2,
      maxLevel: 99,
      requirements: [{ itemId: "flower_03", count: 2 }],
      rewardCoins: 36,
      rewardXp: 18,
      rewardHearts: 1
    },
    {
      id: "order_rose_bouquet",
      minLevel: 3,
      maxLevel: 99,
      requirements: [{ itemId: "flower_04", count: 1 }],
      rewardCoins: 40,
      rewardXp: 20,
      rewardHearts: 2
    },
    {
      id: "order_cake_tea",
      minLevel: 3,
      maxLevel: 99,
      requirements: [
        { itemId: "dessert_03", count: 1 },
        { itemId: "coffee_03", count: 1 }
      ],
      rewardCoins: 50,
      rewardXp: 26,
      rewardHearts: 2
    },
    {
      id: "order_strawberry_cake",
      minLevel: 3,
      maxLevel: 99,
      requirements: [{ itemId: "dessert_04", count: 1 }],
      rewardCoins: 48,
      rewardXp: 24,
      rewardHearts: 2
    },
    {
      id: "order_double_cake",
      minLevel: 4,
      maxLevel: 99,
      requirements: [{ itemId: "dessert_05", count: 1 }],
      rewardCoins: 60,
      rewardXp: 30,
      rewardHearts: 3
    },
    {
      id: "order_gift_small",
      minLevel: 5,
      maxLevel: 99,
      requirements: [{ itemId: "gift_03", count: 1 }],
      rewardCoins: 55,
      rewardXp: 28,
      rewardHearts: 2
    },
    {
      id: "order_romantic_combo",
      minLevel: 4,
      maxLevel: 99,
      requirements: [
        { itemId: "coffee_05", count: 1 },
        { itemId: "flower_05", count: 1 }
      ],
      rewardCoins: 80,
      rewardXp: 40,
      rewardHearts: 3
    },
    {
      id: "order_anniversary_preview",
      minLevel: 5,
      maxLevel: 99,
      requirements: [
        { itemId: "dessert_05", count: 1 },
        { itemId: "gift_04", count: 1 }
      ],
      rewardCoins: 95,
      rewardXp: 48,
      rewardHearts: 4
    }
  ];

  // assets/resources/config/progression.json
  var progression_default = {
    levels: [
      { level: 1, xpRequired: 0, unlockChains: ["coffee", "flower"] },
      { level: 2, xpRequired: 30, unlockChains: [] },
      { level: 3, xpRequired: 80, unlockChains: ["dessert"] },
      { level: 4, xpRequired: 150, unlockChains: [] },
      { level: 5, xpRequired: 250, unlockChains: ["gift"] }
    ]
  };

  // assets/scripts/config/ConfigRepository.ts
  function loadConfigBundle() {
    const game = game_default;
    const items = items_default;
    const generators = generators_default;
    const orders = orders_default;
    const progression = progression_default;
    const catalog = createItemCatalog(items);
    return { game, items, catalog, generators, orders, progression };
  }
  function validateConfig(bundle) {
    const issues = [];
    const { game, items, catalog, generators, orders, progression } = bundle;
    const seen = /* @__PURE__ */ new Set();
    for (const item of items) {
      if (seen.has(item.id)) {
        issues.push({ level: "error", message: `Duplicate item id: ${item.id}` });
      }
      seen.add(item.id);
      if (item.level < 1) {
        issues.push({ level: "error", message: `Item ${item.id} level < 1` });
      }
    }
    const byChain = /* @__PURE__ */ new Map();
    for (const item of items) {
      const list = byChain.get(item.chainId) ?? [];
      list.push(item);
      byChain.set(item.chainId, list);
    }
    for (const [chainId, list] of byChain) {
      const levels = [...list].map((i) => i.level).sort((a, b) => a - b);
      for (let i = 0; i < levels.length; i += 1) {
        if (levels[i] !== i + 1) {
          issues.push({
            level: "error",
            message: `Chain ${chainId} levels not continuous at index ${i}`
          });
          break;
        }
      }
    }
    for (const item of items) {
      if (item.nextItemId !== void 0) {
        const next = catalog.get(item.nextItemId);
        if (!next) {
          issues.push({
            level: "error",
            message: `Item ${item.id} nextItemId missing: ${item.nextItemId}`
          });
        } else if (next.chainId !== item.chainId || next.level !== item.level + 1) {
          issues.push({
            level: "error",
            message: `Item ${item.id} nextItemId chain/level mismatch`
          });
        }
      }
    }
    for (const gen of generators) {
      if (!byChain.has(gen.chainId)) {
        issues.push({
          level: "error",
          message: `Generator ${gen.id} unknown chainId ${gen.chainId}`
        });
      }
      if (gen.outputs.length === 0) {
        issues.push({ level: "error", message: `Generator ${gen.id} has no outputs` });
      }
      for (const out of gen.outputs) {
        if (!catalog.has(out.itemId)) {
          issues.push({
            level: "error",
            message: `Generator ${gen.id} output missing item ${out.itemId}`
          });
        }
        if (out.weight <= 0) {
          issues.push({
            level: "warn",
            message: `Generator ${gen.id} output ${out.itemId} non-positive weight`
          });
        }
      }
    }
    for (const order of orders) {
      if (order.requirements.length < game.orders.minRequirements || order.requirements.length > game.orders.maxRequirements) {
        issues.push({
          level: "error",
          message: `Order ${order.id} requirement count out of range`
        });
      }
      for (const req of order.requirements) {
        const def = catalog.get(req.itemId);
        if (!def) {
          issues.push({
            level: "error",
            message: `Order ${order.id} missing item ${req.itemId}`
          });
        }
      }
    }
    let prev = -Infinity;
    for (const level of progression.levels) {
      if (level.xpRequired < prev) {
        issues.push({
          level: "error",
          message: `Progression xpRequired not increasing at level ${level.level}`
        });
      }
      prev = level.xpRequired;
      for (const chain of level.unlockChains) {
        if (!byChain.has(chain)) {
          issues.push({
            level: "error",
            message: `Progression level ${level.level} unlocks unknown chain ${chain}`
          });
        }
      }
    }
    if (game.board.rows * game.board.columns <= 0) {
      issues.push({ level: "error", message: "Board size invalid" });
    }
    if (game.energy.recoverIntervalMs <= 0) {
      issues.push({ level: "error", message: "Energy recoverIntervalMs invalid" });
    }
    return issues;
  }
  function assertConfigValid(bundle) {
    const issues = validateConfig(bundle);
    const errors = issues.filter((i) => i.level === "error");
    for (const issue of issues) {
      if (issue.level === "error") {
        console.error(`[BOOT] CONFIG ERROR: ${issue.message}`);
      } else {
        console.warn(`[BOOT] CONFIG WARN: ${issue.message}`);
      }
    }
    if (errors.length > 0) {
      throw new Error(`Config validation failed: ${errors.length} error(s)`);
    }
  }

  // assets/scripts/events/GameEventBus.ts
  var GameEventBus = class {
    constructor() {
      this.listeners = /* @__PURE__ */ new Map();
    }
    on(type, handler) {
      let set = this.listeners.get(type);
      if (!set) {
        set = /* @__PURE__ */ new Set();
        this.listeners.set(type, set);
      }
      set.add(handler);
      return () => this.off(type, handler);
    }
    off(type, handler) {
      this.listeners.get(type)?.delete(handler);
    }
    emit(type, payload) {
      const set = this.listeners.get(type);
      if (!set) return;
      for (const handler of [...set]) {
        handler(payload);
      }
    }
    clear() {
      this.listeners.clear();
    }
  };

  // assets/scripts/infrastructure/ClockService.ts
  var SystemClockService = class {
    now() {
      return Date.now();
    }
  };
  var FakeClockService = class {
    constructor(startMs = 17e11) {
      this.current = startMs;
    }
    now() {
      return this.current;
    }
    advance(ms) {
      this.current += ms;
    }
    set(ms) {
      this.current = ms;
    }
  };

  // assets/scripts/infrastructure/RandomService.ts
  var SystemRandomService = class {
    next() {
      return Math.random();
    }
    pickIndex(maxExclusive) {
      if (maxExclusive <= 0) return 0;
      return Math.floor(this.next() * maxExclusive);
    }
  };
  var FixedRandomService = class {
    constructor(values = [0]) {
      this.values = values;
      this.cursor = 0;
    }
    next() {
      const v = this.values[this.cursor % this.values.length] ?? 0;
      this.cursor += 1;
      return v;
    }
    pickIndex(maxExclusive) {
      if (maxExclusive <= 0) return 0;
      return Math.floor(this.next() * maxExclusive) % maxExclusive;
    }
    reset() {
      this.cursor = 0;
    }
  };
  function pickWeighted(items, random) {
    if (items.length === 0) return null;
    const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
    if (total <= 0) return items[0] ?? null;
    let roll = random.next() * total;
    for (const item of items) {
      roll -= Math.max(0, item.weight);
      if (roll < 0) return item;
    }
    return items[items.length - 1] ?? null;
  }

  // assets/scripts/infrastructure/IdService.ts
  var IdService = class {
    constructor() {
      this.counter = 0;
    }
    next() {
      this.counter = (this.counter + 1) % 1e6;
      const time = Date.now().toString(36);
      const count = this.counter.toString(36);
      const rand = Math.floor(Math.random() * 16777215).toString(36).padStart(5, "0");
      return `id_${time}_${count}_${rand}`;
    }
  };
  var SequentialIdService = class {
    constructor(prefix = "test") {
      this.prefix = prefix;
      this.counter = 0;
    }
    next() {
      this.counter += 1;
      return `${this.prefix}_${this.counter}`;
    }
  };

  // assets/scripts/infrastructure/PlatformService.ts
  var PlatformService = class {
    constructor(storage) {
      this.kind = detectPlatform();
      this.storage = storage ?? createDefaultStorage();
    }
    getStorage() {
      return this.storage;
    }
    isDevTools() {
      return this.kind === "web" || this.kind === "editor";
    }
  };
  function detectPlatform() {
    const g = globalThis;
    if (g.wx && typeof g.wx.getSystemInfoSync === "function") {
      return "wechat";
    }
    if (g.document !== void 0) {
      return "web";
    }
    return "unknown";
  }
  function createDefaultStorage() {
    const g = globalThis;
    if (g.localStorage) {
      return g.localStorage;
    }
    if (g.wx?.getStorageSync && g.wx.setStorageSync) {
      const wx = g.wx;
      return {
        getItem(key) {
          const v = wx.getStorageSync?.(key);
          return typeof v === "string" ? v : v == null ? null : String(v);
        },
        setItem(key, value) {
          wx.setStorageSync?.(key, value);
        },
        removeItem(key) {
          wx.removeStorageSync?.(key);
        }
      };
    }
    const mem = /* @__PURE__ */ new Map();
    return {
      getItem: (key) => mem.get(key) ?? null,
      setItem: (key, value) => {
        mem.set(key, value);
      },
      removeItem: (key) => {
        mem.delete(key);
      }
    };
  }

  // assets/scripts/infrastructure/SaveService.ts
  var SaveService = class {
    constructor(options) {
      this.options = options;
      this.timer = null;
      this.pending = null;
      this.debounceMs = options.debounceMs ?? 200;
    }
    load() {
      const raw = this.options.storage.getItem(this.options.saveKey);
      if (raw == null || raw === "") {
        return { ok: false, reason: "EMPTY", defaultData: this.options.createDefault() };
      }
      try {
        const parsed = JSON.parse(raw);
        const migrated = this.migrate(parsed);
        if (!migrated) {
          this.backupCorrupt(raw);
          this.options.logger?.("[SAVE] corrupt payload, using default");
          return {
            ok: false,
            reason: "CORRUPT",
            defaultData: this.options.createDefault()
          };
        }
        return { ok: true, data: migrated.data, repaired: migrated.repaired };
      } catch {
        this.backupCorrupt(raw);
        this.options.logger?.("[SAVE] JSON parse failed, using default");
        return {
          ok: false,
          reason: "CORRUPT",
          defaultData: this.options.createDefault()
        };
      }
    }
    save(data) {
      const payload = {
        ...data,
        version: this.options.version,
        savedAt: this.options.clock.now()
      };
      this.options.storage.setItem(this.options.saveKey, JSON.stringify(payload));
      this.pending = null;
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
    }
    scheduleSave(data) {
      this.pending = data;
      if (this.debounceMs <= 0) {
        this.save(data);
        return;
      }
      if (this.timer) return;
      this.timer = setTimeout(() => {
        this.timer = null;
        if (this.pending) {
          this.save(this.pending);
        }
      }, this.debounceMs);
    }
    /** Flush any pending debounced save (call on page hide / destroy). */
    flush() {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      if (this.pending) {
        this.save(this.pending);
      }
    }
    reset() {
      this.options.storage.removeItem(this.options.saveKey);
      this.options.storage.removeItem(`${this.options.saveKey}:backup`);
      this.pending = null;
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
    }
    migrate(parsed) {
      if (!parsed || typeof parsed !== "object") return null;
      let repaired = false;
      const defaults = this.options.createDefault();
      const version = typeof parsed.version === "number" ? parsed.version : 0;
      if (version < 1) {
        if (version !== 0) return null;
        repaired = true;
      }
      if (version > this.options.version) {
        return null;
      }
      const player = this.mergePlayer(parsed.player, defaults.player);
      const boardCells = this.mergeBoard(
        parsed.board,
        defaults.board,
        defaults.player
      );
      if (!boardCells) return null;
      const activeOrders = Array.isArray(parsed.activeOrders) ? parsed.activeOrders.filter(isActiveOrder) : defaults.activeOrders;
      if (activeOrders.length !== defaults.activeOrders.length && activeOrders.length === 0) {
        repaired = true;
      }
      const tutorial = this.mergeTutorial(parsed.tutorial, defaults.tutorial);
      const data = {
        version: this.options.version,
        savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : this.options.clock.now(),
        player,
        board: boardCells,
        activeOrders: activeOrders.length > 0 ? activeOrders : defaults.activeOrders,
        tutorial,
        recentOrderIds: Array.isArray(parsed.recentOrderIds) ? parsed.recentOrderIds.filter((x) => typeof x === "string") : []
      };
      return { data, repaired };
    }
    mergePlayer(raw, fallback) {
      if (!raw || typeof raw !== "object") return { ...fallback };
      const p = raw;
      return {
        level: num(p.level, fallback.level),
        xp: num(p.xp, fallback.xp),
        coins: num(p.coins, fallback.coins),
        hearts: num(p.hearts, fallback.hearts),
        energy: num(p.energy, fallback.energy),
        maxEnergy: num(p.maxEnergy, fallback.maxEnergy),
        lastEnergyAt: num(p.lastEnergyAt, fallback.lastEnergyAt),
        unlockedChainIds: Array.isArray(p.unlockedChainIds) ? p.unlockedChainIds.filter((x) => typeof x === "string") : [...fallback.unlockedChainIds]
      };
    }
    mergeBoard(raw, fallback, _player) {
      if (!Array.isArray(raw)) {
        return fallback.map((c) => ({ ...c, item: c.item ? { ...c.item } : void 0 }));
      }
      if (raw.length !== fallback.length) {
        return null;
      }
      const cells = [];
      for (let i = 0; i < raw.length; i += 1) {
        const cell = raw[i];
        if (!cell || typeof cell !== "object") return null;
        const item = cell.item;
        if (item && typeof item === "object") {
          const it = item;
          if (typeof it.uid !== "string" || typeof it.definitionId !== "string") {
            return null;
          }
          cells.push({ index: i, item: { uid: it.uid, definitionId: it.definitionId } });
        } else {
          cells.push({ index: i });
        }
      }
      return cells;
    }
    mergeTutorial(raw, fallback) {
      if (!raw || typeof raw !== "object") return { ...fallback };
      const t = raw;
      return {
        generatorClicked: !!t.generatorClicked,
        firstMergeCompleted: !!t.firstMergeCompleted,
        firstOrderCompleted: !!t.firstOrderCompleted,
        firstOrderHintShown: !!t.firstOrderHintShown
      };
    }
    backupCorrupt(raw) {
      try {
        this.options.storage.setItem(`${this.options.saveKey}:backup`, raw);
      } catch {
      }
    }
  };
  function num(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }
  function isActiveOrder(value) {
    if (!value || typeof value !== "object") return false;
    const o = value;
    return typeof o.uid === "string" && typeof o.templateId === "string" && Array.isArray(o.requirements);
  }
  function createDefaultSaveData(config, savedAt) {
    const rows = config.board.rows;
    const columns = config.board.columns;
    const board = [];
    for (let index = 0; index < rows * columns; index += 1) {
      board.push({ index });
    }
    if (board.length >= 4) {
      board[0].item = { uid: "start_c1a", definitionId: "coffee_01" };
      board[1].item = { uid: "start_c1b", definitionId: "coffee_01" };
      board[2].item = { uid: "start_f1a", definitionId: "flower_01" };
      board[3].item = { uid: "start_f1b", definitionId: "flower_01" };
    }
    const player = {
      level: 1,
      xp: 0,
      coins: 0,
      hearts: 0,
      energy: config.energy.initialEnergy,
      maxEnergy: config.energy.maxEnergy,
      lastEnergyAt: savedAt,
      unlockedChainIds: ["coffee", "flower"]
    };
    return {
      version: config.saveVersion,
      savedAt,
      player,
      board,
      activeOrders: [
        {
          uid: "order_start_1",
          templateId: "order_tutorial_coffee",
          requirements: [{ itemId: "coffee_02", count: 1 }],
          rewardCoins: 20,
          rewardXp: 10,
          rewardHearts: 1
        },
        {
          uid: "order_start_2",
          templateId: "order_flower_seed",
          requirements: [{ itemId: "flower_01", count: 2 }],
          rewardCoins: 12,
          rewardXp: 6,
          rewardHearts: 1
        },
        {
          uid: "order_start_3",
          templateId: "order_coffee_powder",
          requirements: [{ itemId: "coffee_02", count: 1 }],
          rewardCoins: 18,
          rewardXp: 8,
          rewardHearts: 1
        }
      ],
      tutorial: {
        generatorClicked: false,
        firstMergeCompleted: false,
        firstOrderCompleted: false,
        firstOrderHintShown: false
      },
      recentOrderIds: ["order_tutorial_coffee", "order_flower_seed", "order_coffee_powder"]
    };
  }

  // assets/scripts/infrastructure/GameLogger.ts
  var ENABLED = true;
  var GameLogger = class {
    constructor(debugEnabled = true) {
      this.debugEnabled = debugEnabled;
    }
    debug(category, message) {
      if (!ENABLED || !this.debugEnabled) return;
      console.log(`[${category}] ${message}`);
    }
    info(category, message) {
      if (!ENABLED) return;
      console.info(`[${category}] ${message}`);
    }
    warn(category, message) {
      if (!ENABLED) return;
      console.warn(`[${category}] ${message}`);
    }
    error(category, message, err) {
      if (!ENABLED) return;
      console.error(`[${category}] ${message}`, err ?? "");
    }
  };
  var gameLogger = new GameLogger(true);

  // assets/scripts/core/merge/mergeEngine.ts
  var MergeEngine = class {
    constructor(catalog) {
      this.catalog = catalog;
    }
    canMerge(source, target) {
      return this.tryMerge(source, target, `${source.uid}_merged`).ok;
    }
    merge(source, target, nextUid) {
      return this.tryMerge(source, target, nextUid);
    }
    tryMerge(source, target, nextUid) {
      const sourceDef = this.catalog.get(source.definitionId);
      const targetDef = this.catalog.get(target.definitionId);
      if (!sourceDef || !targetDef) {
        return { ok: false, reason: "MISSING_DEFINITION" };
      }
      if (source.definitionId !== target.definitionId) {
        return { ok: false, reason: "DIFFERENT_ITEM" };
      }
      if (!sourceDef.nextItemId) {
        return { ok: false, reason: "MAX_LEVEL" };
      }
      const nextDef = this.catalog.get(sourceDef.nextItemId);
      if (!nextDef) {
        return { ok: false, reason: "MISSING_DEFINITION" };
      }
      return {
        ok: true,
        item: { uid: nextUid, definitionId: nextDef.id },
        sourceUid: source.uid,
        targetUid: target.uid
      };
    }
  };

  // assets/scripts/core/board/rules.ts
  function resolveDrop(board, catalog, from, to) {
    if (to === null || !isValidIndex(from, board.rows, board.columns)) {
      return { kind: "CANCEL" };
    }
    if (!isValidIndex(to, board.rows, board.columns)) {
      return { kind: "CANCEL" };
    }
    if (from === to) {
      return { kind: "CANCEL" };
    }
    const source = getCellItem(board, from);
    if (!source) {
      return { kind: "CANCEL" };
    }
    const target = getCellItem(board, to);
    if (!target) {
      return { kind: "MOVE", from, to };
    }
    const mergeEngine = new MergeEngine(catalog);
    if (mergeEngine.canMerge(source, target)) {
      return { kind: "MERGE", from, to };
    }
    return { kind: "SWAP", from, to };
  }
  function applyDrop(board, catalog, from, to, nextUid) {
    const drop = resolveDrop(board, catalog, from, to);
    if (drop.kind === "CANCEL") {
      return { ok: false, reason: "INVALID" };
    }
    const next = cloneBoard(board);
    const source = next.cells[from]?.item;
    if (!source) {
      return { ok: false, reason: "EMPTY_SOURCE" };
    }
    const targetIndex = drop.to;
    if (drop.kind === "MOVE") {
      next.cells[from].item = void 0;
      next.cells[targetIndex].item = source;
      return { ok: true, kind: "MOVE", board: next };
    }
    if (drop.kind === "SWAP") {
      const target2 = next.cells[targetIndex].item;
      next.cells[targetIndex].item = source;
      next.cells[from].item = target2;
      return { ok: true, kind: "SWAP", board: next };
    }
    const target = next.cells[targetIndex].item;
    if (!target) {
      return { ok: false, reason: "INVALID" };
    }
    const mergeEngine = new MergeEngine(catalog);
    const merged = mergeEngine.merge(source, target, nextUid);
    if (!merged.ok) {
      return { ok: false, reason: "CANNOT_MERGE" };
    }
    next.cells[from].item = void 0;
    next.cells[targetIndex].item = merged.item;
    return { ok: true, kind: "MERGE", board: next, merged: merged.item };
  }
  function findItemsForRequirements(board, requirements) {
    const needed = /* @__PURE__ */ new Map();
    for (const req of requirements) {
      if (req.count <= 0) return null;
      needed.set(req.itemId, (needed.get(req.itemId) ?? 0) + req.count);
    }
    const picked = [];
    for (const cell of board.cells) {
      const item = cell.item;
      if (!item) continue;
      const remain = needed.get(item.definitionId);
      if (remain === void 0 || remain <= 0) continue;
      picked.push({
        cellIndex: cell.index,
        uid: item.uid,
        definitionId: item.definitionId
      });
      needed.set(item.definitionId, remain - 1);
    }
    for (const count of needed.values()) {
      if (count > 0) return null;
    }
    return picked;
  }
  function consumeLocations(board, locations) {
    const next = cloneBoard(board);
    const sorted = [...locations].sort((a, b) => a.cellIndex - b.cellIndex);
    for (const loc of sorted) {
      const cell = next.cells[loc.cellIndex];
      if (cell?.item?.uid === loc.uid) {
        cell.item = void 0;
      }
    }
    return next;
  }
  function getOrderProgress(board, order) {
    const haveMap = /* @__PURE__ */ new Map();
    for (const cell of board.cells) {
      if (!cell.item) continue;
      haveMap.set(
        cell.item.definitionId,
        (haveMap.get(cell.item.definitionId) ?? 0) + 1
      );
    }
    let ready = true;
    const requirements = order.requirements.map((req) => {
      const have = haveMap.get(req.itemId) ?? 0;
      const done = have >= req.count;
      if (!done) ready = false;
      return { ...req, have: Math.min(have, req.count), done };
    });
    return { requirements, ready };
  }

  // assets/scripts/gameplay/BoardService.ts
  var BoardService = class {
    constructor(catalog, ids, bus, rows, columns, initial) {
      this.catalog = catalog;
      this.ids = ids;
      this.bus = bus;
      if (initial && "cells" in initial && "rows" in initial) {
        this.board = initial;
      } else if (Array.isArray(initial)) {
        this.board = {
          rows,
          columns,
          cells: initial.map((c) => ({
            ...c,
            item: c.item ? { ...c.item } : void 0
          }))
        };
      } else {
        this.board = createEmptyBoard(rows, columns);
      }
    }
    getBoard() {
      return this.board;
    }
    getRows() {
      return this.board.rows;
    }
    getColumns() {
      return this.board.columns;
    }
    replaceBoard(board) {
      this.board = board;
      this.bus.emit("BOARD_CHANGED", { reason: "reset" });
    }
    previewDrop(from, to) {
      return resolveDrop(this.board, this.catalog, from, to);
    }
    tryDrop(from, to) {
      const nextUid = this.ids.next();
      const result = applyDrop(this.board, this.catalog, from, to, nextUid);
      if (!result.ok) return result;
      this.board = result.board;
      if (result.kind === "MERGE") {
        const dest2 = to;
        const merged = result.merged;
        this.bus.emit("ITEM_MERGED", {
          from,
          to: dest2,
          resultUid: merged.uid,
          resultDefinitionId: merged.definitionId
        });
        this.bus.emit("BOARD_CHANGED", { reason: "merge" });
        return {
          ok: true,
          kind: "MERGE",
          from,
          to: dest2,
          resultUid: merged.uid,
          resultDefinitionId: merged.definitionId
        };
      }
      const dest = to;
      if (result.kind === "MOVE") {
        const uid = this.board.cells[dest]?.item?.uid ?? "";
        this.bus.emit("ITEM_MOVED", { uid, from, to: dest });
        this.bus.emit("BOARD_CHANGED", { reason: "move" });
        return { ok: true, kind: "MOVE", from, to: dest };
      }
      const fromUid = this.board.cells[from]?.item?.uid ?? "";
      const toUid = this.board.cells[dest]?.item?.uid ?? "";
      this.bus.emit("ITEM_SWAPPED", { fromUid, toUid, from, to: dest });
      this.bus.emit("BOARD_CHANGED", { reason: "swap" });
      return { ok: true, kind: "SWAP", from, to: dest };
    }
    spawn(definitionId) {
      const index = findFirstEmptyIndex(this.board);
      if (index === null) {
        return { ok: false, reason: "BOARD_FULL" };
      }
      const item = { uid: this.ids.next(), definitionId };
      this.board.cells[index].item = item;
      this.bus.emit("ITEM_SPAWNED", {
        uid: item.uid,
        definitionId,
        cellIndex: index
      });
      this.bus.emit("BOARD_CHANGED", { reason: "spawn" });
      return { ok: true, item, cellIndex: index };
    }
    isFull() {
      return isBoardFull(this.board);
    }
    findItemsForRequirements(requirements) {
      return findItemsForRequirements(this.board, requirements);
    }
    consumeItems(locations) {
      this.board = consumeLocations(this.board, locations);
      this.bus.emit("BOARD_CHANGED", { reason: "claim" });
    }
    getOrderProgress(order) {
      return getOrderProgress(this.board, order);
    }
    clearBoard() {
      for (const cell of this.board.cells) {
        cell.item = void 0;
      }
      this.bus.emit("BOARD_CHANGED", { reason: "debug" });
    }
    placeAt(index, definitionId) {
      if (index < 0 || index >= this.board.cells.length) return null;
      if (this.board.cells[index].item) return null;
      const item = { uid: this.ids.next(), definitionId };
      this.board.cells[index].item = item;
      this.bus.emit("ITEM_SPAWNED", {
        uid: item.uid,
        definitionId,
        cellIndex: index
      });
      this.bus.emit("BOARD_CHANGED", { reason: "debug" });
      return item;
    }
  };

  // assets/scripts/core/energy/energy.ts
  function recoverEnergy(input) {
    const maxEnergy = Math.max(0, input.maxEnergy);
    let energy = clampInt(input.energy, 0, maxEnergy);
    const interval = Math.max(1, input.recoverIntervalMs);
    const now = Number.isFinite(input.now) ? input.now : input.lastEnergyAt;
    const last = Number.isFinite(input.lastEnergyAt) ? input.lastEnergyAt : now;
    if (energy >= maxEnergy) {
      return {
        energy: maxEnergy,
        maxEnergy,
        lastEnergyAt: now,
        recovered: 0
      };
    }
    const elapsed = Math.max(0, now - last);
    const ticks = Math.floor(elapsed / interval);
    if (ticks <= 0) {
      return {
        energy,
        maxEnergy,
        lastEnergyAt: last,
        recovered: 0
      };
    }
    const room = maxEnergy - energy;
    const recovered = Math.min(room, ticks);
    energy += recovered;
    const consumedMs = recovered * interval;
    const newLast = recovered >= room && energy >= maxEnergy ? now : last + consumedMs;
    return {
      energy,
      maxEnergy,
      lastEnergyAt: newLast,
      recovered
    };
  }
  function spendEnergy(energy, cost) {
    if (cost < 0) {
      return { ok: false, reason: "NOT_ENOUGH_ENERGY" };
    }
    if (energy < cost) {
      return { ok: false, reason: "NOT_ENOUGH_ENERGY" };
    }
    return { ok: true, energy: energy - cost };
  }
  function clampInt(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, Math.floor(value)));
  }

  // assets/scripts/gameplay/EnergyService.ts
  var EnergyService = class {
    constructor(player, clock, bus, recoverIntervalMs) {
      this.player = player;
      this.clock = clock;
      this.bus = bus;
      this.recoverIntervalMs = recoverIntervalMs;
    }
    get energy() {
      return this.player.energy;
    }
    get maxEnergy() {
      return this.player.maxEnergy;
    }
    /** Offline / resume recovery based on lastEnergyAt. */
    tick() {
      const before = this.player.energy;
      const result = recoverEnergy({
        energy: this.player.energy,
        maxEnergy: this.player.maxEnergy,
        lastEnergyAt: this.player.lastEnergyAt,
        now: this.clock.now(),
        recoverIntervalMs: this.recoverIntervalMs
      });
      this.player.energy = result.energy;
      this.player.lastEnergyAt = result.lastEnergyAt;
      const delta = result.energy - before;
      if (delta !== 0) {
        this.bus.emit("ENERGY_CHANGED", {
          energy: this.player.energy,
          maxEnergy: this.player.maxEnergy,
          delta
        });
      }
      return {
        recovered: result.recovered,
        energy: result.energy,
        maxEnergy: result.maxEnergy
      };
    }
    canSpend(cost) {
      return this.player.energy >= cost;
    }
    spend(cost) {
      const result = spendEnergy(this.player.energy, cost);
      if (!result.ok) return result;
      this.player.energy = result.energy;
      if (this.player.energy === this.player.maxEnergy - cost && this.player.lastEnergyAt === 0) {
        this.player.lastEnergyAt = this.clock.now();
      }
      this.bus.emit("ENERGY_CHANGED", {
        energy: this.player.energy,
        maxEnergy: this.player.maxEnergy,
        delta: -cost
      });
      return result;
    }
    add(amount) {
      const before = this.player.energy;
      this.player.energy = Math.min(
        this.player.maxEnergy,
        this.player.energy + amount
      );
      const delta = this.player.energy - before;
      if (delta !== 0) {
        this.bus.emit("ENERGY_CHANGED", {
          energy: this.player.energy,
          maxEnergy: this.player.maxEnergy,
          delta
        });
      }
    }
    /** Regen timestamp after a spend when player is below max. */
    markRegenPoint() {
      this.player.lastEnergyAt = this.clock.now();
    }
  };

  // assets/scripts/gameplay/GeneratorService.ts
  var GeneratorService = class {
    constructor(generators, catalog, board, energy, player, random, clock) {
      this.generators = generators;
      this.catalog = catalog;
      this.board = board;
      this.energy = energy;
      this.player = player;
      this.random = random;
      this.clock = clock;
    }
    list() {
      return this.generators;
    }
    get(id) {
      return this.generators.find((g) => g.id === id);
    }
    isUnlocked(generator) {
      return this.player.level >= generator.unlockLevel;
    }
    rollOutput(generator) {
      return pickWeighted(generator.outputs, this.random);
    }
    spawn(generatorId) {
      const generator = this.get(generatorId);
      if (!generator) {
        return { ok: false, reason: "UNKNOWN_GENERATOR" };
      }
      if (!this.isUnlocked(generator)) {
        return { ok: false, reason: "LOCKED" };
      }
      if (!this.energy.canSpend(generator.energyCost)) {
        return { ok: false, reason: "NOT_ENOUGH_ENERGY" };
      }
      if (this.board.isFull()) {
        return { ok: false, reason: "BOARD_FULL" };
      }
      const output = this.rollOutput(generator);
      if (!output || !this.catalog.has(output.itemId)) {
        return { ok: false, reason: "UNKNOWN_GENERATOR" };
      }
      const spend = this.energy.spend(generator.energyCost);
      if (!spend.ok) {
        return spend;
      }
      if (this.player.energy < this.player.maxEnergy) {
        if (!this.player.lastEnergyAt) {
          this.player.lastEnergyAt = this.clock.now();
        }
      }
      const spawned = this.board.spawn(output.itemId);
      if (!spawned.ok) {
        this.energy.add(generator.energyCost);
        return { ok: false, reason: "BOARD_FULL" };
      }
      return {
        ok: true,
        itemDefinitionId: output.itemId,
        uid: spawned.item.uid,
        cellIndex: spawned.cellIndex
      };
    }
  };

  // assets/scripts/core/order/orders.ts
  function filterOrderTemplates(templates, playerLevel, catalog, unlockedChainIds, minItemLevel, maxItemLevel) {
    const unlocked = new Set(unlockedChainIds);
    return templates.filter((template) => {
      if (playerLevel < template.minLevel || playerLevel > template.maxLevel) {
        return false;
      }
      for (const req of template.requirements) {
        const def = catalog.get(req.itemId);
        if (!def) return false;
        if (!unlocked.has(def.chainId)) return false;
        if (def.level < minItemLevel || def.level > maxItemLevel) {
          return false;
        }
      }
      return true;
    });
  }
  function instantiateOrder(template, uid) {
    const requirements = template.requirements.map((r) => ({
      itemId: r.itemId,
      count: r.count
    }));
    return {
      uid,
      templateId: template.id,
      requirements,
      rewardCoins: template.rewardCoins,
      rewardXp: template.rewardXp,
      rewardHearts: template.rewardHearts
    };
  }
  function pickOrderTemplate(candidates, recentOrderIds, random) {
    if (candidates.length === 0) return null;
    const recentSet = new Set(recentOrderIds.slice(-3));
    const preferred = candidates.filter((t) => !recentSet.has(t.id));
    const pool = preferred.length > 0 ? preferred : [...candidates];
    const index = random.pickIndex(pool.length);
    return pool[index] ?? pool[0] ?? null;
  }
  function generateOrder(input) {
    const candidates = filterOrderTemplates(
      input.templates,
      input.player.level,
      input.catalog,
      input.player.unlockedChainIds,
      input.minItemLevel,
      input.maxItemLevel
    );
    const nonTutorial = candidates.filter((t) => !t.tutorialOnly);
    const tutorial = candidates.filter((t) => t.tutorialOnly);
    const preferTutorial = tutorial.length > 0 && input.recentOrderIds.length === 0;
    const pool = preferTutorial ? tutorial : nonTutorial.length > 0 ? nonTutorial : candidates;
    const template = pickOrderTemplate(pool, input.recentOrderIds, input.random);
    if (!template) return null;
    return instantiateOrder(template, input.id);
  }
  function generateTutorialOrder(templates, id) {
    const template = templates.find((t) => t.tutorialOnly) ?? templates[0];
    if (!template) return null;
    return instantiateOrder(template, id);
  }

  // assets/scripts/gameplay/OrderService.ts
  var OrderService = class {
    constructor(templates, catalog, board, player, progression, random, ids, bus, slots, minItemLevel, maxItemLevel) {
      this.templates = templates;
      this.catalog = catalog;
      this.board = board;
      this.player = player;
      this.progression = progression;
      this.random = random;
      this.ids = ids;
      this.bus = bus;
      this.slots = slots;
      this.minItemLevel = minItemLevel;
      this.maxItemLevel = maxItemLevel;
      this.orders = [];
      this.recentOrderIds = [];
    }
    hydrate(orders, recentOrderIds) {
      this.orders = orders.map((o) => ({
        ...o,
        requirements: o.requirements.map((r) => ({ ...r }))
      }));
      this.recentOrderIds = [...recentOrderIds];
    }
    getOrders() {
      return this.orders.map((o) => ({
        ...o,
        requirements: o.requirements.map((r) => ({ ...r }))
      }));
    }
    getRecentIds() {
      return [...this.recentOrderIds];
    }
    ensureFilled() {
      while (this.orders.length < this.slots) {
        const created = this.createNextOrder();
        if (!created) break;
        this.orders.push(created);
        this.bus.emit("ORDER_UPDATED", { orderUid: created.uid });
      }
    }
    createNextOrder(forceTutorial = false) {
      const order = forceTutorial ? generateTutorialOrder(this.templates, this.ids.next()) : generateOrder({
        player: this.player,
        templates: this.templates,
        catalog: this.catalog,
        recentOrderIds: this.recentOrderIds,
        minItemLevel: this.minItemLevel,
        maxItemLevel: this.maxItemLevel,
        random: this.random,
        id: this.ids.next()
      });
      if (order) {
        this.recentOrderIds.push(order.templateId);
        if (this.recentOrderIds.length > 12) {
          this.recentOrderIds = this.recentOrderIds.slice(-12);
        }
      }
      return order;
    }
    canClaim(orderUid) {
      const order = this.orders.find((o) => o.uid === orderUid);
      if (!order) return false;
      return this.board.getOrderProgress(order).ready;
    }
    /**
     * Transactional claim: re-validate inventory, collect locations first,
     * then consume + grant rewards. Never half-complete.
     */
    claim(orderUid) {
      const index = this.orders.findIndex((o) => o.uid === orderUid);
      if (index < 0) {
        return { ok: false, reason: "ORDER_NOT_FOUND" };
      }
      const order = this.orders[index];
      const locations = this.board.findItemsForRequirements(order.requirements);
      if (!locations) {
        this.bus.emit("ORDER_UPDATED", { orderUid });
        return { ok: false, reason: "INVENTORY_RACE" };
      }
      const rewardCoins = order.rewardCoins;
      const rewardXp = order.rewardXp;
      const rewardHearts = order.rewardHearts;
      this.board.consumeItems(locations);
      this.progression.addCoins(rewardCoins);
      this.progression.addHearts(rewardHearts);
      this.progression.addXp(rewardXp);
      const replacement = this.createNextOrder(false);
      this.orders.splice(index, 1);
      if (replacement) {
        this.orders.push(replacement);
      }
      this.bus.emit("ORDER_COMPLETED", {
        orderUid,
        rewardCoins,
        rewardXp,
        rewardHearts
      });
      this.bus.emit("ORDER_UPDATED", {
        orderUid: replacement?.uid ?? orderUid
      });
      return {
        ok: true,
        orderUid,
        rewardCoins,
        rewardXp,
        rewardHearts
      };
    }
    refreshProgressHints() {
      for (const order of this.orders) {
        this.bus.emit("ORDER_UPDATED", { orderUid: order.uid });
      }
    }
  };

  // assets/scripts/core/progression/progression.ts
  function getLevelForXp(progression, xp) {
    let level = 1;
    for (const entry of progression.levels) {
      if (xp >= entry.xpRequired) {
        level = entry.level;
      }
    }
    return level;
  }
  function getXpToNext(progression, xp) {
    const current = getLevelForXp(progression, xp);
    const next = progression.levels.find((l) => l.level === current + 1);
    if (!next) {
      return { need: 0, nextThreshold: null, current };
    }
    return {
      need: Math.max(0, next.xpRequired - xp),
      nextThreshold: next.xpRequired,
      current
    };
  }
  function collectUnlockChains(progression, upToLevel) {
    const chains = /* @__PURE__ */ new Set();
    for (const entry of progression.levels) {
      if (entry.level <= upToLevel) {
        for (const c of entry.unlockChains) chains.add(c);
      }
    }
    return [...chains];
  }

  // assets/scripts/gameplay/ProgressionService.ts
  var ProgressionService = class {
    constructor(player, progression, generators, bus) {
      this.player = player;
      this.progression = progression;
      this.generators = generators;
      this.bus = bus;
      this.syncUnlocks();
    }
    get level() {
      return this.player.level;
    }
    get xp() {
      return this.player.xp;
    }
    getXpToNext() {
      return getXpToNext(this.progression, this.player.xp);
    }
    addXp(amount) {
      const previousLevel = this.player.level;
      const delta = Math.max(0, Math.floor(amount));
      this.player.xp += delta;
      this.bus.emit("XP_CHANGED", { xp: this.player.xp, delta });
      const newLevel = getLevelForXp(this.progression, this.player.xp);
      let unlockedChains = [];
      if (newLevel > previousLevel) {
        this.player.level = newLevel;
        unlockedChains = this.syncUnlocks(previousLevel, newLevel);
        this.bus.emit("LEVEL_UP", {
          level: newLevel,
          previousLevel,
          unlockedChains
        });
      }
      return {
        xp: this.player.xp,
        delta,
        previousLevel,
        level: this.player.level,
        leveledUp: newLevel > previousLevel,
        unlockedChains
      };
    }
    addCoins(amount) {
      const delta = Math.max(0, Math.floor(amount));
      this.player.coins += delta;
      this.bus.emit("COINS_CHANGED", { coins: this.player.coins, delta });
    }
    addHearts(amount) {
      const delta = Math.max(0, Math.floor(amount));
      this.player.hearts += delta;
      this.bus.emit("HEARTS_CHANGED", { hearts: this.player.hearts, delta });
    }
    unlockedChains() {
      return [...this.player.unlockedChainIds];
    }
    isGeneratorUnlocked(generatorId) {
      const gen = this.generators.find((g) => g.id === generatorId);
      if (!gen) return false;
      return this.player.level >= gen.unlockLevel;
    }
    syncUnlocks(fromLevel = 0, toLevel = this.player.level) {
      const expected = new Set(collectUnlockChains(this.progression, toLevel));
      const newly = [];
      for (const chain of expected) {
        if (!this.player.unlockedChainIds.includes(chain)) {
          this.player.unlockedChainIds.push(chain);
          if (fromLevel > 0) newly.push(chain);
        }
      }
      this.player.unlockedChainIds = this.player.unlockedChainIds.filter(
        (c) => expected.has(c)
      );
      return newly;
    }
  };

  // assets/scripts/gameplay/GameContext.ts
  var GameContext = class {
    constructor(options = {}) {
      this.bus = new GameEventBus();
      this.bootState = "BOOT";
      this.bootError = null;
      this.logger = options.logger ?? new GameLogger(true);
      this.bundle = options.config ?? loadConfigBundle();
      this.config = this.bundle.game;
      this.platform = new PlatformService(options.storage);
      this.clock = options.clock ?? (options.deterministic ? new FakeClockService() : new SystemClockService());
      this.random = options.random ?? (options.deterministic ? new FixedRandomService([0]) : new SystemRandomService());
      this.ids = options.ids ?? (options.deterministic ? new SequentialIdService("det") : new IdService());
      this.saveService = new SaveService({
        storage: this.platform.getStorage(),
        clock: this.clock,
        saveKey: this.config.saveKey,
        version: this.config.saveVersion,
        createDefault: () => createDefaultSaveData(this.config, this.clock.now()),
        debounceMs: options.saveDebounceMs ?? 200,
        logger: (m) => this.logger.debug("SAVE", m)
      });
    }
    get player() {
      return this.playerRef;
    }
    get tutorial() {
      return this.tutorialRef;
    }
    get gameConfig() {
      return this.config;
    }
    boot() {
      try {
        this.bootState = "LOAD_CONFIG";
        this.logger.debug("BOOT", "load config");
        this.bootState = "VALIDATE_CONFIG";
        assertConfigValid(this.bundle);
        this.bootState = "LOAD_SAVE";
        const loaded = this.saveService.load();
        let data;
        if (loaded.ok) {
          data = loaded.data;
          this.logger.debug("SAVE", `loaded v${data.version}`);
        } else {
          data = loaded.defaultData;
          this.logger.debug("SAVE", `using default (${loaded.reason})`);
        }
        this.playerRef = {
          ...data.player,
          unlockedChainIds: [...data.player.unlockedChainIds]
        };
        this.tutorialRef = { ...data.tutorial };
        this.board = new BoardService(
          this.bundle.catalog,
          this.ids,
          this.bus,
          this.config.board.rows,
          this.config.board.columns,
          cloneBoard({
            rows: this.config.board.rows,
            columns: this.config.board.columns,
            cells: data.board
          })
        );
        this.energy = new EnergyService(
          this.playerRef,
          this.clock,
          this.bus,
          this.config.energy.recoverIntervalMs
        );
        this.progression = new ProgressionService(
          this.playerRef,
          this.bundle.progression,
          this.bundle.generators,
          this.bus
        );
        this.generators = new GeneratorService(
          this.bundle.generators,
          this.bundle.catalog,
          this.board,
          this.energy,
          this.playerRef,
          this.random,
          this.clock
        );
        this.orders = new OrderService(
          this.bundle.orders,
          this.bundle.catalog,
          this.board,
          this.playerRef,
          this.progression,
          this.random,
          this.ids,
          this.bus,
          this.config.orders.activeSlots,
          this.config.orders.minItemLevel,
          this.config.orders.maxItemLevel
        );
        this.orders.hydrate(data.activeOrders, data.recentOrderIds ?? []);
        this.orders.ensureFilled();
        this.bootState = "RECOVER_ENERGY";
        this.energy.tick();
        this.bootState = "INIT_GAME";
        this.markTutorialFromBoard();
        this.bootState = "READY";
        this.logger.info("BOOT", "READY");
        this.save();
      } catch (err) {
        this.bootState = "ERROR";
        this.bootError = err instanceof Error ? err.message : String(err);
        this.logger.error("BOOT", "boot failed", err);
        throw err;
      }
    }
    spawnFromGenerator(generatorId) {
      const result = this.generators.spawn(generatorId);
      if (result.ok) {
        if (!this.tutorialRef.generatorClicked) {
          this.tutorialRef.generatorClicked = true;
          this.bus.emit("TUTORIAL_UPDATED", { ...this.tutorialRef });
        }
        this.orders.refreshProgressHints();
        this.save();
      }
      return result;
    }
    dropItem(from, to) {
      const result = this.board.tryDrop(from, to);
      if (result.ok && result.kind === "MERGE") {
        if (!this.tutorialRef.firstMergeCompleted) {
          this.tutorialRef.firstMergeCompleted = true;
          this.bus.emit("TUTORIAL_UPDATED", { ...this.tutorialRef });
        }
      }
      if (result.ok) {
        this.orders.refreshProgressHints();
        this.save();
      }
      return result;
    }
    claimOrder(orderUid) {
      const result = this.orders.claim(orderUid);
      if (result.ok) {
        if (!this.tutorialRef.firstOrderCompleted) {
          this.tutorialRef.firstOrderCompleted = true;
          this.bus.emit("TUTORIAL_UPDATED", { ...this.tutorialRef });
        }
        this.save();
      }
      return result;
    }
    debugAddEnergy(amount) {
      this.energy.add(amount);
      this.save();
    }
    debugAddXp(amount) {
      this.progression.addXp(amount);
      this.save();
    }
    debugAddCoins(amount) {
      this.progression.addCoins(amount);
      this.save();
    }
    debugClearBoard() {
      this.board.clearBoard();
      this.save();
    }
    debugSpawn(definitionId) {
      this.board.spawn(definitionId);
      this.orders.refreshProgressHints();
      this.save();
    }
    debugResetSave() {
      this.saveService.reset();
      this.boot();
    }
    buildSaveData() {
      return {
        version: this.config.saveVersion,
        savedAt: this.clock.now(),
        player: {
          ...this.playerRef,
          unlockedChainIds: [...this.playerRef.unlockedChainIds]
        },
        board: this.board.getBoard().cells.map((c) => ({
          index: c.index,
          item: c.item ? { ...c.item } : void 0
        })),
        activeOrders: this.orders.getOrders(),
        tutorial: { ...this.tutorialRef },
        recentOrderIds: this.orders.getRecentIds()
      };
    }
    save() {
      const data = this.buildSaveData();
      this.saveService.save(data);
      this.bus.emit("GAME_SAVED", { savedAt: data.savedAt });
    }
    scheduleSave() {
      this.saveService.scheduleSave(this.buildSaveData());
    }
    flushSave() {
      this.saveService.flush();
    }
    markTutorialFromBoard() {
      this.bus.emit("TUTORIAL_UPDATED", { ...this.tutorialRef });
    }
  };
  function createGameContext(options) {
    const ctx = new GameContext(options);
    ctx.boot();
    return ctx;
  }

  // src/web/main.ts
  var CHAIN_PREFIX = {
    coffee: "C",
    flower: "F",
    dessert: "D",
    gift: "G"
  };
  function $(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing #${id}`);
    return el;
  }
  function chainClass(chainId) {
    return `chain-${chainId}`;
  }
  function itemCode(def) {
    const prefix = CHAIN_PREFIX[def.chainId] ?? def.chainId.slice(0, 1).toUpperCase();
    return `${prefix}${def.level}`;
  }
  var WebGameUI = class {
    constructor() {
      this.cells = [];
      this.itemEls = /* @__PURE__ */ new Map();
      this.drag = null;
      this.game = createGameContext({ saveDebounceMs: 150 });
      this.dom = {
        levelBadge: $("level-badge"),
        xpFill: $("xp-fill"),
        xpText: $("xp-text"),
        energyText: $("energy-text"),
        coinsText: $("coins-text"),
        heartsText: $("hearts-text"),
        orders: $("orders"),
        board: $("board"),
        dockInner: $("dock-inner"),
        tutorial: $("tutorial"),
        toastRoot: $("toast-root"),
        levelup: $("levelup"),
        levelupLevel: $("levelup-level"),
        levelupDesc: $("levelup-desc"),
        devBtn: $("dev-btn"),
        devPanel: $("dev-panel"),
        energyPill: $("energy-pill")
      };
      this.bindBus();
      this.buildBoard();
      this.buildDock();
      this.renderAll();
      this.bindDev();
      this.dom.energyPill.addEventListener("click", () => {
        this.toast("\u6BCF 2 \u5206\u949F\u6062\u590D 1 \u70B9\u4F53\u529B");
      });
      window.addEventListener("beforeunload", () => this.game.flushSave());
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) this.game.flushSave();
      });
      setInterval(() => {
        this.game.energy.tick();
        this.renderStatus();
      }, 5e3);
    }
    bindBus() {
      const bus = this.game.bus;
      bus.on("ORDER_COMPLETED", (p) => {
        this.toast(
          `\u4EA4\u4ED8\u6210\u529F\uFF01
\u{1F4B0}${p.rewardCoins} XP${p.rewardXp} \u2764${p.rewardHearts}`,
          "success"
        );
      });
      bus.on("LEVEL_UP", (p) => {
        this.showLevelUp(p.level, p.unlockedChains);
      });
      bus.on("BOARD_CHANGED", () => {
        this.renderBoard();
        this.renderOrders();
      });
      bus.on("ENERGY_CHANGED", () => this.renderStatus());
      bus.on("XP_CHANGED", () => this.renderStatus());
      bus.on("COINS_CHANGED", () => this.renderStatus());
      bus.on("HEARTS_CHANGED", () => this.renderStatus());
      bus.on("ORDER_UPDATED", () => this.renderOrders());
      bus.on("TUTORIAL_UPDATED", () => this.renderTutorial());
      bus.on("ITEM_MERGED", () => {
      });
    }
    buildBoard() {
      const rows = this.game.gameConfig.board.rows;
      const cols = this.game.gameConfig.board.columns;
      this.dom.board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
      this.dom.board.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
      this.dom.board.innerHTML = "";
      this.cells = [];
      for (let i = 0; i < rows * cols; i += 1) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.index = String(i);
        this.dom.board.appendChild(cell);
        this.cells.push(cell);
      }
      this.dom.board.addEventListener("pointerdown", (e) => this.onPointerDown(e));
      window.addEventListener("pointermove", (e) => this.onPointerMove(e));
      window.addEventListener("pointerup", (e) => this.onPointerUp(e));
      window.addEventListener("pointercancel", () => this.cancelDrag());
    }
    buildDock() {
      this.dom.dockInner.innerHTML = "";
      for (const gen of this.game.bundle.generators) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "gen-btn";
        btn.dataset.gen = gen.id;
        const map = {
          coffee_machine: "\u5496",
          flower_basket: "\u82B1",
          dessert_oven: "\u751C",
          gift_box: "\u793C"
        };
        btn.innerHTML = `
        <div class="gen-icon ${chainClass(gen.chainId)}">${map[gen.id] ?? gen.displayName.slice(0, 1)}</div>
        <div class="gen-name">${gen.displayName}</div>
        <div class="gen-lock"></div>
      `;
        btn.addEventListener("click", () => this.onGeneratorClick(gen.id));
        this.dom.dockInner.appendChild(btn);
      }
      this.renderDock();
    }
    onGeneratorClick(id) {
      const gen = this.game.generators.get(id);
      if (!gen) return;
      if (!this.game.generators.isUnlocked(gen)) {
        this.toast(`\u8FBE\u5230 Lv${gen.unlockLevel} \u540E\u89E3\u9501`, "warn");
        return;
      }
      const result = this.game.spawnFromGenerator(id);
      if (result.ok) {
        this.renderAll();
        return;
      }
      if (result.reason === "BOARD_FULL") {
        this.toast("\u68CB\u76D8\u6EE1\u5566\uFF5E\n\u5148\u5408\u6210\u4E00\u4E9B\u7269\u54C1\u5427", "warn");
      } else if (result.reason === "NOT_ENOUGH_ENERGY") {
        this.toast("\u4F53\u529B\u4E0D\u8DB3\u5566\uFF5E\n\u4F11\u606F\u4E00\u4E0B\u518D\u56DE\u6765\u5427", "warn");
      } else if (result.reason === "LOCKED") {
        this.toast(`\u8FBE\u5230 Lv${gen.unlockLevel} \u540E\u89E3\u9501`, "warn");
      } else {
        this.toast("\u6682\u65F6\u65E0\u6CD5\u751F\u6210", "warn");
      }
      this.renderAll();
    }
    cellIndexFromEvent(e) {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const cell = target?.closest(".cell");
      if (!cell) return null;
      const idx = Number(cell.dataset.index);
      return Number.isFinite(idx) ? idx : null;
    }
    onPointerDown(e) {
      const itemEl = e.target.closest(".item");
      if (!itemEl) return;
      const uid = itemEl.dataset.uid;
      const index = Number(itemEl.dataset.index);
      if (!uid || !Number.isFinite(index)) return;
      this.drag = {
        uid,
        fromIndex: index,
        startX: e.clientX,
        startY: e.clientY,
        active: false,
        ghost: null,
        threshold: this.game.gameConfig.dragThresholdPx
      };
    }
    onPointerMove(e) {
      if (!this.drag) return;
      const dx = e.clientX - this.drag.startX;
      const dy = e.clientY - this.drag.startY;
      if (!this.drag.active) {
        if (Math.hypot(dx, dy) < this.drag.threshold) return;
        this.drag.active = true;
        this.startGhost(e);
      }
      this.moveGhost(e);
      this.highlightDropTarget(e);
    }
    onPointerUp(e) {
      if (!this.drag) return;
      const drag = this.drag;
      this.drag = null;
      this.clearHighlights();
      this.removeGhost();
      if (!drag.active) {
        this.renderBoard();
        return;
      }
      const to = this.cellIndexFromEvent(e);
      const result = this.game.dropItem(drag.fromIndex, to);
      this.renderAll();
      if (result.ok && result.kind === "MERGE") {
        this.popMerge(result.to);
        this.toast("\u5408\u6210\u6210\u529F\uFF01", "success");
      }
    }
    cancelDrag() {
      this.drag = null;
      this.clearHighlights();
      this.removeGhost();
      this.renderBoard();
    }
    startGhost(e) {
      if (!this.drag) return;
      const inst = this.findItem(this.drag.fromIndex);
      const def = inst ? this.game.bundle.catalog.get(inst.definitionId) : void 0;
      if (!def) return;
      const ghost = document.createElement("div");
      ghost.className = `ghost ${chainClass(def.chainId)}`;
      ghost.innerHTML = `<div>${itemCode(def)}</div><div style="font-size:9px;font-weight:500">${def.displayName}</div>`;
      document.body.appendChild(ghost);
      this.drag.ghost = ghost;
      this.moveGhost(e);
      const src = this.cells[this.drag.fromIndex]?.querySelector(".item");
      src?.classList.add("dragging");
      this.cells[this.drag.fromIndex]?.classList.add("source-ghost");
    }
    moveGhost(e) {
      if (!this.drag?.ghost) return;
      this.drag.ghost.style.left = `${e.clientX}px`;
      this.drag.ghost.style.top = `${e.clientY}px`;
    }
    removeGhost() {
      this.drag?.ghost?.remove();
      if (this.drag) this.drag.ghost = null;
    }
    highlightDropTarget(e) {
      if (!this.drag) return;
      this.clearHighlights();
      const to = this.cellIndexFromEvent(e);
      if (to === null || to === this.drag.fromIndex) return;
      const preview = this.game.board.previewDrop(this.drag.fromIndex, to);
      const cell = this.cells[to];
      if (!cell) return;
      if (preview.kind === "MERGE") cell.classList.add("drop-merge");
      else if (preview.kind === "MOVE" || preview.kind === "SWAP")
        cell.classList.add("drop-ok");
    }
    clearHighlights() {
      for (const c of this.cells) {
        c.classList.remove("drop-ok", "drop-merge", "source-ghost");
      }
      for (const el of this.itemEls.values()) {
        el.classList.remove("dragging");
      }
    }
    findItem(index) {
      return this.game.board.getBoard().cells[index]?.item;
    }
    renderAll() {
      this.renderStatus();
      this.renderBoard();
      this.renderOrders();
      this.renderDock();
      this.renderTutorial();
    }
    renderStatus() {
      const p = this.game.player;
      this.dom.levelBadge.textContent = `Lv.${p.level}`;
      const xpInfo = this.game.progression.getXpToNext();
      const currentFloor = this.levelXpFloor(p.level);
      const span = xpInfo.nextThreshold !== null ? Math.max(1, xpInfo.nextThreshold - currentFloor) : 1;
      const progress = xpInfo.nextThreshold === null ? 1 : Math.min(1, (p.xp - currentFloor) / span);
      this.dom.xpFill.style.width = `${Math.round(progress * 100)}%`;
      this.dom.xpText.textContent = xpInfo.nextThreshold === null ? `${p.xp} XP` : `${p.xp} / ${xpInfo.nextThreshold}`;
      this.dom.energyText.textContent = `${p.energy}/${p.maxEnergy}`;
      this.dom.coinsText.textContent = String(p.coins);
      this.dom.heartsText.textContent = String(p.hearts);
    }
    levelXpFloor(level) {
      const entry = this.game.bundle.progression.levels.find((l) => l.level === level);
      return entry?.xpRequired ?? 0;
    }
    renderBoard() {
      const board = this.game.board.getBoard();
      for (const el of this.itemEls.values()) el.remove();
      this.itemEls.clear();
      for (const cellState of board.cells) {
        const cellEl = this.cells[cellState.index];
        if (!cellEl) continue;
        const old = cellEl.querySelector(".item");
        if (old) old.remove();
        const item = cellState.item;
        if (!item) continue;
        const def = this.game.bundle.catalog.get(item.definitionId);
        if (!def) continue;
        const el = document.createElement("div");
        el.className = `item ${chainClass(def.chainId)}`;
        el.dataset.uid = item.uid;
        el.dataset.index = String(cellState.index);
        el.innerHTML = `<div class="item-code">${itemCode(def)}</div><div class="item-name">${def.displayName}</div>`;
        cellEl.appendChild(el);
        this.itemEls.set(item.uid, el);
      }
    }
    renderOrders() {
      const orders = this.game.orders.getOrders();
      this.dom.orders.innerHTML = "";
      for (const order of orders) {
        this.dom.orders.appendChild(this.buildOrderCard(order));
      }
    }
    buildOrderCard(order) {
      const card = document.createElement("div");
      card.className = "order-card";
      const progress = this.game.board.getOrderProgress(order);
      const reqs = document.createElement("div");
      reqs.className = "order-reqs";
      for (const req of progress.requirements) {
        const def = this.game.bundle.catalog.get(req.itemId);
        const row = document.createElement("div");
        row.className = `order-req${req.done ? " done" : ""}`;
        row.innerHTML = `<span>${def?.displayName ?? req.itemId}</span><span>${req.done ? "\u2713" : `${req.have}/${req.count}`}</span>`;
        reqs.appendChild(row);
      }
      const reward = document.createElement("div");
      reward.className = "order-reward";
      reward.textContent = `\u{1F4B0}${order.rewardCoins} \u2764${order.rewardHearts}`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `order-btn${progress.ready ? " ready" : ""}`;
      btn.textContent = progress.ready ? "\u4EA4\u4ED8" : "\u8FD8\u5DEE\u4E00\u70B9";
      btn.disabled = !progress.ready;
      btn.addEventListener("click", () => {
        const result = this.game.claimOrder(order.uid);
        if (result.ok) {
          this.renderAll();
        } else if (result.reason === "INVENTORY_RACE") {
          this.toast("\u8FD8\u5DEE\u4E00\u70B9\uFF0C\u5148\u51D1\u9F50\u7269\u54C1\u5427", "warn");
          this.renderAll();
        }
      });
      card.appendChild(reqs);
      card.appendChild(reward);
      card.appendChild(btn);
      return card;
    }
    renderDock() {
      for (const gen of this.game.bundle.generators) {
        const btn = this.dom.dockInner.querySelector(
          `[data-gen="${gen.id}"]`
        );
        if (!btn) continue;
        const isUnlocked = this.game.generators.isUnlocked(gen);
        btn.classList.toggle("locked", !isUnlocked);
        const lock = btn.querySelector(".gen-lock");
        if (lock) {
          lock.textContent = isUnlocked ? `\u26A1${gen.energyCost}` : `\u{1F512} Lv${gen.unlockLevel} \u89E3\u9501`;
        }
      }
    }
    renderTutorial() {
      const t = this.game.tutorial;
      let text = "";
      if (!t.generatorClicked) {
        text = "\u70B9\u4E00\u4E0B\u5496\u5561\u673A\u5427\uFF5E";
      } else if (!t.firstMergeCompleted) {
        text = "\u8BD5\u7740\u628A\u4E24\u4E2A\u4E00\u6837\u7684\u4E1C\u897F\u62D6\u5230\u4E00\u8D77";
      } else if (!t.firstOrderCompleted) {
        const ready = this.game.orders.getOrders().some((o) => this.game.board.getOrderProgress(o).ready);
        if (ready) text = "\u8BA2\u5355\u5B8C\u6210\u5566\uFF0C\u70B9\u51FB\u4EA4\u4ED8\u5427 \u2764\uFE0F";
      }
      if (text) {
        this.dom.tutorial.hidden = false;
        this.dom.tutorial.textContent = text;
      } else {
        this.dom.tutorial.hidden = true;
      }
    }
    toast(message, tone = "info") {
      const el = document.createElement("div");
      el.className = `toast ${tone}`;
      el.textContent = message;
      this.dom.toastRoot.appendChild(el);
      setTimeout(() => {
        el.remove();
      }, 1800);
    }
    showLevelUp(level, unlockedChains) {
      this.dom.levelup.hidden = false;
      this.dom.levelupLevel.textContent = `Lv.${level}`;
      const names = unlockedChains.map((c) => {
        const map = {
          coffee: "\u5496\u5561",
          flower: "\u82B1\u827A",
          dessert: "\u751C\u54C1\u70E4\u7BB1",
          gift: "\u793C\u7269\u76D2"
        };
        return map[c] ?? c;
      });
      this.dom.levelupDesc.textContent = names.length ? `${names.join("\u3001")}\u5DF2\u89E3\u9501\uFF01` : "\u89E3\u9501\u65B0\u5185\u5BB9";
      setTimeout(() => {
        this.dom.levelup.hidden = true;
      }, 1600);
    }
    popMerge(cellIndex) {
      const cell = this.cells[cellIndex];
      const item = cell?.querySelector(".item");
      item?.classList.add("merge-pop");
      setTimeout(() => item?.classList.remove("merge-pop"), 300);
    }
    bindDev() {
      this.dom.devBtn.addEventListener("click", () => {
        this.dom.devPanel.hidden = !this.dom.devPanel.hidden;
      });
      this.dom.devPanel.addEventListener("click", (e) => {
        const btn = e.target.closest(
          "button"
        );
        if (!btn) return;
        const action = btn.dataset.dev;
        if (action === "energy") this.game.debugAddEnergy(50);
        if (action === "xp") this.game.debugAddXp(100);
        if (action === "coins") this.game.debugAddCoins(1e3);
        if (action === "clear") this.game.debugClearBoard();
        if (action === "reset") {
          if (confirm("\u786E\u5B9A\u91CD\u7F6E\u5B58\u6863\uFF1F")) this.game.debugResetSave();
        }
        if (action === "spawn") {
          const chain = document.getElementById("dev-chain").value;
          const level = document.getElementById("dev-level").value;
          this.game.debugSpawn(`${chain}_${level.padStart(2, "0")}`);
        }
        this.renderAll();
      });
    }
  };
  function main() {
    try {
      new WebGameUI();
    } catch (err) {
      document.body.innerHTML = `<pre style="padding:20px;color:#b00">Boot failed: ${err instanceof Error ? err.message : String(err)}</pre>`;
      console.error(err);
    }
  }
  main();
})();
//# sourceMappingURL=game.js.map
