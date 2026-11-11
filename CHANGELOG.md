# Changelog

## [1.0.0] — 2026-11-11 本地交付版（未公开发布）

- 整理十章个人故事草稿与原创配图；保留旧章节 ID、顺序、爱心费用和解锁进度。
- 重做拍立得相册、订单头像、生成器卡片、图标导航、手势引导和分项奖励弹窗，适配长短竖屏。
- 修复家具等分裁切带入邻格图案，校准三房间尺度、遮挡、阴影和室内地毯。
- 对齐物品名称与插画，保留物品 ID/合成规则/旧存档。
- 修复照片仅能访问最后四张、加载失败无说明、写入失败静默、读取失败覆盖风险和完整安全区处理。
- 提示去重，最高级物品提示；插画下载失败仍显示物品代码和订单名称。
- Web Mobile 独立 Lv12 演示使用内存存档，刷新重置，不覆盖正式进度。
- 增加存档故障、完整成长、个人故事兼容、演示隔离和平台拍照测试，以及真实 Cocos 客户端的独立浏览器回归工具。
- 实际构建与最新手机复查记录见 `docs/RELEASE_1_0.md`；未上传本轮包或安排体验。
- 用户对本轮五项手机复查清单回复“没啥问题，你继续吧”；未提供机型和逐项操作细节，记录为用户反馈，不冒充现场观测。

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
