import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const MAX_IMAGE_BYTES = 30 * 1024;
const marker = '<!-- love-startup-branding -->';
const bootMarker = '/* love-startup-branding */';

/** Apply project-owned startup branding to a fresh Creator output. */
export async function applyStartupBranding(root, buildDir, platform, options = {}) {
  root = resolve(root); buildDir = resolve(buildDir);
  if (!['wechatgame', 'web-mobile'].includes(platform)) throw new Error(`不支持的平台: ${platform}`);
  const settingsPath = join(buildDir, 'src/settings.json');
  const entryPath = join(buildDir, platform === 'wechatgame' ? 'game.js' : 'index.js');
  const primary = platform === 'wechatgame' ? join(buildDir, 'first-screen.js') : join(buildDir, 'index.html');
  for (const path of [settingsPath, entryPath, primary]) {
    if (!existsSync(path)) throw new Error(`构建产物缺失: ${path}`);
    if (options.notBefore != null && statSync(path).mtimeMs < options.notBefore - 2000) throw new Error(`构建产物不是本次生成: ${path}`);
  }
  const templates = join(root, 'build-templates/startup');
  const source = join(root, 'assets/game_art/cover_background.jpg');
  const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  if (!settings.splashScreen || typeof settings.splashScreen !== 'object') throw new Error('构建设置缺少 splashScreen');
  const startup = readFileSync(primary, 'utf8');
  const entry = readFileSync(entryPath, 'utf8');
  let html = startup, index = entry;
  if (platform === 'wechatgame') {
    if (!/require\(['"]\.\/first-screen['"]\)/.test(entry) || !/firstScreen\.start\(/.test(entry) || !/firstScreen\.end\(/.test(entry)) throw new Error('微信启动接口与预期不符');
    html = readFileSync(join(templates, 'first-screen.js'), 'utf8');
    if (!/module\.exports\s*=\s*\{\s*start,\s*end,\s*setProgress\s*\}/.test(html)) throw new Error('品牌启动模板接口不完整');
  } else {
    if (!startup.includes(marker)) {
      if (!/<title>[^<]*<\/title>/.test(startup) || !startup.includes('</head>') || !startup.includes('<body>')) throw new Error('网页模板与预期不符');
      html = startup.replace(/<title>[^<]*<\/title>/, '<title>我们的浪漫小屋</title>')
        .replace('</head>', `  ${marker}\n  <link rel="stylesheet" href="love-loading.css">\n</head>`)
        .replace('<body>', '<body>\n  <div id="love-loading" role="status" aria-live="polite"><div id="love-loading-title">我们的浪漫小屋</div><div id="love-loading-message">正在准备我们的小屋…</div></div>\n  <script src="love-loading.js"></script>');
      const errorCall = "System.import('./index.js').catch(function(err) { console.error(err); })";
      if (!html.includes(errorCall)) throw new Error('网页启动错误处理与预期不符');
      html = html.replace(errorCall, "System.import('./index.js').catch(function(err) { console.error(err); window.__loveLoadingError(); })");
    }
    if (!entry.includes(bootMarker)) {
      const init = 'return application.init(engine);';
      const error = 'console.error(err);';
      if (!entry.includes(init) || !entry.includes(error)) throw new Error('网页引擎启动接口与预期不符');
      index = entry.replace(init, `application.init(engine); ${bootMarker} engine.director.once(engine.Director.EVENT_AFTER_DRAW, window.__loveLoadingReady); return;`)
        .replace(error, 'console.error(err); window.__loveLoadingError();');
    }
  }
  // Validate all inputs and image size before changing the build output.
  const image = await sharp(source).resize({ width: 360, height: 640, fit: 'cover' }).jpeg({ quality: 62, mozjpeg: true }).toBuffer();
  if (image.length > MAX_IMAGE_BYTES) throw new Error(`启动图超过 30 KiB: ${image.length}`);
  settings.splashScreen.totalTime = 0;
  settings.splashScreen.logo = { type: 'none', base64: '' };
  writeFileSync(join(buildDir, 'love_loading.jpg'), image);
  writeFileSync(settingsPath, JSON.stringify(settings));
  writeFileSync(primary, html);
  if (platform === 'web-mobile') {
    writeFileSync(entryPath, index);
    for (const file of ['web-loading.css', 'web-loading.js']) writeFileSync(join(buildDir, file.replace('web-', 'love-')), readFileSync(join(templates, file)));
  }
  return { imageBytes: image.length, platform };
}
