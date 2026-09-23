import type { GameEventHandler, GameEventMap, GameEventType } from './GameEvents';

export class GameEventBus {
  private listeners = new Map<GameEventType, Set<GameEventHandler<GameEventType>>>();

  on<K extends GameEventType>(type: K, handler: GameEventHandler<K>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(handler as GameEventHandler<GameEventType>);
    return () => this.off(type, handler);
  }

  off<K extends GameEventType>(type: K, handler: GameEventHandler<K>): void {
    this.listeners.get(type)?.delete(handler as GameEventHandler<GameEventType>);
  }

  emit<K extends GameEventType>(type: K, payload: GameEventMap[K]): void {
    const set = this.listeners.get(type);
    if (!set) return;
    // Creator's Web Mobile transpiler lowers a Set spread to [].concat(set),
    // leaving the Set itself in the array instead of its handlers.
    for (const handler of Array.from(set)) {
      (handler as GameEventHandler<K>)(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
