# 前 15 分钟体验打磨与验证

日期：2026-11-13。范围只限新手合成循环、首单、小约会、首章解谜和 Lv3 解锁；本轮没有扩章节，也没有调整订单、经验或体力数值。

## 体验改动

- 合成棋盘显示当前小约会目标与进度，备齐时提示前往交付；短屏布局保留紧凑目标栏。
- 点棋盘物品打开合成链图鉴，显示来源、生成体力消耗、解锁等级及当前约会需求，并可跳转仓库/剪刀。
- 合成增加轻量弹跳/星点；订单和约会奖励显示金币、经验、爱心；首章谜题成功时显示短暂动画。
- 声音与触感开关写入存档；v3 存档迁移到 v4 时保留进度并为旧存档补默认偏好。

相关实现：[`CocosGameView.ts`](../assets/scripts/ui/cocos/CocosGameView.ts)、[`CocosBoardView.ts`](../assets/scripts/ui/cocos/CocosBoardView.ts)、[`CocosItemGuide.ts`](../assets/scripts/ui/cocos/CocosItemGuide.ts)、[`CocosSettingsPanel.ts`](../assets/scripts/ui/cocos/CocosSettingsPanel.ts)、[`CocosFeedback.ts`](../assets/scripts/platform/cocos/CocosFeedback.ts)、[`SaveService.ts`](../assets/scripts/infrastructure/SaveService.ts)。

## 全新存档路线

隔离的 Chrome 新档通过触摸/拖动 UI 完成；场景内状态读取仅用于断言，路线本身不调用调试生成/加经验接口。一次运行从首个合成、首单、小约会走到舟山章节两步交付、解谜并领取，随后达到 Lv3 花篮解锁。最终自动化触摸路线记录耗时约 78.7 秒、13 次订单交付、44 次生成、25 次合成；领取 Lv3 特殊奖励后的状态为 Lv4、460 XP、62 点体力，小约会完成 1 次，舟山谜题已解并领取。

该耗时是自动化触摸脚本的运行时间，不等同于真实玩家阅读、思考和操作所需时间；订单抽取及生成结果仍有随机性。基于该路线无体力/棋盘阻塞且保有体力余量，本轮保留现有 XP 与奖励数值，不为缩短脚本时间额外加速升级。

自动化证据由 [`qa-cocos-web.mjs`](../tools/qa-cocos-web.mjs) 产生；最终运行记录见 [`result.json`](../temp/cocos-ui-qa-2026-11-13T12-35-39-528Z/result.json) 与 [`first15-fresh-save.json`](../temp/cocos-ui-qa-2026-11-13T12-35-39-528Z/first15-fresh-save.json)。

## 验证状态

- `npm run test:core`：24 个测试文件、123 项通过。
- `npm run lint:core`、`npm run build:web`、`npm run verify:cocos`、`npm run test:tools`：通过。
- Creator Web Mobile 构建成功；真实 Cocos Web Mobile 触摸 QA 24 项通过（含 390×700 短屏目标栏），无未捕获运行时异常。
- `npm run build:wechat` 与 `npm run verify:wechat-package`：Creator 微信小游戏构建及包体检查通过；主包 3,939,931 / 4,000,000 bytes（约剩 60 KB），`game_art` 分包 8,852,748 bytes。候选包尚未上传。
- 尚未用微信开发者工具或真实设备验收音频、触感和存档恢复。
