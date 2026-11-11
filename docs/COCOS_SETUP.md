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
2. 本机调试可使用自己的小游戏测试号；给其他微信用户体验时使用已注册小游戏账号的 AppID，并在微信后台配置体验成员。不要使用 Cocos 示例 AppID
3. 构建目录：`build/wechatgame`
4. 校验产物包含：`game.js`、`game.json`、`project.config.json`、`src/`、`subpackages/`
5. 运行下方 `npm run build:wechat`，根据 `tools/wechat-build.json` 模板生成本机配置并构建。`game_art` 是独立 Asset Bundle，并在微信端设为分包。资源包从原始 PNG 的 26,384,613 字节压至 4,660,495 字节（透明图保留调色板 PNG，背景用 JPEG）；原始 PNG 目录可用 `node tools/optimize-art.mjs <原图目录>` 重做压缩，输出到 `temp/art-optimized`
6. 运行 `npm run verify:wechat-package`：读取 `game.json` 的分包目录，统计主包全部文件，必须小于 4,000,000 字节。2026-09-27 构建主包为 3,917,042 字节；每次改动后都要重新构建并复测
7. 用微信开发者工具导入 `build/wechatgame`；测试触摸、安全区、拍照权限与重启恢复

本机 Creator 3.8.8 CLI 构建命令（Windows）：

```powershell
# 首次指定自己的 AppID；测试号仅供开发调试
npm run build:wechat -- --appid wx你的小游戏AppID
# 后续沿用同一 AppID，构建完成后自动核对 AppID 和主包体积
npm run build:wechat
# 只保存本机配置，不调用 Creator
npm run build:wechat -- --appid wx你的小游戏AppID --prepare-only
```

AppID 保存在 Git 忽略的 `local/wechat-build.json`。优先级为命令行 `--appid`、本机配置、现有构建包中的 AppID；首次接管现有包后，之后即使构建目录被覆盖也会沿用本机配置。模板不再携带 Cocos 示例 AppID。切换账号时显式传入新 AppID；不需要提供 AppSecret。其他机器可通过 `--creator <可执行文件路径>` 或 `COCOS_CREATOR` 指定 Creator 3.8.8。脚本会保存 `temp/wechat-build.log`，验证本次产物的 AppID、小游戏类型及包体；不会上传游戏。格式校验通过不表示该账号具备上传或体验版权限。

正式数值配置仍在 `assets/resources/config/`，运行时插画位于 `assets/game_art/`。`CocosArt` 通过 `assetManager.loadBundle('game_art')` 按需加载；Creator 管理图片的 `*.meta` UUID。

故事和照片的替换入口见 [PERSONAL_CONTENT.md](PERSONAL_CONTENT.md)。

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
