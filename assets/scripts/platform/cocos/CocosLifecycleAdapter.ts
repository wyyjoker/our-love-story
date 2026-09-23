/**
 * App lifecycle hooks for Cocos / WeChat (foreground / background).
 */
import { game, Game } from 'cc';

export type LifecycleHandlers = {
  onHide?: () => void;
  onShow?: () => void;
};

export class CocosLifecycleAdapter {
  private detachShow: (() => void) | null = null;
  private detachHide: (() => void) | null = null;

  constructor(private readonly handlers: LifecycleHandlers) {}

  attach(): void {
    this.detach();
    const onShow = (): void => {
      this.handlers.onShow?.();
    };
    const onHide = (): void => {
      this.handlers.onHide?.();
    };
    game.on(Game.EVENT_SHOW, onShow, this);
    game.on(Game.EVENT_HIDE, onHide, this);
    this.detachShow = () => game.off(Game.EVENT_SHOW, onShow, this);
    this.detachHide = () => game.off(Game.EVENT_HIDE, onHide, this);
  }

  detach(): void {
    this.detachShow?.();
    this.detachHide?.();
    this.detachShow = null;
    this.detachHide = null;
  }
}
