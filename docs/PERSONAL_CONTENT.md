# 个人故事与照片替换

当前 assets/resources/config/memories.json 是 **28 章**故事配置，完整日期、正文、旧章 ID 与待核对原话见 [PERSONAL_STORY_DRAFT.md](PERSONAL_STORY_DRAFT.md)。章节数量由配置驱动，不再固定十章；家具和心愿数量不变。

原十章保留 ID、原费用和既有解锁权益，新增章节有独立稳定 ID。不要随着标题变化重命名旧 ID，也不要用新档覆盖玩家进度。新增章节可按顺序补齐，原有章节不重复收费。

每章 title、dateLabel、summary、diary 可编辑。长日记支持上下滑动，切章会回到开头。metDate=2023-09-08 是认识日期，weddingDate=2026-10-03 是婚礼日期；领证与答谢宴在正文中分别为 10 月 20 日、10 月 31 日。姓名与正式恋爱纪念日仍未填写。

## 图片配置

- art：assets/game_art 下图片文件名（不含扩展名）。图集使用 sheet#索引，同时填写 artColumns、artRows。
- artMode：cover 为裁切铺满，contain 为完整显示。当前 28 张独立插画使用 cover；日记中点击插画可完整预览，不裁切。
- artFocusY：裁切的垂直取景位置，范围 0–1（0 靠上、1 靠下）。目前逐章校准，换图时一起调整，避免小屏日记裁掉人物头顶。
- artLabel：图片区说明；当前全部为“故事插画”。替换真实照片时可改为“我们的照片”。

换独立照片时，让 Creator 导入 personal_trip.jpg 并自动生成 meta，再设置 art=personal_trip，删除图集行列参数，并按照片构图选择 cover 或 contain。不要手工造 UUID/meta。

照片会进入 game_art 分包。重新构建后检查主包大小，再手机预览。游戏里的“拍照留念”是保存本机的家园画面，与随包的个人照片不同。

当前 28 章均有独立生成的故事插画，生成提示词和资源清单见 [STORY_ART_1_0_1.md](STORY_ART_1_0_1.md)。服装、颜色和布景为概念创作，未经提供的照片不伪造；婚礼 MV 目前只有文字记录，没有接入未提供的视频。1.0.0 交付压缩包保留为历史快照，本次代码及构建为 1.0.1，未上传微信后台。
