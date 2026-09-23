/**
 * BoardView — Cocos presentation for the merge board.
 * Creates CellViews, renders ItemViews, computes drop targets.
 * Must NOT become a game manager; talk to GameContext services only.
 */
export type BoardViewCallbacks = {
  onDrop: (from: number, to: number | null) => void;
};

export class BoardView {
  constructor(
    private readonly rows: number,
    private readonly columns: number,
    private readonly callbacks: BoardViewCallbacks,
  ) {}

  get cellCount(): number {
    return this.rows * this.columns;
  }

  /** Map pointer local position → cell index (logical, not pixel-bound). */
  hitTest(column: number, row: number): number | null {
    if (row < 0 || column < 0 || row >= this.rows || column >= this.columns) {
      return null;
    }
    return row * this.columns + column;
  }

  emitDrop(from: number, to: number | null): void {
    this.callbacks.onDrop(from, to);
  }
}
