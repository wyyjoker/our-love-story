import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const sampleAppId = 'wx6ac3f5090a6b99c5';
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/** Keep the selected account outside generated build output and Git. */
export function prepareWechatBuild(root, requestedAppId) {
  const template = readJson(join(root, 'tools/wechat-build.json'));
  const localPath = join(root, 'local/wechat-build.json');
  const projectPath = join(root, 'build/wechatgame/project.config.json');
  const appid = (requestedAppId
    ?? (existsSync(localPath) ? readJson(localPath).packages?.wechatgame?.appid : undefined)
    ?? (existsSync(projectPath) ? readJson(projectPath).appid : undefined)
    ?? template.packages?.wechatgame?.appid
    ?? '').trim();
  if (!/^wx[0-9a-f]{16}$/.test(appid) || appid === sampleAppId) {
    throw new Error('请提供自己的小游戏 AppID：npm run build:wechat -- --appid wx…（不接受 Cocos 示例 AppID）');
  }
  const config = {
    ...template,
    packages: {
      ...template.packages,
      wechatgame: { ...template.packages?.wechatgame, appid },
    },
  };
  mkdirSync(join(root, 'local'), { recursive: true });
  writeFileSync(localPath, `${JSON.stringify(config, null, 2)}\n`);
  return { configPath: localPath, appid };
}
