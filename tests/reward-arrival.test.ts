import { describe, expect, it } from 'vitest';
import { RewardArrivalLedger } from '../assets/scripts/ui/cocos/RewardUiMath';

describe('displayed reward arrivals', () => {
  it('keeps overlapping deliveries independent even when they land out of order', () => {
    const display = new RewardArrivalLedger();
    display.hold('first', { coins: 20, xp: 10, hearts: 2 });
    display.hold('second', { coins: 35, xp: 15, hearts: 3 });
    display.hold('first', { coins: 20, xp: 10, hearts: 2 });
    expect(display.total('coins')).toBe(55);
    expect(display.arrive('second', 'coins')).toBe(35);
    expect(display.total('coins')).toBe(20);
    expect(display.total('xp')).toBe(25);
    expect(display.arrive('second', 'coins')).toBe(0);
    expect(display.arrive('first', 'xp')).toBe(10);
    expect(display.total('xp')).toBe(15);
    display.clear();
    expect(display.total('coins')).toBe(0);
    expect(display.total('xp')).toBe(0);
    expect(display.arrive('first', 'coins')).toBe(0);
  });
});
