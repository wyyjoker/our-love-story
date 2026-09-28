# Cocos Smoke Test Checklist (V0.2)

> 手工验收。勾选前必须真实操作 Creator / 构建产物。禁止未跑就打勾。

## Project

- [x] Creator 3.8.8 可打开项目（CLI 导入并完成构建）
- [x] 无 Script compile error（Creator 构建成功，Cocos TS 类型检查通过）
- [x] Game.scene 可加载（Web Mobile 构建在浏览器中启动）
- [x] Game.scene 是 Start Scene（构建设置与产物核对）
- [x] GameBootstrap 已挂到 GameRoot（静态自检与运行画面核对）

## Runtime

- [x] 进入封面显示并能进入游戏（Web Mobile，390×844）
- [x] 状态栏显示（Lv / XP / ⚡ / 💰 / ♥；Web Mobile）
- [x] 三个订单显示（Web Mobile）
- [x] 9×9 棋盘显示完整（Web Mobile）
- [x] 长屏棋盘底板贴合九行格子，上下区域显示背景与提示（Web Mobile，390×844）
- [x] 四个 Generator 显示（锁定文案可见；Web Mobile）
- [x] 家园客厅、卧室、花园切换后显示不同背景（Web Mobile）
- [x] 家园场景、任务弹窗和家具目录分层显示；弹窗不会被家具/导航盖住（Web Mobile）
- [x] 任务弹窗打开时点底部导航不会切页；关闭后可切换（Web Mobile）
- [x] 弹窗内点击未完成项目时，提示消息显示在弹窗上方（Web Mobile）
- [x] 家具目录从「布置家具」打开，关闭后回到原房间（Web Mobile）
- [x] 回忆相册及心动日记分页可打开，日记插画与文字不重叠（Web Mobile）
- [x] 长屏 390×844 没有上下黑边，家园按钮没有横向裁切（Web Mobile）
- [x] 真机进入封面、合成、家园及弹窗页面显示正常（2026-09-28，用户确认）
- [ ] 刘海/底部安全区未遮挡 StatusBar / Dock

## Gameplay

- [x] Generator Spawn（Web Mobile 点击咖啡机，体力 100→99）
- [ ] Move（拖到空格）
- [ ] Swap（拖到不同物品）
- [x] Merge（Web Mobile 与微信开发者工具模拟器均已拖动合成成功；2026-09-28 用户复测）
- [x] 调整棋盘底板后，Web Mobile 自动化触摸拖动仍触发 MERGE（2026-09-28）
- [x] 调整棋盘底板后，真机拖动合成通过（2026-09-28，用户确认）
- [ ] Cancel（拖出棋盘还原）
- [ ] Claim Order（扣物 + 发奖 + 新订单）
- [ ] Level Up 浮层
- [ ] Lv3 花篮礼包领取、连续升级与弹窗顺序
- [ ] Lv5 甜品烤箱、Lv8 礼物盒解锁
- [ ] 回忆按顺序扣爱心解锁，日记可查看
- [ ] 家具购买、摆放、收起，装修值最高 50
- [ ] 10 个心愿完成并各领奖一次
- [x] 家园拍照成功（2026-09-28，用户真机确认）
- [ ] 本机照片页可查看已拍照片

## Touch

- [ ] TOUCH_START 不立刻当拖动
- [ ] dragThreshold 12px 生效
- [ ] Ghost 跟随，源 item 半透明
- [ ] 可 Merge 目标高亮
- [x] TOUCH_END 合成落格正确（Web Mobile、微信模拟器及真机均通过）
- [ ] TOUCH_CANCEL 还原

## Save

- [x] Spawn 后保存（Web Mobile 重载仍有新物品）
- [x] Merge 后保存（Web Mobile 重载仍有合成后的物品）
- [x] 真机关闭后重开，存档可恢复（2026-09-28，用户确认）
- [ ] Order claim 后保存
- [ ] 切后台（hide）flushSave
- [ ] 回前台体力恢复
- [ ] 重启恢复 Board / Energy / Level / Orders / Coins / Hearts

## Build

- [x] Web Mobile build（Creator 3.8.8 CLI，2026-09-28；长屏逐页截图）
- [x] WeChat build（Creator 3.8.8 CLI，2026-09-28；本轮 UI 已由用户真机验收）
- [x] 主包体积已记录（`npm run verify:wechat-package`）
- [x] 微信开发者工具运行（小游戏测试号，模拟器已启动并完成拖动合成）

## 记录

| 项 | 结果 |
| --- | --- |
| Creator version | 3.8.8（CLI 构建） |
| Preview | NOT RUN（Creator 编辑器预览） |
| Web Mobile | PASS（浏览器启动；390×844 检查封面、合成、家园三房间、任务、家具目录、回忆；底部导航被弹窗阻断） |
| WeChat Build | PASS（2026-09-28 构建完成，已生成分包；构建配置的小游戏测试号 AppID 已保留） |
| WeChat DevTools | PARTIAL（模拟器拖动合成已成功；本轮封面、页面、拍照及重启存档由用户真机确认） |
| 手机真机 | PARTIAL（2026-09-28 用户确认拖动合成、页面显示、拍照和重启存档通过；其余项目未逐项确认） |
| Package size | 主包 3,917,209 / 4,000,000 字节；game_art 分包 4,810,245 字节（2026-09-28 重构建） |

未勾选的拖动细节、安全区、后台恢复和其他玩法项仍需逐项操作，不以单元测试或概括性验收代替具体结果。
