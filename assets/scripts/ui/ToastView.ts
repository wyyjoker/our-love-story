/**
 * ToastView - unified toast. Do not scatter random Labels in components.
 */
export type ToastTone = 'info' | 'success' | 'warn';

export class ToastView {
  private queue: string[] = [];

  show(message: string, _tone: ToastTone = 'info'): void {
    this.queue.push(message);
  }

  drain(): string[] {
    const q = this.queue;
    this.queue = [];
    return q;
  }
}

export const ToastMessages = {
  energyLow: 'Not enough energy. Take a short rest.',
  boardFull: 'Board is full. Merge some items first.',
  locked: (level: number) => `Unlocks at Lv${level}`,
  mergeOk: 'Merge success!',
  maxLevel: 'Already max level',
  orderReady: 'Order ready. Tap Deliver!',
} as const;
