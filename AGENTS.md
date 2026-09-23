# AGENTS.md — our-love-story

## 项目技术栈

- Cocos Creator 3.8.8（目标平台：微信小游戏，竖屏）
- TypeScript `strict`
- 纯 TS Domain / Gameplay（禁止依赖 `cc`）
- JSON 配置驱动
- Vitest 测试 core / gameplay / infrastructure

## 核心架构

```text
Presentation (UI: web or Cocos)
  → GameController
  → Gameplay Services (Board/Generator/Order/Energy/Progression)
  → Domain/Core (MergeEngine, Board rules, types)
Infrastructure: Save, Clock, Id, Random, Platform
Config: assets/resources/config + src/config loader
```

## 目录责任

| 路径 | 责任 |
| --- | --- |
| `src/core/` | 纯逻辑：棋盘、合成、类型、订单规则、进度规则 |
| `src/gameplay/` | 编排服务与 GameContext |
| `src/infrastructure/` | 存档、时钟、UID、随机、平台 |
| `src/events/` | 类型化 GameEventBus |
| `src/web/` | 浏览器可玩 UI |
| `assets/scripts/` | Cocos 组件与共享逻辑镜像入口 |
| `assets/resources/config/` | 唯一数值/内容配置源 |
| `tests/` | Vitest 单元测试 |
| `docs/` | 产品、架构、测试计划、路线图 |

## 必须运行的测试

改动以下任一内容后必须跑通：

```bash
npm run test:core
npm run lint
```

**修改 Merge 核心规则后必须同时修改或新增对应测试。**

## 代码规范

- TypeScript strict，禁止滥用 `any`
- 正常游戏失败用 Result type，不 `throw`
- 时间只用 `ClockService.now()`
- 随机只用 `RandomService`
- UID 只用 `IdService`
- 存档只用 `SaveService` + Storage 抽象
- 资源 `snake_case`；TypeScript PascalCase / camelCase / UPPER_SNAKE_CASE
- 禁止魔法字符串解锁等级；用 progression config
- 禁止在 `update()` 每帧 new / JSON.stringify / localStorage

## 禁止事项

- 复制商业游戏代码 / UI / 美术 / 剧情 / 名称
- 把全部逻辑塞进 `Game.ts` / `GameManager`
- UI 直接改 `SaveData`
- MergeEngine import `cc`
- 运行时依赖 DOM / Node `fs` / `process`（web 专用代码仅限 `src/web`）
- 未执行测试却声称测试通过
- `git reset --hard` / `git clean -fd` / `git push --force`
- 未经确认 push 到远程

## 配置驱动要求

棋盘尺寸、体力、经验、物品、合成链、生成器、订单、解锁等级必须来自 config，不得散落硬编码。

## Git 规范

- 提交信息：`chore:` / `feat:` / `fix:` / `docs:` / `test:` / `refactor:`
- 功能分支：`feat/v0.1-core-merge`
- 不主动 push
