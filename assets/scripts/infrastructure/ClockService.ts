export interface ClockService {
  now(): number;
}

export class SystemClockService implements ClockService {
  now(): number {
    return Date.now();
  }
}

export class FakeClockService implements ClockService {
  private current: number;

  constructor(startMs = 1_700_000_000_000) {
    this.current = startMs;
  }

  now(): number {
    return this.current;
  }

  advance(ms: number): void {
    this.current += ms;
  }

  set(ms: number): void {
    this.current = ms;
  }
}
