/**
 * ItemView — sprite/label/drag visuals only.
 * Does NOT own merge/order/save/xp logic.
 */
export class ItemView {
  constructor(
    readonly uid: string,
    readonly definitionId: string,
  ) {}

  /** Visual-only scale pop for merge feedback. */
  playMergePop(): void {
    // scale 1 → 1.15 → 0.95 → 1.0 in ~0.25s via Tween in Cocos.
  }
}
