# Cocos Smoke Test Checklist (V0.2)

> 手工验收。勾选前必须真实操作 Creator / 构建产物。禁止未跑就打勾。

## Project

- [x] Creator 3.8.8 可打开项目（CLI 导入并完成构建）
- [x] 无 Script compile error（Creator 构建成功，Cocos TS 类型检查通过）
- [x] Game.scene 可加载（Web Mobile 构建在浏览器中启动）
- [x] Game.scene 是 Start Scene（构建设置与产物核对）
- [x] GameBootstrap 已挂到 GameRoot（静态自检与运行画面核对）

## Runtime

- [x] 状态栏显示（Lv / XP / ⚡ / 💰 / ♥；Web Mobile）
- [x] 三个订单显示（Web Mobile）
- [x] 9×9 棋盘显示完整（Web Mobile）
- [x] 四个 Generator 显示（锁定文案可见；Web Mobile）
- [x] 家园客厅、卧室、花园切换后显示不同背景（Web Mobile）
- [ ] 刘海/底部安全区未遮挡 StatusBar / Dock

## Gameplay

- [x] Generator Spawn（Web Mobile 点击咖啡机，体力 100→99）
- [ ] Move（拖到空格）
- [ ] Swap（拖到不同物品）
- [x] Merge（Web Mobile 鼠标拖动两个咖啡物，显示“合成成功”）
- [ ] Cancel（拖出棋盘还原）
- [ ] Claim Order（扣物 + 发奖 + 新订单）
- [ ] Level Up 浮层
- [ ] Lv3 花篮礼包领取、连续升级与弹窗顺序
- [ ] Lv5 甜品烤箱、Lv8 礼物盒解锁
- [ ] 回忆按顺序扣爱心解锁，日记可查看
- [ ] 家具购买、摆放、收起，装修值最高 50
- [ ] 10 个心愿完成并各领奖一次
- [ ] 家园拍照与本机照片查看（微信开发者工具）

## Touch

- [ ] TOUCH_START 不立刻当拖动
- [ ] dragThreshold 12px 生效
- [ ] Ghost 跟随，源 item 半透明
- [ ] 可 Merge 目标高亮
- [ ] TOUCH_END 落格正确（Web Mobile 鼠标拖放已通过；真机触摸待测）
- [ ] TOUCH_CANCEL 还原

## Save

- [x] Spawn 后保存（Web Mobile 重载仍有新物品）
- [x] Merge 后保存（Web Mobile 重载仍有合成后的物品）
- [ ] Order claim 后保存
- [ ] 切后台（hide）flushSave
- [ ] 回前台体力恢复
- [ ] 重启恢复 Board / Energy / Level / Orders / Coins / Hearts

## Build

- [x] Web Mobile build（Creator 3.8.8 CLI，2026-09-27）
- [x] WeChat build（Creator 3.8.8 CLI，2026-09-27）
- [x] 主包体积已记录（`npm run verify:wechat-package`）
- [ ] （可选）微信开发者工具运行

## 记录

| 项 | 结果 |
| --- | --- |
| Creator version | 3.8.8（CLI 构建） |
| Preview | NOT RUN（Creator 编辑器预览） |
| Web Mobile | PASS（浏览器启动、生成、拖动合成、重载恢复） |
| WeChat Build | PASS（构建完成，已生成分包） |
| WeChat DevTools | NOT RUN（本机未找到开发者工具，待导入） |
| 手机真机 | NOT RUN（待微信扫码预览） |
| Package size | 主包 3,917,042 / 4,000,000 字节；game_art 分包 4,664,281 字节 |

未勾选的拖动细节、安全区、拍照、后台恢复和其他玩法项仍需按本清单在手机上操作，不以单元测试代替真机结果。
