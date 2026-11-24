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
