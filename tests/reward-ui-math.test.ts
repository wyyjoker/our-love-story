import { describe, expect, it } from 'vitest';
import { claimedCheckInDays, previewEnergyReplenishment } from '../assets/scripts/ui/cocos/RewardUiMath';

describe('reward panel display calculations', () => {
  it('shows only energy the player can actually receive from an exchange', () => {
    expect(previewEnergyReplenishment(100, 40, 60)).toBe(60);
    expect(previewEnergyReplenishment(100, 90, 60)).toBe(10);
    expect(previewEnergyReplenishment(100, 100, 60)).toBe(0);
  });

  it('marks the claimed check-in days and resets at a new seven-day cycle', () => {
    expect(claimedCheckInDays({ cycleIndex: 3, canClaim: true, claims: 3 }, 7)).toEqual([0, 1, 2]);
    expect(claimedCheckInDays({ cycleIndex: 0, canClaim: false, claims: 7 }, 7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(claimedCheckInDays({ cycleIndex: 0, canClaim: true, claims: 7 }, 7)).toEqual([]);
  });
});
