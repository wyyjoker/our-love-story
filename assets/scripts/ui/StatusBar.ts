/**
 * StatusBar — Lv / XP / ⚡ / 💰 / ❤.
 * Keeps safe-area top inset in mind (do not stick to screen edge).
 */
export class StatusBar {
  formatEnergy(energy: number, max: number): string {
    return `⚡ ${energy}/${max}`;
  }

  formatXp(xp: number, nextThreshold: number | null): string {
    return nextThreshold === null ? `XP ${xp}` : `XP ${xp} / ${nextThreshold}`;
  }
}
