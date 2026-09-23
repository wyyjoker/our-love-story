# AGENTS.md — our-love-story

## 项目技术栈

- Cocos Creator 3.8.8（目标：微信小游戏，竖屏）— **正式客户端**
- 浏览器 `index.html` — Debug Harness，不是第二产品
- TypeScript strict
- 纯 TS Domain / Gameplay（禁止依赖 cc）
- JSON 配置驱动
- Vitest 测试 core / gameplay / infrastructure / presentation

## 核心架构

```text
Presentation (Web UI or Cocos UI)
  → GameController
  → Gameplay Services
  → Domain/Core
Infrastructure: Save, Clock, Id, Random, Platform
Cocos adapters: platform/cocos/* (may import cc)
Config: assets/resources/config + assets/scripts/config
```

### Cocos 边界规则（V0.1B）

- Cocos presentation 可以 `import { ... } from 'cc'`
- `assets/scripts/core/**` 与 `assets/scripts/gameplay/**` **禁止**依赖 `cc`
- 禁止在 Cocos 组件里复制玩法逻辑；只调 `GameContext` / services
- 禁止手工伪造 Cocos UUID / meta；让 Creator 生成
- 提交前必须 `npm run test:core` 通过
- Node 类型检查：`npm run lint:core`（`tsconfig.core.json`）

## 目录责任

| 路径 | 责任 |
| --- | --- |
| assets/scripts/core/ | 纯逻辑 Domain |
| assets/scripts/gameplay/ | 服务 + GameContext |
| assets/scripts/infrastructure/ | Save / Clock / Id / Random / Platform |
| assets/scripts/events/ | 类型化事件总线 |
| assets/scripts/config/ | 配置加载与校验 |
| assets/scripts/presentation/ | ViewModel mapper |
| assets/scripts/platform/cocos/ | Cocos 适配（storage/lifecycle/safe area） |
| assets/scripts/ui/cocos/ | Cocos Runtime UI + GameBootstrap |
| src/web/ | 浏览器 Debug Harness |
| assets/resources/config/ | 唯一数值配置源 |
| tests/ | Vitest |
| docs/ | 产品 / 架构 / Cocos setup & smoke |

## 必须运行的测试

```bash
npm run test:core
npm run lint:core
npm run build:web
npm run verify:cocos
```

**修改 Merge 核心规则后必须同时修改或新增对应测试。**

## 代码规范

- TypeScript strict，禁止滥用 any
- 正常游戏失败用 Result type
- 时间 / 随机 / UID / 存档走 Infrastructure 抽象
- UI 文案中文；资源 snake_case
- 配置驱动，禁止魔法字符串解锁等级
- 禁止每帧 full rebuild / localStorage

## 禁止事项

- 复制商业游戏内容
- UI 直接改 SaveData
- Core/gameplay import cc
- 在 Cocos 层复制 WebMergeEngine / CocosOrderService 等双逻辑
- 伪造测试结果 / 未跑 Creator 却写 Build PASS
- git reset --hard / clean -fd / push --force
- 未经确认 push main/master

## Git 规范

- 分支：`feat/v0.1-core-merge`、`feat/v0.1b-cocos-native`
- 提交：`chore:` / `feat:` / `fix:` / `docs:` / `test:` / `build:`
- 不主动 push main
