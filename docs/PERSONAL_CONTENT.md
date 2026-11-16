# 个人故事与照片替换

当前 [memories.json](../assets/resources/config/memories.json) 是 **42 章**故事配置，完整日期、正文、旧章 ID 与待核对原话见 [PERSONAL_STORY_DRAFT.md](PERSONAL_STORY_DRAFT.md)。章节数量由配置驱动；婚礼、领证和答谢宴各自独立。家园共有六个场景（包括泳池）和 30 件家具，原有十个心愿保留。

原十章保留 ID、原费用和既有解锁权益，新增章节有独立稳定 ID。不要随着标题变化重命名旧 ID，也不要用新档覆盖玩家进度。新增章节可按顺序补齐，原有章节不重复收费。

每章 title、dateLabel、summary、diary 可编辑。长日记支持上下滑动，切章会回到开头。metDate=2023-09-08 是认识日期，weddingDate=2026-10-03 是婚礼日期；领证与答谢宴在正文中分别为 10 月 20 日、10 月 31 日。姓名与正式恋爱纪念日仍未填写。

## 图片配置

- art：assets/game_art 下图片文件名（不含扩展名）。图集使用 sheet#索引，同时填写 artColumns、artRows。
- artMode：cover 为裁切铺满，contain 为完整显示。故事独立插画使用 cover；日记中点击插画可完整预览，不裁切。
- artFocusY：裁切的垂直取景位置，范围 0–1（0 靠上、1 靠下）。目前逐章校准，换图时一起调整，避免小屏日记裁掉人物头顶。
- artLabel：图片区说明；当前全部为“故事插画”。替换真实照片时可改为“我们的照片”。

换独立照片时，让 Creator 导入 personal_trip.jpg 并自动生成 meta，再设置 art=personal_trip，删除图集行列参数，并按照片构图选择 cover 或 contain。不要手工造 UUID/meta。

照片会进入 game_art 分包。重新构建后检查主包大小，再手机预览。游戏里的“拍照留念”是保存本机的家园画面，与随包的个人照片不同。

原 28 章的生成提示词和资源清单见 [STORY_ART_1_0_1.md](STORY_ART_1_0_1.md)。服装、颜色和布景为概念创作，未经提供的照片不伪造；婚礼 MV 目前只有文字记录，没有接入未提供的视频。1.0.0 交付压缩包保留为历史快照，当前候选版本以 [package.json](../package.json) 为准，未上传微信后台。

## 婚礼收尾文案槽

[game.json](../assets/resources/config/game.json#L24-L39) 的 `couple.gift` 为可选静态配置，字段 `coverMessage`、`title`、`salutation`、`body`、`signoff`、`signature` 均为字符串。当前默认值全部留空，不代表真实称呼或信件内容；未获本人提供前不要补写、自动生成或把谜题中的拼句当作原信。

- `coverMessage`：封面寄语；空字符串时封面不显示该寄语。
- `title`、`salutation`、`body`、`signoff`、`signature`：婚礼收尾信的标题、称呼、正文、结尾语与署名。空标题使用通用界面标题；空正文在 ending 中明确显示“专属信待填写”，空称呼/结尾/署名不显示。
- 这些是静态配置，不进入玩家存档。日期仍由回忆条目提供；相识日、婚礼日和领证日不可替代空缺的正式恋爱纪念日。

未解锁的相册和日记只展示通用锁定信息及解锁条件，不展示标题、日期、正文或插画；不可用的约会章节同样隐藏封面。家具可在布置模式拖动，并可恢复默认位置。

新增 12 条回忆从已有的复合经历中拆出，原故事的 ID、价格和内容保留。旧版存档已拥有原故事时，会一并保留对应拆分回忆的权益。
