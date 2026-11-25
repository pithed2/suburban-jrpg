/**
 * Tile map for the Mole Tunnels (quest 3). Three depths, top to bottom:
 * depth 1 rows 0-11, depth 2 rows 12-27, depth 3 (deep zone) rows 28-39.
 * Phaser-free so `npm run check` can walk it.
 */
import { growMap } from "../mapBuild";

export const W = 1; // packed earth (solid)
export const F = 2; // tunnel floor
export const X = 3; // ladder up to the backyard
export const A = 4; // flooded irrigation line (solid, drawn as water)

export const SPAWN = [4, 2] as const;

/** Decorative lawn ornaments in the throne room (solid). */
export const ORNAMENTS: Array<[number, number]> = [[9, 30], [17, 30], [9, 37], [15, 37]];

const carved = growMap([], 48, 40, W, F, ({ room, h, v }) => {
  // Depth 1
  room(2, 2, 10, 8);     // entry chamber
  h(5, 11, 22);
  room(23, 2, 31, 9);    // root cellar (burrow 1)
  h(5, 32, 40);
  room(41, 2, 46, 9);    // dead-end storeroom
  v(6, 9, 13);           // down to depth 2
  // Depth 2
  room(2, 14, 14, 20);   // sprinkler junction
  h(17, 15, 30);
  room(31, 13, 40, 20);  // flooded line (burrow 2)
  v(4, 21, 23);
  room(2, 24, 12, 27);   // old irrigation vault (Biscuit)
  // Depth 3
  v(36, 21, 30);
  room(30, 31, 46, 35);  // grub gallery (burrow 3)
  h(33, 20, 29);
  room(8, 29, 19, 38);   // throne room
});

carved[1][4] = X;
for (let r = 24; r <= 26; r++) { carved[r][7] = A; carved[r][8] = A; }

export const MAP: number[][] = carved;
