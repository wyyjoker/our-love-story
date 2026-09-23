# 我们的浪漫小屋（our-love-story）

送给重要的人的专属 Merge 情侣小游戏。

当前版本：**V0.2 — 可玩内容版**（微信开发者工具实机验收仍需完成）

**正式客户端：Cocos Creator 3.8.8**（目标微信小游戏）。  
**Browser client（`index.html`）：开发/逻辑验证辅助 Debug Harness**，与 Cocos 共用同一套 Domain/Gameplay，不是第二款产品。

## 项目是什么

一款竖屏微信小游戏，包含 Merge-2 合成、订单、等级成长、回忆相册、小屋装修与一次性心愿。正式客户端由 Cocos Creator 3.8.8 构建。

纯 TS 玩法与平台适配分离；Cocos 负责触摸与界面，浏览器入口仅用于逻辑调试。

## 玩法

- 9×9 Merge 棋盘；咖啡机、花篮、甜品烤箱、礼物盒分别在 Lv1/3/5/8 解锁
- 新档从咖啡合成链与咖啡订单开始
- 每条链 8 级，两个相同物品可合成下一级
- 顶部 3 个订单，收集指定物品后可交付
- 体力上限 100，每 4 分钟恢复 1 点（支持离线恢复）
- Lv1–18，升级需求为 50 × 当前等级经验；升级礼包只可领取一次
- 10 段可替换的原创示例回忆与日记、10 件家具、10 个一次性小屋心愿
- 拍照留念在微信小游戏中保存本机照片；拜访入口说明当前是单机版本

## 技术栈

| 层 | 技术 |
| --- | --- |
| 正式客户端 | Cocos Creator 3.8.8 + TypeScript + 微信小游戏 |
| 核心逻辑 | 纯 TypeScript（禁止依赖 cc） |
| 配置 | JSON（合成、生成器、订单、成长、回忆、家具、心愿、礼包） |
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
2. 打开 `assets/scenes/Game.scene`；`GameRoot` 已挂载 **GameBootstrap**
3. Start Scene 为 `Game.scene`，设计分辨率 750×1334 Fit Width，竖屏
4. Build：`Web Mobile` 与 `WeChat Mini Game`，再用微信开发者工具验收

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

见 [CHANGELOG.md](CHANGELOG.md)。存档 v2 支持旧档迁移，原创美术位于 `assets/resources/art/`，玩法数据位于 `assets/resources/config/`。

## 未完成功能

- 微信开发者工具触摸、相册权限与不同机型安全区验收
- 用户自己的故事、照片与插画替换
- 微信登录、云存档、广告、支付、多人（当前版本无此功能）

## Roadmap

见 [docs/ROADMAP.md](docs/ROADMAP.md)。

## License

个人原创项目，未使用商业游戏代码、美术、音乐、字体、剧情或名称。
