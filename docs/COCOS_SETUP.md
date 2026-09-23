# Cocos Setup Guide (V0.2)

## 环境

- Cocos Creator **3.8.8**（Dashboard 安装）
- 项目根目录即 Creator 工程（含 `assets/`、`package.json`）
- 目标：Web Mobile 预览 / 构建，以及微信小游戏构建

## 打开项目

1. 打开 Cocos Dashboard → Projects → Open
2. 选择本仓库根目录（`our-love-story`）
3. 首次导入会生成 `library/`、`temp/`、`local/`（已在 `.gitignore`）
4. Creator 会为脚本与场景生成/更新 `*.meta`（**请提交 meta**）

## 场景与启动

`Game.scene` 的 `GameRoot` 已挂载 `GameBootstrap`，构建时的 Start Scene 为 `Game.scene`。如需检查：

1. 打开 `assets/scenes/Game.scene`
2. 在 Hierarchy 选中 `GameRoot`，确认 Inspector 包含 `GameBootstrap`
3. 在构建配置中确认 Start Scene 为 `Game.scene`

运行时 `GameBootstrap` 会构建：

```text
UICamera
Canvas
└─ SafeArea
   ├─ Background
   ├─ StatusBar
   ├─ OrderPanel
   ├─ BoardPanel  (9×9)
   ├─ GeneratorDock
   └─ 任务 / 回忆 / 家园页面
DragLayer / ToastLayer / TutorialLayer / ModalLayer / DebugLayer
```

设计分辨率：**750×1334，Fit Width（FIXED_WIDTH）**，竖屏。

## 打开与预览

1. 确认无 Script compile error（Console）
2. 点击 Preview / Browser
3. 检查状态栏、3 订单、9×9 棋盘、4 生成器与导航
4. 点「咖啡机」生成物品；拖动合并；交付订单；进入回忆和家园；重启后进度应恢复

## 构建 Web Mobile

菜单 **Project → Build**：

- Platform: `Web Mobile`
- Debug: 开发构建时可勾选
- Start Scene: `Game`
- 构建后目录：`build/web-mobile`

CLI（3.8.x，参数以本机 Creator 帮助为准）：

```text
CocosCreator.exe --project <repo> --build "platform=web-mobile;debug=true"
```

检查输出：`index.html`、`settings.json`、`main` bundle、`assets/`。

## 构建微信小游戏

Web 构建通过后再做：

1. Platform: `WeChat Mini Game`
2. AppID 可留空 / 使用测试号（不要求正式 AppID）
3. 构建目录：`build/wechatgame`
4. 校验产物大致包含：`game.js`、`game.json`、`project.config.json`、`src/`、`assets/`
5. 记录主包体积并检查微信包体限制；当前 12 张原创 PNG 运行时素材总量约 26MB，需要在正式上传前优化资源分包与压缩
6. 用微信开发者工具导入 `build/wechatgame`；测试触摸、安全区、拍照权限与重启恢复

## 常见问题

### `Cannot find module 'cc'`

- **不要** `npm install cocos` / `cc`
- Node 侧只检查 pure core：`npm run lint:core`
- Cocos 脚本（`assets/scripts/ui/cocos/**`、`assets/scripts/platform/cocos/**`）由 Creator 编译
- `tsconfig.core.json` 已排除上述目录

### 场景 / 脚本 UUID

- 让 Creator 生成 `*.meta`，不要手写 random UUID
- 改名脚本后在 Creator 内重新保存，再提交 meta

### 缓存异常

关闭 Creator 后可删除工程下：

```text
library/
temp/
```

不要删除 `assets/`、`settings/`、`local/` 中的用户配置前请先备份。`local/` 本就忽略 git。

### 配置 JSON

`assets/resources/config/*.json` 经 `ConfigRepository` `import` 进包，与浏览器版 / Vitest 共用。  
启动仍会 `validateConfig`；失败显示「游戏启动失败」而不是白屏。

### 存档

使用 `CocosStorageAdapter` → `sys.localStorage`，key：`our-love-story-save`。  
切后台 `Game.EVENT_HIDE` / `onDisable` / `onDestroy` 会 `flushSave()`；回前台 `tick()` 恢复体力。

## 静态自检

```bash
npm run verify:cocos
npm run verify
```

`verify:cocos` 只能做静态检查，**不能替代** Creator Import / Preview / Build。
