# Changelog

## [1.2.0] — 2026-11-13 六章探索与持续约会（未上传）

- 通过本地 DeepSeek MCP 委派实现，Codex 审查与验证；保留原有 28 章故事、插画和存档权益。
- 新增横店跨年、丽江婚纱照、乐清草坪婚礼三个探索章节，总计六章，约会目录分页显示。
- 已领奖谜题支持免费重玩，练习进度独立保存，完成练习不重复发奖。
- 新增四组可循环的小约会订单，按解锁链筛选低成本物品，奖励金币、爱心与经验；订单身份校验避免旧回调重复交付。
- 普通订单同时避开当前订单和最近需求，候选不足合理退化；增加低成本组合，延后早期高成本拿铁单。
- 存档保持 v3，新字段自动补齐；验证范围与新增手机复查项见 PLAYFUL_1_2.md。

## [1.1.0] — 2026-11-12 今日约会与回忆解谜（未上传）

- 新增三章独立探索：舟山寻物密码、情书排序、南山塔旋转线路；每章先完成两步剧情订单，免费提示、错误不扣体力、确认后可跳过谜题。
- 完成探索后一次性领取金币、爱心、体力、剪刀和对应回忆；三件纪念物自动出现在家园对应房间，点击可重读日记。已购买的回忆不重复扣费。
- 新增 6 格仓库和剪刀：收纳/取回保留 UID，二级以上物品可拆为两个低一级物品；满格和无剪刀有反馈且不丢物品。
- 合成页增加今日约会、仓库与剪刀工具栏；点棋盘物品可快速定位工具箱；任务与相关日记也可进入探索。
- 存档升至 v3，升级前备份原始数据，保存订单阶段、线索、密码、信件顺序、线路旋转、提示及领奖状态。
- 重用现有原创插画和物品素材，新增解谜与合成 UI；切换玩法页面清理上一页的短提示。验证与真机待验项见 PLAYFUL_1_1.md。

## [1.0.1] — 2026-11-12 个人故事扩展（未上传）

- 按用户补充扩展为 28 章，覆盖 2023-09-08 相识至 2026 年婚礼、领证和答谢宴；完整细节与少量待核对原话见个人故事文档。
- 相册、日记、进度和分页改为按配置数量显示，不再固定十章；家具和心愿仍各十项。
- 保留原十章 ID、原费用与已解锁权益，新增章节可顺序补齐，不重置存档或重复扣费。
- 日记正文支持触摸滚动，切换章节回到正文顶部；封面相识日期补全为 2023.09.08。
- 28 章各自接入一张独立生成的水彩故事插画，统一人物形象；压缩后放入 game_art 分包，保留后续替换真实照片的入口。
- 日记插画可点开完整大图，加载失败有提示；逐章配置取景位置，修正小屏日记裁掉人物头顶的问题。概念插画不作为真实照片。

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
