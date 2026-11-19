# 我们的浪漫小屋（our-love-story）

送给重要的人的专属 Merge 情侣小游戏。

当前版本：**1.3.0 — 发现、补给与扩展家园**（本轮候选包未上传）。最新交互见 [订单交付与奖励反馈](docs/DELIVERY_POLISH.md)，五级补给等规则见 [Nov 16 精修说明](docs/NOV16_REFINEMENT.md)；1.3 原始范围见 [1.3 交付说明](docs/EXPANSION_1_3.md)。个人内容由配置驱动，相册现有 42 段回忆。

最新成长、回忆、订单和周任务规则见 [1.3 交付说明](docs/EXPANSION_1_3.md)。前期从 Lv2 起可有橘树订单，首用背包、剪刀和宝箱有一次性提示，见 [前期体验整理](docs/FIRSTPLAY_FINISH.md)。婚礼收尾信暂留待填写，个人内容见 [故事核对](docs/STORY_REVIEW.md)。

最新追加打磨见 [订单追踪与家园摆放](docs/ORDER_TRACKING_HOME.md)：需求点击备货卡、订单备齐中间提示可直接交付；补给先查看再确认使用，橘树基础恢复 1 分钟/次；家园上移房间栏、扩大摆放区域并增加六款客厅壁画。

**正式客户端：Cocos Creator 3.8.8**（目标微信小游戏）。  
**Browser client（`index.html`）：开发/逻辑验证辅助 Debug Harness**，与 Cocos 共用同一套 Domain/Gameplay，不是第二款产品。

## 项目是什么

一款竖屏微信小游戏，包含 Merge-2 合成、订单、等级成长、回忆相册、小屋装修与一次性心愿。正式客户端由 Cocos Creator 3.8.8 构建。

纯 TS 玩法与平台适配分离；Cocos 负责触摸与界面，浏览器入口仅用于逻辑调试。

## 玩法

- 最大 7×9 合成棋盘。新档开放 3×3，Lv10 到达 6×7，Lv18 全开。咖啡机、花篮、甜品烤箱、礼物盒分别在 Lv1/3/5/8 解锁
- 新档从咖啡合成链与咖啡订单开始
- 七条主物品链最高 Lv18。两个相同物品可合成下一级，方糖短链最高 Lv5
- 顶部 6 个可滑动查看的订单位，快单、常规单和挑战单各两个。每单最多 2 件，常规单和挑战单随等级增加难度
- 42 条回忆各有一关，探索开放给全部等级。解谜有免费提示，也可以跳过后珍藏故事。完成后可领取一次性奖励，原有六章保留家园纪念物
- 已完成谜题可免费重玩并保存练习进度；八组低成本小约会随解锁轮换，交付物品后获得金币、爱心和经验
- 随身背包初始 6 格，可用钻石逐格扩至 36 格。物品和生成器可以拖入背包。剪刀可拖放和合成，五级次数为 1/3/8/20/50，合并时按剩余次数折算。旧档剪刀库存可在背包取出
- 自然体力上限随等级从 100 增至 1000，每 4 分钟恢复 1 点；奖励体力可溢出，今日日记加照片每天可领一次整管体力
- Lv1–50，升级需求为 50 × 当前等级经验。每级礼包只可领取一次，指定里程碑赠送进阶生成器
- 42 段故事与日记，配独立原创概念插画；未解锁内容隐藏；婚礼、领证、答谢宴分别记录
- 客厅、卧室、花园、书房、露台、泳池六个场景，36 件家具（含 6 款客厅壁画），支持拖动、吸附对齐、缩放、平面旋转、翻转及恢复默认
- 首次合成发现奖励、升级与随机合成宝箱（最高 5 级）；金币、钻石和体力瓶补给链最高 5 级，可拖动合成，轻点先看详情、确认后使用
- 钻石换体力、七日循环签到、每日任务与奖励恢复箱。Lv8 开放每周经营，八个主题轮换，已达标的往期礼包可补领
- 顶部签到独立入口；右上常驻体力/金币/钻石，爱心显示在左上等级卡；底部导航随当前页面正确选中
- 合成页使用单行约会目标与包形拖放入口。家园统一装修底座，相册精简标题，界面验证见 [布局整理](docs/LAYOUT_REFINEMENT.md)
- 阳光橘树免费采摘，基础每分钟恢复一次，初始储存 10 次。顶部六位顾客可以左右滑动，交付后原位补单。
- 七种生成器里，调色画架在 Lv22 解锁，留影工作台在 Lv32 解锁。生成器和普通物品共用 7×9 棋盘，可拖进背包。点击产出，长按查看，两台同类同级机器可拖动合成至 Lv9。
- 点普通合成物可查看出售价，确认出售后获得金币并腾出一格。会影响已备齐的订单时，确认页会提前提示。
- 高级生成器的主产出等级随之提升。普通生成器连续产出 60 次后进入冷却，可用钻石恢复，升级后可开启强化产出。合成中会遇到方糖短链和万能食材，收齐图鉴一组可领取永久小增益。
- 拍照留念在微信小游戏中保存本机照片；拜访入口说明当前是单机版本
- 存档 v9 自动迁移旧档并先备份。已有物品所在格保留开放权，棋盘无法容纳的物品进入奖励恢复箱。存档保留累计经验、剪刀次数、照片、偏好和回忆权益

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

见 [CHANGELOG.md](CHANGELOG.md)。原创美术位于 `assets/game_art/`（微信独立分包），玩法数据位于 `assets/resources/config/`。

## 发布验收与个人内容

- 新版安装包仍需用微信真机复测触摸、相册权限、安全区和存档恢复
- 42 段个人故事与配套插画已接入。婚礼来信正文按当前约定保留待填写，可在个人内容配置中更新

## Roadmap

见 [docs/ROADMAP.md](docs/ROADMAP.md)。

## License

个人原创项目，未使用商业游戏代码、美术、音乐、字体、剧情或名称。
