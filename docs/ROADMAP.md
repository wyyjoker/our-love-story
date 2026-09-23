# Roadmap

## V0.1 — Core Merge

- Merge Core（Move / Swap / Merge）
- Generators
- Energy（含离线恢复）
- Orders
- Progression（Lv1–Lv5、链解锁）
- Local Save
- 基础 Toast / 引导 / 动画
- 浏览器可玩预览 + Cocos 脚本骨架

## V0.1B — Polish

- 正式占位图 / 音效
- Cocos Prefab 完善与真机安全区
- Debug Panel 完善
- GitHub Actions `core-tests.yml`（可选）
- 手感与动画微调

## V0.2 — Story & Memories

- 情侣回忆
- 照片
- 剧情章节
- 爱心解锁
- 纪念日彩蛋

## V0.3 — Home Decoration

- 小屋装修
- 家具
- 场景升级
- 金币消费

## V0.4 — Account & Cloud

- 微信登录
- 云存档
- 跨设备同步

## V0.5 — Live & Social

- 每日任务
- 签到
- 情侣互动
- 分享卡片
- 小游戏 polish

## 未来 Story 数据形状（V0.2+，V0.1 不实现系统）

```ts
type StoryChapter = {
  id: string;
  title: string;
  unlockLevel: number;
  unlockHeartCost: number;
  cover?: string;
  memoryIds: string[];
};
```

情侣档案入口（配置，不写死真实姓名与日期）：

```json
{
  "gameTitle": "我们的浪漫小屋",
  "coupleDisplayName": "",
  "anniversary": "",
  "theme": "warm-romantic"
}
```
