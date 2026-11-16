import { closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { prepareWechatBuild } from './prepare-wechat-build.mjs';
import { applyStartupBranding } from './startup-branding.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  const { values } = parseArgs({ options: {
    appid: { type: 'string' },
    creator: { type: 'string' },
    'prepare-only': { type: 'boolean' },
  } });
  const creator = values.creator ?? process.env.COCOS_CREATOR
    ?? 'C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe';
  if (!values['prepare-only'] && !existsSync(creator)) {
    throw new Error('找不到 Creator 3.8.8，请通过 --creator 指定可执行文件路径');
  }
  const { configPath, appid } = prepareWechatBuild(root, values.appid);
  console.log(`AppID: ${appid}\n本机构建配置: ${configPath}`);
  console.log('AppID 格式校验不代表账号具备上传或体验版权限，仍需在微信后台核实。');
  if (!values['prepare-only']) {
    mkdirSync(join(root, 'temp'), { recursive: true });
    const logPath = join(root, 'temp/wechat-build.log');
    const log = openSync(logPath, 'w');
    const started = Date.now();
    let result;
    const creatorEnv = { ...process.env };
    // Electron sets this when its embedded Node runner is active; Creator must launch normally.
    delete creatorEnv.ELECTRON_RUN_AS_NODE;
    try {
      result = spawnSync(creator, ['--project', root, '--build', `configPath=${configPath.replaceAll('\\', '/')}`], {
        cwd: root, env: creatorEnv, windowsHide: true, stdio: ['ignore', log, log], timeout: 300_000,
      });
    } finally { closeSync(log); }
    console.log(readFileSync(logPath, 'utf8').split(/\r?\n/).slice(-18).join('\n'));
    console.log(`Creator 日志: ${logPath}`);
    // Creator 3.8.8 BuildExitCode.BUILD_SUCCESS is 36 (local engine definition).
    if (result.error) throw result.error;
    if (result.status !== 0 && result.status !== 36) throw new Error(`Creator 构建失败，退出码 ${result.status}`);
    const buildDir = join(root, 'build/wechatgame');
    const projectPath = join(buildDir, 'project.config.json');
    if (!existsSync(projectPath) || statSync(projectPath).mtimeMs < started - 2000) {
      throw new Error('未生成本次构建的 project.config.json，不能使用旧产物认定成功');
    }
    const project = JSON.parse(readFileSync(projectPath, 'utf8'));
    if (project.appid !== appid || project.compileType !== 'game') {
      throw new Error('产物 AppID 或小游戏类型与本次配置不一致');
    }
    const branding = await applyStartupBranding(root, buildDir, 'wechatgame', { notBefore: started });
    console.log(`小屋启动图: ${branding.imageBytes} 字节`);
    const check = spawnSync(process.execPath, [join(root, 'tools/check-wechat-package.mjs'), buildDir], {
      cwd: root, stdio: 'inherit', windowsHide: true,
    });
    if (check.status !== 0) throw new Error('微信包体检查未通过');
    console.log('微信构建与包体检查通过；尚未上传或完成体验版验收。');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
