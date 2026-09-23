/**
 * CellView — one board cell visual (rounded square, light bg, soft shadow).
 */
export class CellView {
  constructor(
    readonly index: number,
    readonly row: number,
    readonly column: number,
  ) {}
}
