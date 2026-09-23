/**
 * Cocos Creator 3.8 entry component (skeleton).
 *
 * In the Cocos Editor:
 * 1. Create/open `Game.scene`
 * 2. Create empty node `GameRoot`, attach this script as component
 * 3. Assign UI nodes / prefabs in the inspector
 *
 * This module avoids `import cc` so Node/tsc can typecheck the project.
 * When compiling inside Cocos Creator, change the base to `cc.Component`
 * and use `@ccclass` / `@property` decorators (or assign via editor).
 */
import { createGameContext, type GameContext } from '../gameplay/GameContext';
import { GameController } from './GameController';

export class GameBootstrap {
  private game: GameContext | null = null;
  private controller: GameController | null = null;

  onLoad(): void {
    try {
      this.game = createGameContext({ saveDebounceMs: 200 });
      this.controller = new GameController(this.game);
      this.controller.bootUi();
    } catch (err) {
      console.error('[BOOT] failed', err);
    }
  }

  onDestroy(): void {
    this.game?.flushSave();
  }

  get context(): GameContext | null {
    return this.game;
  }
}
