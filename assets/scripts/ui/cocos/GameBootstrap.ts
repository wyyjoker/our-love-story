/**
 * GameBootstrap — real Cocos Component entry.
 * After first Creator import, add this component to GameRoot (or any scene node).
 */
import { _decorator, Component, director, Director, Node } from 'cc';
import { CocosStorageAdapter } from '../../platform/cocos/CocosStorageAdapter';
import { CocosPlatformAdapter } from '../../platform/cocos/CocosPlatformAdapter';
import { CocosLifecycleAdapter } from '../../platform/cocos/CocosLifecycleAdapter';
import { CocosSafeArea } from '../../platform/cocos/CocosSafeArea';
import { createGameContext, type GameContext } from '../../gameplay/GameContext';
import { GameLogger } from '../../infrastructure/GameLogger';
import {
  applyDesignResolution,
  attachUiToScene,
  buildUiTree,
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
      this.game.energy.tick();
      this.view?.renderAll();
    }
  }

  onDisable(): void {
    this.game?.flushSave();
  }

  onDestroy(): void {
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

    const storage = new CocosStorageAdapter();
    const platform = new CocosPlatformAdapter();
    logger.info('BOOT', `platform=${platform.kind}`);

    this.game = createGameContext({
      storage,
      saveDebounceMs: 200,
      logger,
    });

    const insets = new CocosSafeArea().getInsets();
    const roots = buildUiTree(insets);
    const sceneRoot: Node = this.node.scene ?? this.node;
    attachUiToScene(sceneRoot, roots);

    this.view = new CocosGameView(this.game, roots);

    this.lifecycle = new CocosLifecycleAdapter({
      onHide: () => {
        this.game?.flushSave();
        logger.debug('SAVE', 'flush on hide');
      },
      onShow: () => {
        this.game?.energy.tick();
        this.view?.renderAll();
        logger.debug('ENERGY', 'recover on show');
      },
    });
    this.lifecycle.attach();

    this.onSceneLoading = () => {
      this.game?.flushSave();
    };
    director.on(Director.EVENT_BEFORE_SCENE_LOADING, this.onSceneLoading);

    this.game.save();
    logger.info('BOOT', 'READY');
  }

  private showBootError(err: unknown): void {
    const parent: Node = this.node.scene ?? this.node;
    const errorNode = createUiNode('BootError');
    parent.addChild(errorNode);
    ensureTransform(errorNode, 750, 400);
    const g = errorNode.addComponent(Graphics);
    paintRoundRect(g, 750, 400, 16, CocosTheme.surface(), CocosTheme.danger(), 2);
    const title = makeLabel('游戏启动失败', 28, CocosTheme.danger(), true);
    errorNode.addChild(title.node);
    title.node.setPosition(0, 120, 0);
    const message = err instanceof Error ? err.message : String(err);
    const body = makeLabel(message, 16, CocosTheme.textPrimary());
    errorNode.addChild(body.node);
  }
}
