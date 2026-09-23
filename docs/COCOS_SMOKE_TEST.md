# Cocos Smoke Test Checklist (V0.2)

> 手工验收。勾选前必须真实操作 Creator / 构建产物。禁止未跑就打勾。

## Project

- [ ] Creator 3.8.8 可打开项目
- [ ] 无 Script compile error
- [ ] Game.scene 可加载
- [ ] Game.scene 是 Start Scene
- [ ] GameBootstrap 已挂到 GameRoot

## Runtime

- [ ] 状态栏显示（Lv / XP / ⚡ / 💰 / ♥）
- [ ] 三个订单显示
- [ ] 9×9 棋盘显示完整
- [ ] 四个 Generator 显示（锁定文案可见）
- [ ] 刘海/底部安全区未遮挡 StatusBar / Dock

## Gameplay

- [ ] Generator Spawn（扣 1 体力）
- [ ] Move（拖到空格）
- [ ] Swap（拖到不同物品）
- [ ] Merge（两个相同合成）
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
- [ ] TOUCH_END 落格正确
- [ ] TOUCH_CANCEL 还原

## Save

- [ ] Spawn 后保存
- [ ] Merge 后保存
- [ ] Order claim 后保存
- [ ] 切后台（hide）flushSave
- [ ] 回前台体力恢复
- [ ] 重启恢复 Board / Energy / Level / Orders / Coins / Hearts

## Build

- [ ] Web Mobile build
- [ ] WeChat build
- [ ] 主包体积已记录
- [ ] （可选）微信开发者工具运行

## 记录

| 项 | 结果 |
| --- | --- |
| Creator version | |
| Preview | PASS / FAIL / NOT RUN |
| Web Mobile | PASS / FAIL / NOT RUN |
| WeChat Build | PASS / FAIL / NOT RUN |
| WeChat DevTools | RUN / NOT RUN |
| Package size | |
