# 个人故事与照片替换

当前 `assets/resources/config/memories.json` 是 10 条原创示例文案。真实故事尚未收到，不能把示例写成真实经历。

请按想展示的顺序提供每段的**标题、短句、日记、照片**。可以只提供部分段落；未提供的段落继续使用示例。现有顺序 ID 为：`letters`、`first_trip`、`night_view`、`promise`、`wedding`、`first_home`、`rainy_day`、`birthday`、`garden`、`anniversary`。

`memories.json` 中每条的 `title`、`summary`、`diary` 可直接替换。`art` 指向 `assets/game_art/` 下图片的文件名（不含扩展名），例如将 `personal_trip.jpg` 交给 Creator 导入后，填写 `"art": "personal_trip"`。当前示例图集用 `memory_sheet_a#0` 到 `memory_sheet_b#4`；`#` 后的数字表示图集第几个画面。独立照片不需要 `#`。

个人照片由 Creator 生成 `*.meta`，按 `tools/wechat-build.json` 重新构建后运行 `npm run verify:wechat-package`；新照片会进入 `game_art` 分包。提供照片前请确认允许将其打包进小游戏。家园中的“拍照留念”保存的是用户在本机拍摄的游戏画面，与上述随包照片分开存储。
