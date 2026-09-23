import { describe, expect, it } from 'vitest';
import { runRuntimeSelfTest } from '../assets/scripts/gameplay/RuntimeSelfTest';
import { GameLogger } from '../assets/scripts/infrastructure/GameLogger';

describe('RuntimeSelfTest', () => {
  it('spawn/move/merge/claim/save loop passes', () => {
    const logger = new GameLogger(false);
    expect(runRuntimeSelfTest(logger)).toBe(true);
  });
});
