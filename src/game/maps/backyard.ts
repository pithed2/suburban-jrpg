/**
 * Tile map for the backyard (quest 3). Phaser-free so `npm run check` can test
 * that every hotspot sits on reachable floor.
 */
export const W = 1; // fence (solid)
export const F = 2; // grass (walkable)
export const X = 3; // back door, returns to the house
export const T = 4; // tunnel hole, goes down to the Mole Tunnels
export const H = 5; // house wall (solid)
export const S = 6; // shed wall (solid)

export const COLS = 36;
export const ROWS = 24;

/** Spawn tiles by where Dad came from. */
export const SPAWNS = {
  house: [17, 2],
  tunnels: [17, 15],
} as const;

/** The dirt path from the back door to the tunnel hole (drawn only). */
export const PATH_TILES: Array<[number, number]> = [];
for (let r = 1; r <= 16; r++) PATH_TILES.push([17, r], [18, r]);

/** Old molehills (drawn only, walkable). */
export const MOLEHILLS: Array<[number, number]> = [
  [8, 9], [12, 14], [24, 7], [27, 15], [6, 18], [30, 20], [22, 11], [11, 20], [14, 6],
];

function build(): number[][] {
  const map = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c): number => {
      if (r === 0) return c === 17 || c === 18 ? X : H;
      if (r === ROWS - 1 || c === 0 || c === COLS - 1) return W;
      return F;
    }));
  for (let r = 2; r <= 5; r++) for (let c = 2; c <= 7; c++) map[r][c] = S;
  map[17][17] = T;
  map[17][18] = T;
  return map;
}

export const MAP: number[][] = build();
