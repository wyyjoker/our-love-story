/**
 * GameBootstrap — real Cocos Component entry.
 * After first Creator import, add this component to GameRoot (or any scene node).
 */
import { _decorator, Button, Component, director, Director, Label, Node } from 'cc';
import { CocosStorageAdapter } from '../../platform/cocos/CocosStorageAdapter';
import { CocosPlatformAdapter } from '../../platform/cocos/CocosPlatformAdapter';
import { CocosLifecycleAdapter } from '../../platform/cocos/CocosLifecycleAdapter';
import { CocosSafeArea } from '../../platform/cocos/CocosSafeArea';
import { createGameContext, type GameContext } from '../../gameplay/GameContext';
import { runRuntimeSelfTest } from '../../gameplay/RuntimeSelfTest';
import { GameLogger } from '../../infrastructure/GameLogger';
import { loadConfigBundle } from '../../config/ConfigRepository';
import { createDemoStorage } from '../../infrastructure/DemoSave';
import {
  applyDesignResolution,
  attachUiToScene,
  buildUiTree,
  type UiRoots,
} from './UiFactory';
import { CocosGameView } from './CocosGameView';
import {
  CocosTheme,
  createUiNode,
  ensureTransform,
  makeLabel,
  paintRoundRect,
} from './CocosTheme';
import { Graphics } from 'cc';

const { ccclass } = _decorator;
const logger = new GameLogger(true);

@ccclass('GameBootstrap')
export class GameBootstrap extends Component {
  private game: GameContext | null = null;
  private view: CocosGameView | null = null;
  private lifecycle: CocosLifecycleAdapter | null = null;
  private onSceneLoading: (() => void) | null = null;
  private ui: UiRoots | null = null;

  onLoad(): void {
    try {
      this.boot();
    } catch (err) {
      this.showBootError(err);
      logger.error('BOOT', 'GameBootstrap failed', err);
    }
  }

  onEnable(): void {
    if (this.game) {
      this.game.tick();
      this.view?.renderAll();
    }
  }

  onDisable(): void {
    this.game?.flushSave();
  }

  onDestroy(): void {
    this.unscheduleAllCallbacks();
    this.lifecycle?.detach();
    this.lifecycle = null;
    this.view?.dispose();
    this.view = null;
    this.game?.flushSave();
    this.game = null;
    if (this.onSceneLoading) {
      director.off(Director.EVENT_BEFORE_SCENE_LOADING, this.onSceneLoading);
      this.onSceneLoading = null;
    }
  }

  private boot(): void {
    applyDesignResolution();

    const platform = new CocosPlatformAdapter();
    // Explicit Web Mobile review URL only. Never enable this in WeChat.
    const demoPreview = platform.kind === 'web' && typeof location !== 'undefined'
      && new URLSearchParams(location.search).get('preview') === 'lv12';
    const storage = demoPreview ? createDemoStorage(loadConfigBundle(), Date.now()) : new CocosStorageAdapter();
    logger.info('BOOT', `platform=${platform.kind}`);
    if (platform.isDevBuild()) {
      runRuntimeSelfTest(logger);
    }

    this.game = createGameContext({
      storage,
      saveDebounceMs: 200,
      logger,
    });

    const insets = new CocosSafeArea().getInsets();
    const roots = buildUiTree(insets);
    this.ui = roots;
    const sceneRoot: Node = this.node.scene ?? this.node;
    attachUiToScene(sceneRoot, roots);

    this.view = new CocosGameView(this.game, roots, demoPreview);

    this.lifecycle = new CocosLifecycleAdapter({
      onHide: () => {
        this.game?.flushSave();
        logger.debug('SAVE', 'flush on hide');
      },
      onShow: () => {
        this.game?.tick();
        this.view?.renderAll();
        logger.debug('ENERGY', 'recover on show');
      },
    });
    this.lifecycle.attach();

    this.schedule(() => {
      this.game?.tick();
      this.view?.renderClock();
    }, 1);

    this.onSceneLoading = () => {
      this.game?.flushSave();
    };
    director.on(Director.EVENT_BEFORE_SCENE_LOADING, this.onSceneLoading);

    this.game.save();
    logger.info('BOOT', 'READY');
  }

  private showBootError(err: unknown): void {
    // Read failures happen before the normal canvas/camera is created.
    // Build the error UI's own roots so the retry message is actually visible.
    if (!this.ui) {
      this.ui = buildUiTree(new CocosSafeArea().getInsets());
      attachUiToScene(this.node.scene ?? this.node, this.ui);
    }
    const parent = this.ui.coverLayer;
    const errorNode = createUiNode('BootError');
    parent.addChild(errorNode);
    const w = 640;
    const h = 360;
    ensureTransform(errorNode, w, h);
    const g = errorNode.addComponent(Graphics);
    paintRoundRect(g, w, h, 16, CocosTheme.surface(), CocosTheme.danger(), 2);
    const title = makeLabel('游戏启动失败', 28, CocosTheme.danger(), true);
    errorNode.addChild(title.node);
    title.node.setPosition(0, 100, 0);
    const message = err instanceof Error ? err.message : String(err);
    const body = makeLabel(message.slice(0, 100), 22, CocosTheme.textPrimary());
    errorNode.addChild(body.node);
    ensureTransform(body.node, 570, 130);
    body.enableWrapText = true;
    body.overflow = Label.Overflow.CLAMP;
    body.lineHeight = 32;
    const retry = createUiNode('RetryBoot');
    errorNode.addChild(retry);
    ensureTransform(retry, 240, 64);
    retry.setPosition(0, -112, 0);
    paintRoundRect(retry.addComponent(Graphics), 240, 64, 24, CocosTheme.primary());
    const caption = makeLabel('重新读取存档', 24, CocosTheme.surface(), true);
    retry.addChild(caption.node);
    retry.addComponent(Button);
    retry.on(Button.EventType.CLICK, () => director.loadScene(this.node.scene?.name ?? 'Game'));
  }
}
