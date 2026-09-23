# 我们的浪漫小屋（our-love-story）

送给重要的人的专属 Merge 情侣小游戏。

当前版本：**V0.1B — Cocos Runtime Source Ready**（Creator 构建需本机验证后才能标 Ready）

**正式客户端：Cocos Creator 3.8.8**（目标微信小游戏）。  
**Browser client（`index.html`）：开发/逻辑验证辅助 Debug Harness**，与 Cocos 共用同一套 Domain/Gameplay，不是第二款产品。

## 项目是什么

一款微信小游戏（竖屏），核心玩法为 Merge-2 合成 + 订单 + 体力 + 等级成长。后续版本会逐步加入情侣剧情、回忆照片、小屋装修等内容。

V0.1 做稳核心循环；V0.1B 把同一套 Pure TS Core 接到真正的 Cocos Runtime UI / Touch / Storage / Lifecycle。

## 玩法（V0.1 / V0.1B）

- 7×9 Merge 棋盘
- 底部 4 个生成器：咖啡机、花篮、甜品烤箱（Lv3）、礼物盒（Lv5）
- 初始合成链 coffee / flower；升级解锁 dessert / gift
- 每条链 8 级，两个相同物品可合成下一级
- 顶部 3 个订单，收集指定物品后可交付
- 体力 50 上限，每 120 秒恢复 1 点（支持离线恢复）
- 等级 Lv1–Lv5，金币 / 爱心获取并保存（当前版本不消费）

## 技术栈

| 层 | 技术 |
| --- | --- |
| 正式客户端 | Cocos Creator 3.8.8 + TypeScript + 微信小游戏 |
| 核心逻辑 | 纯 TypeScript（禁止依赖 cc） |
| 配置 | JSON（items / generators / orders / progression / game） |
| 存档 | Storage 抽象（Cocos `sys.localStorage` / Web / mock） |
| 测试 | Vitest（core + gameplay + infrastructure + presentation） |
| 辅助 | 浏览器 `index.html` Debug Harness |

## 环境要求

- Node.js 18+
- npm 9+
- Cocos Creator **3.8.8**
- 微信开发者工具（可选，用于 WeChat 运行时验证）

## 安装与测试

```bash
npm install
npm run test:core
npm run lint:core
npm run build:web
npm run verify:cocos
# 或一次跑完
npm run verify
```

## 浏览器预览（Debug Harness）

```bash
npm run build:web
```

打开项目根目录 `index.html`。

## 用 Cocos Creator 打开

详见 [docs/COCOS_SETUP.md](docs/COCOS_SETUP.md) 与 [docs/COCOS_SMOKE_TEST.md](docs/COCOS_SMOKE_TEST.md)。

摘要：

1. Cocos Creator **3.8.8** 打开仓库根目录
2. 打开 `assets/scenes/Game.scene`，将自定义组件 **GameBootstrap** 挂到 `GameRoot`
3. 设为 Start Scene，设计分辨率 750×1334 Fit Width，竖屏
4. Editor Preview 验证后 Build：`Web Mobile` → 再 `WeChat Mini Game`

## 目录结构

```text
our-love-story/
├─ assets/
│  ├─ scenes/Game.scene
│  ├─ scripts/
│  │  ├─ core/             # 纯 TS Domain（禁 cc）
│  │  ├─ gameplay/         # 服务 + GameContext（禁 cc）
│  │  ├─ infrastructure/   # Save/Clock/Id/Random/Platform
│  │  ├─ events/           # 类型化事件总线
│  │  ├─ config/           # 配置加载与校验
│  │  ├─ presentation/     # GameViewMapper
│  │  ├─ platform/cocos/   # Cocos 适配层（可 import cc）
│  │  └─ ui/
│  │     ├─ cocos/         # Cocos Runtime UI + GameBootstrap
│  │     └─ *              # 平台无关 UI 契约 / Theme
│  └─ resources/config/
├─ src/web/                # 浏览器 Debug Harness
├─ tests/
├─ docs/                   # 含 COCOS_SETUP / COCOS_SMOKE_TEST
├─ tools/                  # verify-cocos-project / verify-all
├─ index.html · styles.css · game.js
└─ package.json · tsconfig.json · tsconfig.core.json
```

## 已完成功能

见 [CHANGELOG.md](CHANGELOG.md)。V0.1 核心闭环 + V0.1B Cocos Runtime 源码层（Component / UI / Touch / Storage / Lifecycle / Safe Area）。

## 未完成功能

- 本环境未执行 Cocos Editor Preview / Web Mobile Build / WeChat Build（见报告）
- 正式美术
- 情侣剧情、照片、回忆、装修
- 微信登录 / 云存档 / 广告 / 支付 / 多人

## Roadmap

见 [docs/ROADMAP.md](docs/ROADMAP.md)。

## License

个人原创项目，未使用商业游戏代码、美术、音乐、字体、剧情或名称。
