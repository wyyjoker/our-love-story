# Changelog

## [0.2.0] — 完整可玩内容版

- 9×9 棋盘、100 点体力、4 分钟恢复、Lv1–18 与新档咖啡开局
- 存档 v2 自动迁移旧棋盘、经验与体力缺口
- 10 条回忆与日记、10 件家具（总装修值 50）、10 个可领奖心愿
- 一次性升级礼包；Lv3 礼包会继续推进等级并依次展示弹窗
- 原创插画背景与图集、合成/回忆/家园/任务页面、资源帮助与本机拍照
- Cocos Creator 3.8.8 Web Mobile 构建与浏览器画面预览
- 微信开发者工具验收仍待进行
- 客厅、卧室、花园各用独立场景插画；家具按房间的配置位置摆放，目录显示装修进度
- 修复电脑端拖动合成的事件回调错误，以及跨页面残留的合成引导

## [0.1.1] — V0.1B Cocos Native Runtime

### Added
- Real Cocos `GameBootstrap` (`extends Component`, `@ccclass`, lifecycle)
- Cocos platform adapters: storage / platform / lifecycle / safe area
- Runtime Cocos UI (status, orders, 7×9 board, generator dock, toast, tutorial, level-up, debug)
- Touch drag with 12px threshold, ghost, merge highlight
- Presentation `GameViewMapper` (Chinese copy)
- `tsconfig.core.json` (pure core typecheck without `cc`)
- `tools/verify-cocos-project.mjs`, `tools/verify-all.mjs`
- `docs/COCOS_SETUP.md`, `docs/COCOS_SMOKE_TEST.md`

### Changed
- package scripts: `lint` / `lint:core`, `verify`, `verify:cocos`
- UI strings unified to Chinese
- README clarifies Cocos as primary client, browser as debug harness

### Note
- Cocos Creator was not available in this environment; Editor / Web Mobile / WeChat builds were NOT RUN here.

## [0.1.0] — V0.1 Core Merge

### Added
- Bootstrap project layout, TypeScript strict toolchain, Vitest
- Config-driven merge chains (coffee / flower / dessert / gift, 8 levels each)
- MergeEngine, board move/swap/merge rules
- Generators, energy + offline recovery, orders, progression, local save
- Browser playable client sharing the same domain layer
- Docs and AGENTS.md
