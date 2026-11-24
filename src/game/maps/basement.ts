/**
 * Tile map for the basement. Phaser-free so `npm run check` can test that every
 * hotspot sits on reachable floor.
 */
export const W = 1; // wall
export const F = 2; // floor (walkable)
export const X = 3; // exit tile — triggers return to NeighborhoodScene

function buildBasementMap(): number[][] {
  const map = Array.from({ length: 32 }, () => Array(48).fill(W));
  const room = (c1: number, r1: number, c2: number, r2: number) => {
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) map[r][c] = F;
    }
  };
  const h = (row: number, c1: number, c2: number) => room(c1, row, c2, row);
  const v = (col: number, r1: number, r2: number) => room(col, r1, col, r2);

  map[0][17] = X;
  map[0][18] = X;

  room(15, 1, 20, 3);  // entry room
  h(3, 3, 32);         // main choice corridor
  v(4, 3, 15);         // west long path
  room(2, 8, 7, 12);
  h(10, 4, 13);        // breaker dead-end hall
  v(10, 3, 8);
  h(8, 10, 16);
  v(16, 8, 18);
  room(12, 15, 18, 18);
  v(24, 3, 14);
  room(22, 11, 28, 14);
  h(6, 24, 33);
  v(33, 6, 18);
  h(18, 20, 33);
  v(20, 14, 18);
  room(29, 17, 34, 20); // dryer room
  h(21, 4, 12);         // south-west false branch
  v(12, 18, 21);
  room(8, 20, 14, 22);

  // ── Deep wings (grind zones, tougher monsters, loot) ──
  h(10, 33, 40);          // east passage
  room(38, 7, 45, 13);    // old furnace room
  v(42, 14, 23);
  room(36, 24, 46, 29);   // sump pit
  h(27, 23, 35);
  room(14, 25, 22, 30);   // crawlspace
  v(14, 23, 24);          // crawlspace back door to the shelf room

  return map;
}

export const MAP: number[][] = buildBasementMap();
