import { describe, expect, it } from 'vitest';
import { GameEventBus } from '../assets/scripts/events/GameEventBus';

describe('GameEventBus', () => {
  it('dispatches each listener once even if a listener unsubscribes during delivery', () => {
    const bus = new GameEventBus();
    const received: number[] = [];
    let offSecond = () => {};
    bus.on('XP_CHANGED', () => {
      received.push(1);
      offSecond();
    });
    offSecond = bus.on('XP_CHANGED', () => received.push(2));

    bus.emit('XP_CHANGED', { xp: 5, delta: 5 });
    expect(received).toEqual([1, 2]);
    bus.emit('XP_CHANGED', { xp: 6, delta: 1 });
    expect(received).toEqual([1, 2, 1]);
  });
});
