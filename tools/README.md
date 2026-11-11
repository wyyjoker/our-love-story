# Tools

开发辅助脚本。

- `generate_placeholders.py` — 可选：用 Pillow 生成 placeholder PNG（无图时 UI 用色块 + 文字缩写即可）。
- `build-wechat.mjs` — Creator 实际微信构建，保留本机 AppID，并检查新产物与主包大小。
- `qa-cocos-web.mjs` — `npm run qa:cocos-web`。先由 Creator 构建 Web Mobile，再以独立 Chrome 配置和独立端口操作真实 Cocos 客户端；不用用户浏览器，也不读取微信存档。需要 Node.js 22+、Chrome；可用 `COCOS_QA_CHROME` 指定浏览器路径。结果和截图在 `temp/cocos-ui-qa-*/`，浏览器测试数据也留在该目录用于排查。此检查不替代手机权限、文件路径、胶囊与后台行为验收。
