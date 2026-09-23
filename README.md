# 我们的浪漫小屋（our-love-story）

送给重要的人的专属 Merge 情侣小游戏。

当前版本：**V0.1（核心 Merge 闭环）**

## 项目是什么

一款微信小游戏（竖屏），核心玩法为 Merge-2 合成 + 订单 + 体力 + 等级成长。后续版本会逐步加入情侣剧情、回忆照片、小屋装修等内容。

V0.1 的目标是把**真正可运行的核心循环**做稳：

启动 → 读档 → 点击生成器 → 扣体力 → 生成物品 → 拖动 / 合成 → 交付订单 → 金币 / XP / 爱心 → 升级解锁 → 自动存档 → 重进恢复。

## 玩法（V0.1）

- 7×9 Merge 棋盘
- 底部 4 个生成器：咖啡机、花篮、甜品烤箱（Lv3）、礼物盒（Lv5）
- 初始合成链 coffee / flower；升级解锁 dessert / gift
- 每条链 8 级，两个相同物品可合成下一级
- 顶部 3 个订单，收集指定物品后可交付
- 体力 50 上限，每 120 秒恢复 1 点（支持离线恢复）
- 等级 Lv1–Lv5，金币 / 爱心获取并保存（V0.1 不消费）

## 技术栈

| 层 | 技术 |
| --- | --- |
| 客户端目标 | Cocos Creator 3.8.8 + TypeScript + 微信小游戏 |
| 核心逻辑 | 纯 TypeScript（不依赖 Cocos） |
| 配置 | JSON（items / generators / orders / progression / game） |
| 存档 | Storage 抽象（Cocos sys.localStorage / Web / 微信） |
| 测试 | Vitest（core + gameplay + infrastructure） |
| 本地可玩预览 | 浏览器 index.html（同一套 Domain / Gameplay） |

## 环境要求

- Node.js 18+（开发与测试）
- npm 9+
- Cocos Creator **3.8.8**（编辑器打开 / 预览 / 构建微信小游戏）
- 微信开发者工具（WeChat Mini Game 构建后导入）

## 安装与测试

```bash
npm install
npm run test:core
npm run lint
```

## 浏览器预览（V0.1 可玩版）

```bash
npm run build:web
```

然后用浏览器打开项目根目录的 `index.html`。

浏览器版与 Cocos 版共享 `assets/scripts/core`、`assets/scripts/gameplay`、`assets/scripts/infrastructure`、`assets/scripts/events` 同一套逻辑；UI 层可替换。

## 用 Cocos Creator 打开

1. 安装 Cocos Dashboard，安装 **Cocos Creator 3.8.8**
2. 用 Creator 打开本仓库根目录
3. 打开场景 `assets/scenes/Game.scene`（若编辑器提示重建资源 UUID，按默认确认）
4. 在 Editor Preview 中验证交互
5. 菜单 **Project → Build**
6. Platform 选择 **WeChat Mini Game**
7. 用微信开发者工具打开构建输出目录

竖屏：设计分辨率 **750×1334**，Fit Width 开启。

## 目录结构

```text
our-love-story/
├─ assets/
│  ├─ scenes/Game.scene
│  ├─ scripts/
│  │  ├─ core/             # 纯 TS Domain
│  │  ├─ gameplay/         # 玩法服务 + GameContext
│  │  ├─ infrastructure/   # Save / Clock / Id / Random / Platform
│  │  ├─ events/           # 类型化事件总线
│  │  ├─ config/           # 配置加载与校验
│  │  └─ ui/               # Cocos / 通用 UI
│  └─ resources/config/    # items/generators/orders/progression/game
├─ src/web/                # 浏览器可玩 UI
├─ tests/                  # Vitest
├─ docs/
├─ tools/
├─ index.html
├─ styles.css
└─ game.js                 # npm run build:web
```

## 已完成功能（V0.1）

- 配置驱动的 4 条 × 8 级合成链
- MergeEngine（同 id 合成，满级不可合）
- 棋盘 Move / Swap / Merge / Cancel
- 4 个生成器、锁定解锁、加权掉落
- 体力消耗与离线恢复
- 订单生成 / 进度 / 交付事务
- 金币 / XP / 爱心 / 等级 / 链解锁
- 本地存档、版本号、坏档恢复
- 新手引导、Toast、合成反馈、升级提示
- 核心自动化测试
- 浏览器可玩界面
- Cocos UI 脚本骨架（GameBootstrap / GameController 等）

## 未完成功能

- 正式美术（当前为程序化色块 / 缩写）
- 情侣剧情、照片、回忆、装修
- 微信登录 / 云存档 / 广告 / 支付 / 多人
- Cocos Prefab 美化与真机安全区微调

## Roadmap

见 [docs/ROADMAP.md](docs/ROADMAP.md)。

## 验证状态

- Automated tests: 见实现报告中的真实命令与结果
- Cocos Editor Preview: 需本机 Cocos Creator
- WeChat build: 需 Cocos Creator + 微信开发者工具

## License

个人原创项目，未使用商业游戏代码、美术、音乐、字体、剧情或名称。
