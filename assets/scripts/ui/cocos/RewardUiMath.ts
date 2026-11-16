export function previewEnergyReplenishment(maxEnergy: number, energy: number, offerEnergy: number): number {
  return Math.max(0, Math.min(Math.max(0, offerEnergy), Math.max(0, maxEnergy - energy)));
}

export type RewardKind = 'coins' | 'xp' | 'hearts';
export type RewardAmounts = Record<RewardKind, number>;

/** Display-only offsets. The saved wallet is always committed by gameplay first. */
export class RewardArrivalLedger {
  private readonly pending = new Map<string, RewardAmounts>();
  hold(id: string, amounts: RewardAmounts): void { if (!this.pending.has(id)) this.pending.set(id, { ...amounts }); }
  total(kind: RewardKind): number {
    let result = 0; this.pending.forEach((entry) => { result += entry[kind]; }); return result;
  }
  arrive(id: string, kind: RewardKind): number {
    const entry = this.pending.get(id); if (!entry) return 0;
    const amount = entry[kind]; entry[kind] = 0;
    if (Object.values(entry).every((value) => value === 0)) this.pending.delete(id);
    return amount;
  }
  clear(): void { this.pending.clear(); }
}

export function claimedCheckInDays(status: {
  cycleIndex: number;
  canClaim: boolean;
  claims?: number;
}, period: number): number[] {
  const count = Math.max(1, Math.floor(period));
  if (status.claims !== undefined) {
    const claimedInCycle = status.claims % count;
    if (claimedInCycle === 0) return status.canClaim ? [] : Array.from({ length: count }, (_, index) => index);
    return Array.from({ length: claimedInCycle }, (_, index) => index);
  }
  return status.canClaim ? [] : [(status.cycleIndex + count - 1) % count];
}
