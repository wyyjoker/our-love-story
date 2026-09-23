export interface IdGenerator {
  next(): string;
}

/**
 * WeChat-safe UID: timestamp + counter + random (no crypto.randomUUID).
 */
export class IdService implements IdGenerator {
  private counter = 0;

  next(): string {
    this.counter = (this.counter + 1) % 1_000_000;
    const time = Date.now().toString(36);
    const count = this.counter.toString(36);
    const rand = Math.floor(Math.random() * 0xffffff)
      .toString(36)
      .padStart(5, '0');
    return `id_${time}_${count}_${rand}`;
  }
}

export class SequentialIdService implements IdGenerator {
  private counter = 0;

  constructor(private readonly prefix = 'test') {}

  next(): string {
    this.counter += 1;
    return `${this.prefix}_${this.counter}`;
  }
}
