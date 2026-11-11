# 个人故事与照片替换

当前 `assets/resources/config/memories.json` 已依据用户口述接入 10 章故事草稿：2023 年 9 月舟山相识、100 天情书、旅行、5·20 生日、南山塔求婚、滑雪爬山、订婚及 2026 年 10 月 3 日结婚。未确认的年份、生日归属、大学名称与具体细节未补写。详细映射见 `PERSONAL_STORY_DRAFT.md`。

后续可逐章补充**日期、短句、日记细节和照片**。现有顺序 ID 为：`letters`、`first_trip`、`night_view`、`promise`、`wedding`、`first_home`、`rainy_day`、`birthday`、`garden`、`anniversary`；这些 ID 是为兼容已有存档保留的历史标识，不应随标题重命名。

`memories.json` 中每条的 `title`、`dateLabel`、`summary`、`diary` 可直接替换。`art` 指向 `assets/game_art/` 下图片的文件名（不含扩展名）。当前使用 `our_story_sheet#0` 到 `our_story_sheet#9`，配置 `artColumns: 5`、`artRows: 2`。这些是故事插画，不是真实照片，来源与提示词见 `STORY_ART.md`。

换独立照片时，将 `personal_trip.jpg` 交给 Creator 导入后填写 `"art": "personal_trip"`，并删除或重置该条的 `artColumns` / `artRows`。独立照片不需要 `#`，界面会保持图片比例。姓名和恋爱纪念日仍为空；`game.json` 的 `metMonth` 为 `2023-09`，`weddingDate` 为 `2026-10-03`，不会把婚礼日期当成未确认的恋爱纪念日。

个人照片由 Creator 生成 `*.meta`，按 `tools/wechat-build.json` 重新构建后运行 `npm run verify:wechat-package`；新照片会进入 `game_art` 分包。提供照片前请确认允许将其打包进小游戏。家园中的“拍照留念”保存的是用户在本机拍摄的游戏画面，与上述随包照片分开存储。
