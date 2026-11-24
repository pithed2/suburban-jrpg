/**
 * Tile map for the garage. Phaser-free so `npm run check` can test that every
 * hotspot sits on reachable floor.
 */
import { growMap } from "../mapBuild";

export const W = 1; // wall
export const F = 2; // floor
export const X = 3; // exit (to house)

// ── Dungeon layout: 30 cols × 20 rows = 480 × 320 world px ───────────────
//
//  Entry/exit  cols 13–14, row 0
//
//  DEAD ENDS (flavor text only):
//    NW     cols 3–4,  rows 1–2   paint cans
//    NE     cols 20–21,rows 1–2   three boxes of Xmas stuff
//    Power  cols 4–13, row  6     old power tools you'll "get to"
//    Cords  cols 4–13, row  9     extension cord mandala
//    Bikes  cols 3–4,  rows 15–18 exercise equipment graveyard
//
//  SIDE CHESTS (dialogue items, no game effect):
//    Easter      col 25, row  1   Easter decorations / the bunny
//    Cards       col 17, row  6   1990 Fleer baseball card complete set
//    Taxes       col 13, row 16   TAXES 2017 and related artifacts
//
//  MAIN CHEST (wrench):
//    Toolbox     col 25, row  9   requires long path
//
//  Path to toolbox:
//    Enter → south → row 3 junction → west → main south (col 3–4) →
//    row 14 E-junction → east col 22–23 → north N-path rows 12–7 →
//    toolbox room cols 22–28, rows 7–11  CHEST at col 25, row 9
//
//  col 21 is a wall in rows 7–11 separating baseball-cards area from
//  toolbox room so the player MUST take the long southern route.
//
/* prettier-ignore */
const BASE_MAP: number[][] = [
  [W,W,W,W,W,W,W,W,W,W,W,W,W,X,X,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W], //  0  exit 13-14
  [W,W,W,F,F,W,W,W,W,W,W,W,W,F,F,W,W,W,W,W,F,F,W,W,W,F,F,W,W,W], //  1  NW|entry|NE|Easter-N
  [W,W,W,F,F,W,W,W,W,W,W,W,W,F,F,W,W,W,W,W,F,F,W,W,W,F,F,W,W,W], //  2
  [W,W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W,W], //  3  wide junction 3-26
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W], //  4  main + baseball-cards room
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W], //  5
  [W,W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W], //  6  power-tools branch + cards room (CARDS CHEST 17,6)
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,W,F,F,W,W,W,W,W,W], //  7  main + cards + toolbox N-path starts 22-23
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,W,F,F,F,F,F,F,F,W], //  8  main + cards + toolbox room 22-28
  [W,W,W,F,F,F,F,F,F,F,F,F,F,F,W,F,F,F,F,F,F,W,F,F,F,F,F,F,F,W], //  9  cords branch | cards | wall | toolbox (WRENCH 25,9)
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,W,F,F,F,F,F,F,F,W], // 10  main + cards + toolbox room
  [W,W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,F,F,F,F,F,F,F,W], // 11  E-branch main→cards, toolbox room bottom
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,F,W,W,W,W,W,W], // 12  main + N-path 22-23
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,F,W,W,W,W,W,W], // 13
  [W,W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W,W,W,W,W], // 14  E-junction 3-23
  [W,W,W,F,F,W,W,W,W,W,W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W], // 15  S dead-end + taxes branch
  [W,W,W,F,F,W,W,W,W,W,W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W], // 16  S dead-end + TAXES CHEST 13,16
  [W,W,W,F,F,W,W,W,W,W,W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W], // 17
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W], // 18  S dead-end bottom
  [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W], // 19  bottom wall
];

// Deep wings added for grinding: workshop (east) and overflow storage (south).
export const MAP: number[][] = growMap(BASE_MAP, 44, 28, W, F, ({ room, h, v }) => {
  h(9, 29, 33);            // toolbox room → workshop
  room(34, 4, 41, 14);     // workshop
  v(23, 15, 21);           // E-junction → storage
  room(5, 22, 40, 26);     // overflow storage
  v(38, 15, 21);           // workshop → storage
});
// Storage pillars (box stacks).
for (const [c, r] of [[10, 24], [16, 23], [16, 25], [24, 24], [31, 23], [31, 25], [36, 24]]) MAP[r][c] = W;
