export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogCategory =
  | 'BOOT'
  | 'SAVE'
  | 'BOARD'
  | 'MERGE'
  | 'GENERATOR'
  | 'ORDER'
  | 'ENERGY'
  | 'LEVEL'
  | 'UI';

const ENABLED = true;

export class GameLogger {
  constructor(private readonly debugEnabled: boolean = true) {}

  debug(category: LogCategory, message: string): void {
    if (!ENABLED || !this.debugEnabled) return;
    console.log(`[${category}] ${message}`);
  }

  info(category: LogCategory, message: string): void {
    if (!ENABLED) return;
    console.info(`[${category}] ${message}`);
  }

  warn(category: LogCategory, message: string): void {
    if (!ENABLED) return;
    console.warn(`[${category}] ${message}`);
  }

  error(category: LogCategory, message: string, err?: unknown): void {
    if (!ENABLED) return;
    console.error(`[${category}] ${message}`, err ?? '');
  }
}

export const gameLogger = new GameLogger(true);
