# 我们的浪漫小屋（our-love-story）

送给重要的人的专属 Merge 情侣小游戏。

当前版本：**1.3.0 — 发现、补给与扩展家园**（本轮候选包未上传）。最新交互见 [订单交付与奖励反馈](docs/DELIVERY_POLISH.md)，五级补给等规则见 [Nov 16 精修说明](docs/NOV16_REFINEMENT.md)；1.3 原始范围见 [1.3 交付说明](docs/EXPANSION_1_3.md)。个人内容由配置驱动，相册现有 42 段回忆。

最新前期规则与构建见 [前期体验整理](docs/FIRSTPLAY_FINISH.md)：Lv2 即可有橘树订单，前期允许双需求，首用背包/剪刀/宝箱有一次性短引导；微信主包已缩至约 1.72 MB。个人内容见 [故事核对](docs/STORY_REVIEW.md)，婚礼收尾信暂留待填写。

**正式客户端：Cocos Creator 3.8.8**（目标微信小游戏）。  
**Browser client（`index.html`）：开发/逻辑验证辅助 Debug Harness**，与 Cocos 共用同一套 Domain/Gameplay，不是第二款产品。

## 项目是什么

一款竖屏微信小游戏，包含 Merge-2 合成、订单、等级成长、回忆相册、小屋装修与一次性心愿。正式客户端由 Cocos Creator 3.8.8 构建。

纯 TS 玩法与平台适配分离；Cocos 负责触摸与界面，浏览器入口仅用于逻辑调试。

## 玩法

- 最大 6×7 Merge 棋盘；新档先开放 3×3，随等级扩展，Lv10 全开；咖啡机、花篮、甜品烤箱、礼物盒分别在 Lv1/3/5/8 解锁
- 新档从咖啡合成链与咖啡订单开始
- 五条主物品链最高 12 级，两个相同物品可合成下一级；每个订单总需求不超过 2 件，通常为 1 件
- 顶部 3 个订单，收集指定物品后可交付
- 六章约会探索：舟山、100 封情书、南山塔、横店跨年、丽江婚纱照、乐清草坪婚礼；达级直接解谜，无需备料，免费提示、可跳过，完成后领取一次性回忆与家园纪念物
- 已完成谜题可免费重玩并保存练习进度；八组低成本小约会随解锁轮换，交付物品后获得金币、爱心和经验
- 棋盘旁有 6 格随身背包，物品可直接拖进背包收纳；剪刀是可拖放、可合成的五级物品，可用次数为 1/3/8/20/50，用过的剪刀合并按剩余次数折算；旧档剪刀库存需在背包取出
- 自然体力上限随等级从 100 增至 1000，每 4 分钟恢复 1 点；奖励体力可溢出，今日日记加照片每天可领一次整管体力
- Lv1–18，升级需求为 50 × 当前等级经验；升级礼包只可领取一次
- 42 段故事与日记，配独立原创概念插画；未解锁内容隐藏；婚礼、领证、答谢宴分别记录
- 客厅、卧室、花园、书房、露台、泳池六个场景，30 件家具，支持拖动、缩放、平面旋转、翻转及恢复默认
- 首次合成发现奖励、升级与随机合成宝箱（最高 5 级）；金币、钻石和体力瓶补给链最高 5 级，可拖动合成，也可点击使用
- 钻石换体力、七日循环签到、每日任务与奖励恢复箱
- 顶部签到独立入口；右上常驻体力/金币/钻石，爱心显示在左上等级卡；底部导航随当前页面正确选中
- 合成页使用单行约会目标与独立包形拖放入口，背包为六格底部抽屉；家园统一装修底座、相册精简标题，最新界面验证见 [布局整理](docs/LAYOUT_REFINEMENT.md)
- 阳光橘树免费采摘、时间恢复（初始储存 10 次）与十二阶水果链；三个订单槽按等级递进，完成交付后自动补单，不提供手动换单
- 生成器最高 8 级，N 级主产出最低 N 阶；普通生成器连续产出 60 次后进入冷却，支持金币购买副本、合并升级、强化产出和钻石恢复；方糖短链与万能食材；链图鉴收齐可领取永久小增益
- 拍照留念在微信小游戏中保存本机照片；拜访入口说明当前是单机版本
- 存档 v8 自动迁移旧档并先备份，保留剪刀剩余次数；旧档已有物品所在格保留开放权，空格随等级解锁；超出 42 格的物品进入奖励恢复箱，保留 UID、照片、偏好与回忆权益

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

Web Mobile 的 `?preview=lv12` 地址提供独立 Lv12 演示，包含 `320/600` 经验和完整物品。演示只使用内存存档，刷新重置，不读取或覆盖正式进度；微信小游戏没有此入口。

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

见 [CHANGELOG.md](CHANGELOG.md)。存档 v2 支持旧档迁移，原创美术位于 `assets/game_art/`（微信独立分包），玩法数据位于 `assets/resources/config/`。

## 未完成功能

- 微信开发者工具触摸、相册权限与不同机型安全区验收
- 用户自己的故事、照片与插画替换
- 微信登录、云存档、广告、支付、多人（当前版本无此功能）

## Roadmap

见 [docs/ROADMAP.md](docs/ROADMAP.md)。

## License

个人原创项目，未使用商业游戏代码、美术、音乐、字体、剧情或名称。
