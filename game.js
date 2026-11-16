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
      if (!cell.locked && !cell.item) return cell.index;
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
        locked: cell.locked,
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
    saveVersion: 8,
    toolbox: {
      warehouseSlots: 6,
      startingScissors: 2
    },
    board: {
      rows: 7,
      columns: 6,
      unlocks: [
        {
          level: 1,
          columns: 3,
          rows: 3
        },
        {
          level: 2,
          columns: 4,
          rows: 3
        },
        {
          level: 3,
          columns: 4,
          rows: 4
        },
        {
          level: 4,
          columns: 5,
          rows: 4
        },
        {
          level: 5,
          columns: 5,
          rows: 5
        },
        {
          level: 6,
          columns: 6,
          rows: 5
        },
        {
          level: 8,
          columns: 6,
          rows: 6
        },
        {
          level: 10,
          columns: 6,
          rows: 7
        }
      ]
    },
    energy: {
      maxEnergy: 100,
      initialEnergy: 100,
      generatorCost: 1,
      recoverIntervalMs: 24e4,
      maxByLevel: [
        100,
        150,
        200,
        250,
        300,
        350,
        400,
        450,
        500,
        550,
        600,
        650,
        700,
        750,
        800,
        850,
        900,
        1e3
      ]
    },
    dragThresholdPx: 12,
    orders: {
      activeSlots: 3,
      minRequirements: 1,
      maxRequirements: 3,
      minItemLevel: 2,
      maxItemLevel: 5,
      refreshCooldownMs: 9e5,
      refreshDiamondCost: 2,
      dynamic: {
        rareChance: 0.2,
        urgentChance: 0.1,
        urgentDurationMs: 18e5,
        rewardMultiplierMin: 1.2,
        rewardMultiplierMax: 1.8,
        rewardMultiplierMaxLevel: 18,
        twoItemChance: 0.3
      }
    },
    couple: {
      gameTitle: "\u6211\u4EEC\u7684\u6D6A\u6F2B\u5C0F\u5C4B",
      coupleDisplayName: "",
      anniversary: "",
      metMonth: "2023-09",
      metDate: "2023-09-08",
      weddingDate: "2026-10-03",
      theme: "warm-romantic",
      gift: {
        coverMessage: "",
        title: "",
        salutation: "",
        body: "",
        signoff: "",
        signature: ""
      }
    },
    rewards: {
      discoveryCoins: 10,
      chestDropChance: 0.08,
      chestLoot: [
        {
          itemId: "coin_01",
          weight: 5
        },
        {
          itemId: "energy_01",
          weight: 3
        },
        {
          itemId: "diamond_01",
          weight: 2
        }
      ],
      exchangeOffers: [
        {
          id: "small",
          diamonds: 5,
          energy: 25
        },
        {
          id: "large",
          diamonds: 10,
          energy: 60
        }
      ],
      checkIn: [
        {
          coins: 30,
          energy: 0,
          diamonds: 0
        },
        {
          coins: 0,
          energy: 15,
          diamonds: 0
        },
        {
          coins: 0,
          energy: 0,
          diamonds: 2
        },
        {
          coins: 50,
          energy: 0,
          diamonds: 0
        },
        {
          coins: 0,
          energy: 25,
          diamonds: 0
        },
        {
          coins: 0,
          energy: 0,
          diamonds: 3
        },
        {
          coins: 80,
          energy: 20,
          diamonds: 5,
          itemId: "scissors_02"
        }
      ],
      dailyTasks: [
        {
          id: "orders_3",
          kind: "orders",
          title: "\u5B8C\u62103\u7B14\u8BA2\u5355",
          target: 3,
          reward: {
            coins: 50,
            xp: 20,
            energy: 10,
            diamonds: 1
          }
        },
        {
          id: "merges_10",
          kind: "merges",
          title: "\u5408\u621010\u6B21",
          target: 10,
          reward: {
            coins: 40,
            xp: 15,
            energy: 10,
            diamonds: 1
          }
        },
        {
          id: "specific_2",
          kind: "specific",
          title: "\u5408\u6210\u6307\u5B9A\u7269\u54C12\u6B21",
          target: 2,
          reward: {
            coins: 35,
            xp: 15,
            energy: 5,
            diamonds: 1
          }
        }
      ],
      chestLevels: [
        {
          level: 1,
          count: 2
        },
        {
          level: 2,
          count: 4,
          loot: [
            {
              itemId: "coin_01",
              weight: 8
            },
            {
              itemId: "energy_01",
              weight: 6
            },
            {
              itemId: "diamond_01",
              weight: 4
            },
            {
              itemId: "coin_02",
              weight: 1
            },
            {
              itemId: "energy_02",
              weight: 1
            },
            {
              itemId: "diamond_02",
              weight: 1
            }
          ]
        },
        {
          level: 3,
          count: 8,
          loot: [
            {
              itemId: "coin_01",
              weight: 6
            },
            {
              itemId: "energy_01",
              weight: 4
            },
            {
              itemId: "diamond_01",
              weight: 3
            },
            {
              itemId: "coin_02",
              weight: 3
            },
            {
              itemId: "energy_02",
              weight: 2
            },
            {
              itemId: "diamond_02",
              weight: 2
            },
            {
              itemId: "coin_03",
              weight: 1
            }
          ]
        },
        {
          level: 4,
          count: 16,
          loot: [
            {
              itemId: "coin_01",
              weight: 3
            },
            {
              itemId: "energy_01",
              weight: 2
            },
            {
              itemId: "diamond_01",
              weight: 2
            },
            {
              itemId: "coin_02",
              weight: 4
            },
            {
              itemId: "energy_02",
              weight: 3
            },
            {
              itemId: "diamond_02",
              weight: 3
            },
            {
              itemId: "coin_03",
              weight: 2
            },
            {
              itemId: "energy_03",
              weight: 2
            },
            {
              itemId: "diamond_03",
              weight: 2
            }
          ]
        },
        {
          level: 5,
          count: 32,
          loot: [
            {
              itemId: "coin_01",
              weight: 2
            },
            {
              itemId: "energy_01",
              weight: 2
            },
            {
              itemId: "diamond_01",
              weight: 1
            },
            {
              itemId: "coin_02",
              weight: 3
            },
            {
              itemId: "energy_02",
              weight: 3
            },
            {
              itemId: "diamond_02",
              weight: 3
            },
            {
              itemId: "coin_03",
              weight: 3
            },
            {
              itemId: "energy_03",
              weight: 3
            },
            {
              itemId: "diamond_03",
              weight: 2
            }
          ]
        }
      ]
    },
    collection: {
      chainIds: [
        "coffee",
        "flower",
        "dessert",
        "gift",
        "fruit",
        "sugar"
      ],
      energyPerChain: 3,
      maxEnergyCap: 1e3
    },
    generationBonusDrops: [
      {
        generatorId: "coffee_machine",
        minLevel: 2,
        chance: 0.1,
        itemId: "sugar_01"
      },
      {
        generatorId: "*",
        minLevel: 2,
        chance: 5e-3,
        itemId: "wildcard",
        excludeRecharge: true
      }
    ],
    generatorRestore: {
      cooldownCost: 2,
      chargeCost: 5
    }
  };

  // assets/resources/config/items.json
  var items_default = [
    {
      id: "coffee_01",
      chainId: "coffee",
      level: 1,
      displayName: "\u5496\u5561\u8C46",
      nextItemId: "coffee_02",
      sellValue: 1,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "coffee_02",
      chainId: "coffee",
      level: 2,
      displayName: "\u7CBE\u9009\u5496\u5561\u8C46",
      nextItemId: "coffee_03",
      sellValue: 2,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "coffee_03",
      chainId: "coffee",
      level: 3,
      displayName: "\u6D53\u7F29\u5496\u5561",
      nextItemId: "coffee_04",
      sellValue: 4,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "coffee_04",
      chainId: "coffee",
      level: 4,
      displayName: "\u7231\u5FC3\u62FF\u94C1",
      nextItemId: "coffee_05",
      sellValue: 8,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "coffee_05",
      chainId: "coffee",
      level: 5,
      displayName: "\u73BB\u7483\u676F\u5496\u5561",
      nextItemId: "coffee_06",
      sellValue: 16,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "coffee_06",
      chainId: "coffee",
      level: 6,
      displayName: "\u5976\u6CE1\u58F6",
      nextItemId: "coffee_07",
      sellValue: 32,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "coffee_07",
      chainId: "coffee",
      level: 7,
      displayName: "\u5496\u5561\u7F50",
      nextItemId: "coffee_08",
      sellValue: 64,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "coffee_08",
      chainId: "coffee",
      level: 8,
      displayName: "\u5496\u5561\u793C\u7BEE",
      sellValue: 128,
      wildcardEligible: true,
      maxLevel: false,
      nextItemId: "coffee_09"
    },
    {
      id: "flower_01",
      chainId: "flower",
      level: 1,
      displayName: "\u90C1\u91D1\u9999\u82B1\u82DE",
      nextItemId: "flower_02",
      sellValue: 1,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "flower_02",
      chainId: "flower",
      level: 2,
      displayName: "\u5E76\u8482\u90C1\u91D1\u9999",
      nextItemId: "flower_03",
      sellValue: 2,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "flower_03",
      chainId: "flower",
      level: 3,
      displayName: "\u90C1\u91D1\u9999\u82B1\u675F",
      nextItemId: "flower_04",
      sellValue: 4,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "flower_04",
      chainId: "flower",
      level: 4,
      displayName: "\u73AB\u7470",
      nextItemId: "flower_05",
      sellValue: 8,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "flower_05",
      chainId: "flower",
      level: 5,
      displayName: "\u73AB\u7470\u82B1\u675F",
      nextItemId: "flower_06",
      sellValue: 16,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "flower_06",
      chainId: "flower",
      level: 6,
      displayName: "\u5411\u65E5\u8475\u82B1\u675F",
      nextItemId: "flower_07",
      sellValue: 32,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "flower_07",
      chainId: "flower",
      level: 7,
      displayName: "\u85B0\u8863\u8349",
      nextItemId: "flower_08",
      sellValue: 64,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "flower_08",
      chainId: "flower",
      level: 8,
      displayName: "\u6D6A\u6F2B\u82B1\u7BEE",
      sellValue: 128,
      wildcardEligible: true,
      maxLevel: false,
      nextItemId: "flower_09"
    },
    {
      id: "dessert_01",
      chainId: "dessert",
      level: 1,
      displayName: "\u725B\u89D2\u5305",
      nextItemId: "dessert_02",
      sellValue: 1,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "dessert_02",
      chainId: "dessert",
      level: 2,
      displayName: "\u5DE7\u514B\u529B\u9EA6\u82AC",
      nextItemId: "dessert_03",
      sellValue: 2,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "dessert_03",
      chainId: "dessert",
      level: 3,
      displayName: "\u8349\u8393\u86CB\u7CD5\u7247",
      nextItemId: "dessert_04",
      sellValue: 4,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "dessert_04",
      chainId: "dessert",
      level: 4,
      displayName: "\u8349\u8393\u5976\u6CB9\u86CB\u7CD5",
      nextItemId: "dessert_05",
      sellValue: 8,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "dessert_05",
      chainId: "dessert",
      level: 5,
      displayName: "\u7C89\u8272\u9A6C\u5361\u9F99",
      nextItemId: "dessert_06",
      sellValue: 16,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "dessert_06",
      chainId: "dessert",
      level: 6,
      displayName: "\u7126\u7CD6\u5E03\u4E01",
      nextItemId: "dessert_07",
      sellValue: 32,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "dessert_07",
      chainId: "dessert",
      level: 7,
      displayName: "\u8393\u679C\u86CB\u7CD5\u5377",
      nextItemId: "dessert_08",
      sellValue: 64,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "dessert_08",
      chainId: "dessert",
      level: 8,
      displayName: "\u53CC\u5C42\u4E0B\u5348\u8336",
      sellValue: 128,
      wildcardEligible: true,
      maxLevel: false,
      nextItemId: "dessert_09"
    },
    {
      id: "gift_01",
      chainId: "gift",
      level: 1,
      displayName: "\u8774\u8776\u7ED3",
      nextItemId: "gift_02",
      sellValue: 1,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "gift_02",
      chainId: "gift",
      level: 2,
      displayName: "\u60C5\u4E66",
      nextItemId: "gift_03",
      sellValue: 2,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "gift_03",
      chainId: "gift",
      level: 3,
      displayName: "\u4E1D\u5E26\u793C\u76D2",
      nextItemId: "gift_04",
      sellValue: 4,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "gift_04",
      chainId: "gift",
      level: 4,
      displayName: "\u5FC3\u610F\u5C0F\u718A",
      nextItemId: "gift_05",
      sellValue: 8,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "gift_05",
      chainId: "gift",
      level: 5,
      displayName: "\u5FC3\u5F62\u793C\u76D2",
      nextItemId: "gift_06",
      sellValue: 16,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "gift_06",
      chainId: "gift",
      level: 6,
      displayName: "\u7231\u5FC3\u540A\u5760",
      nextItemId: "gift_07",
      sellValue: 32,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "gift_07",
      chainId: "gift",
      level: 7,
      displayName: "\u73AB\u7470\u793C\u7BEE",
      nextItemId: "gift_08",
      sellValue: 64,
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "gift_08",
      chainId: "gift",
      level: 8,
      displayName: "\u7EAA\u5FF5\u65E5\u82B1\u793C",
      sellValue: 128,
      wildcardEligible: true,
      maxLevel: false,
      nextItemId: "gift_09"
    },
    {
      id: "coin_01",
      chainId: "coin",
      level: 1,
      displayName: "\u91D1\u5E011\u7EA7",
      useValue: 10,
      nextItemId: "coin_02"
    },
    {
      id: "coin_02",
      chainId: "coin",
      level: 2,
      displayName: "\u91D1\u5E012\u7EA7",
      useValue: 25,
      nextItemId: "coin_03"
    },
    {
      id: "coin_03",
      chainId: "coin",
      level: 3,
      displayName: "\u91D1\u5E013\u7EA7",
      useValue: 60,
      maxLevel: false,
      nextItemId: "coin_04"
    },
    {
      id: "coin_04",
      chainId: "coin",
      level: 4,
      displayName: "\u91D1\u5E014\u7EA7",
      useValue: 150,
      maxLevel: false,
      nextItemId: "coin_05"
    },
    {
      id: "coin_05",
      chainId: "coin",
      level: 5,
      displayName: "\u91D1\u5E015\u7EA7",
      useValue: 375,
      maxLevel: true
    },
    {
      id: "energy_01",
      chainId: "energy",
      level: 1,
      displayName: "\u4F53\u529B\u74F61\u7EA7",
      useValue: 5,
      nextItemId: "energy_02"
    },
    {
      id: "energy_02",
      chainId: "energy",
      level: 2,
      displayName: "\u4F53\u529B\u74F62\u7EA7",
      useValue: 12,
      nextItemId: "energy_03"
    },
    {
      id: "energy_03",
      chainId: "energy",
      level: 3,
      displayName: "\u4F53\u529B\u74F63\u7EA7",
      useValue: 30,
      maxLevel: false,
      nextItemId: "energy_04"
    },
    {
      id: "energy_04",
      chainId: "energy",
      level: 4,
      displayName: "\u4F53\u529B\u74F64\u7EA7",
      useValue: 75,
      maxLevel: false,
      nextItemId: "energy_05"
    },
    {
      id: "energy_05",
      chainId: "energy",
      level: 5,
      displayName: "\u4F53\u529B\u74F65\u7EA7",
      useValue: 190,
      maxLevel: true
    },
    {
      id: "diamond_01",
      chainId: "diamond",
      level: 1,
      displayName: "\u94BB\u77F31\u7EA7",
      useValue: 1,
      nextItemId: "diamond_02"
    },
    {
      id: "diamond_02",
      chainId: "diamond",
      level: 2,
      displayName: "\u94BB\u77F32\u7EA7",
      useValue: 3,
      nextItemId: "diamond_03"
    },
    {
      id: "diamond_03",
      chainId: "diamond",
      level: 3,
      displayName: "\u94BB\u77F33\u7EA7",
      useValue: 8,
      maxLevel: false,
      nextItemId: "diamond_04"
    },
    {
      id: "diamond_04",
      chainId: "diamond",
      level: 4,
      displayName: "\u94BB\u77F34\u7EA7",
      useValue: 20,
      maxLevel: false,
      nextItemId: "diamond_05"
    },
    {
      id: "diamond_05",
      chainId: "diamond",
      level: 5,
      displayName: "\u94BB\u77F35\u7EA7",
      useValue: 50,
      maxLevel: true
    },
    {
      id: "treasure_chest",
      chainId: "treasure_chest",
      level: 1,
      displayName: "\u5B9D\u7BB1",
      nextItemId: "treasure_chest_02",
      maxLevel: false
    },
    {
      id: "fruit_01",
      chainId: "fruit",
      level: 1,
      displayName: "\u751C\u6A58",
      sellValue: 2,
      nextItemId: "fruit_02",
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "fruit_02",
      chainId: "fruit",
      level: 2,
      displayName: "\u6A58\u74E3\u679C\u7897",
      sellValue: 4,
      nextItemId: "fruit_03",
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "fruit_03",
      chainId: "fruit",
      level: 3,
      displayName: "\u9C9C\u69A8\u6A58\u6C41",
      sellValue: 8,
      nextItemId: "fruit_04",
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "fruit_04",
      chainId: "fruit",
      level: 4,
      displayName: "\u6A58\u9999\u679C\u8336",
      sellValue: 16,
      nextItemId: "fruit_05",
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "fruit_05",
      chainId: "fruit",
      level: 5,
      displayName: "\u6A58\u5B50\u679C\u51BB",
      sellValue: 32,
      nextItemId: "fruit_06",
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "fruit_06",
      chainId: "fruit",
      level: 6,
      displayName: "\u6A58\u9999\u5C0F\u86CB\u7CD5",
      sellValue: 64,
      nextItemId: "fruit_07",
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "fruit_07",
      chainId: "fruit",
      level: 7,
      displayName: "\u6A58\u5B50\u5E86\u795D\u86CB\u7CD5",
      sellValue: 128,
      nextItemId: "fruit_08",
      wildcardEligible: true,
      maxLevel: false
    },
    {
      id: "fruit_08",
      chainId: "fruit",
      level: 8,
      displayName: "\u9633\u5149\u751C\u6A58\u793C\u7BEE",
      sellValue: 256,
      wildcardEligible: true,
      maxLevel: false,
      nextItemId: "fruit_09"
    },
    {
      id: "sugar_01",
      chainId: "sugar",
      level: 1,
      displayName: "\u65B9\u7CD6",
      wildcardEligible: true,
      nextItemId: "sugar_02"
    },
    {
      id: "sugar_02",
      chainId: "sugar",
      level: 2,
      displayName: "\u53CC\u5757\u65B9\u7CD6",
      wildcardEligible: true,
      nextItemId: "sugar_03"
    },
    {
      id: "sugar_03",
      chainId: "sugar",
      level: 3,
      displayName: "\u751C\u871C\u7CD6\u7F50",
      wildcardEligible: true
    },
    {
      id: "wildcard",
      chainId: "wildcard",
      level: 1,
      displayName: "\u4E07\u80FD\u98DF\u6750",
      wildcard: true
    },
    {
      id: "treasure_chest_02",
      chainId: "treasure_chest",
      level: 2,
      displayName: "2\u7EA7\u5B9D\u7BB1",
      maxLevel: false,
      nextItemId: "treasure_chest_03"
    },
    {
      id: "treasure_chest_03",
      chainId: "treasure_chest",
      level: 3,
      displayName: "3\u7EA7\u5B9D\u7BB1",
      maxLevel: false,
      nextItemId: "treasure_chest_04"
    },
    {
      id: "treasure_chest_04",
      chainId: "treasure_chest",
      level: 4,
      displayName: "4\u7EA7\u5B9D\u7BB1",
      maxLevel: false,
      nextItemId: "treasure_chest_05"
    },
    {
      id: "treasure_chest_05",
      chainId: "treasure_chest",
      level: 5,
      displayName: "5\u7EA7\u5B9D\u7BB1",
      maxLevel: true
    },
    {
      id: "coffee_09",
      chainId: "coffee",
      level: 9,
      displayName: "\u82B1\u8BED\u62FF\u94C1",
      wildcardEligible: true,
      maxLevel: false,
      nextItemId: "coffee_10"
    },
    {
      id: "coffee_10",
      chainId: "coffee",
      level: 10,
      displayName: "\u53CC\u676F\u5348\u540E\u8336",
      wildcardEligible: true,
      maxLevel: false,
      nextItemId: "coffee_11"
    },
    {
      id: "coffee_11",
      chainId: "coffee",
      level: 11,
      displayName: "\u73AB\u7470\u5496\u5561\u7EC4",
      wildcardEligible: true,
      maxLevel: false,
      nextItemId: "coffee_12"
    },
    {
      id: "coffee_12",
      chainId: "coffee",
      level: 12,
      displayName: "\u6D6A\u6F2B\u5496\u5561\u5BB4",
      wildcardEligible: true,
      maxLevel: true
    },
    {
      id: "flower_09",
      chainId: "flower",
      level: 9,
      displayName: "\u73AB\u7470\u73BB\u7483\u7F69",
      wildcardEligible: true,
      maxLevel: false,
      nextItemId: "flower_10"
    },
    {
      id: "flower_10",
      chainId: "flower",
      level: 10,
      displayName: "\u5FC3\u5F62\u82B1\u73AF",
      wildcardEligible: true,
      maxLevel: false,
      nextItemId: "flower_11"
    },
    {
      id: "flower_11",
      chainId: "flower",
      level: 11,
      displayName: "\u7E41\u82B1\u793C\u7BEE",
      wildcardEligible: true,
      maxLevel: false,
      nextItemId: "flower_12"
    },
    {
      id: "flower_12",
      chainId: "flower",
      level: 12,
      displayName: "\u5A5A\u793C\u6367\u82B1",
      wildcardEligible: true,
      maxLevel: true
    },
    {
      id: "dessert_09",
      chainId: "dessert",
      level: 9,
      displayName: "\u8393\u679C\u53CC\u5C42\u7CD5",
      wildcardEligible: true,
      maxLevel: false,
      nextItemId: "dessert_10"
    },
    {
      id: "dessert_10",
      chainId: "dessert",
      level: 10,
      displayName: "\u5929\u9E45\u6CE1\u8299\u5854",
      wildcardEligible: true,
      maxLevel: false,
      nextItemId: "dessert_11"
    },
    {
      id: "dessert_11",
      chainId: "dessert",
      level: 11,
      displayName: "\u73AB\u7470\u5A5A\u793C\u7CD5",
      wildcardEligible: true,
      maxLevel: false,
      nextItemId: "dessert_12"
    },
    {
      id: "dessert_12",
      chainId: "dessert",
      level: 12,
      displayName: "\u68A6\u5E7B\u751C\u54C1\u5854",
      wildcardEligible: true,
      maxLevel: true
    },
    {
      id: "gift_09",
      chainId: "gift",
      level: 9,
      displayName: "\u73CD\u73E0\u793C\u5323",
      wildcardEligible: true,
      maxLevel: false,
      nextItemId: "gift_10"
    },
    {
      id: "gift_10",
      chainId: "gift",
      level: 10,
      displayName: "\u5FC3\u5F62\u97F3\u4E50\u76D2",
      wildcardEligible: true,
      maxLevel: false,
      nextItemId: "gift_11"
    },
    {
      id: "gift_11",
      chainId: "gift",
      level: 11,
      displayName: "\u6C42\u5A5A\u6212\u76D2",
      wildcardEligible: true,
      maxLevel: false,
      nextItemId: "gift_12"
    },
    {
      id: "gift_12",
      chainId: "gift",
      level: 12,
      displayName: "\u5FC3\u610F\u73CD\u85CF\u7BB1",
      wildcardEligible: true,
      maxLevel: true
    },
    {
      id: "fruit_09",
      chainId: "fruit",
      level: 9,
      displayName: "\u6A59\u82B1\u679C\u51BB\u676F",
      wildcardEligible: true,
      maxLevel: false,
      nextItemId: "fruit_10"
    },
    {
      id: "fruit_10",
      chainId: "fruit",
      level: 10,
      displayName: "\u6A59\u9999\u534E\u592B\u76D8",
      wildcardEligible: true,
      maxLevel: false,
      nextItemId: "fruit_11"
    },
    {
      id: "fruit_11",
      chainId: "fruit",
      level: 11,
      displayName: "\u9C9C\u6A59\u5E86\u5178\u7CD5",
      wildcardEligible: true,
      maxLevel: false,
      nextItemId: "fruit_12"
    },
    {
      id: "fruit_12",
      chainId: "fruit",
      level: 12,
      displayName: "\u9633\u5149\u6C34\u679C\u5BB4",
      wildcardEligible: true,
      maxLevel: true
    },
    {
      id: "scissors_01",
      chainId: "scissors",
      level: 1,
      displayName: "1\u7EA7\u526A\u5200",
      maxUses: 1,
      maxLevel: false,
      wildcardEligible: false,
      nextItemId: "scissors_02"
    },
    {
      id: "scissors_02",
      chainId: "scissors",
      level: 2,
      displayName: "2\u7EA7\u526A\u5200",
      maxUses: 3,
      maxLevel: false,
      wildcardEligible: false,
      nextItemId: "scissors_03"
    },
    {
      id: "scissors_03",
      chainId: "scissors",
      level: 3,
      displayName: "3\u7EA7\u526A\u5200",
      maxUses: 8,
      maxLevel: false,
      wildcardEligible: false,
      nextItemId: "scissors_04"
    },
    {
      id: "scissors_04",
      chainId: "scissors",
      level: 4,
      displayName: "4\u7EA7\u526A\u5200",
      maxUses: 20,
      maxLevel: false,
      wildcardEligible: false,
      nextItemId: "scissors_05"
    },
    {
      id: "scissors_05",
      chainId: "scissors",
      level: 5,
      displayName: "5\u7EA7\u526A\u5200",
      maxUses: 50,
      maxLevel: true,
      wildcardEligible: false
    }
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
        {
          itemId: "coffee_01",
          weight: 70
        },
        {
          itemId: "coffee_02",
          weight: 25
        },
        {
          itemId: "coffee_03",
          weight: 5
        }
      ],
      upgrade: {
        maxLevel: 8,
        rechargeFactor: 0.8,
        boostEnergyMultiplier: 2,
        levels: [
          {
            level: 2,
            outputs: [
              {
                itemId: "coffee_02",
                weight: 70
              },
              {
                itemId: "coffee_03",
                weight: 25
              },
              {
                itemId: "coffee_04",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "coffee_02",
                weight: 25
              },
              {
                itemId: "coffee_03",
                weight: 50
              },
              {
                itemId: "coffee_04",
                weight: 25
              }
            ]
          },
          {
            level: 3,
            outputs: [
              {
                itemId: "coffee_03",
                weight: 70
              },
              {
                itemId: "coffee_04",
                weight: 25
              },
              {
                itemId: "coffee_05",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "coffee_03",
                weight: 25
              },
              {
                itemId: "coffee_04",
                weight: 50
              },
              {
                itemId: "coffee_05",
                weight: 25
              }
            ]
          },
          {
            level: 4,
            outputs: [
              {
                itemId: "coffee_04",
                weight: 70
              },
              {
                itemId: "coffee_05",
                weight: 25
              },
              {
                itemId: "coffee_06",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "coffee_04",
                weight: 25
              },
              {
                itemId: "coffee_05",
                weight: 50
              },
              {
                itemId: "coffee_06",
                weight: 25
              }
            ]
          },
          {
            level: 5,
            outputs: [
              {
                itemId: "coffee_05",
                weight: 70
              },
              {
                itemId: "coffee_06",
                weight: 25
              },
              {
                itemId: "coffee_07",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "coffee_05",
                weight: 25
              },
              {
                itemId: "coffee_06",
                weight: 50
              },
              {
                itemId: "coffee_07",
                weight: 25
              }
            ]
          },
          {
            level: 6,
            outputs: [
              {
                itemId: "coffee_06",
                weight: 70
              },
              {
                itemId: "coffee_07",
                weight: 25
              },
              {
                itemId: "coffee_08",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "coffee_06",
                weight: 25
              },
              {
                itemId: "coffee_07",
                weight: 50
              },
              {
                itemId: "coffee_08",
                weight: 25
              }
            ]
          },
          {
            level: 7,
            outputs: [
              {
                itemId: "coffee_07",
                weight: 70
              },
              {
                itemId: "coffee_08",
                weight: 25
              },
              {
                itemId: "coffee_09",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "coffee_07",
                weight: 25
              },
              {
                itemId: "coffee_08",
                weight: 50
              },
              {
                itemId: "coffee_09",
                weight: 25
              }
            ]
          },
          {
            level: 8,
            outputs: [
              {
                itemId: "coffee_08",
                weight: 70
              },
              {
                itemId: "coffee_09",
                weight: 25
              },
              {
                itemId: "coffee_10",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "coffee_08",
                weight: 25
              },
              {
                itemId: "coffee_09",
                weight: 50
              },
              {
                itemId: "coffee_10",
                weight: 25
              }
            ]
          }
        ]
      },
      streakCooldown: {
        uses: 60,
        durationMs: 2e4
      },
      purchaseCoins: 100
    },
    {
      id: "flower_basket",
      displayName: "\u82B1\u7BEE",
      chainId: "flower",
      unlockLevel: 3,
      energyCost: 1,
      outputs: [
        {
          itemId: "flower_01",
          weight: 70
        },
        {
          itemId: "flower_02",
          weight: 25
        },
        {
          itemId: "flower_03",
          weight: 5
        }
      ],
      upgrade: {
        maxLevel: 8,
        rechargeFactor: 0.8,
        boostEnergyMultiplier: 2,
        levels: [
          {
            level: 2,
            outputs: [
              {
                itemId: "flower_02",
                weight: 70
              },
              {
                itemId: "flower_03",
                weight: 25
              },
              {
                itemId: "flower_04",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "flower_02",
                weight: 25
              },
              {
                itemId: "flower_03",
                weight: 50
              },
              {
                itemId: "flower_04",
                weight: 25
              }
            ]
          },
          {
            level: 3,
            outputs: [
              {
                itemId: "flower_03",
                weight: 70
              },
              {
                itemId: "flower_04",
                weight: 25
              },
              {
                itemId: "flower_05",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "flower_03",
                weight: 25
              },
              {
                itemId: "flower_04",
                weight: 50
              },
              {
                itemId: "flower_05",
                weight: 25
              }
            ]
          },
          {
            level: 4,
            outputs: [
              {
                itemId: "flower_04",
                weight: 70
              },
              {
                itemId: "flower_05",
                weight: 25
              },
              {
                itemId: "flower_06",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "flower_04",
                weight: 25
              },
              {
                itemId: "flower_05",
                weight: 50
              },
              {
                itemId: "flower_06",
                weight: 25
              }
            ]
          },
          {
            level: 5,
            outputs: [
              {
                itemId: "flower_05",
                weight: 70
              },
              {
                itemId: "flower_06",
                weight: 25
              },
              {
                itemId: "flower_07",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "flower_05",
                weight: 25
              },
              {
                itemId: "flower_06",
                weight: 50
              },
              {
                itemId: "flower_07",
                weight: 25
              }
            ]
          },
          {
            level: 6,
            outputs: [
              {
                itemId: "flower_06",
                weight: 70
              },
              {
                itemId: "flower_07",
                weight: 25
              },
              {
                itemId: "flower_08",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "flower_06",
                weight: 25
              },
              {
                itemId: "flower_07",
                weight: 50
              },
              {
                itemId: "flower_08",
                weight: 25
              }
            ]
          },
          {
            level: 7,
            outputs: [
              {
                itemId: "flower_07",
                weight: 70
              },
              {
                itemId: "flower_08",
                weight: 25
              },
              {
                itemId: "flower_09",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "flower_07",
                weight: 25
              },
              {
                itemId: "flower_08",
                weight: 50
              },
              {
                itemId: "flower_09",
                weight: 25
              }
            ]
          },
          {
            level: 8,
            outputs: [
              {
                itemId: "flower_08",
                weight: 70
              },
              {
                itemId: "flower_09",
                weight: 25
              },
              {
                itemId: "flower_10",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "flower_08",
                weight: 25
              },
              {
                itemId: "flower_09",
                weight: 50
              },
              {
                itemId: "flower_10",
                weight: 25
              }
            ]
          }
        ]
      },
      streakCooldown: {
        uses: 60,
        durationMs: 2e4
      },
      purchaseCoins: 150
    },
    {
      id: "dessert_oven",
      displayName: "\u751C\u54C1\u70E4\u7BB1",
      chainId: "dessert",
      unlockLevel: 5,
      energyCost: 1,
      outputs: [
        {
          itemId: "dessert_01",
          weight: 70
        },
        {
          itemId: "dessert_02",
          weight: 25
        },
        {
          itemId: "dessert_03",
          weight: 5
        }
      ],
      upgrade: {
        maxLevel: 8,
        rechargeFactor: 0.8,
        boostEnergyMultiplier: 2,
        levels: [
          {
            level: 2,
            outputs: [
              {
                itemId: "dessert_02",
                weight: 70
              },
              {
                itemId: "dessert_03",
                weight: 25
              },
              {
                itemId: "dessert_04",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "dessert_02",
                weight: 25
              },
              {
                itemId: "dessert_03",
                weight: 50
              },
              {
                itemId: "dessert_04",
                weight: 25
              }
            ]
          },
          {
            level: 3,
            outputs: [
              {
                itemId: "dessert_03",
                weight: 70
              },
              {
                itemId: "dessert_04",
                weight: 25
              },
              {
                itemId: "dessert_05",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "dessert_03",
                weight: 25
              },
              {
                itemId: "dessert_04",
                weight: 50
              },
              {
                itemId: "dessert_05",
                weight: 25
              }
            ]
          },
          {
            level: 4,
            outputs: [
              {
                itemId: "dessert_04",
                weight: 70
              },
              {
                itemId: "dessert_05",
                weight: 25
              },
              {
                itemId: "dessert_06",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "dessert_04",
                weight: 25
              },
              {
                itemId: "dessert_05",
                weight: 50
              },
              {
                itemId: "dessert_06",
                weight: 25
              }
            ]
          },
          {
            level: 5,
            outputs: [
              {
                itemId: "dessert_05",
                weight: 70
              },
              {
                itemId: "dessert_06",
                weight: 25
              },
              {
                itemId: "dessert_07",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "dessert_05",
                weight: 25
              },
              {
                itemId: "dessert_06",
                weight: 50
              },
              {
                itemId: "dessert_07",
                weight: 25
              }
            ]
          },
          {
            level: 6,
            outputs: [
              {
                itemId: "dessert_06",
                weight: 70
              },
              {
                itemId: "dessert_07",
                weight: 25
              },
              {
                itemId: "dessert_08",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "dessert_06",
                weight: 25
              },
              {
                itemId: "dessert_07",
                weight: 50
              },
              {
                itemId: "dessert_08",
                weight: 25
              }
            ]
          },
          {
            level: 7,
            outputs: [
              {
                itemId: "dessert_07",
                weight: 70
              },
              {
                itemId: "dessert_08",
                weight: 25
              },
              {
                itemId: "dessert_09",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "dessert_07",
                weight: 25
              },
              {
                itemId: "dessert_08",
                weight: 50
              },
              {
                itemId: "dessert_09",
                weight: 25
              }
            ]
          },
          {
            level: 8,
            outputs: [
              {
                itemId: "dessert_08",
                weight: 70
              },
              {
                itemId: "dessert_09",
                weight: 25
              },
              {
                itemId: "dessert_10",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "dessert_08",
                weight: 25
              },
              {
                itemId: "dessert_09",
                weight: 50
              },
              {
                itemId: "dessert_10",
                weight: 25
              }
            ]
          }
        ]
      },
      streakCooldown: {
        uses: 60,
        durationMs: 2e4
      },
      purchaseCoins: 200
    },
    {
      id: "gift_box",
      displayName: "\u793C\u7269\u76D2",
      chainId: "gift",
      unlockLevel: 8,
      energyCost: 1,
      outputs: [
        {
          itemId: "gift_01",
          weight: 70
        },
        {
          itemId: "gift_02",
          weight: 25
        },
        {
          itemId: "gift_03",
          weight: 5
        }
      ],
      upgrade: {
        maxLevel: 8,
        rechargeFactor: 0.8,
        boostEnergyMultiplier: 2,
        levels: [
          {
            level: 2,
            outputs: [
              {
                itemId: "gift_02",
                weight: 70
              },
              {
                itemId: "gift_03",
                weight: 25
              },
              {
                itemId: "gift_04",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "gift_02",
                weight: 25
              },
              {
                itemId: "gift_03",
                weight: 50
              },
              {
                itemId: "gift_04",
                weight: 25
              }
            ]
          },
          {
            level: 3,
            outputs: [
              {
                itemId: "gift_03",
                weight: 70
              },
              {
                itemId: "gift_04",
                weight: 25
              },
              {
                itemId: "gift_05",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "gift_03",
                weight: 25
              },
              {
                itemId: "gift_04",
                weight: 50
              },
              {
                itemId: "gift_05",
                weight: 25
              }
            ]
          },
          {
            level: 4,
            outputs: [
              {
                itemId: "gift_04",
                weight: 70
              },
              {
                itemId: "gift_05",
                weight: 25
              },
              {
                itemId: "gift_06",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "gift_04",
                weight: 25
              },
              {
                itemId: "gift_05",
                weight: 50
              },
              {
                itemId: "gift_06",
                weight: 25
              }
            ]
          },
          {
            level: 5,
            outputs: [
              {
                itemId: "gift_05",
                weight: 70
              },
              {
                itemId: "gift_06",
                weight: 25
              },
              {
                itemId: "gift_07",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "gift_05",
                weight: 25
              },
              {
                itemId: "gift_06",
                weight: 50
              },
              {
                itemId: "gift_07",
                weight: 25
              }
            ]
          },
          {
            level: 6,
            outputs: [
              {
                itemId: "gift_06",
                weight: 70
              },
              {
                itemId: "gift_07",
                weight: 25
              },
              {
                itemId: "gift_08",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "gift_06",
                weight: 25
              },
              {
                itemId: "gift_07",
                weight: 50
              },
              {
                itemId: "gift_08",
                weight: 25
              }
            ]
          },
          {
            level: 7,
            outputs: [
              {
                itemId: "gift_07",
                weight: 70
              },
              {
                itemId: "gift_08",
                weight: 25
              },
              {
                itemId: "gift_09",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "gift_07",
                weight: 25
              },
              {
                itemId: "gift_08",
                weight: 50
              },
              {
                itemId: "gift_09",
                weight: 25
              }
            ]
          },
          {
            level: 8,
            outputs: [
              {
                itemId: "gift_08",
                weight: 70
              },
              {
                itemId: "gift_09",
                weight: 25
              },
              {
                itemId: "gift_10",
                weight: 5
              }
            ],
            boostOutputs: [
              {
                itemId: "gift_08",
                weight: 25
              },
              {
                itemId: "gift_09",
                weight: 50
              },
              {
                itemId: "gift_10",
                weight: 25
              }
            ]
          }
        ]
      },
      streakCooldown: {
        uses: 60,
        durationMs: 2e4
      },
      purchaseCoins: 300
    },
    {
      id: "orange_tree",
      displayName: "\u9633\u5149\u6A58\u6811",
      chainId: "fruit",
      unlockLevel: 2,
      energyCost: 0,
      recharge: {
        capacity: 10,
        legacyCapacity: 3,
        intervalMs: 6e5
      },
      outputs: [
        {
          itemId: "fruit_01",
          weight: 70
        },
        {
          itemId: "fruit_02",
          weight: 25
        },
        {
          itemId: "fruit_03",
          weight: 5
        }
      ],
      upgrade: {
        maxLevel: 8,
        rechargeFactor: 0.8,
        boostEnergyMultiplier: 2,
        levels: [
          {
            level: 2,
            outputs: [
              {
                itemId: "fruit_02",
                weight: 70
              },
              {
                itemId: "fruit_03",
                weight: 25
              },
              {
                itemId: "fruit_04",
                weight: 5
              }
            ]
          },
          {
            level: 3,
            outputs: [
              {
                itemId: "fruit_03",
                weight: 70
              },
              {
                itemId: "fruit_04",
                weight: 25
              },
              {
                itemId: "fruit_05",
                weight: 5
              }
            ]
          },
          {
            level: 4,
            outputs: [
              {
                itemId: "fruit_04",
                weight: 70
              },
              {
                itemId: "fruit_05",
                weight: 25
              },
              {
                itemId: "fruit_06",
                weight: 5
              }
            ]
          },
          {
            level: 5,
            outputs: [
              {
                itemId: "fruit_05",
                weight: 70
              },
              {
                itemId: "fruit_06",
                weight: 25
              },
              {
                itemId: "fruit_07",
                weight: 5
              }
            ]
          },
          {
            level: 6,
            outputs: [
              {
                itemId: "fruit_06",
                weight: 70
              },
              {
                itemId: "fruit_07",
                weight: 25
              },
              {
                itemId: "fruit_08",
                weight: 5
              }
            ]
          },
          {
            level: 7,
            outputs: [
              {
                itemId: "fruit_07",
                weight: 70
              },
              {
                itemId: "fruit_08",
                weight: 25
              },
              {
                itemId: "fruit_09",
                weight: 5
              }
            ]
          },
          {
            level: 8,
            outputs: [
              {
                itemId: "fruit_08",
                weight: 70
              },
              {
                itemId: "fruit_09",
                weight: 25
              },
              {
                itemId: "fruit_10",
                weight: 5
              }
            ]
          }
        ]
      },
      purchaseCoins: 150
    }
  ];

  // assets/resources/config/orders.json
  var orders_default = [
    {
      id: "order_tutorial_coffee",
      minLevel: 1,
      maxLevel: 99,
      requirements: [
        {
          itemId: "coffee_02",
          count: 1
        }
      ],
      rewardCoins: 20,
      rewardXp: 10,
      rewardHearts: 1,
      tutorialOnly: true
    },
    {
      id: "order_coffee_bean_bundle",
      minLevel: 1,
      maxLevel: 99,
      requirements: [
        {
          itemId: "coffee_01",
          count: 2
        }
      ],
      rewardCoins: 12,
      rewardXp: 6,
      rewardHearts: 1
    },
    {
      id: "order_coffee_powder",
      minLevel: 1,
      maxLevel: 99,
      requirements: [
        {
          itemId: "coffee_02",
          count: 1
        }
      ],
      rewardCoins: 18,
      rewardXp: 8,
      rewardHearts: 1
    },
    {
      id: "order_coffee_cup",
      minLevel: 1,
      maxLevel: 99,
      requirements: [
        {
          itemId: "coffee_03",
          count: 1
        }
      ],
      rewardCoins: 30,
      rewardXp: 12,
      rewardHearts: 5
    },
    {
      id: "order_coffee_pair",
      minLevel: 1,
      maxLevel: 99,
      requirements: [
        {
          itemId: "coffee_02",
          count: 2
        }
      ],
      rewardCoins: 32,
      rewardXp: 14,
      rewardHearts: 5
    },
    {
      id: "order_coffee_02_cup",
      minLevel: 1,
      maxLevel: 99,
      requirements: [
        {
          itemId: "coffee_02",
          count: 1
        },
        {
          itemId: "coffee_03",
          count: 1
        }
      ],
      rewardCoins: 34,
      rewardXp: 15,
      rewardHearts: 4
    },
    {
      id: "order_coffee_03_pair",
      minLevel: 1,
      maxLevel: 99,
      requirements: [
        {
          itemId: "coffee_03",
          count: 2
        }
      ],
      rewardCoins: 42,
      rewardXp: 18,
      rewardHearts: 6
    },
    {
      id: "order_flower_seed",
      minLevel: 1,
      maxLevel: 99,
      requirements: [
        {
          itemId: "flower_01",
          count: 2
        }
      ],
      rewardCoins: 12,
      rewardXp: 6,
      rewardHearts: 1
    },
    {
      id: "order_flower_sprout",
      minLevel: 1,
      maxLevel: 99,
      requirements: [
        {
          itemId: "flower_02",
          count: 1
        }
      ],
      rewardCoins: 18,
      rewardXp: 8,
      rewardHearts: 1
    },
    {
      id: "order_flower_sprout_pair",
      minLevel: 3,
      maxLevel: 99,
      requirements: [
        {
          itemId: "flower_02",
          count: 2
        }
      ],
      rewardCoins: 30,
      rewardXp: 14,
      rewardHearts: 3
    },
    {
      id: "order_flower_coffee",
      minLevel: 3,
      maxLevel: 99,
      requirements: [
        {
          itemId: "flower_02",
          count: 1
        },
        {
          itemId: "coffee_03",
          count: 1
        }
      ],
      rewardCoins: 34,
      rewardXp: 16,
      rewardHearts: 3
    },
    {
      id: "order_morning_set",
      minLevel: 1,
      maxLevel: 99,
      requirements: [
        {
          itemId: "coffee_02",
          count: 1
        },
        {
          itemId: "flower_02",
          count: 1
        }
      ],
      rewardCoins: 28,
      rewardXp: 14,
      rewardHearts: 2
    },
    {
      id: "order_latte_date",
      minLevel: 5,
      maxLevel: 99,
      requirements: [
        {
          itemId: "coffee_05",
          count: 1
        }
      ],
      rewardCoins: 45,
      rewardXp: 22,
      rewardHearts: 2
    },
    {
      id: "order_tulip_pair",
      minLevel: 2,
      maxLevel: 99,
      requirements: [
        {
          itemId: "flower_03",
          count: 2
        }
      ],
      rewardCoins: 36,
      rewardXp: 18,
      rewardHearts: 1
    },
    {
      id: "order_rose_bouquet",
      minLevel: 3,
      maxLevel: 99,
      requirements: [
        {
          itemId: "flower_04",
          count: 1
        }
      ],
      rewardCoins: 40,
      rewardXp: 20,
      rewardHearts: 2
    },
    {
      id: "order_cake_tea",
      minLevel: 3,
      maxLevel: 99,
      requirements: [
        {
          itemId: "dessert_03",
          count: 1
        },
        {
          itemId: "coffee_03",
          count: 1
        }
      ],
      rewardCoins: 50,
      rewardXp: 26,
      rewardHearts: 2
    },
    {
      id: "order_dessert_muffin_pair",
      minLevel: 5,
      maxLevel: 99,
      requirements: [
        {
          itemId: "dessert_02",
          count: 2
        }
      ],
      rewardCoins: 32,
      rewardXp: 16,
      rewardHearts: 3
    },
    {
      id: "order_dessert_coffee",
      minLevel: 5,
      maxLevel: 99,
      requirements: [
        {
          itemId: "dessert_02",
          count: 1
        },
        {
          itemId: "coffee_02",
          count: 1
        }
      ],
      rewardCoins: 30,
      rewardXp: 15,
      rewardHearts: 3
    },
    {
      id: "order_strawberry_cake",
      minLevel: 3,
      maxLevel: 99,
      requirements: [
        {
          itemId: "dessert_04",
          count: 1
        }
      ],
      rewardCoins: 48,
      rewardXp: 24,
      rewardHearts: 2
    },
    {
      id: "order_double_cake",
      minLevel: 4,
      maxLevel: 99,
      requirements: [
        {
          itemId: "dessert_05",
          count: 1
        }
      ],
      rewardCoins: 60,
      rewardXp: 30,
      rewardHearts: 3
    },
    {
      id: "order_gift_small",
      minLevel: 5,
      maxLevel: 99,
      requirements: [
        {
          itemId: "gift_03",
          count: 1
        }
      ],
      rewardCoins: 55,
      rewardXp: 28,
      rewardHearts: 2
    },
    {
      id: "order_gift_note",
      minLevel: 8,
      maxLevel: 99,
      requirements: [
        {
          itemId: "gift_02",
          count: 1
        },
        {
          itemId: "flower_02",
          count: 1
        }
      ],
      rewardCoins: 36,
      rewardXp: 18,
      rewardHearts: 3
    },
    {
      id: "order_romantic_combo",
      minLevel: 4,
      maxLevel: 99,
      requirements: [
        {
          itemId: "coffee_05",
          count: 1
        },
        {
          itemId: "flower_05",
          count: 1
        }
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
        {
          itemId: "dessert_05",
          count: 1
        },
        {
          itemId: "gift_04",
          count: 1
        }
      ],
      rewardCoins: 95,
      rewardXp: 48,
      rewardHearts: 4
    },
    {
      id: "order_orange_cup",
      minLevel: 5,
      maxLevel: 18,
      requirements: [
        {
          itemId: "fruit_02",
          count: 1
        }
      ],
      rewardCoins: 34,
      rewardXp: 16,
      rewardHearts: 5
    },
    {
      id: "order_afternoon_together",
      minLevel: 6,
      maxLevel: 18,
      requirements: [
        {
          itemId: "coffee_03",
          count: 1
        },
        {
          itemId: "flower_03",
          count: 1
        }
      ],
      rewardCoins: 75,
      rewardXp: 32,
      rewardHearts: 10
    },
    {
      id: "order_sunshine_longterm",
      minLevel: 15,
      maxLevel: 18,
      requirements: [
        {
          itemId: "fruit_04",
          count: 1
        }
      ],
      rewardCoins: 100,
      rewardXp: 40,
      rewardHearts: 12,
      longTerm: true
    }
  ];

  // assets/resources/config/progression.json
  var progression_default = {
    levels: [
      {
        level: 1,
        xpRequired: 0,
        unlockChains: [
          "coffee"
        ]
      },
      {
        level: 2,
        xpRequired: 50,
        unlockChains: [
          "fruit"
        ]
      },
      {
        level: 3,
        xpRequired: 150,
        unlockChains: [
          "flower"
        ]
      },
      {
        level: 4,
        xpRequired: 300,
        unlockChains: []
      },
      {
        level: 5,
        xpRequired: 500,
        unlockChains: [
          "dessert"
        ]
      },
      {
        level: 6,
        xpRequired: 750,
        unlockChains: []
      },
      {
        level: 7,
        xpRequired: 1050,
        unlockChains: []
      },
      {
        level: 8,
        xpRequired: 1400,
        unlockChains: [
          "gift"
        ]
      },
      {
        level: 9,
        xpRequired: 1800,
        unlockChains: []
      },
      {
        level: 10,
        xpRequired: 2250,
        unlockChains: []
      },
      {
        level: 11,
        xpRequired: 2750,
        unlockChains: []
      },
      {
        level: 12,
        xpRequired: 3300,
        unlockChains: []
      },
      {
        level: 13,
        xpRequired: 3900,
        unlockChains: []
      },
      {
        level: 14,
        xpRequired: 4550,
        unlockChains: []
      },
      {
        level: 15,
        xpRequired: 5250,
        unlockChains: []
      },
      {
        level: 16,
        xpRequired: 6e3,
        unlockChains: []
      },
      {
        level: 17,
        xpRequired: 6800,
        unlockChains: []
      },
      {
        level: 18,
        xpRequired: 7650,
        unlockChains: []
      }
    ]
  };

  // assets/resources/config/memories.json
  var memories_default = [
    {
      id: "letters",
      title: "\u821F\u5C71\uFF0C\u6545\u4E8B\u7684\u5F00\u59CB",
      dateLabel: "2023 \u5E74 9 \u6708 8 \u65E5 \xB7 \u821F\u5C71",
      summary: "\u821F\u5C71\u7597\u4F11\u517B\uFF0C\u6D77\u8FB9\u3001\u6C99\u6EE9\u3001\u7BDD\u706B\uFF0C\u8FD8\u6709\u7B2C\u4E00\u6B21\u7275\u624B\u3002",
      diary: "2023 \u5E74 9 \u6708 8 \u65E5\uFF0C\u6211\u4EEC\u5728\u821F\u5C71\u7597\u4F11\u517B\u7684\u8054\u8C0A\u6D3B\u52A8\u4E2D\u8BA4\u8BC6\uFF0C\u5750\u5728\u4E86\u4E00\u8D77\u3002\u4E92\u9009\u7684\u65F6\u5019\uFF0C\u6211\u4EEC\u4E5F\u90FD\u9009\u62E9\u4E86\u5BF9\u65B9\u3002\n\n\u90A3\u8D9F\u884C\u7A0B\u91CC\u6709\u6D77\u8FB9\u3001\u6709\u6C99\u6EE9\uFF0C\u4E5F\u6709\u665A\u4E0A\u7684\u7BDD\u706B\u3002\u6211\u4EEC\u7684\u7B2C\u4E00\u6B21\u7275\u624B\uFF0C\u4E5F\u7559\u5728\u4E86\u821F\u5C71\u3002\u6BCF\u6B21\u60F3\u8D77\u6545\u4E8B\u7684\u5F00\u59CB\uFF0C\u90FD\u4F1A\u60F3\u8D77\u90A3\u6B21\u76F8\u9047\u3002",
      heartCost: 50,
      art: "story_01_letters",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.22
    },
    {
      id: "zhoushan_bonfire",
      title: "\u821F\u5C71\u7BDD\u706B\u4E0E\u7275\u624B",
      dateLabel: "2023 \u5E74 9 \u6708 \xB7 \u821F\u5C71",
      summary: "\u7BDD\u706B\u8FB9\u7684\u65F6\u5149\uFF0C\u4E0E\u6211\u4EEC\u7684\u7B2C\u4E00\u6B21\u7275\u624B\u3002",
      diary: "2023 \u5E74 9 \u6708\uFF0C\u821F\u5C71\u7684\u884C\u7A0B\u91CC\u6709\u665A\u4E0A\u7684\u7BDD\u706B\u3002\n\n\u6211\u4EEC\u7684\u7B2C\u4E00\u6B21\u7275\u624B\uFF0C\u4E5F\u7559\u5728\u4E86\u821F\u5C71\u3002",
      heartCost: 50,
      art: "story_31_zhoushan_bonfire",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.18
    },
    {
      id: "shenxianju",
      title: "\u521D\u8BC6\u540E\u7684\u7B2C\u4E00\u5EA7\u5C71",
      dateLabel: "2023 \u5E74\u56FD\u5E86 \xB7 \u795E\u4ED9\u5C45",
      summary: "\u8BA4\u8BC6\u8FD8\u4E0D\u5230\u4E00\u4E2A\u6708\uFF0C\u6211\u4EEC\u5C31\u4E00\u8D77\u53BB\u722C\u795E\u4ED9\u5C45\u3002",
      diary: "\u521A\u8BA4\u8BC6\u8FD8\u4E0D\u5230\u4E00\u4E2A\u6708\uFF0C\u5C31\u5230\u4E86\u56FD\u5E86\u30022023 \u5E74 10 \u6708\u521D\uFF0C\u6211\u4EEC\u4E00\u8D77\u53BB\u4E86\u795E\u4ED9\u5C45\u722C\u5C71\u3002\n\n\u4ECE\u821F\u5C71\u7684\u76F8\u9047\uFF0C\u5230\u7B2C\u4E00\u6B21\u4E00\u8D77\u8D70\u5C71\u8DEF\uFF0C\u5C5E\u4E8E\u4E24\u4E2A\u4EBA\u7684\u65C5\u9014\u6162\u6162\u5F00\u59CB\u4E86\u3002",
      heartCost: 40,
      art: "story_02_shenxianju",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.18
    },
    {
      id: "trampoline_park",
      title: "\u8E66\u5E8A\u516C\u56ED\u7684\u7EA6\u4F1A",
      dateLabel: "2023 \u5E74 10 \u6708 14 \u65E5",
      summary: "\u8FD9\u4E00\u5929\uFF0C\u6211\u4EEC\u4E00\u8D77\u53BB\u4E86\u8E66\u5E8A\u516C\u56ED\u3002",
      diary: "2023 \u5E74 10 \u6708 14 \u65E5\uFF0C\u6211\u4EEC\u4E00\u8D77\u53BB\u4E86\u8E66\u5E8A\u516C\u56ED\u3002\n\n\u9664\u4E86\u6D77\u8FB9\u548C\u5C71\u8DEF\uFF0C\u6211\u4EEC\u53C8\u591A\u4E86\u4E00\u4E2A\u5171\u540C\u53BB\u8FC7\u7684\u5730\u65B9\u3002\u60F3\u628A\u8FD9\u6B21\u7EA6\u4F1A\uFF0C\u4E5F\u8BB0\u8FDB\u6211\u4EEC\u7684\u76F8\u518C\u3002",
      heartCost: 50,
      art: "story_03_trampoline_park",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.1
    },
    {
      id: "first_trip",
      title: "100 \u5929\uFF0C100 \u5C01\u60C5\u4E66",
      dateLabel: "\u76F8\u8BC6 100 \u5929\u540E",
      summary: "\u8BA4\u8BC6 100 \u5929\u540E\uFF0C\u6211\u7528 100 \u5C01\u60C5\u4E66\u5411\u4F60\u8868\u767D\u3002",
      diary: "\u8BA4\u8BC6 100 \u5929\u540E\uFF0C\u6211\u7528 100 \u5C01\u60C5\u4E66\u5411\u4F60\u8868\u767D\u3002\n\n\u4ECE\u821F\u5C71\u8BA4\u8BC6\uFF0C\u5230\u4E00\u8D77\u722C\u5C71\u3001\u4E00\u8D77\u53BB\u8E66\u5E8A\u516C\u56ED\uFF0C\u60F3\u548C\u4F60\u8BF4\u7684\u8BDD\uFF0C\u4E00\u5C01\u4E00\u5C01\u5199\u6210\u4E86\u60C5\u4E66\u3002\u8FD9\u4EFD\u559C\u6B22\uFF0C\u60F3\u8BA4\u771F\u5730\u544A\u8BC9\u4F60\u3002",
      heartCost: 80,
      art: "story_04_first_trip",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.18
    },
    {
      id: "christmas_portrait",
      title: "\u6211\u4EEC\u7684\u7B2C\u4E00\u7EC4\u5723\u8BDE\u5199\u771F",
      dateLabel: "2023 \u5E74 12 \u6708 22 \u65E5",
      summary: "\u7B2C\u4E00\u6B21\u5723\u8BDE\u5199\u771F\uFF0C\u4E5F\u662F\u6211\u7B2C\u4E00\u6B21\u62CD\u5199\u771F\u3002",
      diary: "2023 \u5E74 12 \u6708 22 \u65E5\uFF0C\u6211\u4EEC\u62CD\u4E86\u7B2C\u4E00\u6B21\u5723\u8BDE\u5199\u771F\u3002\u90A3\u4E5F\u662F\u6211\u7B2C\u4E00\u6B21\u62CD\u5199\u771F\u3002\n\n\u7B2C\u4E00\u6B21\u7684\u7EAA\u5FF5\uFF0C\u56E0\u4E3A\u662F\u548C\u4F60\u4E00\u8D77\uFF0C\u6210\u4E86\u76F8\u8BC6\u540E\u7684\u7B2C\u4E00\u4E2A\u51AC\u5929\u91CC\uFF0C\u60F3\u597D\u597D\u7559\u4F4F\u7684\u4E00\u9875\u3002",
      heartCost: 60,
      art: "story_05_christmas_portrait",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.12
    },
    {
      id: "night_view",
      title: "\u6A2A\u5E97\u8DE8\u5E74\uFF0C\u518D\u4E00\u8D77\u56DE\u6E29\u5DDE",
      dateLabel: "2023 \u5E74\u672B\u20142024 \u5E74\u521D",
      summary: "\u79E6\u738B\u5BAB\u3001\u6E38\u4E50\u56ED\u3001\u6E29\u6CC9\uFF0C\u518D\u4E00\u8D77\u56DE\u6E29\u5DDE\u3002",
      diary: "2023 \u5E74 12 \u6708 30 \u65E5\uFF0C\u6211\u4EEC\u53BB\u4E86\u6A2A\u5E97\u8DE8\u5E74\u3002\u4E00\u8D77\u53BB\u4E86\u79E6\u738B\u5BAB\u3001\u6E38\u4E50\u56ED\uFF0C\u4E5F\u6CE1\u4E86\u6E29\u6CC9\u3002\n\n2024 \u5E74 1 \u6708\uFF0C\u6211\u5E26\u4F60\u56DE\u4E86\u6E29\u5DDE\u3002\u76F8\u8BC6\u540E\u7684\u7B2C\u4E00\u4E2A\u8DE8\u5E74\uFF0C\u5C31\u8FD9\u6837\u8FDE\u7740\u65C5\u884C\u548C\u56DE\u5BB6\u7684\u56DE\u5FC6\u3002",
      heartCost: 100,
      art: "story_06_night_view",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.18
    },
    {
      id: "qinwang_palace",
      title: "\u6A2A\u5E97\u7684\u79E6\u738B\u5BAB",
      dateLabel: "2023 \u5E74\u672B \xB7 \u6A2A\u5E97",
      summary: "\u8DE8\u5E74\u65C5\u7A0B\u4E2D\uFF0C\u6211\u4EEC\u4E00\u8D77\u53BB\u4E86\u79E6\u738B\u5BAB\u3002",
      diary: "2023 \u5E74\u672B\uFF0C\u6211\u4EEC\u4E00\u8D77\u53BB\u6A2A\u5E97\u8DE8\u5E74\uFF0C\u4E5F\u53BB\u4E86\u79E6\u738B\u5BAB\u3002\n\n\u8FD9\u6BB5\u65C5\u7A0B\uFF0C\u6210\u4E3A\u6211\u4EEC\u4E00\u8D77\u8FCE\u63A5\u65B0\u5E74\u7684\u56DE\u5FC6\u3002",
      heartCost: 50,
      art: "story_32_qinwang_palace",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.18
    },
    {
      id: "hengdian_hot_spring",
      title: "\u6A2A\u5E97\u7684\u6E29\u6CC9\u65F6\u5149",
      dateLabel: "2023 \u5E74\u672B \xB7 \u6A2A\u5E97",
      summary: "\u6A2A\u5E97\u8DE8\u5E74\u65F6\uFF0C\u6211\u4EEC\u4E5F\u4E00\u8D77\u6CE1\u4E86\u6E29\u6CC9\u3002",
      diary: "2023 \u5E74\u672B\u7684\u6A2A\u5E97\u8DE8\u5E74\u65C5\u7A0B\u91CC\uFF0C\u6211\u4EEC\u4E00\u8D77\u6CE1\u4E86\u6E29\u6CC9\u3002\n\n\u8FD9\u4E5F\u662F\u90A3\u6B21\u65C5\u884C\u91CC\u60F3\u7559\u4F4F\u7684\u7247\u6BB5\u3002",
      heartCost: 50,
      art: "story_33_hengdian_hot_spring",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.18
    },
    {
      id: "promise",
      title: "\u5C71\u6C34\u4E4B\u95F4\uFF0C\u6709\u4F60",
      dateLabel: "\u9EC4\u5C71 \xB7 \u5343\u5C9B\u6E56 \xB7 \u671B\u5BB8\u9601",
      summary: "\u722C\u8FC7\u9EC4\u5C71\uFF0C\u518D\u901B\u5343\u5C9B\u6E56\uFF0C\u4E5F\u4E00\u8D77\u8D70\u5411\u676D\u5DDE\u671B\u5BB8\u9601\u3002",
      diary: "\u90A3\u4E00\u5E74\uFF0C\u6211\u4EEC\u4E00\u8D77\u722C\u4E86\u9EC4\u5C71\uFF0C\u722C\u5B8C\u4E4B\u540E\u53C8\u53BB\u4E86\u5343\u5C9B\u6E56\u901B\u3002\u540E\u6765\uFF0C\u8FD8\u4E00\u8D77\u53BB\u676D\u5DDE\u671B\u5BB8\u9601\u722C\u5C71\u3002\n\n\u4E00\u6BB5\u5C71\u8DEF\uFF0C\u4E00\u7247\u6E56\u666F\uFF0C\u90FD\u662F\u4E00\u8D77\u8D70\u8FC7\u7684\u5730\u65B9\u3002\u56E0\u4E3A\u8EAB\u8FB9\u662F\u4F60\uFF0C\u8FD9\u4E9B\u5730\u540D\u4E5F\u6210\u4E86\u6211\u4EEC\u6545\u4E8B\u7684\u4E00\u90E8\u5206\u3002",
      heartCost: 120,
      art: "story_07_promise",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.18
    },
    {
      id: "huangshan_trip",
      title: "\u4E00\u8D77\u722C\u9EC4\u5C71",
      dateLabel: "2024 \u5E74\u521D",
      summary: "\u6211\u4EEC\u4E00\u8D77\u722C\u8FC7\u9EC4\u5C71\u3002",
      diary: "2024 \u5E74\u521D\uFF0C\u6211\u4EEC\u4E00\u8D77\u722C\u4E86\u9EC4\u5C71\u3002\n\n\u8FD9\u5EA7\u5C71\uFF0C\u4E5F\u6210\u4E86\u6211\u4EEC\u5171\u540C\u53BB\u8FC7\u7684\u5730\u65B9\u3002",
      heartCost: 60,
      art: "story_34_huangshan_trip",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.18
    },
    {
      id: "qiandao_lake",
      title: "\u5343\u5C9B\u6E56\u7684\u56DE\u5FC6",
      dateLabel: "2024 \u5E74\u521D",
      summary: "\u722C\u5B8C\u9EC4\u5C71\uFF0C\u6211\u4EEC\u53C8\u53BB\u4E86\u5343\u5C9B\u6E56\u901B\u3002",
      diary: "2024 \u5E74\u521D\uFF0C\u722C\u5B8C\u9EC4\u5C71\u4E4B\u540E\uFF0C\u6211\u4EEC\u53C8\u53BB\u4E86\u5343\u5C9B\u6E56\u901B\u3002\n\n\u4E00\u8D77\u53BB\u8FC7\u7684\u98CE\u666F\uFF0C\u53C8\u591A\u4E86\u4E00\u5904\u3002",
      heartCost: 60,
      art: "story_35_qiandao_lake",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.18
    },
    {
      id: "wangchen_pavilion",
      title: "\u4E00\u8D77\u53BB\u671B\u5BB8\u9601",
      dateLabel: "2024 \u5E74\u521D \xB7 \u676D\u5DDE",
      summary: "\u540E\u6765\uFF0C\u6211\u4EEC\u4E00\u8D77\u53BB\u676D\u5DDE\u671B\u5BB8\u9601\u722C\u5C71\u3002",
      diary: "2024 \u5E74\u521D\uFF0C\u6211\u4EEC\u4E00\u8D77\u53BB\u676D\u5DDE\u671B\u5BB8\u9601\u722C\u5C71\u3002\n\n\u60F3\u628A\u8FD9\u4E2A\u4E00\u8D77\u5230\u8FC7\u7684\u5730\u65B9\uFF0C\u4E5F\u8BB0\u8FDB\u76F8\u518C\u3002",
      heartCost: 60,
      art: "story_36_wangchen_pavilion",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.18
    },
    {
      id: "wedding",
      title: "\u5E26\u4F60\u770B\u770B\uFF0C\u6211\u7684\u5927\u5B66",
      dateLabel: "2024 \u5E74 3 \u6708 30 \u65E5 \xB7 \u5609\u5174",
      summary: "\u5E26\u4F60\u53BB\u5609\u5174\uFF0C\u770B\u770B\u6211\u8BFB\u8FC7\u4E66\u7684\u5730\u65B9\u3002",
      diary: "2024 \u5E74 3 \u6708 30 \u65E5\uFF0C\u6211\u5E26\u4F60\u53BB\u4E86\u5609\u5174\uFF0C\u770B\u770B\u6211\u7684\u5927\u5B66\u2014\u2014\u540C\u6D4E\u5927\u5B66\u6D59\u6C5F\u5B66\u9662\u3002\n\n\u66FE\u7ECF\u5C5E\u4E8E\u4E00\u4E2A\u4EBA\u7684\u6821\u56ED\uFF0C\u4E5F\u6709\u4E86\u548C\u4F60\u4E00\u8D77\u5230\u8FC7\u7684\u56DE\u5FC6\u3002\u60F3\u5E26\u4F60\u770B\u770B\uFF0C\u6211\u66FE\u7ECF\u751F\u6D3B\u8FC7\u7684\u4E00\u90E8\u5206\u3002",
      heartCost: 150,
      art: "story_08_wedding",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.18
    },
    {
      id: "jeju_first",
      title: "\u7B2C\u4E00\u6B21\u4E00\u8D77\u53BB\u97E9\u56FD",
      dateLabel: "2024 \u5E74 5 \u6708 1 \u65E5 \xB7 \u6D4E\u5DDE\u5C9B",
      summary: "\u4ECE\u4E0A\u6D77\u51FA\u53D1\uFF0C\u5750\u98DE\u673A\u53BB\u97E9\u56FD\u6D4E\u5DDE\u5C9B\u3002",
      diary: "2024 \u5E74 5 \u6708 1 \u65E5\uFF0C\u6211\u4EEC\u5148\u53BB\u4E0A\u6D77\uFF0C\u518D\u5750\u98DE\u673A\u98DE\u5F80\u97E9\u56FD\u6D4E\u5DDE\u5C9B\u3002\u8FD9\u662F\u6211\u4EEC\u7B2C\u4E00\u6B21\u4E00\u8D77\u53BB\u6D4E\u5DDE\u5C9B\u3002\n\n\u7B2C\u4E00\u6B21\u4E00\u8D77\u53BB\u97E9\u56FD\u7684\u65C5\u7A0B\uFF0C\u60F3\u597D\u597D\u7559\u5728\u8FD9\u672C\u76F8\u518C\u91CC\u3002",
      heartCost: 60,
      art: "story_09_jeju_first",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.18
    },
    {
      id: "shanghai_departure",
      title: "\u4ECE\u4E0A\u6D77\u51FA\u53D1",
      dateLabel: "2024 \u5E74 5 \u6708 1 \u65E5",
      summary: "\u6211\u4EEC\u4ECE\u4E0A\u6D77\u4E58\u98DE\u673A\uFF0C\u98DE\u5F80\u97E9\u56FD\u6D4E\u5DDE\u5C9B\u3002",
      diary: "2024 \u5E74 5 \u6708 1 \u65E5\uFF0C\u6211\u4EEC\u5148\u53BB\u4E0A\u6D77\uFF0C\u518D\u5750\u98DE\u673A\u98DE\u5F80\u97E9\u56FD\u6D4E\u5DDE\u5C9B\u3002\n\n\u7B2C\u4E00\u6B21\u4E00\u8D77\u53BB\u97E9\u56FD\u7684\u65C5\u7A0B\uFF0C\u4ECE\u8FD9\u91CC\u51FA\u53D1\u3002",
      heartCost: 50,
      art: "story_37_shanghai_departure",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.18
    },
    {
      id: "first_home",
      title: "\u7B2C\u4E00\u6B21\u966A\u4F60\u8FC75\xB720\u751F\u65E5",
      dateLabel: "2024 \u5E74 5 \u6708 20 \u65E5",
      summary: "\u8FD9\u4E00\u5E74\u76845\xB720\uFF0C\u6211\u7B2C\u4E00\u6B21\u966A\u4F60\u8FC7\u751F\u65E5\u3002",
      diary: "2024 \u5E74 5 \u6708 20 \u65E5\uFF0C\u6211\u7B2C\u4E00\u6B21\u966A\u4F60\u8FC7\u751F\u65E5\u3002\n\n5\xB720 \u4E0D\u53EA\u662F\u4E00\u4E2A\u5199\u8D77\u6765\u7279\u522B\u7684\u65E5\u671F\uFF0C\u4E5F\u6210\u4E86\u6211\u4EEC\u4E00\u8D77\u8FC7\u751F\u65E5\u7684\u7B2C\u4E00\u4EFD\u7EAA\u5FF5\u3002\u4EE5\u540E\uFF0C\u8FD8\u60F3\u966A\u4F60\u8FC7\u8BB8\u591A\u4E2A\u751F\u65E5\u3002",
      heartCost: 180,
      art: "story_10_first_home",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.23
    },
    {
      id: "barbie_summer",
      title: "\u82AD\u6BD4\u5199\u771F\u4E0E\u5357\u6E56\u6E38\u8239",
      dateLabel: "2024 \u5E74 6 \u6708\u20147 \u6708",
      summary: "\u966A\u4F60\u62CD\u82AD\u6BD4\u5199\u771F\uFF0C\u518D\u5E26\u4F60\u5750\u5357\u6E56\u6E38\u8239\u3002",
      diary: "2024 \u5E74 6 \u6708 15 \u65E5\uFF0C\u966A\u4F60\u53BB\u62CD\u4E86\u82AD\u6BD4\u5199\u771F\u3002\n\n7 \u6708 7 \u65E5\uFF0C\u6211\u4EEC\u53C8\u53BB\u4E86\u5609\u5174\u5357\u6E56\uFF0C\u6211\u5E26\u4F60\u5750\u4E86\u5357\u6E56\u6E38\u8239\u3002\u5199\u771F\u548C\u6E38\u8239\uFF0C\u90FD\u662F\u90A3\u6BB5\u65E5\u5B50\u91CC\u60F3\u548C\u4F60\u4E00\u8D77\u73CD\u85CF\u7684\u5C0F\u4E8B\u3002",
      heartCost: 60,
      art: "story_11_barbie_summer",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.12
    },
    {
      id: "nanhu_boat",
      title: "\u5357\u6E56\u6E38\u8239",
      dateLabel: "2024 \u5E74 7 \u6708 7 \u65E5 \xB7 \u5609\u5174",
      summary: "\u5728\u5609\u5174\u5357\u6E56\uFF0C\u6211\u5E26\u4F60\u4E00\u8D77\u5750\u6E38\u8239\u3002",
      diary: "2024 \u5E74 7 \u6708 7 \u65E5\uFF0C\u6211\u4EEC\u53BB\u4E86\u5609\u5174\u5357\u6E56\u3002\n\n\u6211\u5E26\u4F60\u5750\u4E86\u5357\u6E56\u6E38\u8239\uFF0C\u60F3\u628A\u8FD9\u4E00\u6BB5\u4E5F\u5355\u72EC\u73CD\u85CF\u3002",
      heartCost: 60,
      art: "story_38_nanhu_boat",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.18
    },
    {
      id: "linan_rafting",
      title: "\u5C0F\u7EC4\u51FA\u6E38\uFF0C\u4E00\u8D77\u6F02\u6D41",
      dateLabel: "2024 \u5E74 7 \u6708 20 \u65E5 \xB7 \u4E34\u5B89",
      summary: "\u548C\u5C0F\u7EC4\u4E00\u8D77\uFF0C\u5728\u4E34\u5B89\u7559\u4E0B\u6F02\u6D41\u7684\u56DE\u5FC6\u3002",
      diary: "2024 \u5E74 7 \u6708 20 \u65E5\uFF0C\u6211\u4EEC\u548C\u5C0F\u7EC4\u4E00\u8D77\u53BB\u4E86\u4E34\u5B89\u6F02\u6D41\u3002\n\n\u9664\u4E86\u4E24\u4E2A\u4EBA\u7684\u65C5\u884C\uFF0C\u4E5F\u6709\u548C\u5927\u5BB6\u4E00\u8D77\u51FA\u6E38\u7684\u65E5\u5B50\u3002\u8FD9\u6B21\u6F02\u6D41\uFF0C\u4E5F\u60F3\u8BB0\u8FDB\u5C5E\u4E8E\u6211\u4EEC\u7684\u6545\u4E8B\u3002",
      heartCost: 60,
      art: "story_12_linan_rafting",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.18
    },
    {
      id: "rainy_day",
      title: "\u5357\u5C71\u5854\uFF0C\u5411\u4F60\u6C42\u5A5A",
      dateLabel: "2024 \u5E74 10 \u6708 1\u20143 \u65E5 \xB7 \u9996\u5C14",
      summary: "\u56FD\u5E86\u53BB\u9996\u5C14\uFF0C\u4F53\u9A8C\u5C04\u51FB\uFF0C\u4E5F\u5728\u5357\u5C71\u5854\u5411\u4F60\u6C42\u5A5A\u3002",
      diary: "2024 \u5E74 10 \u6708 1 \u65E5\uFF0C\u6211\u4EEC\u53BB\u4E86\u97E9\u56FD\u9996\u5C14\u65C5\u884C\uFF0C\u8FD8\u5728\u90A3\u91CC\u4F53\u9A8C\u4E86\u5C04\u51FB\u3002\n\n10 \u6708 3 \u65E5\uFF0C\u6211\u5728\u9996\u5C14\u5357\u5C71\u5854\u5411\u4F60\u6C42\u5A5A\u3002\u8FD9\u4E00\u7AD9\uFF0C\u4E0D\u53EA\u662F\u4E00\u6B21\u65C5\u884C\uFF0C\u4E5F\u6210\u4E3A\u6211\u4EEC\u8D70\u5411\u5A5A\u59FB\u7684\u4E00\u6BB5\u91CD\u8981\u56DE\u5FC6\u3002",
      heartCost: 210,
      art: "story_13_rainy_day",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.26
    },
    {
      id: "winter_portraits",
      title: "\u8FD9\u4E00\u5E74\u7684\u51AC\u65E5\u7EAA\u5FF5",
      dateLabel: "2024 \u5E74\u672B \xB7 \u5199\u771F\u4E0E\u5723\u8BDE",
      summary: "\u8FD0\u52A8\u4F1A\u3001\u7EA2\u5E95\u5199\u771F\u3001\u96EA\u4E61\u4E3B\u9898\uFF0C\u8FD8\u6709\u6559\u4F1A\u5723\u8BDE\u3002",
      diary: "11 \u6708 16 \u65E5\uFF0C\u4F60\u4EEC\u516C\u53F8\u7EC4\u7EC7\u7684\u56E2\u5EFA\u8FD0\u52A8\u4F1A\uFF0C\u4E5F\u6210\u4E86\u8FD9\u4E00\u5E74\u91CC\u60F3\u8BB0\u4F4F\u7684\u7247\u6BB5\u3002\n\n12 \u6708 9 \u65E5\uFF0C\u6211\u4EEC\u62CD\u4E86\u4E2D\u5F0F\u5199\u771F\u3002\u6211\u7A7F\u9ED1\u8272\u7684\u4E2D\u5F0F\u8863\u670D\uFF0C\u4F60\u7A7F\u65D7\u888D\uFF0C\u80CC\u666F\u662F\u7EA2\u8272\u300212 \u6708 23 \u65E5\uFF0C\u53C8\u62CD\u4E86\u5929\u771F\u84DD\u7684\u96EA\u4E61\u4E3B\u9898\u5199\u771F\u3002\n\n\u6211\u4EEC\u4E5F\u4E00\u8D77\u53C2\u52A0\u4E86\u6559\u4F1A\u7684\u5723\u8BDE\u8282\u6D3B\u52A8\u3002\u4E00\u5E74\u5FEB\u8FC7\u53BB\u4E86\uFF0C\u60F3\u7559\u4E0B\u7684\u7EAA\u5FF5\u5374\u53C8\u591A\u4E86\u8BB8\u591A\u3002",
      heartCost: 80,
      art: "story_14_winter_portraits",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.07
    },
    {
      id: "new_year_balloons",
      title: "\u4E00\u8D77\u5012\u6570\uFF0C\u65B0\u5E74\u5FEB\u4E50",
      dateLabel: "2024 \u5E74 12 \u6708 31 \u65E5 \xB7 \u4E07\u8FBE\u5E7F\u573A",
      summary: "\u4E00\u8D77\u5012\u8BA1\u65F6\uFF0C\u8FD8\u6709\u5199\u7740\u201C\u65B0\u5E74\u5FEB\u4E50\u201D\u7684\u6C14\u7403\u3002",
      diary: "12 \u6708 31 \u65E5\uFF0C\u6211\u4EEC\u5728\u4E07\u8FBE\u5E7F\u573A\u8DE8\u5E74\uFF0C\u4E00\u8D77\u5012\u8BA1\u65F6\u3002\u8FD8\u4E70\u4E86\u6C14\u7403\uFF0C\u4E0A\u9762\u5199\u7740\u201C\u65B0\u5E74\u5FEB\u4E50\u201D\u3002\n\n\u53C8\u4E00\u8D77\u8DE8\u8FC7\u4E86\u4E00\u4E2A\u5E74\u4EFD\u3002\u90A3\u53E5\u65B0\u5E74\u5FEB\u4E50\uFF0C\u4E5F\u60F3\u4E00\u76F4\u548C\u4F60\u8BF4\u4E0B\u53BB\u3002",
      heartCost: 80,
      art: "story_15_new_year_balloons",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.18
    },
    {
      id: "garden",
      title: "\u6211\u4EEC\u8BA2\u5A5A\u4E86",
      dateLabel: "2025 \u5E74 1 \u6708 18 \u65E5",
      summary: "\u8FD9\u4E00\u5929\uFF0C\u6211\u4EEC\u8BA2\u5A5A\u4E86\uFF0C\u4E00\u8D77\u8D70\u5411\u5171\u540C\u7684\u5BB6\u3002",
      diary: "2025 \u5E74 1 \u6708 18 \u65E5\uFF0C\u6211\u4EEC\u8BA2\u5A5A\u4E86\u3002\n\n\u821F\u5C71\u7684\u521D\u89C1\u3001\u7B2C\u4E00\u6B21\u7275\u624B\u3001100 \u5C01\u60C5\u4E66\u548C\u4E00\u8D77\u8D70\u8FC7\u7684\u65C5\u9014\uFF0C\u90FD\u6210\u4E86\u8FD9\u6BB5\u5173\u7CFB\u7684\u4E00\u90E8\u5206\u3002\u5C5E\u4E8E\u6211\u4EEC\u7684\u6545\u4E8B\uFF0C\u53C8\u5F80\u524D\u8D70\u4E86\u4E00\u6B65\u3002",
      heartCost: 270,
      art: "story_16_garden",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.15
    },
    {
      id: "birthday",
      title: "\u5BA4\u5185\u6ED1\u96EA\u4E0E\u5BB6\u4EBA\u5408\u5F71",
      dateLabel: "2025 \u5E74 2 \u6708",
      summary: "\u4E00\u8D77\u53BB\u5BA4\u5185\u6ED1\u96EA\uFF0C\u4E5F\u7559\u4E0B\u56DB\u4EBA\u5199\u771F\u7684\u7EAA\u5FF5\u3002",
      diary: "2025 \u5E74 2 \u6708 1 \u65E5\uFF0C\u6211\u4EEC\u53BB\u4E86\u5BA4\u5185\u6ED1\u96EA\u573A\u6ED1\u96EA\u3002\n\n2 \u6708 16 \u65E5\uFF0C\u53C8\u548C\u5BB6\u4EBA\u62CD\u4E86\u56DB\u4EBA\u7684\u5199\u771F\u3002\u96EA\u9053\u4E0A\u7684\u65F6\u5149\uFF0C\u548C\u5BB6\u4EBA\u4E00\u8D77\u7559\u4E0B\u7684\u5408\u5F71\uFF0C\u90FD\u662F\u8FD9\u6BB5\u65E5\u5B50\u91CC\u7684\u7EAA\u5FF5\u3002",
      heartCost: 240,
      art: "story_17_birthday",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.07
    },
    {
      id: "quanzhou_birthday",
      title: "\u6CC9\u5DDE\u65C5\u884C\u4E0E\u4F60\u768427\u5C81",
      dateLabel: "2025 \u5E74\u4E94\u4E00 \xB7 5 \u6708 20 \u65E5",
      summary: "\u4E00\u8D77\u53BB\u798F\u5EFA\u6CC9\u5DDE\uFF0C\u7B2C\u4E8C\u6B21\u966A\u4F60\u8FC7\u751F\u65E5\u3002",
      diary: "2025 \u5E74\u4E94\u4E00\u52B3\u52A8\u8282\uFF0C\u6211\u4EEC\u53BB\u4E86\u798F\u5EFA\u6CC9\u5DDE\u65C5\u884C\u3002\n\n5 \u6708 20 \u65E5\uFF0C\u6211\u7B2C\u4E8C\u6B21\u966A\u4F60\u8FC7\u751F\u65E5\u3002\u8FD9\u4E00\u5E74\uFF0C\u4F60 27 \u5C81\u4E86\u3002\u60F3\u7EE7\u7EED\u966A\u4F60\u4E00\u8D77\u65C5\u884C\uFF0C\u4E5F\u4E00\u8D77\u8BB0\u4E0B\u6BCF\u4E00\u5E74\u7684\u751F\u65E5\u3002",
      heartCost: 80,
      art: "story_18_quanzhou_birthday",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.18
    },
    {
      id: "rafting_again",
      title: "\u518D\u4E00\u6B21\uFF0C\u548C\u5C0F\u7EC4\u53BB\u6F02\u6D41",
      dateLabel: "2025 \u5E74 7 \u6708 5 \u65E5",
      summary: "\u53C8\u4E00\u6B21\u53C2\u52A0\u5C0F\u7EC4\u51FA\u6E38\uFF0C\u7EE7\u7EED\u6536\u96C6\u6F02\u6D41\u7684\u56DE\u5FC6\u3002",
      diary: "2025 \u5E74 7 \u6708 5 \u65E5\uFF0C\u6211\u4EEC\u53C8\u4E00\u8D77\u53C2\u52A0\u4E86\u5C0F\u7EC4\u51FA\u6E38\uFF0C\u53BB\u4F53\u9A8C\u6F02\u6D41\u3002\n\n\u4ECE\u4E0A\u4E00\u6B21\u7684\u4E34\u5B89\u6F02\u6D41\uFF0C\u5230\u8FD9\u4E00\u6B21\u7684\u51FA\u6E38\uFF0C\u548C\u4F60\u4E00\u8D77\u7559\u4E0B\u7684\u56DE\u5FC6\uFF0C\u53C8\u591A\u4E86\u4E00\u6BB5\u3002",
      heartCost: 80,
      art: "story_19_rafting_again",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.16
    },
    {
      id: "first_car",
      title: "\u751F\u65E5\uFF0C\u7B2C\u4E00\u8F86\u7231\u8F66",
      dateLabel: "2025 \u5E74 8 \u6708 27 \u65E5",
      summary: "\u6211\u7684\u751F\u65E5\uFF0C\u4E5F\u662F\u63D0\u5230\u7B2C\u4E00\u8F86\u957F\u5B89UNI-V\u7684\u65E5\u5B50\u3002",
      diary: "2025 \u5E74 8 \u6708 27 \u65E5\uFF0C\u662F\u6211\u7684\u751F\u65E5\uFF0C\u4E5F\u662F\u6211\u4EEC\u63D0\u5230\u7B2C\u4E00\u8F86\u7231\u8F66\u7684\u65E5\u5B50\u3002\u5B83\u662F\u4E00\u8F86\u957F\u5B89 UNI-V\u3002\n\n\u751F\u65E5\u548C\u7B2C\u4E00\u8F86\u8F66\uFF0C\u7559\u5728\u4E86\u540C\u4E00\u5929\u3002\u4EE5\u540E\u4E00\u8D77\u51FA\u53D1\u7684\u8DEF\uFF0C\u4E5F\u6709\u4E86\u65B0\u7684\u7EAA\u5FF5\u3002",
      heartCost: 90,
      art: "story_20_first_car",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.23
    },
    {
      id: "chengdu_jiuzhaigou",
      title: "\u5927\u718A\u732B\u4E0E\u4E5D\u5BE8\u6C9F",
      dateLabel: "2025 \u5E74\u56FD\u5E86",
      summary: "\u53BB\u6210\u90FD\u770B\u5927\u718A\u732B\uFF0C\u4E5F\u4E00\u8D77\u53BB\u4E86\u4E5D\u5BE8\u6C9F\u3002",
      diary: "2025 \u5E74\u56FD\u5E86\uFF0C\u6211\u4EEC\u53BB\u4E86\u6210\u90FD\u73A9\uFF0C\u770B\u4E86\u5927\u718A\u732B\uFF0C\u4E5F\u4E00\u8D77\u53BB\u4E86\u4E5D\u5BE8\u6C9F\u3002\n\n\u4E00\u8D77\u53BB\u8FC7\u7684\u57CE\u5E02\u548C\u98CE\u666F\uFF0C\u53C8\u591A\u4E86\u4E24\u4E2A\u60F3\u8981\u8BB0\u4F4F\u7684\u540D\u5B57\u3002\u548C\u4F60\u540C\u884C\u7684\u65C5\u7A0B\uFF0C\u8FD8\u5728\u7EE7\u7EED\u3002",
      heartCost: 90,
      art: "story_21_chengdu_jiuzhaigou",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.22
    },
    {
      id: "suzhou_portrait",
      title: "\u82CF\u5DDE\uFF0C\u6211\u4EEC\u7684\u53E4\u88C5\u5199\u771F",
      dateLabel: "2025 \u5E74 12 \u6708 14 \u65E5",
      summary: "\u6211\u62FF\u7740\u5251\uFF0C\u4F60\u662F\u5510\u98CE\u9020\u578B\uFF0C\u4E00\u8D77\u7559\u4E0B\u53E4\u88C5\u5199\u771F\u3002",
      diary: "2025 \u5E74 12 \u6708 14 \u65E5\uFF0C\u6211\u4EEC\u53BB\u4E86\u82CF\u5DDE\u62CD\u53E4\u88C5\u5199\u771F\u3002\u6211\u62FF\u7740\u5251\uFF0C\u4F60\u662F\u5510\u98CE\u7684\u9020\u578B\u3002\n\n\u6362\u4E00\u79CD\u9020\u578B\uFF0C\u7559\u4E0B\u7684\u8FD8\u662F\u6211\u4EEC\u4E24\u4E2A\u4EBA\u7684\u7EAA\u5FF5\u3002\u8FD9\u6B21\u53E4\u88C5\u5199\u771F\uFF0C\u4E5F\u60F3\u597D\u597D\u73CD\u85CF\u3002",
      heartCost: 90,
      art: "story_22_suzhou_portrait",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.12
    },
    {
      id: "snow_and_family",
      title: "\u5C71\u4E0A\u7684\u96EA\uFF0C\u540C\u884C\u7684\u5BB6\u4EBA",
      dateLabel: "2026 \u5E74 2 \u6708 \xB7 \u4E34\u5B89\u4E0E\u6A2A\u5E97",
      summary: "\u53BB\u4E34\u5B89\u6237\u5916\u6ED1\u96EA\uFF0C\u518D\u5E26\u7236\u6BCD\u4E00\u8D77\u53BB\u6A2A\u5E97\u3002",
      diary: "2026 \u5E74 2 \u6708 7 \u65E5\uFF0C\u6211\u4EEC\u53BB\u4E86\u4E34\u5B89\u5C71\u4E0A\u7684\u5BA4\u5916\u6ED1\u96EA\u573A\u6ED1\u96EA\u3002\n\n2 \u6708 22 \u65E5\uFF0C\u53C8\u5E26\u7236\u6BCD\u4E00\u8D77\u53BB\u4E86\u6A2A\u5E97\u3002\u4ECE\u6211\u4EEC\u4E24\u4E2A\u4EBA\u7684\u8DE8\u5E74\u65C5\u884C\uFF0C\u5230\u8FD9\u6B21\u548C\u7236\u6BCD\u540C\u884C\uFF0C\u6A2A\u5E97\u53C8\u591A\u4E86\u4E00\u4EFD\u4E0D\u540C\u7684\u56DE\u5FC6\u3002",
      heartCost: 90,
      art: "story_23_snow_and_family",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.2
    },
    {
      id: "hengdian_family",
      title: "\u5E26\u7236\u6BCD\u4E00\u8D77\u53BB\u6A2A\u5E97",
      dateLabel: "2026 \u5E74 2 \u6708 22 \u65E5 \xB7 \u6A2A\u5E97",
      summary: "\u8FD9\u4E00\u6B21\uFF0C\u6211\u4EEC\u5E26\u7236\u6BCD\u4E00\u8D77\u53BB\u4E86\u6A2A\u5E97\u3002",
      diary: "2026 \u5E74 2 \u6708 22 \u65E5\uFF0C\u6211\u4EEC\u5E26\u7236\u6BCD\u4E00\u8D77\u53BB\u4E86\u6A2A\u5E97\u3002\n\n\u4ECE\u4E24\u4E2A\u4EBA\u7684\u8DE8\u5E74\u65C5\u884C\uFF0C\u5230\u548C\u7236\u6BCD\u540C\u884C\uFF0C\u6A2A\u5E97\u53C8\u591A\u4E86\u4E00\u4EFD\u56DE\u5FC6\u3002",
      heartCost: 80,
      art: "story_39_hengdian_family",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.18
    },
    {
      id: "wedding_preparations",
      title: "\u4E3A\u6211\u4EEC\u7684\u5A5A\u793C\u505A\u51C6\u5907",
      dateLabel: "2026 \u5E74\u4E94\u4E00",
      summary: "\u6311\u9009\u8349\u576A\u573A\u5730\u3001\u8BD5\u5A5A\u7EB1\uFF0C\u4E5F\u53C2\u52A0\u670B\u53CB\u7684\u5A5A\u793C\u3002",
      diary: "2026 \u5E74\u4E94\u4E00\uFF0C\u6211\u4EEC\u5F00\u59CB\u6311\u9009\u8349\u576A\u5A5A\u793C\u7684\u573A\u5730\uFF0C\u4E5F\u53BB\u8BD5\u4E86\u5A5A\u7EB1\u3002\u8FD8\u4E00\u8D77\u53C2\u52A0\u4E86\u670B\u53CB\u7684\u5A5A\u793C\u3002\n\n\u5173\u4E8E\u6211\u4EEC\u5A5A\u793C\u7684\u51C6\u5907\uFF0C\u5C31\u8FD9\u6837\u4E00\u4EF6\u4E00\u4EF6\u53D8\u5F97\u5177\u4F53\u3002\u60F3\u4E00\u8D77\u628A\u8FD9\u4EFD\u7EAA\u5FF5\uFF0C\u597D\u597D\u51C6\u5907\u3002",
      heartCost: 100,
      art: "story_24_wedding_preparations",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.18
    },
    {
      id: "lijiang_wedding",
      title: "\u4E3D\u6C5F\uFF0C\u7B2C\u4E00\u5957\u5A5A\u7EB1\u7167",
      dateLabel: "2026 \u5E74 5 \u6708 22 \u65E5\u8D77",
      summary: "Hello Kitty\u57CE\u5821\u3001\u59CA\u59B9\u6E56\u98CE\u683C\uFF0C\u8FD8\u6709\u96EA\u5C71\u516C\u8DEF\u3002",
      diary: "2026 \u5E74 5 \u6708 22 \u65E5\uFF0C\u6211\u4EEC\u53BB\u4E86\u4E91\u5357\u4E3D\u6C5F\u62CD\u5A5A\u7EB1\u7167\u3002\n\n\u6709 Hello Kitty \u57CE\u5821\u98CE\u683C\u3001\u201C\u59CA\u59B9\u6E56\u201D\u98CE\u683C\uFF0C\u4E5F\u6709\u516C\u8DEF\u98CE\u683C\u3002\u516C\u8DEF\u90A3\u4E00\u7EC4\uFF0C\u80CC\u666F\u662F\u96EA\u5C71\uFF0C\u8EAB\u8FB9\u662F\u4E00\u8F86\u655E\u7BF7 MINI\u3002\n\n\u62CD\u5B8C\u5A5A\u7EB1\u7167\uFF0C\u6211\u4EEC\u8FD8\u5728\u4E3D\u6C5F\u73A9\u4E86\u4E24\u4E09\u5929\uFF0C\u624D\u4E00\u8D77\u56DE\u53BB\u3002",
      heartCost: 100,
      art: "story_25_lijiang_wedding",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.14
    },
    {
      id: "hangzhou_wedding",
      title: "\u5728\u676D\u5DDE\uFF0C\u7559\u4E0B\u6211\u4EEC\u7684\u6A21\u6837",
      dateLabel: "2026 \u5E74 6 \u6708 6 \u65E5 \xB7 8 \u6708 8 \u65E5",
      summary: "\u5A5A\u793CMV\uFF0C\u518D\u5230\u8239\u4E0A\u6C49\u670D\u3001\u7ECF\u5178\u9ED1\u767D\u4E0E\u6696\u8272\u5149\u5F71\u3002",
      diary: "2026 \u5E74 6 \u6708 6 \u65E5\uFF0C\u6211\u4EEC\u5728\u676D\u5DDE\u62CD\u4E86\u5A5A\u793C MV\u3002\n\n8 \u6708 8 \u65E5\uFF0C\u53C8\u5728\u676D\u5DDE\u62CD\u4E86\u7B2C\u4E8C\u5957\u5A5A\u7EB1\u7167\u3002\u6709\u8239\u4E0A\u7684\u7EA2\u8272\u4E2D\u5F0F\u6C49\u670D\uFF0C\u6211\u7A7F\u72B6\u5143\u670D\uFF1B\u4E5F\u6709\u7ECF\u5178\u7684\u9ED1\u767D\u897F\u88C5\u9020\u578B\uFF0C\u8FD8\u6709\u504F\u6696\u9EC4\u8272\u7684\u5149\u5F71\u3002\n\n\u4E0D\u540C\u7684\u753B\u9762\uFF0C\u90FD\u662F\u6211\u4EEC\u60F3\u7559\u4F4F\u7684\u6A21\u6837\u3002",
      heartCost: 110,
      art: "story_26_hangzhou_wedding",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.15
    },
    {
      id: "wedding_mv",
      title: "\u676D\u5DDE\u7684\u5A5A\u793C MV",
      dateLabel: "2026 \u5E74 6 \u6708 6 \u65E5 \xB7 \u676D\u5DDE",
      summary: "\u6211\u4EEC\u5728\u676D\u5DDE\u62CD\u6444\u4E86\u5A5A\u793C MV\u3002",
      diary: "2026 \u5E74 6 \u6708 6 \u65E5\uFF0C\u6211\u4EEC\u5728\u676D\u5DDE\u62CD\u4E86\u5A5A\u793C MV\u3002\n\n\u4E3A\u5A5A\u793C\u7559\u4E0B\u7684\u8FD9\u6BB5\u7EAA\u5FF5\uFF0C\u4E5F\u60F3\u8BB0\u8FDB\u76F8\u518C\u3002",
      heartCost: 80,
      art: "story_40_wedding_mv",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.18
    },
    {
      id: "summer_before_wedding",
      title: "\u5A5A\u793C\u524D\uFF0C\u6700\u540E\u4E00\u4E2A\u590F\u5929",
      dateLabel: "2026 \u5E74 8 \u6708",
      summary: "\u6F14\u5531\u4F1A\u3001\u6C34\u4E0A\u4E50\u56ED\uFF0C\u518D\u4E00\u8D77\u53BB\u897F\u5B89\u9001\u59B9\u59B9\u4E0A\u5927\u5B66\u3002",
      diary: "2026 \u5E74 8 \u6708 16 \u65E5\uFF0C\u6211\u4EEC\u53BB\u770B\u4E86\u859B\u4E4B\u8C26\u201C\u4E07\u517D\u4E4B\u738B\u201D\u4E3B\u9898\u7684\u6F14\u5531\u4F1A\u30028 \u6708 22 \u65E5\uFF0C\u53C8\u4E00\u8D77\u53BB\u4E86\u6C34\u4E0A\u4E50\u56ED\u3002\n\n8 \u6708 27 \u65E5\uFF0C\u6211\u4EEC\u4E00\u8D77\u53BB\u897F\u5B89\u9001\u59B9\u59B9\u4E0A\u5927\u5B66\uFF0C\u5979\u5C31\u8BFB\u7684\u662F\u897F\u5317\u5927\u5B66\u3002\u8FD8\u987A\u9053\u770B\u4E86\u79E6\u59CB\u7687\u9675\u548C\u5175\u9A6C\u4FD1\u3002\n\n\u5A5A\u793C\u4E4B\u524D\u7684\u8FD9\u4E2A\u590F\u5929\uFF0C\u4E5F\u7559\u4E0B\u4E86\u8BB8\u591A\u60F3\u548C\u4F60\u4E00\u8D77\u8BB0\u4F4F\u7684\u7247\u6BB5\u3002",
      heartCost: 110,
      art: "story_27_summer_before_wedding",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.12
    },
    {
      id: "concert",
      title: "\u4E00\u8D77\u53BB\u770B\u6F14\u5531\u4F1A",
      dateLabel: "2026 \u5E74 8 \u6708 16 \u65E5",
      summary: "\u6211\u4EEC\u4E00\u8D77\u53BB\u770B\u859B\u4E4B\u8C26\u201C\u4E07\u517D\u4E4B\u738B\u201D\u4E3B\u9898\u6F14\u5531\u4F1A\u3002",
      diary: "2026 \u5E74 8 \u6708 16 \u65E5\uFF0C\u6211\u4EEC\u4E00\u8D77\u53BB\u770B\u4E86\u859B\u4E4B\u8C26\u201C\u4E07\u517D\u4E4B\u738B\u201D\u4E3B\u9898\u7684\u6F14\u5531\u4F1A\u3002\n\n\u90A3\u662F\u5A5A\u793C\u524D\u7684\u590F\u5929\uFF0C\u60F3\u5355\u72EC\u7559\u4F4F\u7684\u4E00\u6B21\u540C\u884C\u3002",
      heartCost: 90,
      art: "story_41_concert",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.18
    },
    {
      id: "xian_terracotta",
      title: "\u897F\u5B89\u7684\u540C\u884C\u4E0E\u5175\u9A6C\u4FD1",
      dateLabel: "2026 \u5E74 8 \u6708 27 \u65E5\u8D77 \xB7 \u897F\u5B89",
      summary: "\u4E00\u8D77\u9001\u59B9\u59B9\u53BB\u897F\u5317\u5927\u5B66\uFF0C\u4E5F\u770B\u4E86\u79E6\u59CB\u7687\u9675\u548C\u5175\u9A6C\u4FD1\u3002",
      diary: "2026 \u5E74 8 \u6708 27 \u65E5\uFF0C\u6211\u4EEC\u4E00\u8D77\u53BB\u897F\u5B89\u9001\u59B9\u59B9\u4E0A\u5927\u5B66\uFF0C\u5979\u5C31\u8BFB\u7684\u662F\u897F\u5317\u5927\u5B66\u3002\n\n\u8FD9\u8D9F\u884C\u7A0B\u4E2D\uFF0C\u6211\u4EEC\u8FD8\u987A\u9053\u770B\u4E86\u79E6\u59CB\u7687\u9675\u548C\u5175\u9A6C\u4FD1\u3002",
      heartCost: 90,
      art: "story_42_xian_terracotta",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.18
    },
    {
      id: "anniversary",
      title: "\u4E50\u6E05\u8349\u576A\u5A5A\u793C",
      dateLabel: "2026 \u5E74 10 \u6708 3 \u65E5",
      summary: "2026 \u5E74 10 \u6708 3 \u65E5\uFF0C\u6211\u4EEC\u5728\u4E50\u6E05\u4E3E\u529E\u4E86\u8349\u576A\u5A5A\u793C\u3002",
      diary: "2026 \u5E74 10 \u6708 3 \u65E5\uFF0C\u6211\u4EEC\u5728\u4E50\u6E05\u529E\u4E86\u8349\u576A\u5A5A\u793C\u3002\n\n\u4ECE\u821F\u5C71\u76F8\u8BC6\uFF0C\u5230\u4E00\u8D77\u8D70\u8FC7\u7684\u65C5\u9014\uFF0C\u6211\u4EEC\u8FCE\u6765\u4E86\u8FD9\u4E00\u5929\u3002\u5F80\u540E\u7684\u6545\u4E8B\uFF0C\u4E5F\u60F3\u7EE7\u7EED\u548C\u4F60\u5199\u4E0B\u53BB\u3002",
      heartCost: 300,
      art: "story_28_anniversary",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.18
    },
    {
      id: "marriage_registration",
      title: "\u6211\u4EEC\u9886\u8BC1\u4E86",
      dateLabel: "2026 \u5E74 10 \u6708 20 \u65E5",
      summary: "\u8FD9\u4E00\u5929\uFF0C\u6211\u4EEC\u9886\u4E86\u8BC1\u3002",
      diary: "2026 \u5E74 10 \u6708 20 \u65E5\uFF0C\u6211\u4EEC\u9886\u4E86\u8BC1\u3002\n\n\u8FD9\u4E00\u5929\uFF0C\u662F\u5C5E\u4E8E\u6211\u4EEC\u7684\u53E6\u4E00\u4EFD\u7EAA\u5FF5\u3002",
      heartCost: 120,
      art: "story_29_certificate",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.18
    },
    {
      id: "wedding_thanksgiving",
      title: "\u4ED9\u5C45\u7B54\u8C22\u5BB4",
      dateLabel: "2026 \u5E74 10 \u6708 31 \u65E5 \xB7 \u4ED9\u5C45",
      summary: "\u5728\u4ED9\u5C45\u4E3E\u529E\u9152\u5E97\u7B54\u8C22\u5BB4\uFF0C\u73CD\u85CF\u8FD9\u4EFD\u7EAA\u5FF5\u3002",
      diary: "2026 \u5E74 10 \u6708 31 \u65E5\uFF0C\u6211\u4EEC\u5728\u4ED9\u5C45\u7684\u9152\u5E97\u529E\u4E86\u7B54\u8C22\u5BB4\u3002\n\n\u5A5A\u793C\u3001\u9886\u8BC1\u548C\u7B54\u8C22\u5BB4\uFF0C\u662F\u8FD9\u4E2A\u5341\u6708\u91CC\u4E09\u4EFD\u4E0D\u540C\u7684\u7EAA\u5FF5\u3002",
      heartCost: 120,
      art: "story_30_thanksgiving",
      artMode: "cover",
      artLabel: "\u6545\u4E8B\u63D2\u753B",
      artFocusY: 0.18
    }
  ];

  // assets/resources/config/furniture.json
  var furniture_default = [
    {
      id: "sofa",
      title: "\u751C\u871C\u6C99\u53D1",
      category: "\u5BA2\u5385",
      room: "living",
      placement: {
        x: -152,
        y: -106,
        width: 352,
        height: 260
      },
      coinCost: 100,
      unlockLevel: 1,
      decorPoints: 4,
      art: "art/furniture_sofa"
    },
    {
      id: "tea_table",
      title: "\u6696\u5FC3\u8336\u51E0",
      category: "\u5BA2\u5385",
      room: "living",
      placement: {
        x: 16,
        y: -181,
        width: 196,
        height: 188
      },
      coinCost: 150,
      unlockLevel: 1,
      decorPoints: 4,
      art: "art/furniture_table"
    },
    {
      id: "rose_arch",
      title: "\u73AB\u7470\u82B1\u62F1\u95E8",
      category: "\u82B1\u56ED",
      room: "garden",
      placement: {
        x: -194,
        y: 20,
        width: 244,
        height: 304
      },
      coinCost: 200,
      unlockLevel: 1,
      decorPoints: 5,
      art: "art/furniture_arch"
    },
    {
      id: "bed",
      title: "\u6708\u5149\u5C0F\u5E8A",
      category: "\u5367\u5BA4",
      room: "bedroom",
      placement: {
        x: 70,
        y: -105,
        width: 418,
        height: 310
      },
      coinCost: 250,
      unlockLevel: 1,
      decorPoints: 5,
      art: "art/furniture_bed"
    },
    {
      id: "lamp",
      title: "\u6E29\u67D4\u843D\u5730\u706F",
      category: "\u5BA2\u5385",
      room: "living",
      placement: {
        x: -299,
        y: -29,
        width: 92,
        height: 312
      },
      coinCost: 300,
      unlockLevel: 5,
      decorPoints: 5,
      art: "art/furniture_lamp"
    },
    {
      id: "bookshelf",
      title: "\u56DE\u5FC6\u4E66\u67B6",
      category: "\u88C5\u9970",
      room: "living",
      placement: {
        x: -245,
        y: 120,
        width: 152,
        height: 250
      },
      coinCost: 350,
      unlockLevel: 8,
      decorPoints: 5,
      art: "art/furniture_bookshelf"
    },
    {
      id: "flower_wall",
      title: "\u82B1\u8BED\u5899",
      category: "\u88C5\u9970",
      room: "living",
      placement: {
        x: 261,
        y: 143,
        width: 138,
        height: 236
      },
      coinCost: 400,
      unlockLevel: 10,
      decorPoints: 5,
      art: "art/furniture_flowers"
    },
    {
      id: "dining_set",
      title: "\u53CC\u4EBA\u9910\u684C",
      category: "\u7279\u6B8A",
      room: "living",
      placement: {
        x: 221,
        y: -105,
        width: 222,
        height: 213
      },
      coinCost: 450,
      unlockLevel: 12,
      decorPoints: 5,
      art: "art/furniture_dining"
    },
    {
      id: "fountain",
      title: "\u8BB8\u613F\u55B7\u6CC9",
      category: "\u82B1\u56ED",
      room: "garden",
      placement: {
        x: -38,
        y: -155,
        width: 166,
        height: 206
      },
      coinCost: 500,
      unlockLevel: 15,
      decorPoints: 6,
      art: "art/furniture_fountain"
    },
    {
      id: "swing",
      title: "\u82B1\u56ED\u79CB\u5343",
      category: "\u82B1\u56ED",
      room: "garden",
      placement: {
        x: 170,
        y: -100,
        width: 270,
        height: 260
      },
      coinCost: 600,
      unlockLevel: 18,
      decorPoints: 6,
      art: "art/furniture_swing"
    },
    {
      id: "cream_sofa",
      title: "\u5976\u6CB9\u5F27\u5F62\u6C99\u53D1",
      category: "\u5BA2\u5385",
      room: "living",
      placement: {
        x: 0,
        y: 0,
        width: 320,
        height: 200
      },
      coinCost: 200,
      unlockLevel: 1,
      decorPoints: 5,
      art: "furniture_expansion_sheet#0"
    },
    {
      id: "mint_sofa",
      title: "\u8584\u8377\u53CC\u4EBA\u6C99\u53D1",
      category: "\u5BA2\u5385",
      room: "living",
      placement: {
        x: 0,
        y: -45,
        width: 300,
        height: 190
      },
      coinCost: 225,
      unlockLevel: 1,
      decorPoints: 5,
      art: "furniture_expansion_sheet#1"
    },
    {
      id: "rattan_coffee_table",
      title: "\u5706\u5F62\u85E4\u8336\u51E0",
      category: "\u5BA2\u5385",
      room: "living",
      placement: {
        x: 0,
        y: -170,
        width: 180,
        height: 150
      },
      coinCost: 250,
      unlockLevel: 1,
      decorPoints: 5,
      art: "furniture_expansion_sheet#2"
    },
    {
      id: "glass_side_table",
      title: "\u73BB\u7483\u8FB9\u684C",
      category: "\u5BA2\u5385",
      room: "living",
      placement: {
        x: 190,
        y: -150,
        width: 140,
        height: 150
      },
      coinCost: 275,
      unlockLevel: 1,
      decorPoints: 5,
      art: "furniture_expansion_sheet#3"
    },
    {
      id: "blue_bed",
      title: "\u84DD\u8272\u8F6F\u5305\u5E8A",
      category: "\u5367\u5BA4",
      room: "bedroom",
      placement: {
        x: 20,
        y: -80,
        width: 350,
        height: 250
      },
      coinCost: 300,
      unlockLevel: 2,
      decorPoints: 5,
      art: "furniture_expansion_sheet#4"
    },
    {
      id: "wood_bed",
      title: "\u539F\u6728\u56DB\u67F1\u5E8A",
      category: "\u5367\u5BA4",
      room: "bedroom",
      placement: {
        x: 30,
        y: -60,
        width: 350,
        height: 280
      },
      coinCost: 325,
      unlockLevel: 2,
      decorPoints: 5,
      art: "furniture_expansion_sheet#5"
    },
    {
      id: "wood_desk",
      title: "\u5706\u6728\u4E66\u684C",
      category: "\u4E66\u623F",
      room: "study",
      placement: {
        x: -100,
        y: -100,
        width: 260,
        height: 210
      },
      coinCost: 350,
      unlockLevel: 2,
      decorPoints: 5,
      art: "furniture_expansion_sheet#6"
    },
    {
      id: "cream_bookcase",
      title: "\u5976\u6CB9\u4E66\u67DC",
      category: "\u4E66\u623F",
      room: "study",
      placement: {
        x: -210,
        y: 90,
        width: 160,
        height: 260
      },
      coinCost: 375,
      unlockLevel: 2,
      decorPoints: 5,
      art: "furniture_expansion_sheet#7"
    },
    {
      id: "reading_chair",
      title: "\u9605\u8BFB\u6276\u624B\u6905",
      category: "\u4E66\u623F",
      room: "study",
      placement: {
        x: 160,
        y: -100,
        width: 190,
        height: 220
      },
      coinCost: 400,
      unlockLevel: 3,
      decorPoints: 5,
      art: "furniture_expansion_sheet#8"
    },
    {
      id: "record_cabinet",
      title: "\u5531\u7247\u67DC",
      category: "\u4E66\u623F",
      room: "study",
      placement: {
        x: 170,
        y: 60,
        width: 170,
        height: 210
      },
      coinCost: 425,
      unlockLevel: 3,
      decorPoints: 5,
      art: "furniture_expansion_sheet#9"
    },
    {
      id: "terrace_chair",
      title: "\u9732\u53F0\u85E4\u6905",
      category: "\u9732\u53F0",
      room: "terrace",
      placement: {
        x: -180,
        y: -120,
        width: 190,
        height: 200
      },
      coinCost: 450,
      unlockLevel: 3,
      decorPoints: 5,
      art: "furniture_expansion_sheet#10"
    },
    {
      id: "flower_bench",
      title: "\u82B1\u67B6\u957F\u51F3",
      category: "\u9732\u53F0",
      room: "terrace",
      placement: {
        x: 120,
        y: -100,
        width: 260,
        height: 220
      },
      coinCost: 475,
      unlockLevel: 3,
      decorPoints: 5,
      art: "furniture_expansion_sheet#11"
    },
    {
      id: "greenhouse_shelf",
      title: "\u6E29\u5BA4\u82B1\u67B6",
      category: "\u9732\u53F0",
      room: "terrace",
      placement: {
        x: -200,
        y: 70,
        width: 180,
        height: 250
      },
      coinCost: 500,
      unlockLevel: 4,
      decorPoints: 5,
      art: "furniture_expansion_sheet#12"
    },
    {
      id: "outdoor_table",
      title: "\u6237\u5916\u5C0F\u9910\u684C",
      category: "\u9732\u53F0",
      room: "terrace",
      placement: {
        x: 20,
        y: -170,
        width: 190,
        height: 180
      },
      coinCost: 525,
      unlockLevel: 4,
      decorPoints: 5,
      art: "furniture_expansion_sheet#13"
    },
    {
      id: "rattan_light",
      title: "\u85E4\u7F16\u843D\u5730\u706F",
      category: "\u9732\u53F0",
      room: "terrace",
      placement: {
        x: 230,
        y: -45,
        width: 130,
        height: 190
      },
      coinCost: 550,
      unlockLevel: 4,
      decorPoints: 5,
      art: "furniture_expansion_sheet#14"
    },
    {
      id: "round_rug",
      title: "\u5706\u5F62\u82B1\u7EB9\u5730\u6BEF",
      category: "\u88C5\u9970",
      room: "living",
      placement: {
        x: 0,
        y: -200,
        width: 270,
        height: 130
      },
      coinCost: 575,
      unlockLevel: 4,
      decorPoints: 5,
      art: "furniture_expansion_sheet#15"
    },
    {
      id: "pool_lounger",
      title: "\u5976\u6CB9\u8EBA\u6905",
      category: "\u6CF3\u6C60",
      room: "pool",
      placement: {
        x: -65,
        y: -195,
        width: 250,
        height: 180
      },
      coinCost: 400,
      unlockLevel: 5,
      decorPoints: 5,
      art: "pool:0"
    },
    {
      id: "pool_umbrella",
      title: "\u906E\u9633\u4F1E\u4E0E\u5C0F\u8FB9\u684C",
      category: "\u6CF3\u6C60",
      room: "pool",
      placement: {
        x: 190,
        y: -150,
        width: 220,
        height: 280
      },
      coinCost: 425,
      unlockLevel: 6,
      decorPoints: 5,
      art: "pool:1"
    },
    {
      id: "pool_towel_rack",
      title: "\u6728\u5236\u6BDB\u5DFE\u67B6",
      category: "\u6CF3\u6C60",
      room: "pool",
      placement: {
        x: -245,
        y: -160,
        width: 130,
        height: 190
      },
      coinCost: 450,
      unlockLevel: 7,
      decorPoints: 5,
      art: "pool:2"
    },
    {
      id: "pool_float",
      title: "\u7C89\u8272\u6CF3\u5708",
      category: "\u6CF3\u6C60",
      room: "pool",
      placement: {
        x: 60,
        y: 45,
        width: 170,
        height: 130
      },
      coinCost: 475,
      unlockLevel: 8,
      decorPoints: 5,
      art: "pool:3"
    }
  ];

  // assets/resources/config/wishes.json
  var wishes_default = [
    { id: "first_spawns", title: "\u70B9\u4EAE\u5496\u5561\u673A", metric: "spawns", target: 5, rewardCoins: 100, rewardHearts: 20 },
    { id: "first_merges", title: "\u5C0F\u5C0F\u7684\u5408\u6210", metric: "merges", target: 3, rewardCoins: 100, rewardHearts: 20 },
    { id: "first_order", title: "\u7B2C\u4E00\u4EFD\u59D4\u6258", metric: "orders", target: 1, rewardCoins: 100, rewardHearts: 20 },
    { id: "flower_time", title: "\u82B1\u7BEE\u5F00\u653E", metric: "level", target: 3, rewardCoins: 100, rewardHearts: 20 },
    { id: "first_memory", title: "\u7FFB\u5F00\u7B2C\u4E00\u9875", metric: "memories", target: 1, rewardCoins: 100, rewardHearts: 20 },
    { id: "first_furniture", title: "\u88C5\u70B9\u5C0F\u5C4B", metric: "furniture", target: 1, rewardCoins: 100, rewardHearts: 20 },
    { id: "helpful_neighbor", title: "\u70ED\u5FC3\u5C0F\u5C4B", metric: "orders", target: 5, rewardCoins: 100, rewardHearts: 20 },
    { id: "gift_time", title: "\u793C\u7269\u65F6\u5149", metric: "level", target: 8, rewardCoins: 100, rewardHearts: 20 },
    { id: "more_memories", title: "\u73CD\u85CF\u7684\u6545\u4E8B", metric: "memories", target: 3, rewardCoins: 100, rewardHearts: 20 },
    { id: "cozy_home", title: "\u6E29\u6696\u7684\u5BB6", metric: "decor", target: 20, rewardCoins: 100, rewardHearts: 20 }
  ];

  // assets/resources/config/level_rewards.json
  var level_rewards_default = {
    default: {
      coinsPerLevel: 20,
      heartsPerLevel: 2,
      xp: 0
    },
    special: [
      {
        level: 3,
        coins: 200,
        hearts: 50,
        xp: 300
      }
    ],
    generatorRotation: [
      "coffee_machine",
      "orange_tree",
      "flower_basket",
      "dessert_oven",
      "gift_box"
    ]
  };

  // assets/resources/config/adventures.json
  var adventures_default = [
    {
      id: "zhoushan",
      memoryId: "letters",
      title: "\u821F\u5C71 \xB7 \u76F8\u9047\u7684\u7EBF\u7D22",
      unlockLevel: 1,
      intro: "\u4E00\u8D77\u6574\u7406\u56DE\u5FC6\u518C\u5427\u3002\u5148\u51C6\u5907\u4E24\u4EFD\u65C5\u9014\u5FC3\u610F\uFF0C\u518D\u5728\u6D77\u8FB9\u63D2\u753B\u91CC\u5BFB\u627E\u4E09\u5F20\u7EBF\u7D22\u5361\u3002",
      steps: [
        {
          title: "\u51C6\u5907\u65C5\u9014\u5496\u5561",
          requirements: [
            {
              itemId: "coffee_02",
              count: 1
            }
          ],
          note: "\u7B2C\u4E00\u4EFD\u5FC3\u610F\u5DF2\u88C5\u597D\uFF0C\u518D\u51C6\u5907\u4E00\u676F\u5496\u5561\uFF0C\u5C31\u80FD\u6253\u5F00\u6D77\u8FB9\u56DE\u5FC6\u518C\u3002"
        },
        {
          title: "\u628A\u5FC3\u610F\u88C5\u8FDB\u80CC\u5305",
          requirements: [
            {
              itemId: "coffee_03",
              count: 1
            }
          ],
          note: "\u80CC\u5305\u51C6\u5907\u597D\u4E86\u3002\u70B9\u51FB\u6D77\u8FB9\u753B\u9762\u4E2D\u7684\u4E09\u4E2A\u6807\u8BB0\uFF0C\u6536\u96C6\u9080\u8BF7\u5361\u3001\u65E5\u5386\u548C\u4FBF\u7B7E\u3002"
        }
      ],
      instruction: "\u627E\u9F50\u4E09\u5F20\u7EBF\u7D22\u5361\uFF0C\u518D\u6839\u636E\u5361\u7247\u8F93\u5165\u56DB\u4F4D\u5BC6\u7801\uFF0C\u6253\u5F00\u56DE\u5FC6\u62BD\u5C49\u3002",
      hints: [
        "\u5148\u70B9\u51FB\u63D2\u753B\u4E2D\u7684\u4E09\u4E2A\u5706\u5F62\u6807\u8BB0\uFF0C\u7EBF\u7D22\u4F1A\u4FDD\u5B58\u5728\u4E0B\u65B9\u7B14\u8BB0\u91CC\u3002",
        "\u9080\u8BF7\u5361\u5199\u7740\u4E5D\u6708\uFF0C\u65E5\u5386\u5708\u51FA\u4E86\u516B\u65E5\uFF1B\u4FBF\u7B7E\u63D0\u793A\u6309\u6708\u4EFD\u3001\u65E5\u671F\u5404\u4E24\u4F4D\u6392\u5217\u3002",
        "\u62BD\u5C49\u5BC6\u7801\u662F 0908\u3002\u4E5F\u53EF\u4EE5\u70B9\u51FB\u8DF3\u8FC7\u8C1C\u9898\uFF0C\u7EE7\u7EED\u73CD\u85CF\u8FD9\u6BB5\u56DE\u5FC6\u3002"
      ],
      puzzle: {
        kind: "find",
        solution: "0908",
        hotspots: [
          {
            id: "invitation",
            label: "\u9080\u8BF7\u5361",
            x: -190,
            y: 95,
            clue: "\u9080\u8BF7\u5361\uFF1A\u4E5D\u6708\u7684\u821F\u5C71\uFF0C\u6B22\u8FCE\u4E00\u8D77\u53C2\u52A0\u6D3B\u52A8\u3002"
          },
          {
            id: "calendar",
            label: "\u65E5\u5386",
            x: 175,
            y: 5,
            clue: "\u5C0F\u65E5\u5386\uFF1A\u516B\u65E5\u88AB\u8F7B\u8F7B\u753B\u4E0A\u4E86\u4E00\u4E2A\u5708\u3002"
          },
          {
            id: "note",
            label: "\u4FBF\u7B7E",
            x: -60,
            y: -110,
            clue: "\u62BD\u5C49\u4FBF\u7B7E\uFF1A\u6708\u4EFD\u5728\u524D\u3001\u65E5\u671F\u5728\u540E\uFF0C\u5404\u5199\u4E24\u4F4D\u3002"
          }
        ]
      },
      replayVariants: [
        {
          id: "practice_card",
          instruction: "\u627E\u5230\u4E09\u5F20\u7EC3\u4E60\u5361\uFF0C\u628A\u4E24\u6BB5\u6570\u5B57\u4F9D\u6B21\u62FC\u6210\u56DB\u4F4D\u7EC3\u4E60\u7801\u3002",
          hints: [
            "\u4E09\u4E2A\u6807\u8BB0\u90FD\u8981\u627E\u5230\uFF0C\u7EBF\u7D22\u4F1A\u4FDD\u5B58\u5728\u7EC3\u4E60\u7B14\u8BB0\u91CC\u3002",
            "A \u5361\u7ED9\u51FA\u524D\u4E24\u4F4D 73\uFF0CB \u5361\u7ED9\u51FA\u540E\u4E24\u4F4D 14\u3002",
            "\u6309\u5361\u7247\u987A\u5E8F\u8F93\u5165 7314\uFF1B\u8FD9\u53EA\u662F\u7EC3\u4E60\u7801\uFF0C\u4E0D\u5BF9\u5E94\u73B0\u5B9E\u65E5\u671F\u6216\u56DE\u5FC6\u4E8B\u5B9E\u3002"
          ],
          puzzle: {
            kind: "find",
            solution: "7314",
            hotspots: [
              { id: "practice_card_a", label: "\u7EC3\u4E60\u5361 A", x: -190, y: 95, clue: "\u7EC3\u4E60\u5361 A\uFF1A\u524D\u4E24\u4F4D\u662F 73\u3002" },
              { id: "practice_card_b", label: "\u7EC3\u4E60\u5361 B", x: 175, y: 5, clue: "\u7EC3\u4E60\u5361 B\uFF1A\u540E\u4E24\u4F4D\u662F 14\u3002" },
              { id: "practice_card_note", label: "\u7EC3\u4E60\u8BF4\u660E", x: -60, y: -110, clue: "\u5361\u7247\u6570\u5B57\u4EC5\u7528\u4E8E\u672C\u6B21\u7EC3\u4E60\uFF0C\u4E0D\u4EE3\u8868\u771F\u5B9E\u65E5\u671F\u6216\u56DE\u5FC6\u4E8B\u5B9E\u3002" }
            ]
          }
        }
      ],
      reward: {
        coins: 120,
        hearts: 50,
        energy: 20,
        scissors: 1
      },
      souvenir: {
        title: "\u521D\u8BC6\u7684\u5FC3\u610F\u793C\u76D2",
        artItemId: "gift_03",
        room: "living",
        x: 155,
        y: -6
      }
    },
    {
      id: "love_letters",
      memoryId: "first_trip",
      title: "\u60C5\u4E66 \xB7 \u628A\u5FC3\u610F\u6392\u6210\u4E00\u53E5\u8BDD",
      unlockLevel: 3,
      intro: "\u628A\u82B1\u548C\u5496\u5561\u51C6\u5907\u597D\uFF0C\u518D\u4ECE\u56DB\u5C01\u4EE3\u8868\u6027\u7684\u4FE1\u91CC\uFF0C\u627E\u51FA\u8FD9\u4EFD\u5FC3\u610F\u7684\u987A\u5E8F\u3002",
      steps: [
        {
          title: "\u4E3A\u4FE1\u4EF6\u6311\u4E00\u6735\u82B1",
          requirements: [
            {
              itemId: "flower_02",
              count: 1
            }
          ],
          note: "\u82B1\u51C6\u5907\u597D\u4E86\u3002\u518D\u6DFB\u4E00\u676F\u5496\u5561\uFF0C\u4E00\u8D77\u7FFB\u5F00\u4FE1\u4EF6\u3002"
        },
        {
          title: "\u5750\u4E0B\u6765\u6162\u6162\u8BFB\u4FE1",
          requirements: [
            {
              itemId: "coffee_04",
              count: 1
            }
          ],
          note: "\u56DB\u5C01\u4FE1\u5DF2\u7ECF\u653E\u5728\u684C\u4E0A\u3002\u6839\u636E\u4FE1\u5C01\u4FBF\u7B7E\uFF0C\u628A\u5B83\u4EEC\u6392\u6210\u4E00\u53E5\u544A\u767D\u3002"
        }
      ],
      instruction: "\u4F9D\u6B21\u70B9\u51FB\u56DB\u5C01\u4FE1\uFF0C\u6392\u51FA\u5B8C\u6574\u544A\u767D\uFF1B\u70B9\u5DF2\u9009\u62E9\u7684\u4FE1\u53EF\u64A4\u56DE\u5B83\u53CA\u540E\u9762\u7684\u4FE1\u3002",
      hints: [
        "\u8BFB\u4E00\u8BFB\u56DB\u5F20\u4FE1\u5C01\u4E0A\u7684\u4FBF\u7B7E\uFF0C\u5B83\u4EEC\u4F1A\u544A\u8BC9\u4F60\u524D\u540E\u4F4D\u7F6E\u3002",
        "\u201C\u6211\u201D\u5F00\u5934\uFF0C\u201C\u4F60\u201D\u7ED3\u5C3E\uFF1B\u201C\u559C\u6B22\u201D\u7D27\u8DDF\u7740\u201C\u60F3\u544A\u8BC9\u4F60\uFF1A\u201D\u3002",
        "\u987A\u5E8F\u662F\uFF1A\u6211 \u2192 \u60F3\u544A\u8BC9\u4F60\uFF1A \u2192 \u559C\u6B22 \u2192 \u4F60\u3002"
      ],
      puzzle: {
        kind: "sequence",
        tiles: [
          {
            id: "you",
            label: "\u4F60",
            clue: "\u6211\u5728\u6700\u540E\uFF0C\u7B49\u4F60\u628A\u8BDD\u8BF4\u5B8C\u3002"
          },
          {
            id: "like",
            label: "\u559C\u6B22",
            clue: "\u6211\u7D27\u8DDF\u7740\u201C\u60F3\u544A\u8BC9\u4F60\uFF1A\u201D\u3002"
          },
          {
            id: "me",
            label: "\u6211",
            clue: "\u8BA9\u6211\u5148\u5F00\u53E3\u5427\u3002"
          },
          {
            id: "tell",
            label: "\u60F3\u544A\u8BC9\u4F60\uFF1A",
            clue: "\u6211\u5728\u201C\u6211\u201D\u7684\u540E\u9762\u3002"
          }
        ],
        solution: [
          "me",
          "tell",
          "like",
          "you"
        ]
      },
      replayVariants: [
        {
          id: "practice_phrase",
          instruction: "\u6839\u636E\u6BCF\u5F20\u7EC3\u4E60\u5361\u6807\u6CE8\u7684\u4F4D\u7F6E\uFF0C\u628A\u56DB\u4E2A\u8BCD\u6392\u6210\u4E00\u53E5\u4E2D\u6027\u7684\u5FC3\u610F\u8BDD\u3002",
          hints: [
            "\u6BCF\u5F20\u7EC3\u4E60\u5361\u90FD\u72EC\u7ACB\u5199\u660E\u81EA\u5DF1\u5E94\u653E\u7684\u4F4D\u7F6E\u3002",
            "\u5148\u653E\u7B2C1\u683C\u201C\u613F\u201D\uFF0C\u518D\u653E\u7B2C2\u683C\u201C\u6BCF\u5929\u201D\u3002",
            "\u6700\u540E\u6309\u4F4D\u7F6E\u653E\u201C\u90FD\u6709\u201D\u548C\u201C\u5C0F\u5C0F\u6B22\u559C\u201D\uFF0C\u7EC4\u6210\u201C\u613F\u6BCF\u5929\u90FD\u6709\u5C0F\u5C0F\u6B22\u559C\u201D\u3002"
          ],
          puzzle: {
            kind: "sequence",
            tiles: [
              { id: "practice_joy", label: "\u5C0F\u5C0F\u6B22\u559C", clue: "\u6211\u662F\u6574\u53E5\u8BDD\u7684\u6536\u5C3E\uFF0C\u7559\u4E0B\u8F7B\u677E\u7684\u5FC3\u60C5\u3002" },
              { id: "practice_wish", label: "\u613F", clue: "\u6211\u662F\u8FD9\u53E5\u8BDD\u7684\u5F00\u5934\uFF0C\u5148\u8BF4\u51FA\u5FC3\u613F\u3002" },
              { id: "practice_daily", label: "\u6BCF\u5929", clue: "\u6211\u7D27\u8DDF\u7740\u201C\u613F\u201D\uFF0C\u8BF4\u660E\u8FD9\u4EFD\u5FC3\u610F\u4F1A\u53D1\u751F\u5728\u6BCF\u5929\u3002" },
              { id: "practice_have", label: "\u90FD\u6709", clue: "\u6211\u63A5\u5728\u201C\u6BCF\u5929\u201D\u540E\u9762\uFF0C\u8FDE\u63A5\u65F6\u95F4\u548C\u7ED3\u679C\u3002" }
            ],
            solution: ["practice_wish", "practice_daily", "practice_have", "practice_joy"]
          }
        }
      ],
      reward: {
        coins: 180,
        hearts: 80,
        energy: 25,
        scissors: 2
      },
      souvenir: {
        title: "\u73CD\u85CF\u7684\u60C5\u4E66",
        artItemId: "gift_02",
        room: "bedroom",
        x: 0,
        y: -6
      }
    },
    {
      id: "namsan",
      memoryId: "rainy_day",
      title: "\u5357\u5C71\u5854 \xB7 \u70B9\u4EAE\u5FC3\u610F",
      unlockLevel: 5,
      intro: "\u51C6\u5907\u597D\u751C\u70B9\u548C\u82B1\u675F\uFF0C\u518D\u70B9\u4EAE\u8FD9\u5F20\u4E3A\u56DE\u5FC6\u518C\u8BBE\u8BA1\u7684\u706F\u5149\u5361\u3002",
      steps: [
        {
          title: "\u51C6\u5907\u65C5\u884C\u751C\u70B9",
          requirements: [
            {
              itemId: "dessert_03",
              count: 1
            }
          ],
          note: "\u751C\u70B9\u51C6\u5907\u597D\u4E86\u3002\u518D\u5E26\u4E0A\u82B1\u675F\uFF0C\u5C31\u53EF\u4EE5\u70B9\u4EAE\u706F\u5149\u5361\u3002"
        },
        {
          title: "\u5E26\u4E0A\u6D6A\u6F2B\u82B1\u675F",
          requirements: [
            {
              itemId: "flower_04",
              count: 1
            }
          ],
          note: "\u70B9\u51FB\u706F\u5149\u5361\u7247\u65CB\u8F6C\u7EBF\u8DEF\uFF0C\u8BA9\u5DE6\u4FA7\u5165\u53E3\u4E00\u8DEF\u8FDE\u63A5\u5230\u53F3\u4FA7\u7231\u5FC3\u3002"
        }
      ],
      instruction: "\u70B9\u4E00\u4E0B\u65CB\u8F6C\u4E00\u683C\uFF0C\u91D1\u8272\u8868\u793A\u5DF2\u901A\u7535\uFF1B\u628A\u5DE6\u4E0A\u5165\u53E3\u63A5\u5230\u53F3\u4E0B\u7231\u5FC3\u3002\u5B8C\u6210\u540E\u70B9\u51FB\u68C0\u67E5\u7EBF\u8DEF\u3002",
      hints: [
        "\u7EBF\u8DEF\u5FC5\u987B\u4E24\u7AEF\u76F8\u5BF9\u624D\u80FD\u8FDE\u901A\u3002\u5148\u4ECE\u5DE6\u4E0A\u5165\u53E3\u5411\u53F3\u63A5\u3002",
        "\u8DEF\u7EBF\u6CBF\u7B2C\u4E00\u6392\u5411\u53F3\uFF0C\u518D\u5230\u7B2C\u4E8C\u6392\u5411\u5DE6\uFF0C\u6700\u540E\u6CBF\u7B2C\u4E09\u6392\u5411\u53F3\u3002",
        "\u5148\u70B9\u91CD\u7F6E\u673A\u5173\uFF0C\u518D\u628A\u6BCF\u4E2A\u683C\u5B50\u70B9\u4E09\u6B21\uFF0C\u6700\u540E\u68C0\u67E5\u7EBF\u8DEF\u3002\u4E5F\u53EF\u4EE5\u8DF3\u8FC7\uFF0C\u7EE7\u7EED\u73CD\u85CF\u8FD9\u6BB5\u56DE\u5FC6\u3002"
      ],
      puzzle: {
        kind: "circuit",
        columns: 3,
        rows: 3,
        start: 0,
        end: 8,
        ports: [
          [
            1,
            3
          ],
          [
            1,
            3
          ],
          [
            2,
            3
          ],
          [
            1,
            2
          ],
          [
            1,
            3
          ],
          [
            0,
            3
          ],
          [
            0,
            1
          ],
          [
            1,
            3
          ],
          [
            1,
            3
          ]
        ],
        initial: [
          1,
          1,
          1,
          1,
          1,
          1,
          1,
          1,
          1
        ],
        solution: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ]
      },
      replayVariants: [
        {
          id: "practice_circuit",
          instruction: "\u65CB\u8F6C 3\xD73 \u706F\u5149\u5361\u7247\uFF0C\u8BA9\u5DE6\u4E0A\u5165\u53E3\u7684\u5149\u6CBF\u7EBF\u8DEF\u5230\u8FBE\u53F3\u4E0B\u7231\u5FC3\u3002",
          hints: [
            "\u53EA\u6709\u76F8\u90BB\u4E24\u683C\u7684\u7AEF\u53E3\u5F7C\u6B64\u76F8\u5BF9\uFF0C\u706F\u5149\u624D\u4F1A\u901A\u8FC7\u3002",
            "\u8DEF\u7EBF\u5148\u6CBF\u7B2C\u4E00\u6392\u5411\u53F3\uFF0C\u518D\u6CBF\u4E2D\u95F4\u4E00\u6392\u8FD4\u56DE\uFF0C\u6700\u540E\u5411\u53F3\u62B5\u8FBE\u7231\u5FC3\u3002",
            "\u7EC3\u4E60\u521D\u6001\u7684\u65CB\u8F6C\u6B21\u6570\u5404\u4E0D\u76F8\u540C\uFF1B\u9010\u683C\u8C03\u6574\u540E\u68C0\u67E5\u8FDE\u63A5\u3002"
          ],
          puzzle: {
            kind: "circuit",
            columns: 3,
            rows: 3,
            start: 0,
            end: 8,
            ports: [[1, 3], [1, 3], [2, 3], [1, 2], [1, 3], [0, 3], [0, 1], [1, 3], [1, 3]],
            initial: [1, 0, 2, 3, 1, 2, 0, 3, 1],
            solution: [0, 0, 0, 0, 0, 0, 0, 0, 0]
          }
        }
      ],
      reward: {
        coins: 240,
        hearts: 120,
        energy: 30,
        scissors: 2
      },
      souvenir: {
        title: "\u5357\u5C71\u5854\u7684\u5FC3\u610F\u540A\u5760",
        artItemId: "gift_06",
        room: "living",
        x: -155,
        y: -6
      }
    },
    {
      id: "hengdian_newyear",
      memoryId: "night_view",
      title: "\u6A2A\u5E97 \xB7 \u4E00\u8D77\u8DE8\u5E74",
      unlockLevel: 6,
      intro: "2023 \u5E74 12 \u6708 30 \u65E5\uFF0C\u6211\u4EEC\u53BB\u6A2A\u5E97\u8DE8\u5E74\u3002\u5148\u51C6\u5907\u4E24\u4EF6\u65C5\u9014\u5FC3\u610F\uFF0C\u518D\u628A\u56DE\u5FC6\u518C\u8FD9\u4E00\u9875\u7684\u7167\u7247\u6392\u6210\u4E00\u6BB5\u6545\u4E8B\u3002",
      steps: [
        {
          title: "\u51FA\u53D1\u524D\u7684\u4E00\u676F\u70ED\u5496\u5561",
          requirements: [
            {
              itemId: "coffee_03",
              count: 1
            },
            {
              itemId: "dessert_02",
              count: 1
            }
          ],
          note: "\u70ED\u5496\u5561\u548C\u751C\u70B9\u88C5\u597D\u4E86\u3002\u518D\u5E26\u4E0A\u82B1\u548C\u86CB\u7CD5\uFF0C\u5C31\u80FD\u6253\u5F00\u8DE8\u5E74\u7684\u884C\u7A0B\u5361\u3002"
        },
        {
          title: "\u79E6\u738B\u5BAB\u4E0E\u6E29\u6CC9",
          requirements: [
            {
              itemId: "flower_03",
              count: 1
            },
            {
              itemId: "dessert_03",
              count: 1
            }
          ],
          note: "\u95E8\u7968\u548C\u6E29\u6CC9\u724C\u90FD\u6536\u597D\u4E86\u3002\u6309\u56DE\u5FC6\u518C\u8FD9\u4E00\u9875\u7684\u6392\u7248\uFF0C\u628A\u56DB\u5F20\u7167\u7247\u6392\u6210\u4E00\u6761\u7EBF\u3002"
        }
      ],
      instruction: "\u8FD9\u662F\u56DE\u5FC6\u518C\u7684\u4E00\u9875\u6392\u7248\uFF0C\u4E0D\u662F\u884C\u7A0B\u65F6\u95F4\u8868\uFF1B\u6309\u9875\u7801\u4F9D\u6B21\u70B9\u9009\u56DB\u5F20\u7167\u7247\u3002",
      hints: [
        "\u5148\u770B\u56DB\u5F20\u5361\u5DE6\u4E0A\u89D2\u7684\u9875\u7801\uFF0C\u5B83\u4EEC\u8868\u793A\u8FD9\u4E00\u9875\u7684\u6392\u7248\u4F4D\u7F6E\u3002",
        "\u9875\u7801 1 \u662F\u79E6\u738B\u5BAB\uFF0C\u9875\u7801 2 \u662F\u6E38\u4E50\u56ED\uFF1B\u9875\u7801 3 \u662F\u6E29\u6CC9\uFF0C\u9875\u7801 4 \u662F\u56DE\u6E29\u5DDE\u3002",
        "\u6309\u9875\u7801\u4F9D\u6B21\u70B9\u9009\uFF1A\u79E6\u738B\u5BAB \u2192 \u6E38\u4E50\u56ED \u2192 \u6E29\u6CC9 \u2192 \u56DE\u6E29\u5DDE\u3002"
      ],
      puzzle: {
        kind: "sequence",
        tiles: [
          {
            id: "qinwang",
            label: "\u79E6\u738B\u5BAB",
            clue: "\u9875\u7801 1 \xB7 \u7EA2\u5899\u7167\u7247\u6392\u5728\u8FD9\u4E00\u9875\u6700\u4E0A\u9762\u3002"
          },
          {
            id: "park",
            label: "\u6E38\u4E50\u56ED",
            clue: "\u9875\u7801 2 \xB7 \u63A5\u5728\u7EA2\u5899\u7167\u7247\u540E\u9762\u7684\u6E38\u4E50\u56ED\u5F69\u706F\u3002"
          },
          {
            id: "hotspring",
            label: "\u6E29\u6CC9",
            clue: "\u9875\u7801 3 \xB7 \u6E29\u6CC9\u7167\u7247\u6392\u5728\u8FD9\u4E00\u9875\u7684\u4E0B\u65B9\u3002"
          },
          {
            id: "back_wenzhou",
            label: "\u56DE\u6E29\u5DDE",
            clue: "\u9875\u7801 4 \xB7 \u8F66\u7968\u548C\u56DE\u6E29\u5DDE\u7684\u7167\u7247\u6536\u5728\u9875\u5C3E\u3002"
          }
        ],
        solution: [
          "qinwang",
          "park",
          "hotspring",
          "back_wenzhou"
        ]
      },
      replayVariants: [
        {
          id: "practice_phrase",
          instruction: "\u6839\u636E\u7EC3\u4E60\u5361\u7247\u4E0A\u7684\u4F4D\u7F6E\u63D0\u793A\uFF0C\u628A\u56DB\u4E2A\u8BCD\u6392\u6210\u4E00\u53E5\u8F7B\u677E\u7684\u5FC3\u610F\u8BDD\u3002",
          hints: [
            "\u56DB\u5F20\u5361\u5404\u81EA\u6807\u6CE8\u4E86\u7B2C\u51E0\u683C\uFF0C\u6309\u4F4D\u7F6E\u6392\u5217\u5373\u53EF\u3002",
            "\u7B2C1\u683C\u662F\u201C\u4E00\u8D77\u201D\uFF0C\u7B2C2\u683C\u662F\u201C\u6162\u6162\u201D\u3002",
            "\u7B2C3\u683C\u201C\u6536\u96C6\u201D\u540E\u63A5\u7B2C4\u683C\u201C\u5FEB\u4E50\u201D\uFF0C\u7EC4\u6210\u201C\u4E00\u8D77\u6162\u6162\u6536\u96C6\u5FEB\u4E50\u201D\u3002"
          ],
          puzzle: {
            kind: "sequence",
            tiles: [
              { id: "practice_joy", label: "\u5FEB\u4E50", clue: "\u6211\u5728\u53E5\u5B50\u7ED3\u5C3E\uFF0C\u8868\u793A\u4E00\u8D77\u6536\u83B7\u7684\u5FC3\u60C5\u3002" },
              { id: "practice_together", label: "\u4E00\u8D77", clue: "\u6211\u662F\u8FD9\u53E5\u8BDD\u7684\u8D77\u70B9\uFF0C\u9080\u8BF7\u4E00\u8D77\u884C\u52A8\u3002" },
              { id: "practice_gather", label: "\u6536\u96C6", clue: "\u6211\u63A5\u5728\u201C\u6162\u6162\u201D\u540E\u9762\uFF0C\u8868\u793A\u8981\u505A\u7684\u52A8\u4F5C\u3002" },
              { id: "practice_slowly", label: "\u6162\u6162", clue: "\u6211\u7D27\u8DDF\u201C\u4E00\u8D77\u201D\uFF0C\u8BF4\u660E\u884C\u52A8\u7684\u8282\u594F\u3002" }
            ],
            solution: ["practice_together", "practice_slowly", "practice_gather", "practice_joy"]
          }
        }
      ],
      reward: {
        coins: 300,
        hearts: 150,
        energy: 30,
        scissors: 2
      },
      souvenir: {
        title: "\u8DE8\u5E74\u884C\u7A0B\u7EAA\u5FF5\u7968",
        artItemId: "gift_05",
        room: "living",
        x: 0,
        y: 26
      }
    },
    {
      id: "lijiang_photos",
      memoryId: "lijiang_wedding",
      title: "\u4E3D\u6C5F \xB7 \u7B2C\u4E00\u5957\u5A5A\u7EB1\u7167",
      unlockLevel: 8,
      intro: "2026 \u5E74 5 \u6708 22 \u65E5\uFF0C\u6211\u4EEC\u53BB\u4E3D\u6C5F\u62CD\u5A5A\u7EB1\u7167\u3002\u51C6\u5907\u597D\u51FA\u53D1\u7684\u5FC3\u610F\uFF0C\u518D\u5728\u753B\u9762\u91CC\u627E\u56DE\u90A3\u5929\u7684\u65E5\u671F\u5BC6\u7801\u3002",
      steps: [
        {
          title: "\u6E05\u6668\u7684\u62FF\u94C1",
          requirements: [
            {
              itemId: "coffee_03",
              count: 1
            },
            {
              itemId: "flower_02",
              count: 1
            }
          ],
          note: "\u6E05\u6668\u7684\u5496\u5561\u548C\u82B1\u51C6\u5907\u597D\u4E86\u3002\u518D\u5E26\u4E0A\u793C\u7269\u4E0E\u751C\u70B9\uFF0C\u5C31\u80FD\u7FFB\u5F00\u4E3D\u6C5F\u7684\u62CD\u6444\u624B\u8BB0\u3002"
        },
        {
          title: "\u57CE\u5821\u4E0E\u96EA\u5C71\u516C\u8DEF",
          requirements: [
            {
              itemId: "gift_02",
              count: 1
            },
            {
              itemId: "dessert_04",
              count: 1
            }
          ],
          note: "\u62CD\u6444\u624B\u8BB0\u91CC\u5939\u7740\u57CE\u5821\u9884\u7EA6\u5355\u3001\u59CA\u59B9\u6E56\u4FBF\u7B7E\u548C\u4E00\u628A MINI \u8F66\u94A5\u5319\u3002\u627E\u5230\u4E09\u5904\u7EBF\u7D22\uFF0C\u518D\u8F93\u5165\u65E5\u671F\u5BC6\u7801\u3002"
        }
      ],
      instruction: "\u627E\u5230\u57CE\u5821\u3001\u59CA\u59B9\u6E56\u548C\u96EA\u5C71\u516C\u8DEF\u7684\u4E09\u5904\u6807\u8BB0\uFF0C\u518D\u8F93\u5165\u56DB\u4F4D\u65E5\u671F\u5BC6\u7801\u3002",
      hints: [
        "\u5148\u70B9\u753B\u9762\u91CC\u7684\u4E09\u5904\u6807\u8BB0\uFF0C\u7EBF\u7D22\u4F1A\u6536\u8FDB\u4E0B\u65B9\u7B14\u8BB0\u3002",
        "\u57CE\u5821\u9884\u7EA6\u5355\u5199\u7740 5 \u6708\uFF0C\u96EA\u5C71\u516C\u8DEF\u7684\u8F66\u94A5\u5319\u724C\u6807\u7740 22 \u65E5\u3002",
        "\u6708\u4EFD\u5728\u524D\u3001\u65E5\u671F\u5728\u540E\uFF0C\u5404\u5199\u4E24\u4F4D\uFF0C\u5BC6\u7801\u662F 0522\u3002\u4E5F\u53EF\u4EE5\u8DF3\u8FC7\u8C1C\u9898\uFF0C\u7EE7\u7EED\u73CD\u85CF\u8FD9\u6BB5\u56DE\u5FC6\u3002"
      ],
      puzzle: {
        kind: "find",
        solution: "0522",
        hotspots: [
          {
            id: "castle",
            label: "\u57CE\u5821\u9884\u7EA6\u5355",
            x: -180,
            y: 80,
            clue: "\u57CE\u5821\u9884\u7EA6\u5355\uFF1A5 \u6708 22 \u65E5\uFF0C\u7B2C\u4E00\u7AD9\u3002"
          },
          {
            id: "sister_lake",
            label: "\u59CA\u59B9\u6E56\u4FBF\u7B7E",
            x: 160,
            y: 20,
            clue: "\u59CA\u59B9\u6E56\u7684\u4FBF\u7B7E\uFF1A\u6708\u4EFD\u548C\u65E5\u671F\u90FD\u5199\u4E24\u4F4D\u3002"
          },
          {
            id: "mini",
            label: "MINI \u8F66\u94A5\u5319",
            x: -50,
            y: -110,
            clue: "\u96EA\u5C71\u516C\u8DEF\u7684\u8F66\u94A5\u5319\u724C\uFF1A\u65E5\u671F\u662F 22 \u65E5\uFF0C\u8EAB\u8FB9\u505C\u7740\u4E00\u8F86\u655E\u7BF7 MINI\u3002"
          }
        ]
      },
      replayVariants: [
        {
          id: "practice_card",
          instruction: "\u627E\u5230\u4E09\u5F20\u7EC3\u4E60\u5361\uFF0C\u6309\u63D0\u793A\u7EC4\u6210\u56DB\u4F4D\u7EC3\u4E60\u7801\u3002",
          hints: [
            "\u6807\u8BB0\u90FD\u8981\u70B9\u51FB\uFF0C\u6570\u5B57\u7EBF\u7D22\u4F1A\u8BB0\u5728\u7EC3\u4E60\u7B14\u8BB0\u4E2D\u3002",
            "A \u5361\u7ED9\u51FA\u524D\u4E24\u4F4D 24\uFF0CB \u5361\u7ED9\u51FA\u540E\u4E24\u4F4D 68\u3002",
            "\u4F9D\u6B21\u8F93\u5165 2468\uFF1B\u8FD9\u4E9B\u6570\u5B57\u4EC5\u4F9B\u7EC3\u4E60\uFF0C\u4E0D\u5173\u8054\u73B0\u5B9E\u65E5\u671F\u6216\u56DE\u5FC6\u4E8B\u5B9E\u3002"
          ],
          puzzle: {
            kind: "find",
            solution: "2468",
            hotspots: [
              { id: "practice_card_a", label: "\u7EC3\u4E60\u5361 A", x: -180, y: 80, clue: "\u7EC3\u4E60\u5361 A\uFF1A\u524D\u4E24\u4F4D\u662F 24\u3002" },
              { id: "practice_card_b", label: "\u7EC3\u4E60\u5361 B", x: 160, y: 20, clue: "\u7EC3\u4E60\u5361 B\uFF1A\u540E\u4E24\u4F4D\u662F 68\u3002" },
              { id: "practice_card_note", label: "\u7EC3\u4E60\u8BF4\u660E", x: -50, y: -110, clue: "\u8FD9\u7EC4\u53F7\u7801\u53EA\u5C5E\u4E8E\u7EC3\u4E60\uFF0C\u4E0D\u4EE3\u8868\u65E5\u671F\u6216\u771F\u5B9E\u56DE\u5FC6\u3002" }
            ]
          }
        }
      ],
      reward: {
        coins: 360,
        hearts: 180,
        energy: 35,
        scissors: 2
      },
      souvenir: {
        title: "\u4E3D\u6C5F\u65C5\u62CD\u82B1\u675F",
        artItemId: "flower_06",
        room: "bedroom",
        x: 160,
        y: -6
      }
    },
    {
      id: "leqing_wedding",
      memoryId: "anniversary",
      title: "\u4E50\u6E05 \xB7 \u8349\u576A\u5A5A\u793C",
      unlockLevel: 10,
      intro: "2026 \u5E74 10 \u6708 3 \u65E5\uFF0C\u6211\u4EEC\u5728\u4E50\u6E05\u529E\u8349\u576A\u5A5A\u793C\u3002\u51C6\u5907\u597D\u82B1\u95E8\u4E0E\u8A93\u8A00\uFF0C\u518D\u628A\u8349\u576A\u4E0A\u7684\u706F\u4E32\u70B9\u4EAE\u3002",
      steps: [
        {
          title: "\u8349\u576A\u4E0A\u7684\u82B1\u95E8",
          requirements: [
            {
              itemId: "flower_04",
              count: 1
            },
            {
              itemId: "coffee_03",
              count: 1
            }
          ],
          note: "\u82B1\u95E8\u548C\u5496\u5561\u51C6\u5907\u597D\u4E86\u3002\u518D\u5E26\u4E0A\u793C\u7269\u4E0E\u751C\u70B9\uFF0C\u5C31\u80FD\u8D70\u8FDB\u8349\u576A\u5A5A\u793C\u8FD9\u4E00\u9875\u3002"
        },
        {
          title: "\u4EA4\u6362\u5FC3\u610F",
          requirements: [
            {
              itemId: "gift_04",
              count: 1
            },
            {
              itemId: "dessert_04",
              count: 1
            }
          ],
          note: "\u793C\u7269\u548C\u751C\u70B9\u6446\u4E0A\u4E86\u684C\u3002\u65CB\u8F6C\u706F\u4E32\uFF0C\u8BA9\u5DE6\u4FA7\u5165\u53E3\u4E00\u8DEF\u4EAE\u5230\u53F3\u4E0B\u89D2\u7684\u82B1\u95E8\u3002"
        }
      ],
      instruction: "\u70B9\u4E00\u4E0B\u65CB\u8F6C\u4E00\u683C\uFF0C\u91D1\u8272\u8868\u793A\u5DF2\u901A\u7535\uFF1B\u628A\u8349\u576A\u5DE6\u4FA7\u5165\u53E3\u63A5\u5230\u53F3\u4E0B\u89D2\u7684\u82B1\u95E8\u3002",
      hints: [
        "\u706F\u4E32\u4ECE\u8349\u576A\u5DE6\u4FA7\u5165\u53E3\u8FDB\u5165\uFF0C\u5148\u6CBF\u7B2C\u4E00\u6392\u5411\u53F3\u3002",
        "\u5230\u53F3\u4E0A\u89D2\u540E\u5F80\u4E0B\u62D0\uFF0C\u7ECF\u8FC7\u7B2C\u4E8C\u6392\u53F3\u4FA7\uFF0C\u6700\u540E\u843D\u5230\u53F3\u4E0B\u89D2\u7684\u82B1\u95E8\u3002",
        "\u5148\u70B9\u91CD\u7F6E\u673A\u5173\uFF0C\u518D\u628A\u6BCF\u4E2A\u683C\u5B50\u70B9\u4E09\u6B21\uFF0C\u6700\u540E\u68C0\u67E5\u7EBF\u8DEF\u3002\u4E5F\u53EF\u4EE5\u8DF3\u8FC7\u8C1C\u9898\u3002"
      ],
      puzzle: {
        kind: "circuit",
        columns: 3,
        rows: 3,
        start: 0,
        end: 8,
        ports: [
          [
            3,
            1
          ],
          [
            3,
            1
          ],
          [
            3,
            2
          ],
          [
            0,
            2
          ],
          [
            1,
            3
          ],
          [
            0,
            2
          ],
          [
            0,
            1
          ],
          [
            0,
            2
          ],
          [
            0,
            1
          ]
        ],
        initial: [
          1,
          1,
          1,
          1,
          1,
          1,
          1,
          1,
          1
        ],
        solution: [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ]
      },
      replayVariants: [
        {
          id: "practice_circuit",
          instruction: "\u65CB\u8F6C 3\xD73 \u706F\u5149\u5361\u7247\uFF0C\u628A\u5DE6\u4E0A\u5165\u53E3\u63A5\u5230\u53F3\u4E0B\u82B1\u95E8\u3002",
          hints: [
            "\u76F8\u90BB\u683C\u5B50\u7684\u7AEF\u53E3\u9700\u8981\u65B9\u5411\u76F8\u5BF9\uFF0C\u706F\u5149\u624D\u4F1A\u8FDE\u901A\u3002",
            "\u5148\u6CBF\u7B2C\u4E00\u6392\u5411\u53F3\uFF0C\u5230\u53F3\u4E0A\u89D2\u540E\u5411\u4E0B\uFF0C\u518D\u6CBF\u53F3\u4FA7\u4E00\u8DEF\u63A5\u5230\u82B1\u95E8\u3002",
            "\u8FD9\u5C40\u7EC3\u4E60\u4F7F\u7528\u72EC\u7ACB\u521D\u6001\uFF1B\u9010\u683C\u65CB\u8F6C\u5E76\u68C0\u67E5\u82B1\u95E8\u662F\u5426\u4EAE\u8D77\u3002"
          ],
          puzzle: {
            kind: "circuit",
            columns: 3,
            rows: 3,
            start: 0,
            end: 8,
            ports: [[3, 1], [3, 1], [3, 2], [0, 2], [1, 3], [0, 2], [0, 1], [0, 2], [0, 1]],
            initial: [1, 2, 0, 3, 1, 2, 0, 3, 1],
            solution: [0, 0, 0, 0, 0, 0, 0, 0, 0]
          }
        }
      ],
      reward: {
        coins: 450,
        hearts: 220,
        energy: 40,
        scissors: 3
      },
      souvenir: {
        title: "\u8349\u576A\u5A5A\u793C\u7684\u8A93\u8A00\u5361",
        artItemId: "gift_07",
        room: "garden",
        x: 0,
        y: -6
      }
    }
  ];

  // assets/resources/config/small_dates.json
  var small_dates_default = [
    {
      id: "small_date_morning_coffee",
      title: "\u6668\u95F4\u5496\u5561",
      description: "\u4E0D\u7528\u7B49\u7279\u522B\u7684\u65E5\u5B50\uFF0C\u65E9\u8D77\u78E8\u4E00\u676F\u5496\u5561\uFF0C\u628A\u6E05\u6668\u7559\u7ED9\u5F7C\u6B64\u3002",
      memoryId: "letters",
      minLevel: 1,
      requirements: [
        {
          itemId: "coffee_02",
          count: 1
        },
        {
          itemId: "coffee_01",
          count: 1
        }
      ],
      rewardCoins: 16,
      rewardXp: 8,
      rewardHearts: 2
    },
    {
      id: "small_date_window_tea",
      title: "\u7A97\u8FB9\u4E0B\u5348\u8336",
      description: "\u628A\u751C\u70B9\u548C\u5496\u5561\u642C\u5230\u7A97\u8FB9\uFF0C\u770B\u4E00\u4F1A\u513F\u4E91\uFF0C\u4E5F\u8BF4\u4E00\u4F1A\u513F\u8BDD\u3002",
      memoryId: "first_trip",
      minLevel: 5,
      requirements: [
        {
          itemId: "coffee_03",
          count: 1
        },
        {
          itemId: "dessert_02",
          count: 1
        }
      ],
      rewardCoins: 20,
      rewardXp: 10,
      rewardHearts: 3
    },
    {
      id: "small_date_walk_flowers",
      title: "\u6563\u6B65\u5E26\u82B1",
      description: "\u6CBF\u7740\u719F\u6089\u7684\u5C0F\u8DEF\u6162\u6162\u8D70\uFF0C\u987A\u624B\u5E26\u4E00\u679D\u82B1\u56DE\u5BB6\u3002",
      memoryId: "shenxianju",
      minLevel: 3,
      requirements: [
        {
          itemId: "flower_02",
          count: 1
        },
        {
          itemId: "coffee_02",
          count: 1
        }
      ],
      rewardCoins: 18,
      rewardXp: 9,
      rewardHearts: 2
    },
    {
      id: "small_date_movie_night",
      title: "\u7535\u5F71\u5C0F\u591C\u665A",
      description: "\u6311\u4E00\u90E8\u8001\u7535\u5F71\uFF0C\u51C6\u5907\u4E00\u70B9\u751C\u70B9\uFF0C\u5173\u6389\u706F\u5C31\u662F\u4E00\u4E2A\u665A\u4E0A\u3002",
      memoryId: "new_year_balloons",
      minLevel: 5,
      requirements: [
        {
          itemId: "dessert_02",
          count: 1
        },
        {
          itemId: "coffee_01",
          count: 1
        }
      ],
      rewardCoins: 19,
      rewardXp: 9,
      rewardHearts: 3
    },
    {
      id: "small_date_shared_coffee",
      title: "\u4E00\u8D77\u78E8\u5496\u5561\u8C46",
      description: "\u628A\u5496\u5561\u8C46\u653E\u8FDB\u78E8\u8C46\u673A\uFF0C\u6162\u6162\u51C6\u5907\u4E00\u676F\u6E05\u6668\u5496\u5561\u3002",
      memoryId: "letters",
      minLevel: 1,
      requirements: [
        {
          itemId: "coffee_01",
          count: 2
        }
      ],
      rewardCoins: 16,
      rewardXp: 8,
      rewardHearts: 2
    },
    {
      id: "small_date_flower_window",
      title: "\u7A97\u53F0\u63D2\u82B1",
      description: "\u6311\u4E24\u679D\u559C\u6B22\u7684\u82B1\uFF0C\u6446\u5728\u7A97\u8FB9\u4E00\u8D77\u6574\u7406\u3002",
      memoryId: "shenxianju",
      minLevel: 3,
      requirements: [
        {
          itemId: "flower_02",
          count: 2
        }
      ],
      rewardCoins: 18,
      rewardXp: 9,
      rewardHearts: 2
    },
    {
      id: "small_date_shared_dessert",
      title: "\u5206\u7740\u5403\u751C\u70B9",
      description: "\u51C6\u5907\u51E0\u4EFD\u5C0F\u751C\u70B9\u548C\u5496\u5561\uFF0C\u5728\u5BB6\u91CC\u7559\u4E00\u6BB5\u60A0\u95F2\u65F6\u95F4\u3002",
      memoryId: "first_trip",
      minLevel: 5,
      requirements: [
        {
          itemId: "dessert_02",
          count: 1
        },
        {
          itemId: "coffee_02",
          count: 1
        }
      ],
      rewardCoins: 20,
      rewardXp: 10,
      rewardHearts: 3
    },
    {
      id: "small_date_garden_pause",
      title: "\u82B1\u56ED\u5C0F\u6B47",
      description: "\u5E26\u4E00\u679D\u82B1\u548C\u4E00\u4EFD\u751C\u70B9\uFF0C\u5728\u82B1\u56ED\u91CC\u5750\u4E00\u4F1A\u513F\u3002",
      memoryId: "shenxianju",
      minLevel: 5,
      requirements: [
        {
          itemId: "dessert_02",
          count: 1
        },
        {
          itemId: "flower_02",
          count: 1
        }
      ],
      rewardCoins: 18,
      rewardXp: 9,
      rewardHearts: 2
    }
  ];

  // assets/scripts/core/play/types.ts
  function createChapterProgress() {
    return { step: 0, found: [], selected: [], rotations: [], code: "", hints: 0, outcome: "playing", claimed: false };
  }
  function createReplayProgress(variantId = "classic") {
    return { found: [], selected: [], rotations: [], code: "", hints: 0, outcome: "playing", variantId };
  }
  function createReplayStats() {
    return { started: 0, solved: 0, skipped: 0, totalHints: 0, bestSolvedHints: null, legacyHistoryIncomplete: false };
  }
  function createSmallDateProgress() {
    return { currentId: "", rotation: 0, completed: 0 };
  }
  function itemBaseCost(level) {
    return level <= 1 ? 1 : 2 ** (level - 1);
  }
  function requirementsBaseCost(requirements, levelOf) {
    let total = 0;
    for (const req of requirements) {
      const level = levelOf(req.itemId);
      if (!level) return Number.POSITIVE_INFINITY;
      total += itemBaseCost(level) * req.count;
    }
    return total;
  }
  function circuitState(puzzle, rotations) {
    const ports = puzzle.ports.map((cell, i) => cell.map((p) => (p + (rotations[i] ?? puzzle.initial[i])) % 4));
    const lit = [];
    const queue = ports[puzzle.start]?.includes(3) ? [puzzle.start] : [];
    while (queue.length) {
      const index = queue.shift();
      if (lit.includes(index)) continue;
      lit.push(index);
      const row = Math.floor(index / puzzle.columns), column = index % puzzle.columns;
      for (const port of ports[index]) {
        const nr = row + [-1, 0, 1, 0][port], nc = column + [0, 1, 0, -1][port];
        if (nr < 0 || nc < 0 || nr >= puzzle.rows || nc >= puzzle.columns) continue;
        const next = nr * puzzle.columns + nc;
        if (ports[next].includes((port + 2) % 4) && !lit.includes(next)) queue.push(next);
      }
    }
    return { ports, lit, solved: lit.includes(puzzle.end) && ports[puzzle.end].includes(1) };
  }

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
    return Array.from(chains);
  }

  // assets/scripts/config/ConfigRepository.ts
  function nonEmptyText(value) {
    return typeof value === "string" && value.trim().length > 0;
  }
  function validPuzzleDefinition(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const puzzle = value;
    if (puzzle.kind === "find") {
      const hotspots = puzzle.hotspots;
      return typeof puzzle.solution === "string" && puzzle.solution.length === 4 && Array.from(puzzle.solution).every((digit) => digit >= "0" && digit <= "9") && Array.isArray(hotspots) && hotspots.length === 3 && new Set(hotspots.map((hotspot) => hotspot && typeof hotspot === "object" ? hotspot.id : void 0)).size === hotspots.length && hotspots.every((hotspot) => {
        if (!hotspot || typeof hotspot !== "object" || Array.isArray(hotspot)) return false;
        const entry = hotspot;
        return typeof entry.id === "string" && /^[a-z][a-z0-9_]*$/.test(entry.id) && nonEmptyText(entry.label) && nonEmptyText(entry.clue) && Number.isFinite(entry.x) && Number.isFinite(entry.y);
      });
    }
    if (puzzle.kind === "sequence") {
      const tiles = puzzle.tiles, solution = puzzle.solution;
      return Array.isArray(tiles) && tiles.length === 4 && Array.isArray(solution) && solution.length === tiles.length && new Set(tiles.map((tile) => tile && typeof tile === "object" ? tile.id : void 0)).size === tiles.length && new Set(solution).size === solution.length && tiles.every((tile) => {
        if (!tile || typeof tile !== "object" || Array.isArray(tile)) return false;
        const entry = tile;
        return typeof entry.id === "string" && /^[a-z][a-z0-9_]*$/.test(entry.id) && nonEmptyText(entry.label) && nonEmptyText(entry.clue) && solution.includes(entry.id);
      }) && solution.every((id) => tiles.some((tile) => tile.id === id));
    }
    if (puzzle.kind === "circuit") {
      const columns = puzzle.columns, rows = puzzle.rows, ports = puzzle.ports;
      const initial = puzzle.initial, solution = puzzle.solution;
      const start = puzzle.start, end = puzzle.end;
      if (columns !== 3 || rows !== 3 || !Array.isArray(ports) || ports.length !== 9 || !Array.isArray(initial) || initial.length !== 9 || !Array.isArray(solution) || solution.length !== 9 || ![...initial, ...solution].every((rotation) => Number.isInteger(rotation) && rotation >= 0 && rotation < 4) || !ports.every((cell) => Array.isArray(cell) && cell.length === 2 && new Set(cell).size === 2 && cell.every((port) => Number.isInteger(port) && port >= 0 && port < 4)) || !Number.isInteger(start) || start < 0 || start >= 9 || !Number.isInteger(end) || end < 0 || end >= 9) return false;
      const circuit = value;
      return circuitState(circuit, circuit.solution).solved && !circuitState(circuit, circuit.initial).solved;
    }
    return false;
  }
  function loadConfigBundle() {
    const game = game_default;
    const items = items_default;
    const generators = generators_default;
    const orders = orders_default;
    const progression = progression_default;
    const catalog = createItemCatalog(items);
    const memories = memories_default;
    const furniture = furniture_default;
    const wishes = wishes_default;
    const levelRewards = level_rewards_default;
    return {
      game,
      items,
      catalog,
      generators,
      orders,
      progression,
      memories,
      furniture,
      wishes,
      levelRewards,
      adventures: adventures_default,
      smallDates: small_dates_default
    };
  }
  function validateConfig(bundle) {
    const issues = [];
    const { game, items, catalog, generators, orders, progression, memories, furniture, wishes, levelRewards } = bundle;
    const couple = game.couple;
    if (couple && typeof couple === "object" && !Array.isArray(couple) && Object.prototype.hasOwnProperty.call(couple, "gift")) {
      const gift = couple.gift;
      if (!gift || typeof gift !== "object" || Array.isArray(gift)) {
        issues.push({ level: "error", message: "Couple gift must be a non-null object" });
      } else {
        for (const field of ["title", "salutation", "body", "signoff", "signature", "coverMessage"]) {
          if (Object.prototype.hasOwnProperty.call(gift, field) && typeof gift[field] !== "string") {
            issues.push({ level: "error", message: `Couple gift ${field} must be a string` });
          }
        }
      }
    }
    const seen = /* @__PURE__ */ new Set();
    for (const item of items) {
      if (seen.has(item.id)) {
        issues.push({ level: "error", message: `Duplicate item id: ${item.id}` });
      }
      seen.add(item.id);
      if (item.maxUses !== void 0 && (item.chainId !== "scissors" || !Number.isSafeInteger(item.maxUses) || item.maxUses <= 0)) issues.push({ level: "error", message: `Item ${item.id} invalid tool uses` });
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
      if (!Number.isSafeInteger(gen.purchaseCoins) || gen.purchaseCoins <= 0) issues.push({ level: "error", message: `Generator ${gen.id} purchase price invalid` });
      if (gen.recharge && (!Number.isInteger(gen.recharge.capacity) || gen.recharge.capacity < 1 || !Number.isFinite(gen.recharge.intervalMs) || gen.recharge.intervalMs <= 0 || gen.energyCost !== 0)) issues.push({ level: "error", message: `Generator ${gen.id} recharge invalid` });
      if (gen.recharge?.legacyCapacity !== void 0 && (!Number.isSafeInteger(gen.recharge.legacyCapacity) || gen.recharge.legacyCapacity < 1 || gen.recharge.legacyCapacity > gen.recharge.capacity)) issues.push({ level: "error", message: `Generator ${gen.id} legacy recharge capacity invalid` });
      if (gen.streakCooldown && (gen.recharge || !Number.isSafeInteger(gen.streakCooldown.uses) || gen.streakCooldown.uses < 1 || !Number.isSafeInteger(gen.streakCooldown.durationMs) || gen.streakCooldown.durationMs <= 0)) issues.push({ level: "error", message: `Generator ${gen.id} cooldown invalid` });
      if (gen.upgrade) {
        const upgrade = gen.upgrade;
        const validOutputs = (outputs, minLevel) => Array.isArray(outputs) && outputs.length > 0 && outputs.every((output) => {
          const item = catalog.get(output.itemId);
          return item?.chainId === gen.chainId && item.level >= minLevel && item.level <= Math.min(12, minLevel + 2) && Number.isFinite(output.weight) && output.weight > 0;
        });
        if (!Number.isSafeInteger(upgrade.maxLevel) || upgrade.maxLevel < 2 || upgrade.maxLevel > 8 || !Number.isFinite(upgrade.rechargeFactor) || upgrade.rechargeFactor <= 0 || upgrade.rechargeFactor > 1 || !Number.isSafeInteger(upgrade.boostEnergyMultiplier) || upgrade.boostEnergyMultiplier < 2 || !Array.isArray(upgrade.levels) || upgrade.levels.length !== upgrade.maxLevel - 1 || upgrade.levels.some((entry, index) => entry.level !== index + 2 || !validOutputs(entry.outputs, entry.level) || gen.energyCost > 0 && (!entry.boostOutputs || !validOutputs(entry.boostOutputs, entry.level)) || entry.boostOutputs !== void 0 && !validOutputs(entry.boostOutputs, entry.level))) {
          issues.push({ level: "error", message: `Generator ${gen.id} upgrade invalid` });
        }
      }
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
        const outputDefinition = catalog.get(out.itemId);
        if (outputDefinition && (outputDefinition.chainId !== gen.chainId || gen.upgrade && outputDefinition.level > 3)) {
          issues.push({ level: "error", message: `Generator ${gen.id} base output invalid: ${out.itemId}` });
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
      if (order.requirements.length < game.orders.minRequirements || order.requirements.length > game.orders.maxRequirements || order.requirements.some((requirement) => !Number.isSafeInteger(requirement.count) || requirement.count < 1) || order.requirements.reduce((sum, requirement) => sum + requirement.count, 0) > 2) {
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
    if (!game.collection || !Array.isArray(game.collection.chainIds) || !game.collection.chainIds.length || new Set(game.collection.chainIds).size !== game.collection.chainIds.length || game.collection.chainIds.some((id) => !byChain.has(id)) || !Number.isSafeInteger(game.collection.energyPerChain) || game.collection.energyPerChain <= 0 || !Number.isSafeInteger(game.collection.maxEnergyCap) || game.collection.maxEnergyCap < 1) issues.push({ level: "error", message: "Collection configuration invalid" });
    if (!Array.isArray(game.generationBonusDrops) || game.generationBonusDrops.some((drop) => drop.generatorId !== "*" && !generators.some((gen) => gen.id === drop.generatorId) || !catalog.has(drop.itemId) || !Number.isFinite(drop.chance) || drop.chance < 0 || drop.chance > 1 || !Number.isSafeInteger(drop.minLevel) || drop.minLevel < 1)) issues.push({ level: "error", message: "Generation bonus drops invalid" });
    if (items.filter((item) => item.wildcard).length !== 1 || items.some((item) => item.wildcard && (item.nextItemId || item.wildcardEligible))) issues.push({ level: "error", message: "Wildcard item invalid" });
    if (!game.board.unlocks?.length || game.board.unlocks.some((u, i, all) => !Number.isInteger(u.level) || !Number.isInteger(u.rows) || !Number.isInteger(u.columns) || u.level < 1 || u.rows < 1 || u.columns < 1 || u.rows > game.board.rows || u.columns > game.board.columns || i > 0 && (u.level <= all[i - 1].level || u.rows < all[i - 1].rows || u.columns < all[i - 1].columns))) issues.push({ level: "error", message: "Board unlocks invalid" });
    const rewards = game.rewards;
    if (!rewards || !Number.isFinite(rewards.chestDropChance) || rewards.chestDropChance < 0 || rewards.chestDropChance > 1 || !Number.isInteger(rewards.discoveryCoins) || rewards.discoveryCoins < 0 || !Array.isArray(rewards.chestLoot) || !rewards.chestLoot.length || rewards.chestLoot.some((entry) => !catalog.has(entry.itemId) || !Number.isFinite(entry.weight) || entry.weight <= 0) || !Array.isArray(rewards.exchangeOffers) || !rewards.exchangeOffers.length || rewards.exchangeOffers.some((entry) => !entry.id || !Number.isInteger(entry.diamonds) || entry.diamonds <= 0 || !Number.isInteger(entry.energy) || entry.energy <= 0) || !Array.isArray(rewards.checkIn) || rewards.checkIn.length !== 7 || rewards.checkIn.some((entry) => [entry.coins, entry.energy, entry.diamonds].some((n) => !Number.isInteger(n) || n < 0))) issues.push({ level: "error", message: "Rewards configuration invalid" });
    const chestItems = items.filter((item) => item.chainId === "treasure_chest").sort((a, b) => a.level - b.level);
    for (const chainId of ["coin", "energy", "diamond"]) {
      const supply = items.filter((item) => item.chainId === chainId).sort((a, b) => a.level - b.level);
      if (supply.length !== 5 || supply.some((item, index) => item.level !== index + 1 || item.id !== `${chainId}_0${index + 1}` || item.nextItemId !== supply[index + 1]?.id || (index === 4 ? item.maxLevel !== true : item.maxLevel === true) || !Number.isSafeInteger(item.useValue) || (item.useValue ?? 0) <= 0 || index > 0 && (item.useValue ?? 0) <= 2 * (supply[index - 1].useValue ?? 0))) {
        issues.push({ level: "error", message: `Supply chain ${chainId} invalid` });
      }
    }
    if (chestItems.length !== 5 || chestItems.some((item, index) => item.level !== index + 1 || item.id !== (index === 0 ? "treasure_chest" : `treasure_chest_0${index + 1}`) || item.maxLevel !== (index === 4) || item.nextItemId !== chestItems[index + 1]?.id || item.wildcardEligible === true)) {
      issues.push({ level: "error", message: "Treasure chest chain invalid" });
    }
    const validChestLoot = (loot) => Array.isArray(loot) && loot.length > 0 && loot.every((entry) => entry && typeof entry === "object" && typeof entry.itemId === "string" && ["coin", "energy", "diamond"].includes(catalog.get(entry.itemId)?.chainId ?? "") && Number.isFinite(entry.weight) && entry.weight > 0);
    if (!rewards || !validChestLoot(rewards.chestLoot) || !Array.isArray(rewards.chestLevels) || rewards.chestLevels.length !== 5 || rewards.chestLevels.some((entry, index) => !entry || entry.level !== index + 1 || !Number.isSafeInteger(entry.count) || entry.count < 1 || entry.count > 32 || index > 0 && entry.loot === void 0 || !validChestLoot(entry.loot ?? rewards.chestLoot))) {
      issues.push({ level: "error", message: "Treasure chest rewards invalid" });
    }
    if (!Number.isSafeInteger(game.orders.refreshCooldownMs) || game.orders.refreshCooldownMs <= 0 || !Number.isSafeInteger(game.orders.refreshDiamondCost) || game.orders.refreshDiamondCost <= 0) issues.push({ level: "error", message: "Order refresh configuration invalid" });
    if (!game.generatorRestore || !Number.isSafeInteger(game.generatorRestore.cooldownCost) || game.generatorRestore.cooldownCost < 1 || !Number.isSafeInteger(game.generatorRestore.chargeCost) || game.generatorRestore.chargeCost < 1) issues.push({ level: "error", message: "Generator restore configuration invalid" });
    const daily = game.rewards?.dailyTasks;
    if (!Array.isArray(daily) || daily.length !== 3 || new Set(daily.map((task) => task.id)).size !== daily.length || daily.some((task) => !/^[a-z][a-z0-9_]*$/.test(task.id) || !["orders", "merges", "specific"].includes(task.kind) || !task.title || !Number.isSafeInteger(task.target) || task.target <= 0 || !task.reward || [task.reward.coins, task.reward.xp, task.reward.energy, task.reward.diamonds].some((n) => !Number.isSafeInteger(n) || n < 0)) || new Set(daily.map((task) => task.kind)).size !== 3) issues.push({ level: "error", message: "Daily tasks configuration invalid" });
    if (game.energy.recoverIntervalMs <= 0) {
      issues.push({ level: "error", message: "Energy recoverIntervalMs invalid" });
    }
    if (game.energy.maxByLevel && (game.energy.maxByLevel.length !== progression.levels.length || game.energy.maxByLevel.some((n, i, a) => !Number.isSafeInteger(n) || n < 1 || n > 1e3 || i > 0 && n < a[i - 1]))) issues.push({ level: "error", message: "Energy capacity curve invalid" });
    const dynamicOrders = game.orders.dynamic;
    if (dynamicOrders && ([dynamicOrders.twoItemChance, dynamicOrders.rareChance, dynamicOrders.urgentChance].some((n) => !Number.isFinite(n) || n < 0 || n > 1) || !Number.isSafeInteger(dynamicOrders.urgentDurationMs) || dynamicOrders.urgentDurationMs <= 0 || !Number.isSafeInteger(dynamicOrders.rewardMultiplierMaxLevel) || dynamicOrders.rewardMultiplierMaxLevel < 1 || !Number.isFinite(dynamicOrders.rewardMultiplierMin) || !Number.isFinite(dynamicOrders.rewardMultiplierMax) || dynamicOrders.rewardMultiplierMin <= 0 || dynamicOrders.rewardMultiplierMax < dynamicOrders.rewardMultiplierMin)) issues.push({ level: "error", message: "Dynamic order configuration invalid" });
    for (const [name, values] of [
      ["memory", memories],
      ["furniture", furniture],
      ["wish", wishes]
    ]) {
      const ids = /* @__PURE__ */ new Set();
      for (const entry of values) {
        if (ids.has(entry.id)) issues.push({ level: "error", message: `Duplicate ${name} id: ${entry.id}` });
        ids.add(entry.id);
      }
    }
    if (memories.length === 0) {
      issues.push({ level: "error", message: "Memory content must not be empty" });
    }
    if (furniture.length < 10 || wishes.length !== 10) {
      issues.push({ level: "error", message: "Life content must have at least 10 furniture items and 10 wishes" });
    }
    for (const memory of memories) {
      if (memory.artMode !== void 0 && !["cover", "contain"].includes(memory.artMode)) {
        issues.push({ level: "error", message: `Memory ${memory.id} art mode invalid` });
      }
      if (memory.artFocusY !== void 0 && (!Number.isFinite(memory.artFocusY) || memory.artFocusY < 0 || memory.artFocusY > 1)) {
        issues.push({ level: "error", message: `Memory ${memory.id} art focus invalid` });
      }
      if (memory.heartCost <= 0) issues.push({ level: "error", message: `Memory ${memory.id} cost invalid` });
      if (typeof memory.art !== "string" || !/^[a-z][a-z0-9_]*(?:#\d{1,2})?$/.test(memory.art)) {
        issues.push({ level: "error", message: `Memory ${memory.id} art invalid` });
        continue;
      }
      const columns = memory.artColumns ?? 5;
      const rows = memory.artRows ?? 1;
      const frame = Number(memory.art.split("#")[1] ?? 0);
      if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 1 || rows < 1 || frame >= columns * rows) {
        issues.push({ level: "error", message: `Memory ${memory.id} atlas bounds invalid` });
      }
    }
    for (const item of furniture) {
      if (item.coinCost < 0 || item.unlockLevel < 1 || item.decorPoints <= 0) {
        issues.push({ level: "error", message: `Furniture ${item.id} invalid` });
      }
      if (!["living", "bedroom", "garden", "study", "terrace", "pool"].includes(item.room) || !item.placement || ![item.placement.x, item.placement.y, item.placement.width, item.placement.height].every(Number.isFinite) || item.placement.width <= 0 || item.placement.height <= 0) {
        issues.push({ level: "error", message: `Furniture ${item.id} placement invalid` });
      }
    }
    for (const wish of wishes) {
      if (wish.target <= 0 || wish.rewardCoins < 0 || wish.rewardHearts < 0) {
        issues.push({ level: "error", message: `Wish ${wish.id} invalid` });
      }
    }
    if (levelRewards.default.coinsPerLevel < 0 || levelRewards.default.heartsPerLevel < 0 || levelRewards.default.xp < 0) {
      issues.push({ level: "error", message: "Default level reward invalid" });
    }
    if (levelRewards.generatorRotation && (new Set(levelRewards.generatorRotation).size !== levelRewards.generatorRotation.length || levelRewards.generatorRotation.some((id) => !generators.some((generator) => generator.id === id)))) {
      issues.push({ level: "error", message: "Level generator reward rotation invalid" });
    }
    const specialLevels = /* @__PURE__ */ new Set();
    for (const reward of levelRewards.special) {
      if (specialLevels.has(reward.level) || reward.level < 2 || reward.coins < 0 || reward.hearts < 0 || reward.xp < 0) {
        issues.push({ level: "error", message: `Level reward ${reward.level} invalid` });
      }
      specialLevels.add(reward.level);
    }
    if (!Number.isInteger(game.toolbox?.warehouseSlots) || game.toolbox.warehouseSlots < 1 || game.toolbox.warehouseSlots > 6 || !Number.isInteger(game.toolbox.startingScissors) || game.toolbox.startingScissors < 0) issues.push({ level: "error", message: "Toolbox config invalid" });
    const chapterIds = /* @__PURE__ */ new Set();
    const chapterMemoryIds = /* @__PURE__ */ new Set();
    const souvenirKeys = /* @__PURE__ */ new Set();
    for (const c of bundle.adventures) {
      const p = c.puzzle;
      const unlockedAtLevel = new Set(collectUnlockChains(progression, c.unlockLevel));
      const souvenirKey = `${c.souvenir.room}:${c.souvenir.x}:${c.souvenir.y}`;
      const baseOk = /^[a-z][a-z0-9_]*$/.test(c.id) && !chapterIds.has(c.id) && memories.some((m) => m.id === c.memoryId) && !chapterMemoryIds.has(c.memoryId) && typeof c.title === "string" && c.title.trim().length > 0 && typeof c.intro === "string" && c.intro.trim().length > 0 && typeof c.instruction === "string" && c.instruction.trim().length > 0 && c.steps.length === 2 && c.hints.length === 3 && c.hints.every((hint) => typeof hint === "string" && hint.trim().length > 0) && Number.isInteger(c.unlockLevel) && c.unlockLevel >= 1 && c.unlockLevel <= 18 && Object.values(c.reward).every((n) => Number.isInteger(n) && n >= 0) && catalog.has(c.souvenir.artItemId) && ["living", "bedroom", "garden"].includes(c.souvenir.room) && typeof c.souvenir.title === "string" && c.souvenir.title.trim().length > 0 && Number.isFinite(c.souvenir.x) && Number.isFinite(c.souvenir.y) && !souvenirKeys.has(souvenirKey) && c.steps.every((s) => typeof s.title === "string" && typeof s.note === "string" && s.requirements.length > 0 && s.requirements.every((r) => {
        const def = catalog.get(r.itemId);
        return !!def && unlockedAtLevel.has(def.chainId) && Number.isInteger(r.count) && r.count > 0;
      }));
      chapterIds.add(c.id);
      chapterMemoryIds.add(c.memoryId);
      souvenirKeys.add(souvenirKey);
      let puzzleOk = false;
      if (p.kind === "find") puzzleOk = /^\d{4}$/.test(p.solution) && p.hotspots.length >= 2 && new Set(p.hotspots.map((h) => h.id)).size === p.hotspots.length && p.hotspots.every((h) => typeof h.label === "string" && h.label.trim().length > 0 && typeof h.clue === "string" && h.clue.trim().length > 0 && Number.isFinite(h.x) && Number.isFinite(h.y));
      if (p.kind === "sequence") puzzleOk = p.tiles.length >= 3 && p.tiles.length <= 6 && new Set(p.solution).size === p.tiles.length && p.solution.length === p.tiles.length && p.tiles.every((t) => p.solution.includes(t.id)) && p.tiles.every((t) => typeof t.label === "string" && t.label.trim().length > 0 && typeof t.clue === "string" && t.clue.trim().length > 0);
      if (p.kind === "circuit") {
        puzzleOk = p.columns === 3 && p.rows === 3 && p.ports.length === 9 && p.initial.length === 9 && p.solution.length === 9 && p.ports.every((ports) => ports.length === 2 && new Set(ports).size === 2 && ports.every((n) => Number.isInteger(n) && n >= 0 && n < 4)) && [...p.initial, ...p.solution].every((n) => Number.isInteger(n) && n >= 0 && n < 4) && Number.isInteger(p.start) && p.start >= 0 && p.start < 9 && Number.isInteger(p.end) && p.end >= 0 && p.end < 9;
        if (puzzleOk) puzzleOk = circuitState(p, p.solution).solved && !circuitState(p, p.initial).solved;
      }
      let variantsOk = c.replayVariants === void 0 || Array.isArray(c.replayVariants);
      const variantIds = /* @__PURE__ */ new Set(["classic"]);
      if (Array.isArray(c.replayVariants)) {
        for (const candidate of c.replayVariants) {
          if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
            variantsOk = false;
            continue;
          }
          const variant = candidate;
          const id = variant.id;
          const variantPuzzle = variant.puzzle;
          const variantPuzzleValid = validPuzzleDefinition(variantPuzzle);
          const sameKind = !puzzleOk || variantPuzzleValid && variantPuzzle.kind === p.kind;
          const hints = variant.hints;
          const valid = typeof id === "string" && /^[a-z][a-z0-9_]*$/.test(id) && !variantIds.has(id) && nonEmptyText(variant.instruction) && Array.isArray(hints) && hints.length === 3 && hints.every(nonEmptyText) && variantPuzzleValid && sameKind;
          if (typeof id === "string") variantIds.add(id);
          if (!valid) variantsOk = false;
        }
      }
      if (!baseOk || !puzzleOk || !variantsOk) issues.push({ level: "error", message: `Adventure ${c.id} invalid` });
    }
    if (bundle.smallDates.length < 4) {
      issues.push({ level: "error", message: "Small dates must provide at least 4 themes" });
    }
    const smallDateIds = /* @__PURE__ */ new Set();
    const levelOneChains = new Set(collectUnlockChains(progression, 1));
    let levelOneDate = false;
    for (const date of bundle.smallDates) {
      const cost = requirementsBaseCost(date.requirements, (id) => catalog.get(id)?.level);
      const dateOk = /^[a-z][a-z0-9_]*$/.test(date.id) && !smallDateIds.has(date.id) && typeof date.title === "string" && date.title.trim().length > 0 && typeof date.description === "string" && date.description.trim().length > 0 && typeof date.memoryId === "string" && date.memoryId.length > 0 && Number.isInteger(date.minLevel) && date.minLevel >= 1 && date.minLevel <= 18 && date.requirements.length > 0 && date.requirements.reduce((sum, requirement) => sum + requirement.count, 0) <= 2 && date.requirements.every((r) => {
        const def = catalog.get(r.itemId);
        return !!def && def.level <= 3 && Number.isInteger(r.count) && r.count > 0;
      }) && cost >= 2 && cost <= 8 && [date.rewardCoins, date.rewardXp, date.rewardHearts].every((n) => Number.isInteger(n) && n >= 0);
      smallDateIds.add(date.id);
      if (!dateOk) issues.push({ level: "error", message: `Small date ${date.id} invalid` });
      else if (!memories.some((m) => m.id === date.memoryId)) issues.push({ level: "warn", message: `Small date ${date.id} illustration memory missing` });
      if (date.minLevel <= 1 && date.requirements.length > 0 && date.requirements.every((r) => {
        const def = catalog.get(r.itemId);
        return !!def && levelOneChains.has(def.chainId);
      })) levelOneDate = true;
    }
    if (!levelOneDate) issues.push({ level: "error", message: "Small dates need an entry playable at level 1" });
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
      for (const handler of Array.from(set)) {
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
  function businessDayUtc8(timestampMs) {
    return Math.floor((timestampMs + 8 * 60 * 60 * 1e3) / 864e5);
  }

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

  // assets/scripts/gameplay/JournalService.ts
  function normalizeJournal(raw) {
    const value = raw && typeof raw === "object" ? raw : {};
    const entries = [];
    if (Array.isArray(value.entries)) for (const entry of value.entries) {
      if (!entry || !Number.isSafeInteger(entry.day) || typeof entry.text !== "string" || typeof entry.photoPath !== "string" || entries.some((e) => e.day === entry.day)) continue;
      entries.push({ day: entry.day, text: entry.text.slice(0, 2e3), photoPath: entry.photoPath, rewarded: entry.rewarded === true });
    }
    const claimed = entries.filter((entry) => entry.rewarded).map((entry) => entry.day);
    if (typeof value.lastRewardDay === "number" && Number.isSafeInteger(value.lastRewardDay)) claimed.push(value.lastRewardDay);
    return { entries, lastRewardDay: claimed.length ? Math.max(...claimed) : null };
  }
  var JournalService = class {
    constructor(raw, clock, energy, onChange) {
      this.clock = clock;
      this.energy = energy;
      this.onChange = onChange;
      this.data = normalizeJournal(raw);
    }
    get state() {
      return { entries: this.data.entries.map((e) => ({ ...e })), lastRewardDay: this.data.lastRewardDay };
    }
    today() {
      const value = this.data.entries.find((entry) => entry.day === businessDayUtc8(this.clock.now()));
      return value ? { ...value } : null;
    }
    entries() {
      return this.state.entries.sort((a, b) => b.day - a.day);
    }
    saveToday(text, photoPath) {
      text = text.trim();
      photoPath = photoPath.trim();
      if (!text) return { ok: false, reason: "NEED_TEXT" };
      if (text.length > 2e3) return { ok: false, reason: "TOO_LONG" };
      if (!photoPath) return { ok: false, reason: "NEED_PHOTO" };
      const day = businessDayUtc8(this.clock.now());
      const existing = this.data.entries.find((entry2) => entry2.day === day);
      const rewarded = !existing?.rewarded && (this.data.lastRewardDay === null || day > this.data.lastRewardDay);
      const amount = rewarded ? this.energy.maxEnergy : 0;
      const entry = { day, text, photoPath, rewarded: !!existing?.rewarded || rewarded };
      if (existing) Object.assign(existing, entry);
      else this.data.entries.push(entry);
      if (rewarded) {
        this.data.lastRewardDay = day;
        this.energy.add(amount);
      }
      this.onChange();
      return { ok: true, energy: amount, rewarded };
    }
  };

  // assets/scripts/infrastructure/SaveService.ts
  var SaveService = class {
    constructor(options) {
      this.options = options;
      this.timer = null;
      this.pending = null;
      this.debounceMs = options.debounceMs ?? 200;
    }
    load() {
      let raw;
      try {
        raw = this.options.storage.getItem(this.options.saveKey);
      } catch {
        return { ok: false, reason: "UNAVAILABLE", defaultData: this.options.createDefault() };
      }
      if (raw == null || raw === "") {
        return { ok: false, reason: "EMPTY", defaultData: this.options.createDefault() };
      }
      const loaded = this.parse(raw);
      if (loaded) {
        if (loaded.notice === "MIGRATED" && !this.backupCorrupt(raw)) {
          return { ok: false, reason: "UNAVAILABLE", defaultData: this.options.createDefault() };
        }
        return loaded;
      }
      let backup;
      try {
        backup = this.options.storage.getItem(`${this.options.saveKey}:backup`);
      } catch {
        return { ok: false, reason: "UNAVAILABLE", defaultData: this.options.createDefault() };
      }
      const recovered = backup ? this.parse(backup) : null;
      if (recovered) return { ...recovered, notice: "BACKUP_RESTORED" };
      return {
        ok: false,
        reason: "CORRUPT",
        defaultData: this.options.createDefault(),
        backupPreserved: backup === raw || this.backupCorrupt(raw)
      };
    }
    parse(raw) {
      try {
        const parsed = JSON.parse(raw);
        const migrated = this.migrate(parsed);
        if (!migrated) return null;
        const notice = parsed.version !== this.options.version ? "MIGRATED" : migrated.repaired ? "REPAIRED" : void 0;
        return { ok: true, ...migrated, notice };
      } catch {
        return null;
      }
    }
    save(data) {
      this.pending = data;
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      const payload = {
        ...data,
        version: this.options.version,
        savedAt: this.options.clock.now()
      };
      try {
        this.options.storage.setItem(this.options.saveKey, JSON.stringify(payload));
      } catch {
        const failed = { ok: false, reason: "STORAGE_UNAVAILABLE" };
        this.options.onWrite?.(failed);
        return failed;
      }
      this.pending = null;
      const result = { ok: true, savedAt: payload.savedAt };
      this.options.onWrite?.(result);
      return result;
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
      let repaired = parsed.version !== this.options.version;
      const defaults = this.options.createDefault();
      if (Object.keys(defaults).some((key) => !(key in parsed))) repaired = true;
      const version = typeof parsed.version === "number" ? parsed.version : 0;
      if (version < 1) {
        if (version !== 0) return null;
        repaired = true;
      }
      if (version > this.options.version) {
        return null;
      }
      const allowedCollection = new Set(this.options.collection?.chainIds ?? []);
      const claimedCollectionIds = Array.isArray(parsed.claimedCollectionIds) ? Array.from(new Set(parsed.claimedCollectionIds.filter((id) => typeof id === "string" && allowedCollection.has(id)))) : [];
      const collectionBonus = claimedCollectionIds.length * (this.options.collection?.energyPerChain ?? 0);
      const player = this.mergePlayer(parsed.player, defaults.player, version, collectionBonus);
      const overflow = [];
      const boardCells = this.mergeBoard(parsed.board, defaults.board, version, overflow);
      if (!boardCells) return null;
      const retainedOpenCellIndices = new Set(Array.isArray(parsed.retainedOpenCellIndices) ? parsed.retainedOpenCellIndices.filter((index) => Number.isInteger(index) && index >= 0 && index < defaults.board.length) : []);
      if (version < 7) {
        for (const cell of boardCells) if (cell.item) retainedOpenCellIndices.add(cell.index);
      }
      const activeOrders = Array.isArray(parsed.activeOrders) ? parsed.activeOrders.filter(isActiveOrder) : defaults.activeOrders;
      if (activeOrders.length !== defaults.activeOrders.length && activeOrders.length === 0) {
        repaired = true;
      }
      const tutorial = this.mergeTutorial(parsed.tutorial, defaults.tutorial);
      const life = this.mergeLife(parsed.life, defaults.life);
      const rawLife = parsed.life;
      const brokenSet = (value) => Array.isArray(value) && value.length === 1 && value[0] !== null && typeof value[0] === "object" && Object.keys(value[0]).length === 0;
      if (this.options.legacyStarterFurnitureId && brokenSet(rawLife?.ownedFurnitureIds) && brokenSet(rawLife?.placedFurnitureIds) && life.ownedFurnitureIds.length === 0 && life.placedFurnitureIds.length === 0) {
        life.ownedFurnitureIds = [this.options.legacyStarterFurnitureId];
        life.placedFurnitureIds = [this.options.legacyStarterFurnitureId];
        repaired = true;
      }
      if (version < 6) {
        const legacyMemoryRights = {
          anniversary: ["marriage_registration", "wedding_thanksgiving"],
          letters: ["zhoushan_bonfire"],
          night_view: ["qinwang_palace", "hengdian_hot_spring"],
          promise: ["huangshan_trip", "qiandao_lake", "wangchen_pavilion"],
          jeju_first: ["shanghai_departure"],
          barbie_summer: ["nanhu_boat"],
          snow_and_family: ["hengdian_family"],
          hangzhou_wedding: ["wedding_mv"],
          summer_before_wedding: ["concert", "xian_terracotta"]
        };
        for (const [oldId, rights] of Object.entries(legacyMemoryRights)) {
          if (life.unlockedMemoryIds.includes(oldId)) for (const id of rights) {
            if (!life.unlockedMemoryIds.includes(id)) life.unlockedMemoryIds.push(id);
          }
        }
      }
      const rawWarehouse = parsed.play?.warehouse;
      const legacyWarehouse = Array.isArray(rawWarehouse) ? rawWarehouse.filter((item) => !!item && typeof item === "object" && typeof item.uid === "string" && typeof item.definitionId === "string") : [];
      if (rawWarehouse !== void 0 && (!Array.isArray(rawWarehouse) || legacyWarehouse.length !== rawWarehouse.length)) repaired = true;
      const legacyItems = [...boardCells.flatMap((c) => c.item ? [c.item] : []), ...overflow, ...legacyWarehouse];
      const known = version < 6 ? legacyItems.map((item) => item.definitionId) : [];
      const strings = (v) => Array.isArray(v) ? Array.from(new Set(v.filter((x) => typeof x === "string"))) : [];
      const inbox = Array.isArray(parsed.rewardInbox) ? parsed.rewardInbox.filter((i) => i && typeof i.uid === "string" && typeof i.definitionId === "string") : [];
      const data = {
        version: this.options.version,
        savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : this.options.clock.now(),
        player,
        board: boardCells,
        legacyBoardEntitlement: version < 6 || parsed.legacyBoardEntitlement === true,
        retainedOpenCellIndices: Array.from(retainedOpenCellIndices).sort((a, b) => a - b),
        rewardInbox: [...overflow, ...inbox],
        discoveredItemIds: Array.from(/* @__PURE__ */ new Set([...strings(parsed.discoveredItemIds), ...known])),
        claimedDiscoveryIds: Array.from(/* @__PURE__ */ new Set([...strings(parsed.claimedDiscoveryIds), ...known])),
        generatorCharges: this.mergeGeneratorCharges(parsed.generatorCharges),
        generatorInventory: this.mergeGeneratorInventory(parsed.generatorInventory),
        generatorCooldowns: this.mergeGeneratorCooldowns(parsed.generatorCooldowns),
        claimedCollectionIds,
        orderRefreshAt: Array.isArray(parsed.orderRefreshAt) ? parsed.orderRefreshAt.map((v) => typeof v === "number" && Number.isFinite(v) ? v : null) : [],
        dailyTasks: this.mergeDailyTasks(parsed.dailyTasks),
        journal: normalizeJournal(parsed.journal),
        checkIn: { lastClaimDay: typeof parsed.checkIn?.lastClaimDay === "number" && Number.isFinite(parsed.checkIn.lastClaimDay) ? parsed.checkIn.lastClaimDay : null, claims: Math.max(0, Math.floor(num(parsed.checkIn?.claims, 0))) },
        activeOrders: activeOrders.length > 0 ? activeOrders : defaults.activeOrders,
        tutorial,
        recentOrderIds: Array.isArray(parsed.recentOrderIds) ? parsed.recentOrderIds.filter((x) => typeof x === "string") : [],
        life,
        preferences: this.mergePreferences(parsed.preferences, defaults.preferences),
        play: this.mergePlay(parsed.play, defaults.play, boardCells, version)
      };
      return { data, repaired };
    }
    mergePlayer(raw, fallback, version, collectionBonus) {
      if (!raw || typeof raw !== "object") return { ...fallback };
      const p = raw;
      const level = Math.max(1, Math.min(18, Math.floor(num(p.level, fallback.level))));
      const oldXp = Math.max(0, Math.floor(num(p.xp, fallback.xp)));
      let xp = oldXp;
      if (version === 1) {
        const oldFloors = [0, 30, 80, 150, 250];
        const oldFloor = oldFloors[Math.min(level - 1, 4)];
        const oldNext = oldFloors[level] ?? oldFloor;
        const newFloor = 25 * level * (level - 1);
        const progress = oldNext > oldFloor ? Math.min(1, Math.max(0, (oldXp - oldFloor) / (oldNext - oldFloor))) : 0;
        xp = newFloor + Math.round(progress * 50 * level) + (level >= 5 ? Math.max(0, oldXp - oldFloor) : 0);
      }
      const oldMax = Math.max(1, num(p.maxEnergy, fallback.maxEnergy));
      const oldEnergy = Math.max(0, num(p.energy, fallback.energy));
      const baseCap = this.options.energyCaps?.[Math.min(this.options.energyCaps.length - 1, level - 1)] ?? fallback.maxEnergy;
      const maxEnergy = Math.min(this.options.collection?.maxEnergyCap ?? Number.MAX_SAFE_INTEGER, baseCap + collectionBonus);
      const energy = Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, maxEnergy + oldEnergy - oldMax));
      return {
        level,
        xp,
        coins: Math.max(0, num(p.coins, fallback.coins)),
        diamonds: Math.max(0, num(p.diamonds, 0)),
        hearts: num(p.hearts, fallback.hearts),
        energy,
        maxEnergy,
        lastEnergyAt: num(p.lastEnergyAt, fallback.lastEnergyAt),
        unlockedChainIds: Array.isArray(p.unlockedChainIds) ? p.unlockedChainIds.filter((x) => typeof x === "string") : [...fallback.unlockedChainIds]
      };
    }
    mergeBoard(raw, fallback, version, overflow) {
      if (!Array.isArray(raw)) return fallback.map((c) => ({ ...c, item: c.item ? { ...c.item } : void 0 }));
      const oldWidth = version < 6 && raw.length === 81 ? 9 : version < 6 && raw.length === 63 ? 7 : version < 7 && raw.length === 48 ? 6 : 0;
      if (raw.length !== fallback.length && !oldWidth) return null;
      const cells = fallback.map((c) => ({ index: c.index }));
      for (let i = 0; i < raw.length; i += 1) {
        const cell = raw[i];
        if (!cell || typeof cell !== "object") return null;
        if (!cell.item) continue;
        if (typeof cell.item.uid !== "string" || typeof cell.item.definitionId !== "string") return null;
        const item = { ...cell.item, uid: cell.item.uid, definitionId: cell.item.definitionId };
        const row = oldWidth ? Math.floor(i / oldWidth) : Math.floor(i / 6);
        const column = oldWidth ? i % oldWidth : i % 6;
        if (row < fallback.length / 6 && column < 6) cells[row * 6 + column].item = item;
        else overflow.push(item);
      }
      return cells;
    }
    mergeDailyTasks(raw) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return void 0;
      const d = raw;
      if (!Number.isSafeInteger(d.day) || typeof d.targetItemId !== "string" || !d.progress || typeof d.progress !== "object" || Array.isArray(d.progress)) return void 0;
      const progress = /* @__PURE__ */ Object.create(null);
      for (const [key, value] of Object.entries(d.progress)) if (/^[a-z][a-z0-9_]*$/.test(key) && Number.isSafeInteger(value) && value >= 0) progress[key] = value;
      return { day: d.day, targetItemId: d.targetItemId, progress, claimedIds: Array.isArray(d.claimedIds) ? Array.from(new Set(d.claimedIds.filter((id) => typeof id === "string"))) : [] };
    }
    mergeGeneratorCooldowns(raw) {
      const result = /* @__PURE__ */ Object.create(null);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return result;
      for (const [id, value] of Object.entries(raw)) {
        if (!/^[a-z][a-z0-9_]*$/.test(id) || !value || typeof value !== "object" || Array.isArray(value)) continue;
        const state = value;
        if (Number.isSafeInteger(state.streak) && (state.streak ?? -1) >= 0 && (state.cooldownStartedAt === null || typeof state.cooldownStartedAt === "number" && Number.isFinite(state.cooldownStartedAt))) result[id] = { streak: state.streak, cooldownStartedAt: state.cooldownStartedAt };
      }
      return result;
    }
    mergeGeneratorInventory(raw) {
      const result = /* @__PURE__ */ Object.create(null);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return result;
      for (const [id, value] of Object.entries(raw)) {
        if (!/^[a-z][a-z0-9_]*$/.test(id) || !Array.isArray(value)) continue;
        const counts = Array.from({ length: 8 }, (_, index) => Number.isSafeInteger(value[index]) && value[index] >= 0 ? value[index] : 0);
        if (counts.some((count) => count > 0)) result[id] = counts;
      }
      return result;
    }
    mergeGeneratorCharges(raw) {
      const result = /* @__PURE__ */ Object.create(null);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return result;
      for (const [id, value] of Object.entries(raw)) {
        if (!/^[a-z][a-z0-9_]*$/.test(id) || !value || typeof value !== "object" || Array.isArray(value)) continue;
        const state = value;
        if (typeof state.charges === "number" && Number.isSafeInteger(state.charges) && state.charges >= 0 && typeof state.lastRecoveryAt === "number" && Number.isFinite(state.lastRecoveryAt)) result[id] = {
          charges: state.charges,
          lastRecoveryAt: state.lastRecoveryAt,
          ...typeof state.capacity === "number" && Number.isSafeInteger(state.capacity) && state.capacity > 0 ? { capacity: state.capacity } : {}
        };
      }
      return result;
    }
    mergePreferences(raw, fallback) {
      if (!raw || typeof raw !== "object") return { ...fallback };
      const value = raw;
      return {
        soundEnabled: typeof value.soundEnabled === "boolean" ? value.soundEnabled : fallback.soundEnabled,
        vibrationEnabled: typeof value.vibrationEnabled === "boolean" ? value.vibrationEnabled : fallback.vibrationEnabled
      };
    }
    mergePlay(raw, fallback, board, version) {
      const p = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
      const used = new Set(board.flatMap((cell) => cell.item ? [cell.item.uid] : []));
      const warehouse = (Array.isArray(p.warehouse) ? p.warehouse : []).filter((item) => {
        if (!item || typeof item.uid !== "string" || typeof item.definitionId !== "string" || used.has(item.uid)) return false;
        used.add(item.uid);
        return true;
      }).map((item) => ({ ...item, uid: item.uid, definitionId: item.definitionId }));
      const strings = (value) => Array.isArray(value) ? Array.from(new Set(value.filter((v) => typeof v === "string"))) : [];
      const puzzle = (value) => ({
        found: strings(value.found),
        selected: strings(value.selected),
        rotations: Array.isArray(value.rotations) && value.rotations.every((r) => Number.isInteger(r) && r >= 0 && r < 4) ? [...value.rotations] : [],
        code: typeof value.code === "string" && /^\d{0,16}$/.test(value.code) ? value.code : "",
        hints: Math.max(0, Math.floor(num(value.hints, 0))),
        outcome: value.outcome === "solved" || value.outcome === "skipped" ? value.outcome : "playing"
      });
      const chapters = /* @__PURE__ */ Object.create(null);
      if (p.chapters && typeof p.chapters === "object") for (const [id, value] of Object.entries(p.chapters)) {
        if (!value || typeof value !== "object" || !/^[a-z][a-z0-9_]*$/.test(id)) continue;
        chapters[id] = {
          ...puzzle(value),
          step: Math.max(0, Math.floor(num(value.step, 0))),
          claimed: value.claimed === true
        };
      }
      const replays = /* @__PURE__ */ Object.create(null);
      if (p.replays && typeof p.replays === "object" && !Array.isArray(p.replays)) {
        for (const [id, value] of Object.entries(p.replays)) {
          if (!value || typeof value !== "object" || Array.isArray(value) || !/^[a-z][a-z0-9_]*$/.test(id)) continue;
          const replay = value;
          const variantId = typeof replay.variantId === "string" && /^[a-z][a-z0-9_]*$/.test(replay.variantId) ? replay.variantId : "classic";
          replays[id] = { ...puzzle(replay), variantId };
        }
      }
      const nonNegativeInt = (value) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
      const replayStats = /* @__PURE__ */ Object.create(null);
      if (p.replayStats && typeof p.replayStats === "object" && !Array.isArray(p.replayStats)) {
        for (const [id, value] of Object.entries(p.replayStats)) {
          if (!value || typeof value !== "object" || Array.isArray(value) || !/^[a-z][a-z0-9_]*$/.test(id)) continue;
          const stats = value;
          const solved = nonNegativeInt(stats.solved);
          const skipped = nonNegativeInt(stats.skipped);
          const best = typeof stats.bestSolvedHints === "number" && Number.isSafeInteger(stats.bestSolvedHints) && stats.bestSolvedHints >= 0 ? stats.bestSolvedHints : null;
          const activeRun = replays[id]?.outcome === "playing" ? 1 : 0;
          replayStats[id] = {
            started: Math.max(nonNegativeInt(stats.started), solved + skipped + activeRun),
            solved,
            skipped,
            totalHints: nonNegativeInt(stats.totalHints),
            bestSolvedHints: solved > 0 ? best : null,
            legacyHistoryIncomplete: stats.legacyHistoryIncomplete === true || version < 5
          };
        }
      }
      for (const [id, replay] of Object.entries(replays)) {
        if (replayStats[id]) continue;
        const solved = replay.outcome === "solved" ? 1 : 0;
        const skipped = replay.outcome === "skipped" ? 1 : 0;
        const finished = solved + skipped > 0;
        replayStats[id] = {
          started: 1,
          solved,
          skipped,
          totalHints: finished ? replay.hints : 0,
          bestSolvedHints: solved ? replay.hints : null,
          legacyHistoryIncomplete: true
        };
      }
      const rawDate = p.smallDate && typeof p.smallDate === "object" && !Array.isArray(p.smallDate) ? p.smallDate : {};
      const smallDate = {
        currentId: typeof rawDate.currentId === "string" && /^[a-z][a-z0-9_]*$/.test(rawDate.currentId) ? rawDate.currentId : "",
        rotation: Math.max(0, Math.floor(num(rawDate.rotation, fallback.smallDate?.rotation ?? 0))),
        completed: Math.max(0, Math.floor(num(rawDate.completed, fallback.smallDate?.completed ?? 0)))
      };
      return {
        warehouse,
        scissors: Math.max(0, Math.floor(num(p.scissors, fallback.scissors))),
        chapters,
        replays,
        replayStats,
        smallDate
      };
    }
    mergeLife(raw, fallback) {
      if (!raw || typeof raw !== "object") return {
        ...fallback,
        stats: { ...fallback.stats }
      };
      const state = raw;
      const strings = (value) => Array.isArray(value) ? Array.from(new Set(value.filter((x) => typeof x === "string"))) : [];
      const claimedLevels = Array.isArray(state.claimedLevelRewards) ? Array.from(new Set(state.claimedLevelRewards.filter((x) => typeof x === "number" && Number.isInteger(x) && x >= 2 && x <= 18))) : [];
      return {
        furniturePositions: state.furniturePositions && typeof state.furniturePositions === "object" && !Array.isArray(state.furniturePositions) ? Object.fromEntries(Object.entries(state.furniturePositions).filter(([, p]) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1).map(([id, p]) => [id, {
          x: p.x,
          y: p.y,
          scale: typeof p.scale === "number" && Number.isFinite(p.scale) && p.scale >= 0.5 && p.scale <= 1.8 ? p.scale : 1,
          rotation: typeof p.rotation === "number" && Number.isFinite(p.rotation) && p.rotation >= -180 && p.rotation <= 180 ? p.rotation : 0,
          flipped: typeof p.flipped === "boolean" ? p.flipped : false
        }])) : {},
        unlockedMemoryIds: strings(state.unlockedMemoryIds),
        ownedFurnitureIds: strings(state.ownedFurnitureIds),
        placedFurnitureIds: strings(state.placedFurnitureIds),
        claimedWishIds: strings(state.claimedWishIds),
        claimedLevelRewards: claimedLevels,
        photoPaths: strings(state.photoPaths),
        stats: {
          spawns: Math.max(0, Math.floor(num(state.stats?.spawns, 0))),
          merges: Math.max(0, Math.floor(num(state.stats?.merges, 0))),
          orders: Math.max(0, Math.floor(num(state.stats?.orders, 0)))
        }
      };
    }
    mergeTutorial(raw, fallback) {
      if (!raw || typeof raw !== "object") return { ...fallback };
      const t = raw;
      return {
        generatorClicked: !!t.generatorClicked,
        firstMergeCompleted: !!t.firstMergeCompleted,
        firstOrderCompleted: !!t.firstOrderCompleted,
        firstOrderHintShown: !!t.firstOrderHintShown,
        ...Array.isArray(t.firstUseHints) ? { firstUseHints: Array.from(new Set(t.firstUseHints.filter((hint) => ["backpack", "scissors", "chest"].includes(hint)))) } : {}
      };
    }
    backupCorrupt(raw) {
      try {
        this.options.storage.setItem(`${this.options.saveKey}:backup`, raw);
        return true;
      } catch {
        return false;
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
      board[2].item = { uid: "start_c1c", definitionId: "coffee_01" };
      board[columns].item = { uid: "start_c1d", definitionId: "coffee_01" };
    }
    const player = {
      level: 1,
      xp: 0,
      coins: 0,
      diamonds: 0,
      hearts: 0,
      energy: config.energy.initialEnergy,
      maxEnergy: config.energy.maxEnergy,
      lastEnergyAt: savedAt,
      unlockedChainIds: ["coffee"]
    };
    return {
      version: config.saveVersion,
      savedAt,
      preferences: { soundEnabled: true, vibrationEnabled: true },
      player,
      play: {
        warehouse: [],
        scissors: config.toolbox.startingScissors,
        chapters: {},
        replays: {},
        replayStats: {},
        smallDate: { currentId: "", rotation: 0, completed: 0 }
      },
      board,
      legacyBoardEntitlement: false,
      retainedOpenCellIndices: [],
      rewardInbox: [],
      discoveredItemIds: ["coffee_01"],
      claimedDiscoveryIds: [],
      checkIn: { lastClaimDay: null, claims: 0 },
      generatorCharges: {},
      generatorInventory: {},
      generatorCooldowns: {},
      claimedCollectionIds: [],
      orderRefreshAt: [],
      activeOrders: [
        {
          uid: "order_start_1",
          templateId: "order_tutorial_coffee",
          requirements: [{ itemId: "coffee_02", count: 1 }],
          rewardCoins: 3,
          rewardXp: 10,
          rewardHearts: 1
        },
        {
          uid: "order_start_2",
          templateId: "order_coffee_pair",
          requirements: [{ itemId: "coffee_01", count: 1 }],
          rewardCoins: 5,
          rewardXp: 14,
          rewardHearts: 5
        },
        {
          uid: "order_start_3",
          templateId: "order_coffee_cup",
          requirements: [{ itemId: "coffee_03", count: 1 }],
          rewardCoins: 5,
          rewardXp: 12,
          rewardHearts: 5
        }
      ],
      tutorial: {
        generatorClicked: false,
        firstMergeCompleted: false,
        firstOrderCompleted: false,
        firstOrderHintShown: false
      },
      recentOrderIds: ["order_tutorial_coffee", "order_coffee_pair", "order_coffee_cup"],
      life: {
        furniturePositions: {},
        unlockedMemoryIds: [],
        ownedFurnitureIds: [],
        placedFurnitureIds: [],
        claimedWishIds: [],
        claimedLevelRewards: [],
        photoPaths: [],
        stats: { spawns: 0, merges: 0, orders: 0 }
      }
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
  function remainingToolUses(item, definition) {
    if (!definition.maxUses) return 0;
    return item.remainingUses === void 0 ? definition.maxUses : Math.min(
      definition.maxUses,
      Math.max(0, Math.floor(Number.isFinite(item.remainingUses) ? item.remainingUses : 0))
    );
  }
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
      const wildcardPair = sourceDef.wildcard === true !== (targetDef.wildcard === true);
      const ordinary = sourceDef.wildcard ? targetDef : sourceDef;
      if (wildcardPair && !ordinary.wildcardEligible) {
        return { ok: false, reason: "DIFFERENT_ITEM" };
      }
      if (!wildcardPair && source.definitionId !== target.definitionId) {
        return { ok: false, reason: "DIFFERENT_ITEM" };
      }
      if (ordinary.maxUses && (!remainingToolUses(source, ordinary) || !remainingToolUses(target, ordinary))) return { ok: false, reason: "DIFFERENT_ITEM" };
      if (!ordinary.nextItemId) {
        return { ok: false, reason: "MAX_LEVEL" };
      }
      const nextDef = this.catalog.get(ordinary.nextItemId);
      if (!nextDef) {
        return { ok: false, reason: "MISSING_DEFINITION" };
      }
      return {
        ok: true,
        item: {
          uid: nextUid,
          definitionId: nextDef.id,
          ...ordinary.maxUses && nextDef.maxUses ? { remainingUses: Math.max(1, Math.floor(
            (remainingToolUses(source, ordinary) + remainingToolUses(target, ordinary)) * nextDef.maxUses / (ordinary.maxUses * 2)
          )) } : {}
        },
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
    if (board.cells[from]?.locked || board.cells[to]?.locked) return { kind: "CANCEL" };
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
    const tool = catalog.get(source.definitionId), targetDefinition = catalog.get(target.definitionId);
    if (tool?.maxUses && targetDefinition?.chainId !== tool.chainId) {
      const uses = remainingToolUses(source, tool);
      const previous = Array.from(catalog.values()).find((item) => item.nextItemId === target.definitionId);
      if (uses <= 0 || !previous || targetDefinition?.maxUses || uses > 1 && !board.cells.some((cell) => !cell.locked && !cell.item)) return { kind: "CANCEL" };
      return { kind: "SPLIT", from, to };
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
    if (drop.kind === "SPLIT") {
      const tool = catalog.get(source.definitionId), target2 = next.cells[targetIndex].item;
      const previous = Array.from(catalog.values()).find((item) => item.nextItemId === target2.definitionId);
      const uses = remainingToolUses(source, tool);
      const extra = uses === 1 ? next.cells[from] : next.cells.find((cell) => !cell.locked && !cell.item);
      next.cells[from].item = uses === 1 ? void 0 : { ...source, remainingUses: uses - 1 };
      next.cells[targetIndex].item = { uid: target2.uid, definitionId: previous.id };
      extra.item = { uid: nextUid, definitionId: previous.id };
      return { ok: true, kind: "SPLIT", board: next };
    }
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
      this.unlockLevels = [];
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
    getLockedUnlockLevel(index) {
      return this.unlockLevels[index] || null;
    }
    configureUnlocks(level, unlocks, retainedIndices = []) {
      this.unlockLevels = this.board.cells.map((c) => unlocks.find((u) => Math.floor(c.index / this.board.columns) < u.rows && c.index % this.board.columns < u.columns)?.level ?? 0);
      const retained = new Set(retainedIndices);
      for (const cell of this.board.cells) cell.locked = !retained.has(cell.index) && (!this.unlockLevels[cell.index] || level < this.unlockLevels[cell.index]);
    }
    getRows() {
      return this.board.rows;
    }
    getColumns() {
      return this.board.columns;
    }
    getMergeHint() {
      const occupied = this.board.cells.filter((cell) => cell.item);
      for (let first = 0; first < occupied.length; first += 1) {
        for (let second = first + 1; second < occupied.length; second += 1) {
          const from = occupied[first];
          const to = occupied[second];
          if (this.previewDrop(from.index, to.index).kind === "MERGE" && from.item) {
            return { from: from.index, to: to.index, definitionId: from.item.definitionId };
          }
        }
      }
      return null;
    }
    replaceBoard(board, reason = "reset") {
      this.board = board;
      this.bus.emit("BOARD_CHANGED", { reason });
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
      if (result.kind === "SPLIT") {
        this.bus.emit("BOARD_CHANGED", { reason: "tool" });
        this.bus.emit("PLAY_CHANGED", { reason: "scissors" });
        return { ok: true, kind: "SPLIT", from, to: dest };
      }
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
      if (this.board.cells[index].item || this.board.cells[index].locked) return null;
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
    let energy = clampInt(input.energy, 0, Number.MAX_SAFE_INTEGER);
    const interval = Math.max(1, input.recoverIntervalMs);
    const now = Number.isFinite(input.now) ? input.now : input.lastEnergyAt;
    const last = Number.isFinite(input.lastEnergyAt) ? input.lastEnergyAt : now;
    if (energy >= maxEnergy) {
      return {
        energy,
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
      const before = this.player.energy;
      const result = spendEnergy(this.player.energy, cost);
      if (!result.ok) return result;
      this.player.energy = result.energy;
      if (before >= this.player.maxEnergy && this.player.energy < this.player.maxEnergy) {
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
      this.player.energy = Math.min(Number.MAX_SAFE_INTEGER, this.player.energy + Math.max(0, Math.floor(amount)));
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
    constructor(generators, catalog, board, energy, player, random, clock, chargeStates = {}, inventory = {}, cooldownStates = {}) {
      this.generators = generators;
      this.catalog = catalog;
      this.board = board;
      this.energy = energy;
      this.player = player;
      this.random = random;
      this.clock = clock;
      this.chargeStates = chargeStates;
      this.inventory = inventory;
      this.cooldownStates = cooldownStates;
      this.spawning = false;
      this.ensureUnlockedCharges();
    }
    ensureUnlockedCharges() {
      for (const gen of this.generators) {
        if (this.isUnlocked(gen) && !this.inventory[gen.id]) {
          this.inventory[gen.id] = Array.from({ length: gen.upgrade?.maxLevel ?? 1 }, (_, index) => index === 0 ? 1 : 0);
        }
        if (this.inventory[gen.id]) while (this.inventory[gen.id].length < (gen.upgrade?.maxLevel ?? 1)) this.inventory[gen.id].push(0);
        const savedCooldown = this.cooldownStates[gen.id];
        if (gen.streakCooldown && savedCooldown?.cooldownStartedAt != null && savedCooldown.streak < gen.streakCooldown.uses) {
          if (this.clock.now() >= savedCooldown.cooldownStartedAt + this.streakInterval(gen)) savedCooldown.streak = 0;
          savedCooldown.cooldownStartedAt = null;
        }
        if (!gen.recharge || !this.isUnlocked(gen)) continue;
        const rule = gen.recharge;
        if (!this.chargeStates[gen.id]) this.chargeStates[gen.id] = { charges: rule.capacity, lastRecoveryAt: this.clock.now(), capacity: rule.capacity };
        const saved = this.chargeStates[gen.id];
        const previousCapacity = saved.capacity ?? rule.legacyCapacity ?? rule.capacity;
        if (previousCapacity !== rule.capacity) {
          saved.charges = Math.max(0, Math.min(rule.capacity, saved.charges + rule.capacity - previousCapacity));
          if (saved.charges >= rule.capacity) saved.lastRecoveryAt = Math.max(this.clock.now(), saved.lastRecoveryAt);
        }
        saved.capacity = rule.capacity;
      }
    }
    activeLevel(gen) {
      const counts = this.inventory[gen.id] ?? [];
      for (let i = counts.length - 1; i >= 0; i--) if (counts[i] > 0) return i + 1;
      return 1;
    }
    interval(gen, level = this.activeLevel(gen)) {
      return gen.recharge ? Math.max(1, Math.round(gen.recharge.intervalMs * Math.pow(gen.upgrade?.rechargeFactor ?? 1, level - 1))) : 0;
    }
    streakInterval(gen, level = this.activeLevel(gen)) {
      return gen.streakCooldown ? Math.max(1, Math.round(gen.streakCooldown.durationMs * Math.pow(gen.upgrade?.rechargeFactor ?? 1, level - 1))) : 0;
    }
    getStatus(id) {
      const gen = this.get(id);
      if (!gen) return null;
      const unlocked = this.isUnlocked(gen), level = unlocked ? this.activeLevel(gen) : 0, rule = gen.recharge;
      const boostAvailable = unlocked && level > 1 && gen.energyCost > 0 && !!gen.upgrade?.levels.find((v) => v.level === level)?.boostOutputs;
      const cooldown = gen.streakCooldown ? this.cooldownStates[id] : void 0;
      const cooldownMs = gen.streakCooldown ? this.streakInterval(gen, level || 1) : unlocked ? this.interval(gen, level) : rule?.intervalMs ?? 0;
      const remainingCooldownMs = cooldown?.cooldownStartedAt == null ? 0 : Math.max(0, cooldown.cooldownStartedAt + cooldownMs - this.clock.now());
      const streak = cooldown?.cooldownStartedAt != null && remainingCooldownMs === 0 ? 0 : Math.min(gen.streakCooldown?.uses ?? 0, cooldown?.streak ?? 0);
      const base = {
        unlocked,
        level,
        maxLevel: gen.upgrade?.maxLevel ?? 1,
        inventory: [...this.inventory[id] ?? Array.from({ length: gen.upgrade?.maxLevel ?? 1 }, () => 0)],
        energyCost: gen.energyCost,
        boostAvailable,
        boostEnergyCost: boostAvailable ? gen.energyCost * (gen.upgrade?.boostEnergyMultiplier ?? 2) : null,
        cooldownMs,
        streak,
        streakLimit: gen.streakCooldown?.uses ?? 0,
        remainingCooldownMs
      };
      if (!rule) return { ...base, charges: null, maxCharges: null, nextRecoveryMs: null };
      if (!unlocked) return { ...base, charges: null, maxCharges: rule.capacity, nextRecoveryMs: null };
      const saved = this.chargeStates[id];
      if (!saved) return { ...base, charges: rule.capacity, maxCharges: rule.capacity, nextRecoveryMs: null };
      const elapsed = Math.max(0, this.clock.now() - saved.lastRecoveryAt), interval = this.interval(gen, level);
      const restored = Math.floor(elapsed / interval);
      const charges = Math.min(rule.capacity, saved.charges + restored);
      const anchor = saved.lastRecoveryAt + restored * interval;
      return { ...base, charges, maxCharges: rule.capacity, nextRecoveryMs: charges >= rule.capacity ? null : Math.max(0, anchor + interval - this.clock.now()) };
    }
    merge(id, level) {
      const gen = this.get(id);
      if (!gen) return { ok: false, reason: "NOT_FOUND" };
      if (!this.isUnlocked(gen)) return { ok: false, reason: "LOCKED" };
      if (!Number.isInteger(level) || level < 1 || level >= (gen.upgrade?.maxLevel ?? 1)) return { ok: false, reason: "MAX_LEVEL" };
      const inventory = this.inventory[id];
      if (!inventory || (inventory[level - 1] ?? 0) < 2) return { ok: false, reason: "NOT_ENOUGH_GENERATORS" };
      const previousLevel = this.activeLevel(gen), oldInterval = this.interval(gen, previousLevel);
      const saved = this.chargeStates[id], status = this.getStatus(id);
      if (saved && status && status.charges !== null && gen.recharge) {
        const now2 = this.clock.now(), elapsed = Math.max(0, now2 - saved.lastRecoveryAt), steps = Math.floor(elapsed / oldInterval);
        const anchor = saved.lastRecoveryAt + steps * oldInterval;
        saved.charges = status.charges;
        saved.lastRecoveryAt = status.charges >= gen.recharge.capacity ? Math.max(now2, saved.lastRecoveryAt) : anchor;
      }
      inventory[level - 1] -= 2;
      inventory[level] = (inventory[level] ?? 0) + 1;
      const newInterval = this.interval(gen), now = this.clock.now();
      if (saved && gen.recharge && saved.charges < gen.recharge.capacity && newInterval !== oldInterval && now > saved.lastRecoveryAt) {
        const progress = now - saved.lastRecoveryAt;
        saved.lastRecoveryAt = now - Math.floor(progress * newInterval / oldInterval);
      }
      return { ok: true, level: level + 1 };
    }
    grantLevelReward(level, rotation) {
      const eligible = rotation.map((id) => this.get(id)).filter((g) => !!g && this.isUnlocked(g));
      if (!eligible.length) return null;
      const gen = eligible[(level - 2) % eligible.length];
      this.ensureUnlockedCharges();
      this.inventory[gen.id][0] += 1;
      return gen.id;
    }
    grantPurchased(id) {
      const gen = this.get(id);
      if (!gen) return { ok: false, reason: "NOT_FOUND" };
      if (!this.isUnlocked(gen)) return { ok: false, reason: "LOCKED" };
      this.ensureUnlockedCharges();
      this.inventory[id][0] += 1;
      return { ok: true, inventory: [...this.inventory[id]] };
    }
    getInventory() {
      return Object.fromEntries(Object.entries(this.inventory).map(([id, counts]) => [id, [...counts]]));
    }
    getCooldownStates() {
      return Object.fromEntries(Object.entries(this.cooldownStates).map(([id, state]) => [id, { ...state }]));
    }
    restoreExhausted(id) {
      if (this.spawning) return { ok: false, reason: "IN_PROGRESS" };
      const generator = this.get(id);
      if (!generator) return { ok: false, reason: "NOT_FOUND" };
      const status = this.getStatus(id);
      if (!status.unlocked) return { ok: false, reason: "LOCKED" };
      if (generator.recharge) {
        if (status.charges !== 0) return { ok: false, reason: "NOT_NEEDED" };
        const saved = this.chargeStates[id];
        if (!saved) return { ok: false, reason: "NOT_NEEDED" };
        saved.charges = generator.recharge.capacity;
        saved.capacity = generator.recharge.capacity;
        saved.lastRecoveryAt = Math.max(this.clock.now(), saved.lastRecoveryAt);
        return { ok: true, kind: "charges", restoredUses: generator.recharge.capacity };
      }
      if (!generator.streakCooldown || status.remainingCooldownMs <= 0 || status.streak < generator.streakCooldown.uses) return { ok: false, reason: "NOT_NEEDED" };
      this.cooldownStates[id] = { streak: 0, cooldownStartedAt: null };
      return { ok: true, kind: "cooldown", restoredUses: generator.streakCooldown.uses };
    }
    spendCharge(gen) {
      const rule = gen.recharge;
      if (!rule) return null;
      this.ensureUnlockedCharges();
      const saved = this.chargeStates[gen.id];
      const previous = { ...saved };
      const now = this.clock.now();
      const elapsed = Math.max(0, now - saved.lastRecoveryAt);
      const interval = this.interval(gen);
      const steps = Math.floor(elapsed / interval);
      const charges = Math.min(rule.capacity, saved.charges + steps);
      saved.charges = charges - 1;
      saved.lastRecoveryAt = charges === rule.capacity ? Math.max(now, saved.lastRecoveryAt) : saved.lastRecoveryAt + steps * interval;
      return previous;
    }
    getChargeStates() {
      return Object.fromEntries(Object.entries(this.chargeStates).map(([id, state]) => [id, { ...state }]));
    }
    list() {
      return this.generators;
    }
    get(id) {
      return this.generators.find((g) => g.id === id);
    }
    isUnlocked(generator) {
      return this.player.level >= generator.unlockLevel || this.player.unlockedChainIds.includes(generator.chainId);
    }
    rollOutput(generator, level = 1, boost = false) {
      const upgrade = generator.upgrade?.levels.find((v) => v.level === level);
      return pickWeighted((boost ? upgrade?.boostOutputs : upgrade?.outputs) ?? generator.outputs, this.random);
    }
    spawn(generatorId, boost = false) {
      if (this.spawning) return { ok: false, reason: "IN_PROGRESS" };
      this.spawning = true;
      try {
        return this.spawnOnce(generatorId, boost);
      } finally {
        this.spawning = false;
      }
    }
    spawnOnce(generatorId, boost) {
      const generator = this.get(generatorId);
      if (!generator) {
        return { ok: false, reason: "UNKNOWN_GENERATOR" };
      }
      if (!this.isUnlocked(generator)) {
        return { ok: false, reason: "LOCKED" };
      }
      const status = this.getStatus(generatorId);
      if (status.remainingCooldownMs > 0) return { ok: false, reason: "GENERATOR_COOLDOWN" };
      if (boost && !status.boostAvailable) return { ok: false, reason: "BOOST_UNAVAILABLE" };
      const energyCost = generator.energyCost * (boost ? generator.upgrade?.boostEnergyMultiplier ?? 2 : 1);
      if (generator.recharge && status.charges === 0) return { ok: false, reason: "NO_CHARGES" };
      if (!this.energy.canSpend(energyCost)) {
        return { ok: false, reason: "NOT_ENOUGH_ENERGY" };
      }
      if (this.board.isFull()) {
        return { ok: false, reason: "BOARD_FULL" };
      }
      const output = this.rollOutput(generator, status.level, boost);
      if (!output || !this.catalog.has(output.itemId)) {
        return { ok: false, reason: "UNKNOWN_GENERATOR" };
      }
      const previousCharge = this.spendCharge(generator);
      const spend = energyCost > 0 ? this.energy.spend(energyCost) : { ok: true };
      if (!spend.ok) {
        if (previousCharge) this.chargeStates[generator.id] = previousCharge;
        return spend;
      }
      if (energyCost > 0 && this.player.energy < this.player.maxEnergy) {
        if (!this.player.lastEnergyAt) {
          this.player.lastEnergyAt = this.clock.now();
        }
      }
      const spawned = this.board.spawn(output.itemId);
      if (!spawned.ok) {
        if (previousCharge) this.chargeStates[generator.id] = previousCharge;
        if (energyCost > 0) this.energy.add(energyCost);
        return { ok: false, reason: "BOARD_FULL" };
      }
      if (generator.streakCooldown) {
        const streak = status.streak + 1;
        this.cooldownStates[generatorId] = { streak, cooldownStartedAt: streak >= generator.streakCooldown.uses ? this.clock.now() : null };
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
  function requirementSignature(requirements) {
    const totals = /* @__PURE__ */ new Map();
    for (const req of requirements) totals.set(req.itemId, (totals.get(req.itemId) ?? 0) + req.count);
    return Array.from(totals.entries()).sort(([first], [second]) => first.localeCompare(second)).map(([itemId, count]) => `${itemId}x${count}`).join("|");
  }
  function instantiateOrder(template, uid) {
    const requirements = template.requirements.map((r) => ({
      itemId: r.itemId,
      count: r.count
    }));
    return {
      uid,
      templateId: template.id,
      ...template.longTerm === true ? { longTerm: true } : {},
      requirements,
      rewardCoins: template.rewardCoins,
      rewardXp: template.rewardXp,
      rewardHearts: template.rewardHearts
    };
  }
  var DEFAULT_DYNAMIC_ORDER_CONFIG = {
    twoItemChance: 0.3,
    rareChance: 0.2,
    urgentChance: 0.1,
    urgentDurationMs: 30 * 6e4,
    rewardMultiplierMin: 1.2,
    rewardMultiplierMax: 1.8,
    rewardMultiplierMaxLevel: 18
  };
  function generateOrder(input) {
    const unlocked = new Set(input.player.unlockedChainIds);
    const limited = new Set(input.limitedChainIds ?? []);
    const hasLimited = (requirements2) => requirements2.some((r) => {
      const def = input.catalog.get(r.itemId);
      return !!def && limited.has(def.chainId);
    });
    const active = input.activeOrders ?? [];
    const occupiedLimited = active.some((order) => hasLimited(order.requirements));
    const maxLevel = Math.min(input.maxItemLevel, 3 + Math.floor((Math.max(1, input.player.level) - 1) / 4));
    const items = Array.from(input.catalog.values()).filter((item) => {
      const floor = Math.max(input.minItemLevel, input.minimumLevelForChain?.(item.chainId) ?? 1);
      return (input.canProduceItem?.(item.id) ?? true) && unlocked.has(item.chainId) && item.level >= floor && item.level <= Math.max(maxLevel, floor);
    });
    const common = items.filter((item) => !limited.has(item.chainId));
    const rare = items.filter((item) => limited.has(item.chainId));
    if (!common.length) return null;
    const level = input.player.level;
    const dynamic = input.dynamic ?? DEFAULT_DYNAMIC_ORDER_CONFIG;
    const count = input.random.next() < dynamic.twoItemChance ? 2 : 1;
    const wantsRare = !occupiedLimited && rare.length > 0 && input.random.next() < dynamic.rareChance;
    const candidates = [];
    if (count === 1) {
      for (const item of wantsRare ? rare : common) candidates.push([{ itemId: item.id, count: 1 }]);
    } else if (wantsRare) {
      for (const item of rare) {
        candidates.push([{ itemId: item.id, count: 2 }]);
        for (const other of common) candidates.push([{ itemId: item.id, count: 1 }, { itemId: other.id, count: 1 }]);
      }
    } else {
      for (let i = 0; i < common.length; i++) {
        candidates.push([{ itemId: common[i].id, count: 2 }]);
        for (let j = i + 1; j < common.length; j++) candidates.push([{ itemId: common[i].id, count: 1 }, { itemId: common[j].id, count: 1 }]);
      }
    }
    const affordable = candidates.filter((requirements2) => {
      const costs = /* @__PURE__ */ new Map();
      for (const req of requirements2) {
        const item = input.catalog.get(req.itemId);
        const floor = Math.max(input.minItemLevel, input.minimumLevelForChain?.(item.chainId) ?? 1);
        costs.set(item.chainId, (costs.get(item.chainId) ?? 0) + 2 ** Math.max(0, item.level - floor) * req.count);
      }
      return Array.from(costs.entries()).every(([chain, cost2]) => cost2 <= (input.maxMergeCostForChain?.(chain) ?? Infinity));
    });
    const activeSignatures = new Set(active.map((order) => requirementSignature(order.requirements)));
    const replacing = input.replacingRequirements && requirementSignature(input.replacingRequirements);
    const byId = new Map(input.templates.map((template) => [template.id, template]));
    const recentIds = new Set(input.recentOrderIds.slice(-3).map((id) => {
      const old = byId.get(id);
      return old ? `dynamic:${requirementSignature(old.requirements)}` : id;
    }));
    const notOccupied = affordable.filter((rows) => !activeSignatures.has(requirementSignature(rows)));
    const different = notOccupied.filter((rows) => requirementSignature(rows) !== replacing);
    const preferred = different.filter((rows) => !recentIds.has(`dynamic:${requirementSignature(rows)}`));
    const pool = preferred.length ? preferred : different.length ? different : notOccupied.length ? notOccupied : affordable;
    const requirements = pool[input.random.pickIndex(pool.length)];
    if (!requirements) return null;
    const cost = requirements.reduce((sum, req) => sum + 2 ** ((input.catalog.get(req.itemId)?.level ?? 1) - 1) * req.count, 0);
    const multiplier = dynamic.rewardMultiplierMin + (dynamic.rewardMultiplierMax - dynamic.rewardMultiplierMin) * (Math.min(dynamic.rewardMultiplierMaxLevel, Math.max(1, level)) - 1) / Math.max(1, dynamic.rewardMultiplierMaxLevel - 1);
    return {
      uid: input.id,
      templateId: `dynamic:${requirementSignature(requirements)}`,
      requirements,
      ...level >= 15 && hasLimited(requirements) ? { longTerm: true } : {},
      rewardCoins: Math.ceil(cost * multiplier),
      rewardXp: Math.max(6, cost * 2 + 6),
      rewardHearts: Math.max(1, Math.ceil(cost / 2))
    };
  }
  function generateTutorialOrder(templates, id) {
    const template = templates.find((t) => t.tutorialOnly) ?? templates[0];
    if (!template) return null;
    return instantiateOrder(template, id);
  }

  // assets/scripts/gameplay/OrderService.ts
  var OrderService = class {
    constructor(templates, catalog, board, player, progression, random, ids, bus, slots, minItemLevel, maxItemLevel, limitedChainIds = [], clock = new SystemClockService(), dynamic = DEFAULT_DYNAMIC_ORDER_CONFIG, projectItem = (id) => id, minimumLevelForChain = () => 1, canProduceItem = () => true, maxMergeCostForChain = () => Infinity) {
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
      this.limitedChainIds = limitedChainIds;
      this.clock = clock;
      this.dynamic = dynamic;
      this.projectItem = projectItem;
      this.minimumLevelForChain = minimumLevelForChain;
      this.canProduceItem = canProduceItem;
      this.maxMergeCostForChain = maxMergeCostForChain;
      this.orders = [];
      this.recentOrderIds = [];
    }
    hydrate(orders, recentOrderIds) {
      this.orders = orders.map((o) => ({
        ...o,
        ...o.longTerm === true || this.templates.find((t) => t.id === o.templateId)?.longTerm === true ? { longTerm: true } : {},
        requirements: o.requirements.map((r) => ({ ...r }))
      }));
      this.recentOrderIds = [...recentOrderIds];
      const limit = 2;
      for (const order of this.orders) {
        const valid = order.requirements.filter((r) => r && typeof r.itemId === "string" && this.catalog.has(r.itemId) && Number.isSafeInteger(r.count) && r.count > 0);
        let remaining = limit;
        order.requirements = valid.flatMap((requirement) => {
          const count = Math.min(remaining, requirement.count);
          remaining -= count;
          return count > 0 ? [{ itemId: requirement.itemId, count }] : [];
        });
      }
      for (let index = 0; index < this.orders.length; index++) {
        if (this.orders[index].requirements.length) continue;
        const replacement = this.createNextOrder(false, this.orders[index].uid);
        if (replacement) this.orders[index] = replacement;
      }
      this.orders = this.orders.filter((order) => order.requirements.length > 0);
      this.reconcileRequirements();
    }
    reconcileRequirements() {
      for (const order of this.orders) {
        if (this.board.findItemsForRequirements(order.requirements)) continue;
        if (order.requirements.some((req) => !this.canProduceItem(req.itemId) || !this.player.unlockedChainIds.includes(this.catalog.get(req.itemId)?.chainId ?? ""))) {
          const replacement = this.createNextOrder(false, order.uid);
          if (replacement) {
            order.requirements = replacement.requirements;
            order.templateId = replacement.templateId;
            delete order.longTerm;
            this.bus.emit("ORDER_UPDATED", { orderUid: order.uid });
          }
        }
        let changed = false;
        const counts = /* @__PURE__ */ new Map();
        for (const requirement of order.requirements) {
          const itemId = this.projectItem(requirement.itemId);
          if (itemId !== requirement.itemId) changed = true;
          counts.set(itemId, (counts.get(itemId) ?? 0) + requirement.count);
        }
        if (changed) order.requirements = Array.from(counts.entries()).map(([itemId, count]) => ({ itemId, count }));
        if (changed) this.bus.emit("ORDER_UPDATED", { orderUid: order.uid });
      }
    }
    getOrders() {
      return this.orders.map((o) => {
        const copy = { ...o, requirements: o.requirements.map((r) => ({ ...r })) };
        if (copy.urgentUntil !== void 0 && this.clock.now() >= copy.urgentUntil) {
          if (copy.urgentBaseCoins !== void 0) copy.rewardCoins = copy.urgentBaseCoins;
          if (copy.urgentBaseXp !== void 0) copy.rewardXp = copy.urgentBaseXp;
          if (copy.urgentBaseHearts !== void 0) copy.rewardHearts = copy.urgentBaseHearts;
          delete copy.urgentUntil;
          delete copy.urgentBaseCoins;
          delete copy.urgentBaseXp;
          delete copy.urgentBaseHearts;
        }
        return copy;
      });
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
    createNextOrder(forceTutorial = false, replacingUid) {
      const order = forceTutorial ? generateTutorialOrder(this.templates, this.ids.next()) : generateOrder({
        player: this.player,
        templates: this.templates,
        catalog: this.catalog,
        recentOrderIds: this.recentOrderIds,
        activeOrders: this.orders.filter((order2) => order2.uid !== replacingUid),
        dynamic: this.dynamic,
        replacingRequirements: this.orders.find((order2) => order2.uid === replacingUid)?.requirements,
        minItemLevel: this.minItemLevel,
        maxItemLevel: this.maxItemLevel,
        minimumLevelForChain: this.minimumLevelForChain,
        canProduceItem: this.canProduceItem,
        maxMergeCostForChain: this.maxMergeCostForChain,
        limitedChainIds: this.limitedChainIds,
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
    getSlot(orderUid) {
      return this.orders.findIndex((order) => order.uid === orderUid);
    }
    refresh(orderUid) {
      const index = this.getSlot(orderUid);
      if (index < 0) return { ok: false, reason: "ORDER_NOT_FOUND" };
      const replacement = this.createNextOrder(false, orderUid);
      if (!replacement) return { ok: false, reason: "NO_REPLACEMENT" };
      this.orders[index] = replacement;
      this.bus.emit("ORDER_UPDATED", { orderUid: replacement.uid });
      return { ok: true, orderUid: replacement.uid };
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
      this.expireUrgentOrders();
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
      const replacement = this.createNextOrder(false, orderUid);
      if (replacement && this.random.next() < this.dynamic.urgentChance) {
        replacement.urgentBaseCoins = replacement.rewardCoins;
        replacement.urgentBaseXp = replacement.rewardXp;
        replacement.urgentBaseHearts = replacement.rewardHearts;
        replacement.rewardCoins *= 2;
        replacement.rewardXp *= 2;
        replacement.rewardHearts *= 2;
        replacement.urgentUntil = this.clock.now() + this.dynamic.urgentDurationMs;
      }
      if (replacement) this.orders[index] = replacement;
      else this.orders.splice(index, 1);
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
    /** Returns whether an expired order changed, so the caller can persist and refresh UI. */
    expireUrgentOrders() {
      let changed = false;
      for (const order of this.orders) {
        if (order.urgentUntil !== void 0 && this.clock.now() >= order.urgentUntil) {
          if (order.urgentBaseCoins !== void 0) order.rewardCoins = order.urgentBaseCoins;
          if (order.urgentBaseXp !== void 0) order.rewardXp = order.urgentBaseXp;
          if (order.urgentBaseHearts !== void 0) order.rewardHearts = order.urgentBaseHearts;
          delete order.urgentUntil;
          delete order.urgentBaseCoins;
          delete order.urgentBaseXp;
          delete order.urgentBaseHearts;
          changed = true;
        }
      }
      return changed;
    }
    refreshProgressHints() {
      for (const order of this.orders) {
        this.bus.emit("ORDER_UPDATED", { orderUid: order.uid });
      }
    }
  };

  // assets/scripts/gameplay/ProgressionService.ts
  var ProgressionService = class {
    constructor(player, progression, generators, bus, energyCaps, collectionBonus = () => 0, maxEnergyCap = Number.MAX_SAFE_INTEGER) {
      this.player = player;
      this.progression = progression;
      this.generators = generators;
      this.bus = bus;
      this.energyCaps = energyCaps;
      this.collectionBonus = collectionBonus;
      this.maxEnergyCap = maxEnergyCap;
      this.syncUnlocks();
      this.syncEnergyCap();
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
        for (let level = previousLevel + 1; level <= newLevel; level += 1) {
          this.player.level = level;
          this.syncEnergyCap();
          const newly = this.syncUnlocks(level - 1, level);
          unlockedChains.push(...newly);
          this.bus.emit("LEVEL_UP", {
            level,
            previousLevel: level - 1,
            unlockedChains: newly
          });
        }
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
    spendCoins(amount) {
      if (!Number.isInteger(amount) || amount < 0 || this.player.coins < amount) return false;
      this.player.coins -= amount;
      this.bus.emit("COINS_CHANGED", { coins: this.player.coins, delta: -amount });
      return true;
    }
    spendHearts(amount) {
      if (!Number.isInteger(amount) || amount < 0 || this.player.hearts < amount) return false;
      this.player.hearts -= amount;
      this.bus.emit("HEARTS_CHANGED", { hearts: this.player.hearts, delta: -amount });
      return true;
    }
    unlockedChains() {
      return [...this.player.unlockedChainIds];
    }
    isGeneratorUnlocked(generatorId) {
      const gen = this.generators.find((g) => g.id === generatorId);
      if (!gen) return false;
      return this.player.level >= gen.unlockLevel || this.player.unlockedChainIds.includes(gen.chainId);
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
      return newly;
    }
    syncEnergyCap() {
      const cap = this.energyCaps?.[Math.min(this.energyCaps.length - 1, this.player.level - 1)];
      if (cap !== void 0) this.player.maxEnergy = Math.min(this.maxEnergyCap, cap + this.collectionBonus());
    }
  };

  // assets/scripts/gameplay/LifeService.ts
  var LifeService = class {
    constructor(state, memories, furniture, wishes, levelRewards, player, progression, bus) {
      this.state = state;
      this.memories = memories;
      this.furniture = furniture;
      this.wishes = wishes;
      this.levelRewards = levelRewards;
      this.player = player;
      this.progression = progression;
      this.bus = bus;
    }
    record(metric) {
      this.state.stats[metric] += 1;
      this.bus.emit("LIFE_CHANGED", { reason: "progress" });
    }
    getDecorPoints() {
      const placed = new Set(this.state.placedFurnitureIds);
      return this.furniture.reduce((total, item) => total + (placed.has(item.id) ? item.decorPoints : 0), 0);
    }
    getWishProgress(wish) {
      const metric = wish.metric;
      switch (metric) {
        case "spawns":
        case "merges":
        case "orders":
          return this.state.stats[metric];
        case "level":
          return this.player.level;
        case "memories":
          return this.state.unlockedMemoryIds.length;
        case "furniture":
          return this.state.placedFurnitureIds.length;
        case "decor":
          return this.getDecorPoints();
      }
    }
    grantMemory(id) {
      if (!this.memories.some((memory) => memory.id === id)) return { ok: false, reason: "NOT_FOUND" };
      if (this.state.unlockedMemoryIds.includes(id)) return { ok: false, reason: "ALREADY_OWNED" };
      this.state.unlockedMemoryIds.push(id);
      this.bus.emit("LIFE_CHANGED", { reason: "memory" });
      return { ok: true };
    }
    unlockMemory(id) {
      const index = this.memories.findIndex((item) => item.id === id);
      if (index < 0) return { ok: false, reason: "NOT_FOUND" };
      if (this.state.unlockedMemoryIds.includes(id)) return { ok: false, reason: "ALREADY_OWNED" };
      if (index > 0 && !this.state.unlockedMemoryIds.includes(this.memories[index - 1].id)) {
        return { ok: false, reason: "LOCKED" };
      }
      if (!this.progression.spendHearts(this.memories[index].heartCost)) {
        return { ok: false, reason: "NOT_ENOUGH_HEARTS" };
      }
      this.state.unlockedMemoryIds.push(id);
      this.bus.emit("LIFE_CHANGED", { reason: "memory" });
      return { ok: true };
    }
    buyFurniture(id) {
      const item = this.furniture.find((entry) => entry.id === id);
      if (!item) return { ok: false, reason: "NOT_FOUND" };
      if (this.state.ownedFurnitureIds.includes(id)) return { ok: false, reason: "ALREADY_OWNED" };
      if (this.player.level < item.unlockLevel) return { ok: false, reason: "LOCKED" };
      if (!this.progression.spendCoins(item.coinCost)) {
        return { ok: false, reason: "NOT_ENOUGH_COINS" };
      }
      this.state.ownedFurnitureIds.push(id);
      this.state.placedFurnitureIds.push(id);
      this.bus.emit("LIFE_CHANGED", { reason: "furniture" });
      return { ok: true };
    }
    placeFurniture(id) {
      if (!this.furniture.some((item) => item.id === id)) return { ok: false, reason: "NOT_FOUND" };
      if (!this.state.ownedFurnitureIds.includes(id)) return { ok: false, reason: "LOCKED" };
      if (this.state.placedFurnitureIds.includes(id)) {
        this.state.placedFurnitureIds = this.state.placedFurnitureIds.filter((value) => value !== id);
      } else {
        this.state.placedFurnitureIds.push(id);
      }
      this.bus.emit("LIFE_CHANGED", { reason: "furniture" });
      return { ok: true };
    }
    claimWish(id) {
      const wish = this.wishes.find((item) => item.id === id);
      if (!wish) return { ok: false, reason: "NOT_FOUND" };
      if (this.state.claimedWishIds.includes(id)) return { ok: false, reason: "ALREADY_CLAIMED" };
      if (this.getWishProgress(wish) < wish.target) return { ok: false, reason: "NOT_READY" };
      this.state.claimedWishIds.push(id);
      this.progression.addCoins(wish.rewardCoins);
      this.progression.addHearts(wish.rewardHearts);
      this.bus.emit("LIFE_CHANGED", { reason: "wish" });
      return { ok: true };
    }
    pendingLevelRewards() {
      const claimed = new Set(this.state.claimedLevelRewards);
      const levels = [];
      for (let level = 2; level <= this.player.level; level += 1) {
        if (!claimed.has(level)) levels.push(level);
      }
      return levels;
    }
    rewardForLevel(level) {
      const special = this.levelRewards.special.find((reward) => reward.level === level);
      return special ? { coins: special.coins, hearts: special.hearts, xp: special.xp } : {
        coins: this.levelRewards.default.coinsPerLevel * level,
        hearts: this.levelRewards.default.heartsPerLevel * level,
        xp: this.levelRewards.default.xp
      };
    }
    claimLevelReward(level) {
      if (!Number.isInteger(level) || level < 2 || level > this.player.level) {
        return { ok: false, reason: "LOCKED" };
      }
      if (this.state.claimedLevelRewards.includes(level)) {
        return { ok: false, reason: "ALREADY_CLAIMED" };
      }
      this.state.claimedLevelRewards.push(level);
      const reward = this.rewardForLevel(level);
      this.progression.addCoins(reward.coins);
      this.progression.addHearts(reward.hearts);
      if (reward.xp > 0) this.progression.addXp(reward.xp);
      this.bus.emit("LIFE_CHANGED", { reason: "level-reward" });
      return { ok: true };
    }
    addPhoto(path) {
      if (!path || this.state.photoPaths.includes(path)) return { ok: false, reason: "ALREADY_OWNED" };
      this.state.photoPaths.push(path);
      this.bus.emit("LIFE_CHANGED", { reason: "photo" });
      return { ok: true };
    }
  };

  // assets/scripts/gameplay/PlayService.ts
  var PlayService = class {
    constructor(state, bundle, board, ids, bus, progression, energy, life, projectItem = (id) => id) {
      this.bundle = bundle;
      this.board = board;
      this.ids = ids;
      this.bus = bus;
      this.progression = progression;
      this.energy = energy;
      this.life = life;
      this.projectItem = projectItem;
      this.deliveringSmallDate = false;
      const loaded = JSON.parse(JSON.stringify(state));
      this.data = {
        warehouse: Array.isArray(loaded.warehouse) ? loaded.warehouse : [],
        scissors: typeof loaded.scissors === "number" ? loaded.scissors : bundle.game.toolbox.startingScissors,
        chapters: loaded.chapters && typeof loaded.chapters === "object" ? loaded.chapters : {},
        replays: loaded.replays && typeof loaded.replays === "object" ? loaded.replays : {},
        replayStats: loaded.replayStats && typeof loaded.replayStats === "object" ? loaded.replayStats : {},
        smallDate: { ...createSmallDateProgress(), ...loaded.smallDate ?? {} }
      };
      for (const chapter of bundle.adventures) {
        const p = this.data.chapters[chapter.id];
        if (p) {
          p.step = Math.min(chapter.steps.length, Math.max(0, p.step));
          p.hints = Math.min(chapter.hints.length, Math.max(0, p.hints));
          this.normalizePuzzle(chapter.puzzle, p);
          if (p.claimed) {
            p.step = chapter.steps.length;
            if (p.outcome === "playing") p.outcome = "solved";
          } else if (p.step < chapter.steps.length) p.outcome = "playing";
          p.step = chapter.steps.length;
        }
        const replay = this.data.replays[chapter.id];
        if (replay && p?.claimed) {
          const definition = this.variantDefinition(chapter, replay.variantId);
          if (!definition) {
            replay.variantId = "classic";
            replay.found = [];
            replay.selected = [];
            replay.rotations = [];
            replay.code = "";
          }
          const active = this.variantDefinition(chapter, replay.variantId) ?? this.classicDefinition(chapter);
          replay.hints = Math.max(0, Math.min(active.hints.length, replay.hints));
          this.normalizePuzzle(active.puzzle, replay);
          if (!this.data.replayStats[chapter.id]) {
            this.data.replayStats[chapter.id] = {
              ...createReplayStats(),
              started: 1,
              solved: replay.outcome === "solved" ? 1 : 0,
              skipped: replay.outcome === "skipped" ? 1 : 0,
              totalHints: replay.outcome === "playing" ? 0 : replay.hints,
              bestSolvedHints: replay.outcome === "solved" ? replay.hints : null,
              legacyHistoryIncomplete: true
            };
          }
        } else if (replay) {
          delete this.data.replays[chapter.id];
        }
      }
      this.ensureSmallDate();
    }
    get state() {
      return JSON.parse(JSON.stringify(this.data));
    }
    progress(id) {
      const chapter = this.bundle.adventures.find((entry) => entry.id === id);
      return { ...createChapterProgress(), ...this.state.chapters[id], ...chapter ? { step: chapter.steps.length } : {} };
    }
    hasReplay(id) {
      return !!this.data.replays[id];
    }
    replayProgress(id) {
      const replay = this.data.replays[id];
      return replay ? JSON.parse(JSON.stringify(replay)) : void 0;
    }
    replaySummary(id) {
      const stats = this.data.replayStats[id] ?? createReplayStats();
      return { ...stats };
    }
    /** Renderers read whichever independent progress is active: practice first, otherwise the chapter. */
    puzzleProgress(id) {
      return this.replayProgress(id) ?? this.progress(id);
    }
    puzzleDefinition(id) {
      const chapter = this.bundle.adventures.find((entry) => entry.id === id);
      if (!chapter) return void 0;
      return JSON.parse(JSON.stringify(this.activeDefinition(chapter, id)));
    }
    activeDefinition(chapter, id) {
      const replay = this.data.replays[id];
      return (replay && this.variantDefinition(chapter, replay.variantId)) ?? this.classicDefinition(chapter);
    }
    chapterAvailability(id) {
      const index = this.bundle.adventures.findIndex((chapter2) => chapter2.id === id);
      if (index < 0) return void 0;
      const chapter = this.bundle.adventures[index];
      const currentLevel = this.progression.level;
      return {
        available: currentLevel >= chapter.unlockLevel,
        requiredLevel: chapter.unlockLevel,
        currentLevel
      };
    }
    journeyProgress() {
      const completed = this.bundle.adventures.filter((chapter) => this.progress(chapter.id).claimed).length;
      const nextChapter = this.bundle.adventures.find((chapter) => !this.progress(chapter.id).claimed) ?? null;
      return {
        completed,
        total: this.bundle.adventures.length,
        nextChapter,
        nextProgress: nextChapter ? this.progress(nextChapter.id) : null,
        availability: nextChapter ? this.chapterAvailability(nextChapter.id) ?? null : null
      };
    }
    isAvailable(id) {
      return this.chapterAvailability(id)?.available ?? false;
    }
    current(id) {
      const chapter = this.bundle.adventures.find((c) => c.id === id);
      if (!chapter || !this.isAvailable(id)) return;
      const progress = this.data.chapters[id] ?? (this.data.chapters[id] = createChapterProgress());
      progress.step = chapter.steps.length;
      return { chapter, progress };
    }
    classicDefinition(chapter) {
      return { puzzle: chapter.puzzle, instruction: chapter.instruction, hints: chapter.hints, variantId: "classic" };
    }
    variantDefinition(chapter, variantId) {
      if (variantId === "classic") return this.classicDefinition(chapter);
      const variant = chapter.replayVariants?.find((candidate) => candidate.id === variantId);
      return variant ? { puzzle: variant.puzzle, instruction: variant.instruction, hints: variant.hints, variantId: variant.id } : void 0;
    }
    normalizePuzzle(puzzle, progress) {
      if (puzzle.kind === "find") {
        progress.found = progress.found.filter((id) => puzzle.hotspots.some((hotspot) => hotspot.id === id));
        progress.selected = [];
        progress.rotations = [];
        if (progress.code.length > puzzle.solution.length || !Array.from(progress.code).every((digit) => digit >= "0" && digit <= "9")) progress.code = "";
      } else if (puzzle.kind === "sequence") {
        progress.found = [];
        progress.selected = progress.selected.filter((id) => puzzle.tiles.some((tile) => tile.id === id));
        progress.rotations = [];
        progress.code = "";
      } else {
        progress.found = [];
        progress.selected = [];
        progress.code = "";
        if (progress.rotations.length !== puzzle.ports.length || !progress.rotations.every((rotation) => Number.isInteger(rotation) && rotation >= 0 && rotation < 4)) {
          progress.rotations = [];
        }
      }
    }
    changed(reason) {
      this.bus.emit("PLAY_CHANGED", { reason });
      return { ok: true };
    }
    store(index) {
      const item = this.board.getBoard().cells[index]?.item;
      if (!item || this.board.getBoard().cells[index]?.locked) return { ok: false, reason: "INVALID" };
      if (this.data.warehouse.length >= this.bundle.game.toolbox.warehouseSlots) return { ok: false, reason: "WAREHOUSE_FULL" };
      const next = cloneBoard(this.board.getBoard());
      next.cells[index].item = void 0;
      this.data.warehouse.push({ ...item });
      this.board.replaceBoard(next, "tool");
      return this.changed("warehouse");
    }
    withdraw(uid) {
      const at = this.data.warehouse.findIndex((item) => item.uid === uid);
      if (at < 0) return { ok: false, reason: "INVALID" };
      const next = cloneBoard(this.board.getBoard());
      const empty = next.cells.find((cell) => !cell.locked && !cell.item);
      if (!empty) return { ok: false, reason: "BOARD_FULL" };
      empty.item = { ...this.data.warehouse[at] };
      this.data.warehouse.splice(at, 1);
      this.board.replaceBoard(next, "tool");
      return this.changed("warehouse");
    }
    takeScissors() {
      if (this.data.scissors <= 0) return { ok: false, reason: "NO_SCISSORS" };
      if (this.board.isFull()) return { ok: false, reason: "BOARD_FULL" };
      const result = this.board.spawn("scissors_01");
      if (!result.ok) return result;
      this.data.scissors -= 1;
      return this.changed("scissors");
    }
    grantScissors(count) {
      this.data.scissors += Math.max(0, Math.floor(count));
      this.changed("scissors");
    }
    split(index) {
      const item = this.board.getBoard().cells[index]?.item;
      const previous = item && Array.from(this.bundle.catalog.values()).find((d) => d.nextItemId === item.definitionId);
      if (!item || !previous || this.bundle.catalog.get(item.definitionId)?.maxUses || this.board.getBoard().cells[index]?.locked) return { ok: false, reason: "CANNOT_SPLIT" };
      if (this.data.scissors <= 0) return { ok: false, reason: "NO_SCISSORS" };
      const next = cloneBoard(this.board.getBoard());
      const empty = next.cells.find((cell) => !cell.locked && !cell.item);
      if (!empty) return { ok: false, reason: "BOARD_FULL" };
      const used = /* @__PURE__ */ new Set([...next.cells.flatMap((c) => c.item ? [c.item.uid] : []), ...this.data.warehouse.map((i) => i.uid)]);
      let uid = this.ids.next();
      while (used.has(uid)) uid = this.ids.next();
      next.cells[index].item = { ...item, definitionId: previous.id };
      empty.item = { uid, definitionId: previous.id };
      this.data.scissors -= 1;
      this.board.replaceBoard(next, "tool");
      return this.changed("scissors");
    }
    deliver(id) {
      const current = this.current(id);
      if (!current) return { ok: false, reason: "LOCKED" };
      const { chapter, progress } = current;
      if (progress.step >= chapter.steps.length) return { ok: false, reason: "NOT_READY" };
      const locations = this.board.findItemsForRequirements(chapter.steps[progress.step].requirements);
      if (!locations) return { ok: false, reason: "NOT_READY" };
      progress.step += 1;
      this.board.consumeItems(locations);
      this.life.record("orders");
      return this.changed("chapter");
    }
    applyPuzzle(puzzle, progress, action, value) {
      if (action === "find" && puzzle.kind === "find" && puzzle.hotspots.some((h) => h.id === value)) {
        if (!progress.found.includes(value)) progress.found.push(value);
      } else if (action === "select" && puzzle.kind === "sequence" && puzzle.tiles.some((t) => t.id === value)) {
        const index = progress.selected.indexOf(value);
        if (index < 0) progress.selected.push(value);
        else progress.selected.splice(index);
      } else if (action === "rotate" && puzzle.kind === "circuit" && /^\d+$/.test(value) && Number(value) < puzzle.ports.length) {
        if (!progress.rotations.length) progress.rotations = [...puzzle.initial];
        const index = Number(value);
        progress.rotations[index] = (progress.rotations[index] + 1) % 4;
      } else if (action === "digit" && puzzle.kind === "find" && /^\d$/.test(value)) {
        if (progress.code.length < puzzle.solution.length) progress.code += value;
      } else if (action === "erase") progress.code = progress.code.slice(0, -1);
      else if (action === "reset") {
        progress.selected = [];
        progress.code = "";
        progress.rotations = [];
      } else return false;
      return true;
    }
    act(id, action, value = "") {
      const current = this.current(id);
      if (!current) return { ok: false, reason: "LOCKED" };
      const replay = this.data.replays[id];
      const progress = replay ?? current.progress;
      if (!replay && current.progress.step < current.chapter.steps.length) return { ok: false, reason: "NOT_READY" };
      if (progress.outcome !== "playing") return { ok: false, reason: "NOT_READY" };
      const definition = this.activeDefinition(current.chapter, id);
      if (!this.applyPuzzle(definition.puzzle, progress, action, value)) return { ok: false, reason: "INVALID" };
      return this.changed("chapter");
    }
    hint(id) {
      const current = this.current(id);
      if (!current) return { ok: false, reason: "LOCKED" };
      const replay = this.data.replays[id];
      const progress = replay ?? current.progress;
      if (!replay && current.progress.step < current.chapter.steps.length) return { ok: false, reason: "LOCKED" };
      if (progress.outcome !== "playing") return { ok: false, reason: "NOT_READY" };
      progress.hints = Math.min(this.activeDefinition(current.chapter, id).hints.length, progress.hints + 1);
      return this.changed("chapter");
    }
    solve(id, skip = false) {
      const current = this.current(id);
      if (!current) return { ok: false, reason: "LOCKED" };
      const replay = this.data.replays[id];
      const progress = replay ?? current.progress;
      const { chapter } = current;
      if (!replay && current.progress.step < chapter.steps.length) return { ok: false, reason: "NOT_READY" };
      if (progress.outcome !== "playing") return { ok: false, reason: "NOT_READY" };
      const puzzle = this.activeDefinition(chapter, id).puzzle;
      const correct = puzzle.kind === "find" ? progress.found.length === puzzle.hotspots.length && progress.code === puzzle.solution : puzzle.kind === "sequence" ? JSON.stringify(progress.selected) === JSON.stringify(puzzle.solution) : circuitState(puzzle, progress.rotations).solved;
      if (!skip && !correct) return { ok: false, reason: "WRONG_ANSWER" };
      progress.outcome = skip ? "skipped" : "solved";
      if (replay) {
        const stats = this.replayStats(id);
        if (skip) stats.skipped += 1;
        else {
          stats.solved += 1;
          stats.bestSolvedHints = stats.bestSolvedHints === null ? progress.hints : Math.min(stats.bestSolvedHints, progress.hints);
        }
        stats.totalHints += progress.hints;
      }
      return this.changed("chapter");
    }
    circuit(id) {
      const definition = this.puzzleDefinition(id);
      return definition?.puzzle.kind === "circuit" ? circuitState(definition.puzzle, this.puzzleProgress(id).rotations) : void 0;
    }
    replayStats(id) {
      return this.data.replayStats[id] ?? (this.data.replayStats[id] = createReplayStats());
    }
    beginReplay(chapter) {
      const stats = this.replayStats(chapter.id);
      const variants = [
        this.classicDefinition(chapter),
        ...(chapter.replayVariants ?? []).map((variant2) => ({
          puzzle: variant2.puzzle,
          instruction: variant2.instruction,
          hints: variant2.hints,
          variantId: variant2.id
        }))
      ];
      const variant = variants[stats.started % variants.length];
      stats.started += 1;
      this.data.replays[chapter.id] = createReplayProgress(variant.variantId);
    }
    /** Start a free practice run, or resume the one already in progress. */
    startReplay(id) {
      const chapter = this.bundle.adventures.find((c) => c.id === id);
      if (!chapter) return { ok: false, reason: "LOCKED" };
      if (!this.progress(id).claimed) return { ok: false, reason: "NOT_CLAIMED" };
      const existing = this.data.replays[id];
      if (!existing || existing.outcome !== "playing") this.beginReplay(chapter);
      return this.changed("chapter");
    }
    /** Explicitly discard practice progress and begin a new counted run. */
    restartReplay(id) {
      const chapter = this.bundle.adventures.find((c) => c.id === id);
      if (!chapter) return { ok: false, reason: "LOCKED" };
      if (!this.progress(id).claimed) return { ok: false, reason: "NOT_CLAIMED" };
      this.beginReplay(chapter);
      return this.changed("chapter");
    }
    claim(id) {
      const current = this.current(id);
      if (!current) return { ok: false, reason: "LOCKED" };
      const { chapter, progress } = current;
      if (progress.claimed) return { ok: false, reason: "ALREADY_CLAIMED" };
      if (progress.outcome === "playing" || progress.step < chapter.steps.length) return { ok: false, reason: "NOT_READY" };
      progress.claimed = true;
      this.data.scissors += chapter.reward.scissors;
      this.progression.addCoins(chapter.reward.coins);
      this.progression.addHearts(chapter.reward.hearts);
      this.energy.add(chapter.reward.energy);
      this.life.grantMemory(chapter.memoryId);
      return this.changed("reward");
    }
    smallDatePool() {
      const unlocked = new Set(this.progression.unlockedChains());
      return this.bundle.smallDates.filter((date) => this.progression.level >= date.minLevel && date.requirements.every((req) => {
        const definition = this.bundle.catalog.get(req.itemId);
        return !!definition && definition.level <= 3 && unlocked.has(definition.chainId);
      }));
    }
    /** Deterministic rotation that skips the theme just completed when another is available. */
    nextSmallDateId(pool, rotation, avoidId) {
      if (!pool.length) return "";
      const start = (rotation % pool.length + pool.length) % pool.length;
      for (let offset = 0; offset < pool.length; offset += 1) {
        const candidate = pool[(start + offset) % pool.length];
        if (pool.length === 1 || candidate.id !== avoidId) return candidate.id;
      }
      return pool[start].id;
    }
    ensureSmallDate() {
      const pool = this.smallDatePool();
      if (!pool.some((date) => date.id === this.data.smallDate.currentId)) {
        this.data.smallDate.currentId = this.nextSmallDateId(pool, this.data.smallDate.rotation, "");
      }
    }
    smallDateOrder() {
      const original = this.bundle.smallDates.find((date) => date.id === this.data.smallDate.currentId);
      if (!original || !this.smallDatePool().some((date) => date.id === original.id)) return void 0;
      const counts = /* @__PURE__ */ new Map();
      for (const req of original.requirements) {
        const id = this.projectItem(req.itemId);
        counts.set(id, (counts.get(id) ?? 0) + req.count);
      }
      const template = { ...original, requirements: Array.from(counts.entries()).map(([itemId, count]) => ({ itemId, count })) };
      const progress = this.board.getOrderProgress(template);
      return {
        template,
        token: `${this.data.smallDate.currentId}:${this.data.smallDate.rotation}`,
        rotation: this.data.smallDate.rotation,
        completed: this.data.smallDate.completed,
        requirements: progress.requirements,
        ready: progress.ready
      };
    }
    /** Bind delivery to the rendered order; a stale token never consumes, pays or rotates. */
    deliverSmallDate(expectedToken) {
      if (this.deliveringSmallDate) return { ok: false, reason: "STALE_DATE" };
      const order = this.smallDateOrder();
      if (!order) return { ok: false, reason: "NO_DATE" };
      if (expectedToken !== order.token) return { ok: false, reason: "STALE_DATE" };
      const locations = this.board.findItemsForRequirements(order.template.requirements);
      if (!locations) return { ok: false, reason: "NOT_READY" };
      this.deliveringSmallDate = true;
      try {
        this.board.consumeItems(locations);
        this.progression.addCoins(order.template.rewardCoins);
        this.progression.addHearts(order.template.rewardHearts);
        this.progression.addXp(order.template.rewardXp);
        this.life.record("orders");
        this.data.smallDate.rotation += 1;
        this.data.smallDate.completed += 1;
        const pool = this.smallDatePool();
        this.data.smallDate.currentId = this.nextSmallDateId(pool, this.data.smallDate.rotation, order.template.id);
      } finally {
        this.deliveringSmallDate = false;
      }
      return this.changed("reward");
    }
  };

  // assets/scripts/gameplay/GameContext.ts
  var GameContext = class {
    constructor(options = {}) {
      this.bus = new GameEventBus();
      this.inboxRef = [];
      this.reservedIds = /* @__PURE__ */ new Set();
      this.discovered = [];
      this.claimedDiscoveries = [];
      this.claimedCollections = [];
      this.legacyBoardEntitlement = false;
      this.retainedOpenCellIndices = [];
      this.exchanging = false;
      this.purchasingGenerator = false;
      this.orderRefreshAt = [];
      this.checkIn = { lastClaimDay: null, claims: 0 };
      this.bootState = "BOOT";
      this.bootError = null;
      this.saveFailed = false;
      this.loadNotice = null;
      this.logger = options.logger ?? new GameLogger(true);
      this.bundle = options.config ?? loadConfigBundle();
      this.config = this.bundle.game;
      this.bus.on("ITEM_SPAWNED", ({ definitionId }) => this.recordBaseAcquisition(definitionId));
      this.platform = new PlatformService(options.storage);
      this.clock = options.clock ?? (options.deterministic ? new FakeClockService() : new SystemClockService());
      this.random = options.random ?? (options.deterministic ? new FixedRandomService([0]) : new SystemRandomService());
      const sourceIds = options.ids ?? (options.deterministic ? new SequentialIdService("det") : new IdService());
      this.ids = { next: () => {
        let id = sourceIds.next();
        while (this.reservedIds.has(id)) id = sourceIds.next();
        this.reservedIds.add(id);
        return id;
      } };
      this.saveService = new SaveService({
        storage: this.platform.getStorage(),
        clock: this.clock,
        saveKey: this.config.saveKey,
        version: this.config.saveVersion,
        createDefault: () => createDefaultSaveData(this.config, this.clock.now()),
        debounceMs: options.saveDebounceMs ?? 200,
        logger: (m) => this.logger.debug("SAVE", m),
        legacyStarterFurnitureId: this.bundle.furniture[0]?.id,
        energyCaps: this.config.energy.maxByLevel,
        collection: this.config.collection,
        onWrite: (result) => {
          this.saveFailed = !result.ok;
          if (result.ok) this.bus.emit("GAME_SAVED", { savedAt: result.savedAt });
          this.bus.emit("SAVE_STATUS_CHANGED", { ok: result.ok });
        }
      });
    }
    get player() {
      return this.playerRef;
    }
    get tutorial() {
      return this.tutorialRef;
    }
    get preferences() {
      return { ...this.preferencesRef };
    }
    setPreferences(patch) {
      this.preferencesRef = {
        soundEnabled: typeof patch.soundEnabled === "boolean" ? patch.soundEnabled : this.preferencesRef.soundEnabled,
        vibrationEnabled: typeof patch.vibrationEnabled === "boolean" ? patch.vibrationEnabled : this.preferencesRef.vibrationEnabled
      };
      this.save();
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
        this.loadNotice = null;
        if (!loaded.ok && (loaded.reason === "UNAVAILABLE" || loaded.reason === "CORRUPT" && !loaded.backupPreserved)) {
          throw new Error("\u6682\u65F6\u65E0\u6CD5\u5B89\u5168\u8BFB\u53D6\u6216\u5907\u4EFD\u5B58\u6863\uFF0C\u539F\u8FDB\u5EA6\u672A\u8986\u76D6\u3002\u8BF7\u7A0D\u540E\u70B9\u51FB\u91CD\u8BD5\u3002");
        }
        if (loaded.ok && loaded.notice) {
          this.loadNotice = loaded.notice === "MIGRATED" ? "\u65E7\u5B58\u6863\u5DF2\u5347\u7EA7\uFF0C\u5DF2\u6709\u7269\u54C1\u548C\u8D44\u4EA7\u5DF2\u4FDD\u7559\u3002" : loaded.notice === "BACKUP_RESTORED" ? "\u5F53\u524D\u5B58\u6863\u5F02\u5E38\uFF0C\u5DF2\u4ECE\u53EF\u7528\u5907\u4EFD\u6062\u590D\u8FDB\u5EA6\u3002" : "\u5B58\u6863\u4E2D\u7684\u5F02\u5E38\u6570\u636E\u5DF2\u4FEE\u590D\uFF0C\u8BF7\u68C0\u67E5\u5F53\u524D\u8FDB\u5EA6\u3002";
        } else if (!loaded.ok && loaded.reason === "CORRUPT") {
          this.loadNotice = "\u5B58\u6863\u5DF2\u635F\u574F\uFF0C\u539F\u59CB\u6570\u636E\u5DF2\u5907\u4EFD\u3002\u672A\u627E\u5230\u53EF\u7528\u8FDB\u5EA6\uFF0C\u5DF2\u521B\u5EFA\u65B0\u7684\u5C0F\u5C4B\u3002";
        }
        let data;
        if (loaded.ok) {
          data = loaded.data;
          this.logger.debug("SAVE", `loaded v${data.version}`);
        } else {
          data = loaded.defaultData;
          this.logger.debug("SAVE", `using default (${loaded.reason})`);
        }
        for (const id of [...data.board.flatMap((c) => c.item ? [c.item.uid] : []), ...data.rewardInbox.map((i) => i.uid), ...data.play.warehouse.map((i) => i.uid), ...data.activeOrders.map((o) => o.uid)]) this.reservedIds.add(id);
        this.inboxRef = data.rewardInbox.map((i) => ({ ...i }));
        this.discovered = [...data.discoveredItemIds];
        for (const item of [...data.board.flatMap((cell) => cell.item ? [cell.item] : []), ...data.play.warehouse, ...data.rewardInbox]) this.recordBaseAcquisition(item.definitionId, false);
        this.claimedDiscoveries = [...data.claimedDiscoveryIds];
        this.claimedCollections = [...data.claimedCollectionIds ?? []];
        this.legacyBoardEntitlement = data.legacyBoardEntitlement;
        this.retainedOpenCellIndices = [...data.retainedOpenCellIndices ?? []];
        this.checkIn = { ...data.checkIn };
        this.orderRefreshAt = [...data.orderRefreshAt ?? []];
        this.dailyTasks = data.dailyTasks ? { ...data.dailyTasks, progress: { ...data.dailyTasks.progress }, claimedIds: [...data.dailyTasks.claimedIds] } : void 0;
        this.playerRef = {
          ...data.player,
          unlockedChainIds: [...data.player.unlockedChainIds]
        };
        this.tutorialRef = { ...data.tutorial };
        this.preferencesRef = { ...data.preferences };
        this.lifeRef = {
          ...data.life,
          unlockedMemoryIds: [...data.life.unlockedMemoryIds],
          ownedFurnitureIds: [...data.life.ownedFurnitureIds],
          placedFurnitureIds: [...data.life.placedFurnitureIds],
          claimedWishIds: [...data.life.claimedWishIds],
          claimedLevelRewards: [...data.life.claimedLevelRewards],
          photoPaths: [...data.life.photoPaths],
          stats: { ...data.life.stats },
          furniturePositions: Object.fromEntries(Object.entries(data.life.furniturePositions).map(([id, position]) => [id, { ...position }]))
        };
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
        this.board.configureUnlocks(this.playerRef.level, this.config.board.unlocks, this.retainedOpenCellIndices);
        this.bus.on("LEVEL_UP", ({ level }) => this.board.configureUnlocks(level, this.config.board.unlocks, this.retainedOpenCellIndices));
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
          this.bus,
          this.config.energy.maxByLevel,
          () => this.claimedCollections.length * this.config.collection.energyPerChain,
          this.config.collection.maxEnergyCap
        );
        this.life = new LifeService(
          this.lifeRef,
          this.bundle.memories,
          this.bundle.furniture,
          this.bundle.wishes,
          this.bundle.levelRewards,
          this.playerRef,
          this.progression,
          this.bus
        );
        this.generators = new GeneratorService(
          this.bundle.generators,
          this.bundle.catalog,
          this.board,
          this.energy,
          this.playerRef,
          this.random,
          this.clock,
          data.generatorCharges ?? {},
          data.generatorInventory ?? {},
          data.generatorCooldowns ?? {}
        );
        this.bus.on("LEVEL_UP", () => this.generators.ensureUnlockedCharges());
        this.bus.on("LEVEL_UP", () => this.energy.markRegenPoint());
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
          this.config.orders.maxItemLevel,
          this.bundle.generators.filter((g) => g.recharge).map((g) => g.chainId),
          this.clock,
          this.config.orders.dynamic,
          (id) => this.projectProducerItem(id),
          (chain) => this.producerLevel(chain),
          (id) => this.canProduceOrderItem(id),
          (chain) => {
            const generator = this.bundle.generators.find((entry) => entry.chainId === chain);
            return this.player.level < 15 ? generator?.recharge?.capacity ?? Infinity : Infinity;
          }
        );
        this.orders.hydrate(data.activeOrders, data.recentOrderIds ?? []);
        this.orders.ensureFilled();
        this.play = new PlayService(data.play, this.bundle, this.board, this.ids, this.bus, this.progression, this.energy, this.life, (id) => this.projectProducerItem(id));
        this.journal = new JournalService(data.journal, this.clock, this.energy, () => {
          this.bus.emit("JOURNAL_CHANGED", {});
          this.save();
        });
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
    getGeneratorStatus(id) {
      return this.generators.getStatus(id);
    }
    getGeneratorPurchaseQuote(id) {
      const generator = this.generators.get(id);
      if (!generator) return { ok: false, reason: "NOT_FOUND" };
      if (!this.generators.isUnlocked(generator)) return { ok: false, reason: "LOCKED" };
      return { ok: true, generatorId: id, cost: generator.purchaseCoins };
    }
    purchaseGenerator(id) {
      if (this.purchasingGenerator) return { ok: false, reason: "IN_PROGRESS" };
      const quote = this.getGeneratorPurchaseQuote(id);
      if (!quote.ok) return quote;
      if (this.player.coins < quote.cost) return { ok: false, reason: "NOT_ENOUGH_COINS" };
      this.purchasingGenerator = true;
      try {
        if (!this.progression.spendCoins(quote.cost)) return { ok: false, reason: "NOT_ENOUGH_COINS" };
        const result = this.generators.grantPurchased(id);
        if (!result.ok) {
          this.progression.addCoins(quote.cost);
          return result;
        }
        this.bus.emit("GENERATOR_CHANGED", { generatorId: id });
        this.save();
        return { ...quote, inventory: result.inventory };
      } finally {
        this.purchasingGenerator = false;
      }
    }
    getGeneratorRestoreQuote(id) {
      const generator = this.generators.get(id), status = this.generators.getStatus(id);
      if (!generator || !status) return { ok: false, reason: "NOT_FOUND" };
      if (!status.unlocked) return { ok: false, reason: "LOCKED" };
      if (generator.recharge && status.charges === 0) return {
        ok: true,
        generatorId: id,
        kind: "charges",
        cost: this.config.generatorRestore.chargeCost,
        restoredUses: generator.recharge.capacity,
        remainingMs: status.nextRecoveryMs ?? 0
      };
      if (generator.streakCooldown && status.remainingCooldownMs > 0 && status.streak >= generator.streakCooldown.uses) return {
        ok: true,
        generatorId: id,
        kind: "cooldown",
        cost: this.config.generatorRestore.cooldownCost,
        restoredUses: generator.streakCooldown.uses,
        remainingMs: status.remainingCooldownMs
      };
      return { ok: false, reason: "NOT_NEEDED" };
    }
    restoreGenerator(id) {
      if (this.exchanging) return { ok: false, reason: "IN_PROGRESS" };
      const quote = this.getGeneratorRestoreQuote(id);
      if (!quote.ok) return quote;
      if (this.player.diamonds < quote.cost) return { ok: false, reason: "NOT_ENOUGH_DIAMONDS" };
      this.exchanging = true;
      try {
        const restored = this.generators.restoreExhausted(id);
        if (!restored.ok) return restored;
        this.player.diamonds -= quote.cost;
        this.bus.emit("GENERATOR_CHANGED", { generatorId: id });
        this.bus.emit("REWARDS_CHANGED", { reason: "exchange" });
        this.save();
        return { ...quote, kind: restored.kind, restoredUses: restored.restoredUses };
      } finally {
        this.exchanging = false;
      }
    }
    spawnFromGenerator(generatorId, boost = false) {
      const result = this.generators.spawn(generatorId, boost);
      if (result.ok) {
        const generator = this.generators.get(generatorId);
        const level = this.generators.getStatus(generatorId)?.level ?? 0;
        for (const drop of this.config.generationBonusDrops) {
          if (!generator || drop.generatorId !== "*" && drop.generatorId !== generatorId || level < drop.minLevel || drop.excludeRecharge && generator.recharge) continue;
          if (this.random.next() < drop.chance) {
            if (!this.board.spawn(drop.itemId).ok) this.enqueue(drop.itemId);
          }
        }
        this.bus.emit("GENERATOR_CHANGED", { generatorId });
        this.life.record("spawns");
        if (!this.tutorialRef.generatorClicked) {
          this.tutorialRef.generatorClicked = true;
          this.bus.emit("TUTORIAL_UPDATED", { ...this.tutorialRef });
        }
        this.orders.refreshProgressHints();
        this.save();
      }
      return result;
    }
    mergeGenerators(id, level) {
      const result = this.generators.merge(id, level);
      if (result.ok) {
        this.orders.reconcileRequirements();
        this.ensureDailyTasks();
        this.bus.emit("GENERATOR_CHANGED", { generatorId: id });
        this.save();
      }
      return result;
    }
    producerLevel(chainId) {
      const generator = this.bundle.generators.find((entry) => entry.chainId === chainId);
      return generator ? Math.max(1, this.generators.getStatus(generator.id)?.level ?? 1) : 1;
    }
    canProduceOrderItem(id) {
      const item = this.bundle.catalog.get(id);
      if (!item || item.wildcard || item.maxUses) return false;
      const direct = this.bundle.generators.find((generator) => generator.chainId === item.chainId);
      if (direct) return this.generators.getStatus(direct.id)?.unlocked === true;
      return this.config.generationBonusDrops.some((drop) => {
        const source = this.generators.getStatus(drop.generatorId);
        return drop.chance > 0 && source?.unlocked && source.level >= drop.minLevel && this.bundle.catalog.get(drop.itemId)?.chainId === item.chainId;
      });
    }
    projectProducerItem(id, mergeResult = false) {
      const item = this.bundle.catalog.get(id);
      if (!item) return id;
      const generator = this.bundle.generators.find((entry) => entry.chainId === item.chainId);
      if (!generator) return id;
      const level = Math.max(item.level, this.producerLevel(item.chainId) + (mergeResult ? 1 : 0));
      return this.bundle.items.find((candidate) => candidate.chainId === item.chainId && candidate.level === level)?.id ?? id;
    }
    dropItem(from, to) {
      const result = this.board.tryDrop(from, to);
      if (result.ok && result.kind === "MERGE") {
        this.life.record("merges");
        this.handleMerge(result.resultDefinitionId);
        this.recordDaily("merges", result.resultDefinitionId);
        if (!this.tutorialRef.firstMergeCompleted) {
          this.tutorialRef.firstMergeCompleted = true;
          this.bus.emit("TUTORIAL_UPDATED", { ...this.tutorialRef });
        }
      }
      if (result.ok) {
        if (result.kind === "SPLIT") this.acknowledgeFirstUseHint("scissors");
        if (result.kind === "SPLIT" && to !== null) {
          const item = this.board.getBoard().cells[to].item;
          if (item) this.recordBaseAcquisition(item.definitionId);
        }
        this.orders.refreshProgressHints();
        this.save();
      }
      return result;
    }
    playAction(action, value) {
      const result = action === "take_scissors" ? this.play.takeScissors() : action === "store" ? this.play.store(Number(value)) : action === "withdraw" ? this.play.withdraw(value) : action === "split" ? this.play.split(Number(value)) : action === "deliver" ? this.play.deliver(value) : action === "hint" ? this.play.hint(value) : action === "claim" ? this.play.claim(value) : action === "replay" ? this.play.startReplay(value) : action === "replay_reset" ? this.play.restartReplay(value) : action === "small_date" ? this.play.deliverSmallDate(value) : this.play.solve(value, action === "skip");
      if (result.ok) {
        if (action === "store") this.acknowledgeFirstUseHint("backpack");
        if (action === "split") this.acknowledgeFirstUseHint("scissors");
        if (action === "split") {
          const item = this.board.getBoard().cells[Number(value)]?.item;
          if (item) this.recordBaseAcquisition(item.definitionId);
        } else if (action === "withdraw") {
          const item = this.board.getBoard().cells.find((cell) => cell.item?.uid === value)?.item;
          if (item) this.recordBaseAcquisition(item.definitionId);
        }
        this.orders.refreshProgressHints();
        this.save();
      }
      return result;
    }
    puzzleAction(id, action, value = "") {
      const result = this.play.act(id, action, value);
      if (result.ok) this.save();
      return result;
    }
    acknowledgeFirstUseHint(hint) {
      if (!["backpack", "scissors", "chest"].includes(hint)) return { ok: false, reason: "INVALID" };
      if (this.tutorialRef.firstUseHints?.includes(hint)) return { ok: false, reason: "ALREADY_ACKNOWLEDGED" };
      this.tutorialRef.firstUseHints = [...this.tutorialRef.firstUseHints ?? [], hint];
      this.bus.emit("TUTORIAL_UPDATED", { ...this.tutorialRef });
      this.save();
      return { ok: true };
    }
    getFirstUseGuide() {
      if (this.bootState !== "READY" || !this.tutorialRef.firstOrderCompleted && this.life.state.stats.orders === 0) return;
      const seen = new Set(this.tutorialRef.firstUseHints ?? []), board = this.board.getBoard();
      if (!seen.has("chest")) {
        const source = board.cells.find((cell) => cell.item && this.bundle.catalog.get(cell.item.definitionId)?.chainId === "treasure_chest");
        if (source) return { hint: "chest", sourceIndex: source.index };
        if (this.inboxRef.some((item) => this.bundle.catalog.get(item.definitionId)?.chainId === "treasure_chest")) return { hint: "chest" };
      }
      if (!seen.has("scissors")) {
        const source = board.cells.find((cell) => cell.item && this.bundle.catalog.get(cell.item.definitionId)?.maxUses);
        if (source) {
          const target = board.cells.find((cell) => this.board.previewDrop(source.index, cell.index).kind === "SPLIT");
          return { hint: "scissors", sourceIndex: source.index, ...target ? { targetIndex: target.index } : {} };
        }
      }
      const open = board.cells.filter((cell) => !cell.locked), occupied = open.filter((cell) => cell.item);
      if (!seen.has("backpack") && occupied.length >= Math.min(6, Math.max(2, open.length - 2)) && this.play.state.warehouse.length < this.config.toolbox.warehouseSlots) {
        const source = occupied.find((cell) => cell.item && !this.bundle.catalog.get(cell.item.definitionId)?.maxUses);
        if (source) return { hint: "backpack", sourceIndex: source.index };
      }
    }
    getMergeHint() {
      return this.board.getMergeHint();
    }
    unlockMemory(id) {
      const result = this.life.unlockMemory(id);
      if (result.ok) this.save();
      return result;
    }
    buyFurniture(id) {
      const result = this.life.buyFurniture(id);
      if (result.ok) this.save();
      return result;
    }
    placeFurniture(id) {
      const result = this.life.placeFurniture(id);
      if (result.ok) this.save();
      return result;
    }
    claimWish(id) {
      const result = this.life.claimWish(id);
      if (result.ok) this.save();
      return result;
    }
    claimLevelReward(level) {
      const result = this.life.claimLevelReward(level);
      if (result.ok) {
        this.enqueue("treasure_chest");
        const generatorId = this.generators.grantLevelReward(level, this.bundle.levelRewards.generatorRotation ?? []);
        if (generatorId) this.bus.emit("GENERATOR_CHANGED", { generatorId });
        this.save();
      }
      return result;
    }
    addPhoto(path) {
      const result = this.life.addPhoto(path);
      if (result.ok) this.save();
      return result;
    }
    tick() {
      if (this.energy.tick().recovered > 0) this.scheduleSave();
    }
    claimOrder(orderUid) {
      const result = this.orders.claim(orderUid);
      if (result.ok) {
        this.life.record("orders");
        this.recordDaily("orders");
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
        generatorCharges: this.generators.getChargeStates(),
        generatorInventory: this.generators.getInventory(),
        generatorCooldowns: this.generators.getCooldownStates(),
        claimedCollectionIds: [...this.claimedCollections],
        orderRefreshAt: [...this.orderRefreshAt],
        dailyTasks: this.dailyTasks ? { ...this.dailyTasks, progress: { ...this.dailyTasks.progress }, claimedIds: [...this.dailyTasks.claimedIds] } : void 0,
        journal: this.journal.state,
        legacyBoardEntitlement: this.legacyBoardEntitlement,
        retainedOpenCellIndices: [...this.retainedOpenCellIndices],
        rewardInbox: this.inboxRef.map((i) => ({ ...i })),
        discoveredItemIds: [...this.discovered],
        claimedDiscoveryIds: [...this.claimedDiscoveries],
        checkIn: { ...this.checkIn },
        board: this.board.getBoard().cells.map((c) => ({
          index: c.index,
          item: c.item ? { ...c.item } : void 0
        })),
        activeOrders: this.orders.getOrders(),
        tutorial: { ...this.tutorialRef },
        preferences: { ...this.preferencesRef },
        play: this.play.state,
        recentOrderIds: this.orders.getRecentIds(),
        life: {
          ...this.lifeRef,
          unlockedMemoryIds: [...this.lifeRef.unlockedMemoryIds],
          ownedFurnitureIds: [...this.lifeRef.ownedFurnitureIds],
          placedFurnitureIds: [...this.lifeRef.placedFurnitureIds],
          claimedWishIds: [...this.lifeRef.claimedWishIds],
          claimedLevelRewards: [...this.lifeRef.claimedLevelRewards],
          photoPaths: [...this.lifeRef.photoPaths],
          stats: { ...this.lifeRef.stats },
          furniturePositions: Object.fromEntries(Object.entries(this.lifeRef.furniturePositions).map(([id, position]) => [id, { ...position }]))
        }
      };
    }
    save() {
      const data = this.buildSaveData();
      return this.saveService.save(data);
    }
    scheduleSave() {
      this.saveService.scheduleSave(this.buildSaveData());
    }
    flushSave() {
      this.saveService.flush();
    }
    /** Legacy callers cannot replace an order or spend diamonds. */
    getOrderRefreshStatus(_uid) {
      return null;
    }
    refreshOrderClock() {
      if (this.orders.expireUrgentOrders()) {
        this.save();
        this.orders.refreshProgressHints();
      }
    }
    getTodayJournal() {
      return this.journal.today();
    }
    getJournalEntries() {
      return this.journal.entries();
    }
    saveTodayJournal(text, photoPath) {
      return this.journal.saveToday(text, photoPath);
    }
    refreshOrder(_uid, _mode) {
      return { ok: false, reason: "DISABLED" };
    }
    ensureDailyTasks() {
      const day = businessDayUtc8(this.clock.now());
      if (this.dailyTasks && day <= this.dailyTasks.day) {
        const task = this.config.rewards.dailyTasks.find((entry) => entry.kind === "specific");
        if (!task || this.dailyTasks.claimedIds.includes(task.id) || (this.dailyTasks.progress[task.id] ?? 0) >= task.target) return false;
        const target = this.projectProducerItem(this.dailyTasks.targetItemId, true);
        if (target === this.dailyTasks.targetItemId) return false;
        this.dailyTasks.targetItemId = target;
        this.bus.emit("DAILY_TASKS_CHANGED", { day: this.dailyTasks.day });
        return true;
      }
      const unlocked = new Set(this.player.unlockedChainIds);
      const producerChains = new Set(this.bundle.generators.filter((g) => unlocked.has(g.chainId)).map((g) => g.chainId));
      const choices = this.bundle.items.filter((item) => item.level === 2 && producerChains.has(item.chainId));
      const index = (day % choices.length + choices.length) % choices.length;
      this.dailyTasks = { day, targetItemId: this.projectProducerItem(choices[index]?.id ?? "coffee_02", true), progress: {}, claimedIds: [] };
      return true;
    }
    recordDaily(kind, itemId) {
      this.ensureDailyTasks();
      const state = this.dailyTasks;
      for (const task of this.config.rewards.dailyTasks) {
        if (task.kind === kind || kind === "merges" && task.kind === "specific" && state.targetItemId === itemId) state.progress[task.id] = Math.min(task.target, (state.progress[task.id] ?? 0) + 1);
      }
      this.bus.emit("DAILY_TASKS_CHANGED", { day: state.day });
    }
    getDailyTasks() {
      if (this.ensureDailyTasks()) this.save();
      const state = this.dailyTasks;
      return { day: state.day, tasks: this.config.rewards.dailyTasks.map((task) => {
        const progress = state.progress[task.id] ?? 0, claimed = state.claimedIds.includes(task.id);
        return { id: task.id, title: task.title, target: task.target, progress, claimed, ready: !claimed && progress >= task.target, reward: { ...task.reward }, ...task.kind === "specific" ? { targetItemId: state.targetItemId } : {} };
      }) };
    }
    claimDailyTask(id) {
      this.ensureDailyTasks();
      const state = this.dailyTasks, task = this.config.rewards.dailyTasks.find((t) => t.id === id);
      if (!task) return { ok: false, reason: "NOT_FOUND" };
      if (state.claimedIds.includes(id)) return { ok: false, reason: "ALREADY_CLAIMED" };
      if ((state.progress[id] ?? 0) < task.target) return { ok: false, reason: "NOT_READY" };
      state.claimedIds.push(id);
      const { coins, xp, diamonds } = task.reward;
      const energy = task.reward.energy;
      this.progression.addCoins(coins);
      this.progression.addXp(xp);
      this.player.diamonds += diamonds;
      this.energy.add(energy);
      this.bus.emit("DAILY_TASKS_CHANGED", { day: state.day });
      this.save();
      return { ok: true, coins, xp, energy, diamonds };
    }
    get rewardInbox() {
      return this.inboxRef.map((i) => ({ ...i }));
    }
    isItemDiscovered(id) {
      return this.bundle.catalog.has(id) && this.discovered.includes(id);
    }
    getDiscoveryProgress() {
      return { discovered: this.bundle.items.filter((i) => this.isItemDiscovered(i.id)).length, total: this.bundle.items.length };
    }
    getCollectionProgress() {
      return this.config.collection.chainIds.map((chainId) => {
        const items = this.bundle.items.filter((item) => item.chainId === chainId);
        const discovered = items.filter((item) => this.isItemDiscovered(item.id)).length;
        const claimed = this.claimedCollections.includes(chainId);
        return { chainId, discovered, total: items.length, claimed, ready: !claimed && items.length > 0 && discovered === items.length, energyBonus: this.config.collection.energyPerChain };
      });
    }
    claimCollectionBonus(chainId) {
      const collection = this.getCollectionProgress().find((item) => item.chainId === chainId);
      if (!collection) return { ok: false, reason: "NOT_FOUND" };
      if (collection.claimed) return { ok: false, reason: "ALREADY_CLAIMED" };
      if (!collection.ready) return { ok: false, reason: "NOT_READY" };
      this.claimedCollections.push(chainId);
      const previous = this.player.maxEnergy;
      this.progression.syncEnergyCap();
      this.bus.emit("COLLECTION_CHANGED", { chainId });
      this.bus.emit("ENERGY_CHANGED", { energy: this.player.energy, maxEnergy: this.player.maxEnergy, delta: 0 });
      this.save();
      return { ok: true, energyBonus: this.player.maxEnergy - previous };
    }
    newItem(definitionId) {
      const used = /* @__PURE__ */ new Set([...this.board.getBoard().cells.flatMap((c) => c.item ? [c.item.uid] : []), ...this.inboxRef.map((i) => i.uid), ...this.play.state.warehouse.map((i) => i.uid)]);
      let uid = this.ids.next();
      while (used.has(uid)) uid = this.ids.next();
      return { uid, definitionId };
    }
    recordBaseAcquisition(id, notify = true) {
      const definition = this.bundle.catalog.get(id);
      if (!definition || definition.level !== 1 || this.discovered.includes(id)) return;
      this.discovered.push(id);
      if (notify) this.bus.emit("COLLECTION_CHANGED", { chainId: definition.chainId });
    }
    enqueue(id) {
      this.inboxRef.push(this.newItem(id));
      this.recordBaseAcquisition(id);
      this.bus.emit("REWARDS_CHANGED", { reason: "inbox" });
    }
    handleMerge(id) {
      const chain = this.bundle.catalog.get(id)?.chainId;
      if (chain === "treasure_chest") {
        if (!this.discovered.includes(id)) {
          this.discovered.push(id);
          this.bus.emit("COLLECTION_CHANGED", { chainId: chain });
        }
        return;
      }
      if (!this.discovered.includes(id)) this.discovered.push(id);
      if (!this.claimedDiscoveries.includes(id)) {
        this.claimedDiscoveries.push(id);
        this.progression.addCoins(this.config.rewards.discoveryCoins);
        this.bus.emit("DISCOVERY_CHANGED", { definitionId: id });
      }
      if (chain && this.config.collection.chainIds.includes(chain) && this.random.next() < this.config.rewards.chestDropChance) {
        const placed = this.board.spawn("treasure_chest");
        if (!placed.ok) this.enqueue("treasure_chest");
      }
    }
    claimInboxItem(uid) {
      const at = this.inboxRef.findIndex((i) => i.uid === uid);
      if (at < 0) return { ok: false, reason: "NOT_FOUND" };
      const cell = this.board.getBoard().cells.find((c) => !c.locked && !c.item);
      if (!cell) return { ok: false, reason: "BOARD_FULL" };
      cell.item = this.inboxRef.splice(at, 1)[0];
      this.bus.emit("BOARD_CHANGED", { reason: "tool" });
      this.bus.emit("REWARDS_CHANGED", { reason: "inbox" });
      this.save();
      return { ok: true };
    }
    useBoardItem(index, expectedUid) {
      const cell = this.board.getBoard().cells[index];
      const item = cell?.item;
      const def = item && this.bundle.catalog.get(item.definitionId);
      if (!cell || cell.locked || !item || expectedUid !== void 0 && item.uid !== expectedUid || !def || !["coin", "energy", "diamond", "treasure_chest"].includes(def.chainId)) return { ok: false, reason: "INVALID" };
      const chest = def.chainId === "treasure_chest" ? this.config.rewards.chestLevels.find((entry) => entry.level === def.level) : void 0;
      if (def.chainId === "treasure_chest" && !chest) return { ok: false, reason: "INVALID" };
      const choices = chest ? Array.from({ length: chest.count }, () => pickWeighted(chest.loot ?? this.config.rewards.chestLoot, this.random)) : [];
      if (choices.some((entry) => !entry)) return { ok: false, reason: "INVALID" };
      const items = choices.map((entry) => this.newItem(entry.itemId));
      cell.item = void 0;
      let amount = def.useValue ?? 0;
      if (def.chainId === "coin") this.progression.addCoins(amount);
      if (def.chainId === "energy") this.energy.add(amount);
      if (def.chainId === "diamond") this.player.diamonds += amount;
      const loot = items.map((created) => {
        const empty = this.board.getBoard().cells.find((candidate) => !candidate.locked && !candidate.item);
        if (empty) empty.item = created;
        else this.inboxRef.push(created);
        return { ...created, cellIndex: empty?.index ?? null };
      });
      for (const created of items) this.recordBaseAcquisition(created.definitionId);
      if (chest) this.acknowledgeFirstUseHint("chest");
      this.bus.emit("BOARD_CHANGED", { reason: "tool" });
      this.bus.emit("REWARDS_CHANGED", { reason: "used" });
      this.save();
      return chest ? { ok: true, amount, loot } : { ok: true, amount };
    }
    exchangeDiamonds(offerId) {
      if (this.exchanging) return { ok: false, reason: "IN_PROGRESS" };
      const offer = this.config.rewards.exchangeOffers.find((o) => o.id === offerId);
      if (!offer) return { ok: false, reason: "INVALID" };
      if (this.player.energy >= this.player.maxEnergy) return { ok: false, reason: "ENERGY_FULL" };
      if (this.player.diamonds < offer.diamonds) return { ok: false, reason: "NOT_ENOUGH_DIAMONDS" };
      const energy = Math.min(offer.energy, this.player.maxEnergy - this.player.energy);
      this.exchanging = true;
      try {
        this.player.diamonds -= offer.diamonds;
        this.energy.add(energy);
        this.bus.emit("REWARDS_CHANGED", { reason: "exchange" });
        this.save();
        return { ok: true, energy };
      } finally {
        this.exchanging = false;
      }
    }
    moveFurniture(id, x, y) {
      if (!this.life.state.ownedFurnitureIds.includes(id) || !this.life.state.placedFurnitureIds.includes(id)) return { ok: false, reason: "LOCKED" };
      if (!this.bundle.furniture.some((f) => f.id === id)) return { ok: false, reason: "NOT_FOUND" };
      if (![x, y].every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) return { ok: false, reason: "NOT_READY" };
      const previous = this.life.state.furniturePositions[id];
      this.life.state.furniturePositions[id] = { ...previous, x, y };
      this.bus.emit("LIFE_CHANGED", { reason: "furniture" });
      this.save();
      return { ok: true };
    }
    setFurnitureTransform(id, patch) {
      const furniture = this.bundle.furniture.find((item) => item.id === id);
      if (!furniture) return { ok: false, reason: "NOT_FOUND" };
      if (!this.life.state.ownedFurnitureIds.includes(id) || !this.life.state.placedFurnitureIds.includes(id)) return { ok: false, reason: "LOCKED" };
      if (!patch || typeof patch !== "object" || Array.isArray(patch) || patch.scale !== void 0 && (typeof patch.scale !== "number" || !Number.isFinite(patch.scale) || patch.scale < 0.5 || patch.scale > 1.8) || patch.rotation !== void 0 && (typeof patch.rotation !== "number" || !Number.isFinite(patch.rotation) || patch.rotation < -180 || patch.rotation > 180) || patch.flipped !== void 0 && typeof patch.flipped !== "boolean" || patch.x !== void 0 && (typeof patch.x !== "number" || !Number.isFinite(patch.x) || patch.x < 0 || patch.x > 1) || patch.y !== void 0 && (typeof patch.y !== "number" || !Number.isFinite(patch.y) || patch.y < 0 || patch.y > 1)) return { ok: false, reason: "NOT_READY" };
      const saved = this.life.state.furniturePositions[id];
      if (!saved && (patch.x === void 0 || patch.y === void 0)) return { ok: false, reason: "NOT_READY" };
      const previous = saved ?? { x: patch.x, y: patch.y };
      this.life.state.furniturePositions[id] = {
        ...previous,
        x: patch.x ?? previous.x,
        y: patch.y ?? previous.y,
        scale: patch.scale ?? previous.scale ?? 1,
        rotation: patch.rotation ?? previous.rotation ?? 0,
        flipped: patch.flipped ?? previous.flipped ?? false
      };
      this.bus.emit("LIFE_CHANGED", { reason: "furniture" });
      this.save();
      return { ok: true };
    }
    resetFurniturePosition(id) {
      if (!this.bundle.furniture.some((f) => f.id === id)) return { ok: false, reason: "NOT_FOUND" };
      if (!this.life.state.ownedFurnitureIds.includes(id)) return { ok: false, reason: "LOCKED" };
      delete this.life.state.furniturePositions[id];
      this.bus.emit("LIFE_CHANGED", { reason: "furniture" });
      this.save();
      return { ok: true };
    }
    getCheckInStatus() {
      const day = businessDayUtc8(this.clock.now());
      return { day, claims: this.checkIn.claims, cycleIndex: this.checkIn.claims % this.config.rewards.checkIn.length, canClaim: this.checkIn.lastClaimDay === null || day > this.checkIn.lastClaimDay, nextReward: { ...this.config.rewards.checkIn[this.checkIn.claims % this.config.rewards.checkIn.length] }, lastClaimDay: this.checkIn.lastClaimDay };
    }
    claimDailyCheckIn() {
      const status = this.getCheckInStatus();
      if (!status.canClaim) return { ok: false, reason: "ALREADY_CLAIMED" };
      const { coins, diamonds, energy } = status.nextReward;
      this.checkIn = { lastClaimDay: status.day, claims: this.checkIn.claims + 1 };
      this.progression.addCoins(coins);
      this.player.diamonds += diamonds;
      this.energy.add(energy);
      const itemId = status.nextReward.itemId;
      if (itemId) this.enqueue(itemId);
      this.bus.emit("CHECK_IN_CHANGED", { day: status.day });
      this.save();
      return { ok: true, coins, energy, diamonds, ...itemId ? { itemId } : {} };
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
      this.dom.xpText.textContent = xpInfo.nextThreshold === null ? `${Math.max(0, p.xp - currentFloor)} / MAX` : `${Math.max(0, p.xp - currentFloor)} / ${span}`;
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
