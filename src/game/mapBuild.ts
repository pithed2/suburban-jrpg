/**
 * Helpers to grow a hand-drawn tile map. The original layout stays in the
 * top-left corner, so existing coordinates keep working.
 */
export interface Carver {
  /** Fill the rectangle (inclusive) with floor. */
  room(c1: number, r1: number, c2: number, r2: number): void;
  /** Horizontal corridor on one row. */
  h(row: number, c1: number, c2: number): void;
  /** Vertical corridor on one column. */
  v(col: number, r1: number, r2: number): void;
}

export function growMap(
  base: number[][],
  cols: number,
  rows: number,
  wall: number,
  floor: number,
  carve: (carver: Carver) => void,
): number[][] {
  const map = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => base[r]?.[c] ?? wall));
  const room = (c1: number, r1: number, c2: number, r2: number) => {
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) map[r][c] = floor;
    }
  };
  carve({
    room,
    h: (row, c1, c2) => room(c1, row, c2, row),
    v: (col, r1, r2) => room(col, r1, col, r2),
  });
  return map;
}
