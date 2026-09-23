# V0.1 手工验收测试计划

> 自动化测试覆盖 Domain / Gameplay / Infrastructure。  
> 以下项目需要在浏览器预览或 Cocos Editor / 微信开发者工具中手工验证。

## Test 01 — 新游戏启动

**步骤：** 清除存档后启动。

**期望：**

- 7×9 board
- Energy 50
- Level 1
- coffee / flower 解锁
- 初始物品可尝试合并（coffee_01×2、flower_01×2）
- 首个教程订单为简单 coffee 订单

## Test 02 — 点击生成器

**步骤：** 点击咖啡机。

**期望：**

- Energy −1
- 棋盘出现咖啡物品（Lv1 或 Lv2）
- 有 Toast / 反馈

## Test 03 — 拖到空格

**步骤：** 将物品拖到空格。

**期望：** 移动成功，源格清空。

## Test 04 — 同级合成

**步骤：** 两个相同 `definitionId` 物品拖到一起。

**期望：** Merge 成高一级 Item，动画播放。

## Test 05 — 不同物品

**步骤：** 不同物品拖到一起。

**期望：** Swap 交换位置。

## Test 06 — 完成订单

**步骤：** 凑齐订单所需物品后点击交付。

**期望：**

- 物品被扣除
- 金币 / XP / 爱心到账
- 出现新订单
- 不能出现只扣物品不发奖或只发奖不扣物

## Test 07 — 升级 Lv3

**步骤：** 获得足够 XP 升到 Lv3。

**期望：**

- LEVEL UP 提示
- 甜品烤箱 / dessert 解锁
- 生成器锁定样式解除

## Test 08 — 关闭重开

**步骤：** 完全刷新 / 重开游戏。

**期望：** Board、Energy、Level、Orders、Coins、Hearts 全部恢复。

## Test 09 — 离线体力

**步骤：** 将 `lastEnergyAt` 拨回 10 分钟前（或等待），再启动。

**期望：** Energy 正确恢复（10 分钟 = 600s / 120s = +5），不超过上限。

## Test 10 — 棋盘满

**步骤：** 填满棋盘后点击生成器。

**期望：**

- 不给 Item
- 不扣 Energy
- Toast：`棋盘满啦～ 先合成一些物品吧`

## 回归命令

```bash
npm install
npm run test:core
npm run lint
npm run build:web
```
