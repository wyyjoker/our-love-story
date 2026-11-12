# 28 章故事插画（1.0.1）

用户授权直接生成并导入工程。使用内置 image_gen，28 个独立生成请求，另对第 23 章做一次纠正编辑（移除滑雪现场的父母，避免与另一次横店行程混淆）；未使用 API/CLI 生图，未请求 API Key。风格参考为工程旧版原创故事插画，人物是统一的虚构成年情侣形象。

## 已接入素材

全部存于 assets/game_art，28 张独立 JPEG，640×640，quality 85，共 3,443,861 字节。旧插画保留，当前回忆配置已逐章改为新资源，不再使用花束/礼物装饰占位。相册卡片和日记使用裁切预览，日记点击可完整看图。每章通过 artFocusY 校准垂直取景，优先保留人物面部，完整原构图在大图里查看。

| 章 | 故事 | 资源文件 |
| --- | --- | --- |
| 1 | 舟山，故事的开始 | `story_01_letters.jpg` |
| 2 | 初识后的第一座山 | `story_02_shenxianju.jpg` |
| 3 | 蹦床公园的约会 | `story_03_trampoline_park.jpg` |
| 4 | 100 天，100 封情书 | `story_04_first_trip.jpg` |
| 5 | 我们的第一组圣诞写真 | `story_05_christmas_portrait.jpg` |
| 6 | 横店跨年，再一起回温州 | `story_06_night_view.jpg` |
| 7 | 山水之间，有你 | `story_07_promise.jpg` |
| 8 | 带你看看，我的大学 | `story_08_wedding.jpg` |
| 9 | 第一次一起去韩国 | `story_09_jeju_first.jpg` |
| 10 | 第一次陪你过5·20生日 | `story_10_first_home.jpg` |
| 11 | 芭比写真与南湖游船 | `story_11_barbie_summer.jpg` |
| 12 | 小组出游，一起漂流 | `story_12_linan_rafting.jpg` |
| 13 | 南山塔，向你求婚 | `story_13_rainy_day.jpg` |
| 14 | 这一年的冬日纪念 | `story_14_winter_portraits.jpg` |
| 15 | 一起倒数，新年快乐 | `story_15_new_year_balloons.jpg` |
| 16 | 我们订婚了 | `story_16_garden.jpg` |
| 17 | 室内滑雪与家人合影 | `story_17_birthday.jpg` |
| 18 | 泉州旅行与你的27岁 | `story_18_quanzhou_birthday.jpg` |
| 19 | 再一次，和小组去漂流 | `story_19_rafting_again.jpg` |
| 20 | 生日，第一辆爱车 | `story_20_first_car.jpg` |
| 21 | 大熊猫与九寨沟 | `story_21_chengdu_jiuzhaigou.jpg` |
| 22 | 苏州，我们的古装写真 | `story_22_suzhou_portrait.jpg` |
| 23 | 山上的雪，同行的家人 | `story_23_snow_and_family.jpg` |
| 24 | 为我们的婚礼做准备 | `story_24_wedding_preparations.jpg` |
| 25 | 丽江，第一套婚纱照 | `story_25_lijiang_wedding.jpg` |
| 26 | 在杭州，留下我们的模样 | `story_26_hangzhou_wedding.jpg` |
| 27 | 婚礼前，最后一个夏天 | `story_27_summer_before_wedding.jpg` |
| 28 | 婚礼、领证与答谢宴 | `story_28_anniversary.jpg` |

## 可追溯资料

- [完整生成提示词](story_art_prompts_1_0_1.json)：每章独立场景、风格和构图约束。
- [素材清单与 SHA256](story_art_manifest_1_0_1.json)：文件尺寸、字节数和生成原图路径。原图保留在本机 Codex generated_images 目录；正式客户端直接使用工程内文件。
- tools/import-story-art.mjs 只负责等比例缩小、JPEG 压缩和配置绑定，不生成 UUID/meta；由 Creator 导入生成。

插画呈现故事主题。未提供的服饰、车身颜色、背景构图和光线属于美术设定；它们不作为实拍或对现场细节的证明。故事文字以 PERSONAL_STORY_DRAFT.md 中的用户确认信息为准。

## 验证

日期：2026-11-12，版本 1.0.1。以下针对本轮最终取景配置和配图运行。

- npm run verify：91 项 Vitest 测试、3 项工具测试、lint:core、build:web（Debug Harness）、verify:cocos 全部通过。
- Cocos 完整 TypeScript 检查通过：npx tsc -p temp/tsconfig.fix-check.json --skipLibCheck --resolveJsonModule --allowSyntheticDefaultImports --lib ES2020,DOM。
- 实际调用 Creator 3.8.8 CLI 构建 Web Mobile 和微信小游戏，均成功（退出码 36）。日志：temp/story-art-final-web.out.log、temp/story-art-final-wechat.log、temp/wechat-build.log。
- 微信主包 **3,928,977 / 4,000,000 字节**；game_art 分包 8,818,341 字节，internal 分包 689,471 字节，main 分包 158,387 字节。构建产物位于 build/wechatgame。
- npm run qa:cocos-web：**11 组正式 Cocos Web Mobile 客户端检查全部通过**，无未捕获异常。覆盖 28 张独立图片加载、逐章裁切配置生效、28 张完整大图开关、28 章分页、375 小屏正文滚动及冬日写真取景、320/375/430 竖屏与模拟安全区；并回归合成/移动/交换/取消、订单、升级奖励、三房间家具、六张照片与读写故障处理。
- 最终客户端证据：[result.json](../temp/cocos-ui-qa-2026-11-12T13-49-27-077Z/result.json)，同目录保留画面截图。被测 Web 构建 SHA256：93ded8c7c43c8dcebc1eefcba4aed7f9be5bcfbd7994243c814a41f8128ffe13。
- 人工查看了 28 张插画总览、最窄日记取景总览，以及正式客户端相册、大图、婚礼日记和 375 小屏冬日日记截图。已修正滑雪场景误画父母、冬日写真头顶被裁掉的问题。
- 28 个运行时 JPEG 的 SHA256 与素材清单一致，28 份 meta 均由 Creator 导入生成。

本轮新插画版本尚未真机复测、未上传微信后台。旧版手机验收不作为本轮新资源的真机验收证据；1.0.0 交付包保留为历史快照。
