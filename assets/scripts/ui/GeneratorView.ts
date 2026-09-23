/**
 * GeneratorView — bottom dock buttons (not board cells).
 * Locked shows `🔒 LvN 解锁` instead of hiding.
 */
export type GeneratorViewData = {
  id: string;
  displayName: string;
  locked: boolean;
  unlockLevel: number;
  energyCost: number;
};

export class GeneratorView {
  render(list: GeneratorViewData[]): string {
    return list
      .map((g) =>
        g.locked
          ? `${g.displayName} 🔒 Lv${g.unlockLevel} 解锁`
          : `${g.displayName} ⚡${g.energyCost}`,
      )
      .join(' | ');
  }
}
