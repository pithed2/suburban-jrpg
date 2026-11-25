/**
 * Tile map for the bathroom. Phaser-free so `npm run check` can test that every
 * hotspot sits on reachable floor.
 */
import { growMap } from "../mapBuild";

export const W = 1; // wall
export const F = 2; // floor
export const X = 3; // exit (to house)

/* prettier-ignore */
const BASE_MAP: number[][] = [
  [W,W,W,W,W,W,W,W,W,W,W,X,X,W,W,W,W,W,W,W,W,W,W,W], //  0  exit 11-12
  [W,W,W,W,W,W,W,W,W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W], //  1  entry corridor
  [W,W,W,W,W,W,W,W,W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W], //  2
  [W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W], //  3  wide junction
  [W,W,F,F,F,F,W,W,W,F,F,F,F,F,W,W,W,F,F,F,F,W,W,W], //  4  linen closet | vanity | shower
  [W,W,F,F,F,F,W,W,W,F,F,F,F,F,W,W,W,F,F,F,F,W,W,W], //  5
  [W,W,F,F,F,F,W,W,W,F,F,F,F,F,W,W,W,F,F,F,F,W,W,W], //  6
  [W,W,F,F,F,F,W,W,W,F,F,F,F,F,W,W,W,F,F,F,F,W,W,W], //  7
  [W,W,W,W,W,W,W,W,W,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W], //  8  south corridor begins
  [W,W,W,W,W,W,W,W,W,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W], //  9
  [W,W,W,W,W,W,W,W,W,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W], // 10
  [W,W,W,W,W,W,W,W,W,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W], // 11  toilet nook begins
  [W,W,W,W,W,W,W,W,W,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W], // 12
  [W,W,W,W,W,W,W,W,W,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W], // 13  TOILET at col 11
  [W,W,W,W,W,W,W,W,W,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W], // 14
  [W,W,W,W,W,W,W,W,W,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W], // 15
  [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W], // 16  bottom wall
];

// Deep wings added for grinding: hamper hall, under-sink cavern, old tub room.
export const MAP: number[][] = growMap(BASE_MAP, 36, 26, W, F, ({ room, h, v }) => {
  h(5, 21, 26);            // shower → hamper hall
  room(27, 2, 33, 9);      // hamper hall
  v(30, 10, 18);
  room(22, 19, 33, 23);    // under-sink cavern
  v(3, 8, 18);             // linen closet → old tub room
  room(2, 19, 10, 23);     // old tub room
  h(21, 11, 21);           // tub room ↔ cavern
});

/** Deep wings (grind rooms) get the grimy floor. */
export const isGrimy = (col: number, row: number): boolean => col >= 21 || row >= 17;

/**
 * Fixtures drawn on top of the floor. `solid` ones block walking, so keep them
 * against walls and out of doorways. Frame names are keys of BATH in
 * src/game/bathroomTiles.ts.
 */
export const FIXTURES: { col: number; row: number; frame: string; solid?: boolean }[] = [
  // Linen closet shelves along the west wall
  { col: 2, row: 4, frame: "linen", solid: true },
  { col: 2, row: 5, frame: "linen", solid: true },
  { col: 2, row: 6, frame: "linen", solid: true },
  // Vanity across the top of the sink corridor
  { col: 10, row: 4, frame: "counter", solid: true },
  { col: 11, row: 4, frame: "sink", solid: true },
  { col: 12, row: 4, frame: "counter", solid: true },
  // Shower: tub along the south wall, mat in front
  { col: 17, row: 7, frame: "tubLeft", solid: true },
  { col: 18, row: 7, frame: "tubRight", solid: true },
  { col: 19, row: 6, frame: "bathMat" },
  // Toilet corridor
  { col: 11, row: 9, frame: "drain" },
  { col: 10, row: 14, frame: "puddle" },
  // Hamper hall
  { col: 32, row: 9, frame: "hamper", solid: true },
  { col: 33, row: 9, frame: "hamper", solid: true },
  { col: 29, row: 5, frame: "puddle" },
  // Under-sink cavern
  { col: 25, row: 21, frame: "puddle" },
  { col: 28, row: 22, frame: "puddle" },
  { col: 31, row: 21, frame: "drain" },
  // Old tub room
  { col: 5, row: 21, frame: "oldTubLeft", solid: true },
  { col: 6, row: 21, frame: "oldTubRight", solid: true },
  { col: 8, row: 22, frame: "puddle" },
];

/** Wall tiles above the cavern that show a pipe run. */
export const PIPE_ROW = { row: 18, from: 22, to: 33 };
