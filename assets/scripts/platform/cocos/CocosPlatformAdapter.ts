/**
 * Platform adapter for Cocos Creator runtime (Editor / Web / WeChat Mini Game).
 */
import { sys } from 'cc';

export type CocosPlatformKind = 'editor' | 'web' | 'wechat' | 'native' | 'unknown';

export class CocosPlatformAdapter {
  readonly kind: CocosPlatformKind;

  constructor() {
    this.kind = detect();
  }

  isDevBuild(): boolean {
    return this.kind === 'editor' || this.kind === 'web';
  }

  isWeChat(): boolean {
    return this.kind === 'wechat';
  }
}

function detect(): CocosPlatformKind {
  const platform = sys.platform;
  // cc.sys.Platform
  if (platform === sys.Platform.WECHAT_GAME) return 'wechat';
  if (platform === sys.Platform.EDITOR_PAGE || platform === sys.Platform.EDITOR_CORE) {
    return 'editor';
  }
  if (
    platform === sys.Platform.MOBILE_BROWSER ||
    platform === sys.Platform.DESKTOP_BROWSER
  ) {
    return 'web';
  }
  if (platform === sys.Platform.ANDROID || platform === sys.Platform.IOS || platform === sys.Platform.OHOS) {
    return 'native';
  }
  // Editor preview plays as browser-ish; treat unknown as web-like
  return 'unknown';
}
