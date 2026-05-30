/**
 * scripts/paint-house.mjs
 *
 * Paints the tile data for public/assets/maps/new-house.json.
 * Run:  node scripts/paint-house.mjs
 *
 * After painting, run process-maps.mjs to regenerate the assets-active version.
 *
 * ── Map dimensions ────────────────────────────────────────────────────────────
 *  36 cols × 24 rows at 16px/tile = 576 × 384 world pixels
 *
 * ── House layout ─────────────────────────────────────────────────────────────
 *
 *  col:  0  1 [2]3──────────12[13]14───────24[25]26──────32[33] 34 35
 *  row:
 *   0        exterior (void)
 *   1        exterior (void)
 *  [2]        ╔══════════════════════════════════════════╗
 *   3         ║  LIVING ROOM    ║   CENTER HALL  ║KITCHEN║
 *   4         ║  (wood floor)   ║  (hall floor)  ║(tile) ║
 *   5         ║   Wife          ║                ║       ║
 *   6         ║                 ·                ·       ║   ← door gaps in col 13 & 25
 *   7         ║                 ·                ·       ║
 *   8         ║                 ║                ║ Dryer ║
 *   9         ║                 ║                ║       ║
 *  [10]        ╠══════·══╗     (open)     ╔══·══════════╣   ← interior horiz wall
 *  11          ║ MUDROOM  ║   (center     ║  UTILITY    ║
 *  12          ║ (mudroom ║   open)       ║  (mudroom)  ║
 *  13          ║  floor)  ·               ·             ║   ← door gaps in col 13 & 25
 *  14          ║          ·               ·             ║
 *  15          ║  (spawn) ║               ║             ║
 *  16          ║          ║  Bsmt Stairs  ║             ║
 *  17          ║          ║  (col 24)     ║             ║
 *  18          ║          ║               ║             ║
 *  19          ║          ║               ║             ║
 *  20          ║          ║               ║             ║
 * [21]         ╚══════════╩═══════════════╩═════════════╝   ← bottom wall
 *  22          (garage opening at cols 8-11)
 *  23          exterior
 *
 * ── Tile IDs (house_core_16x16, firstgid=1) ──────────────────────────────────
 *  GID = Phaser frame index + 1
 *  All tiles from house_core_16x16.png (1024×1536, 64 cols × 96 rows)
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const ROOT    = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAP_SRC = resolve(ROOT, "public/assets/maps/new-house.json");

// ── Dimensions ────────────────────────────────────────────────────────────────
const W = 36, H = 24;

// ── Tile dictionary ───────────────────────────────────────────────────────────
// All from house_core_16x16.png (firstgid = 1)
// GID = Phaser spritesheet frame + 1

const T = {
  E:     0,    // empty / transparent

  // Floors
  WOOD:  2053, // frame 2052 = living room wood planks
  KIT:   2061, // frame 2060 = kitchen ceramic tile
  MUD:   2117, // frame 2116 = mudroom / utility cement
  HALL:  2577, // frame 2576 = hallway neutral

  // Walls (non-zero → solid in canWalkTo)
  WH:    513,  // frame 512  = horizontal wall — top-facing surface
  WV:    529,  // frame 528  = vertical wall — side surface
  WB:    1025, // frame 1024 = horizontal wall — bottom-facing surface

  // Decorative (DoorsWindowsFixtures layer)
  WIN:   561,  // frame 560  = window pane (place 2-3 in a row for a full window)
  DOOR:  1085, // frame 1084 = door frame / opening indicator
  STAIR: 3073, // frame 3072 = basement/house staircase top tile
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Create a blank W×H grid filled with `fill`. */
const blank = (fill = 0) =>
  Array.from({ length: H }, () => new Array(W).fill(fill));

/** Flatten row-major 2-D grid to the flat array Tiled stores. */
const flat = (g) => g.flat();

/** Paint a rectangle (inclusive bounds) with one tile ID. */
function rect(g, r1, c1, r2, c2, tid) {
  for (let r = r1; r <= r2; r++)
    for (let c = c1; c <= c2; c++)
      g[r][c] = tid;
}

/** Paint a single horizontal span. */
const hline = (g, r, c1, c2, tid) => rect(g, r, c1, r, c2, tid);

/** Paint a single vertical span. */
const vline = (g, r1, r2, c, tid) => rect(g, r1, c, r2, c, tid);

// ── House coordinates ─────────────────────────────────────────────────────────
const HL = 2, HR = 33, HT = 2, HB = 21; // outer wall positions
const VL = 13, VR = 25;                   // interior vertical divider cols
const HW = 10;                            // interior horizontal divider row

// Door openings (pairs of cols / rows that are passable in the walls)
const H_OPEN_L  = [10, 11];          // row HW: living ↔ mudroom door
const H_OPEN_R  = [28, 29];          // row HW: kitchen ↔ utility door
const VL_OPEN_U = [6, 7];            // col VL: living ↔ center (upper)
const VL_OPEN_D = [12, 13];          // col VL: mudroom ↔ center (lower)
const VR_OPEN_U = [6, 7];            // col VR: center ↔ kitchen (upper)
const VR_OPEN_D = [12, 13];          // col VR: center ↔ utility (lower)
const GARAGE    = [8, 9, 10, 11];    // row HB: garage exit opening

// ── Layer builders ────────────────────────────────────────────────────────────

function buildFloor() {
  const g = blank();

  // ── Upper rooms (rows 3–9) ──────────────────────────────────────────
  rect(g, HT+1, HL+1, HW-1, VL-1, T.WOOD);   // living room
  rect(g, HT+1, VL+1, HW-1, VR-1, T.HALL);   // center hall upper
  rect(g, HT+1, VR+1, HW-1, HR-1, T.KIT);    // kitchen

  // ── Horizontal divider row — floor in openings and center ───────────
  hline(g, HW, VL+1, VR-1, T.HALL);           // center always open
  for (const c of H_OPEN_L) g[HW][c] = T.WOOD;
  for (const c of H_OPEN_R) g[HW][c] = T.KIT;

  // ── Lower rooms (rows 11–20) ────────────────────────────────────────
  rect(g, HW+1, HL+1, HB-1, VL-1, T.MUD);    // mudroom
  rect(g, HW+1, VL+1, HB-1, VR-1, T.HALL);   // center hall lower
  rect(g, HW+1, VR+1, HB-1, HR-1, T.MUD);    // utility / laundry

  // ── Floor in vertical door openings ────────────────────────────────
  for (const r of [...VL_OPEN_U, ...VL_OPEN_D]) g[r][VL] = T.WOOD;
  for (const r of [...VR_OPEN_U, ...VR_OPEN_D]) g[r][VR] = T.HALL;

  return g;
}

function buildWalls() {
  const g = blank();

  // ── Outer perimeter ─────────────────────────────────────────────────
  hline(g, HT, HL, HR, T.WH);                 // top outer wall
  hline(g, HB, HL, HR, T.WB);                 // bottom outer wall
  for (const c of GARAGE) g[HB][c] = T.E;     // garage opening in bottom wall
  vline(g, HT+1, HB-1, HL, T.WV);            // left outer wall
  vline(g, HT+1, HB-1, HR, T.WV);            // right outer wall

  // ── Interior vertical dividers ─────────────────────────────────────
  const openVL = new Set([...VL_OPEN_U, ...VL_OPEN_D]);
  const openVR = new Set([...VR_OPEN_U, ...VR_OPEN_D]);
  for (let r = HT+1; r <= HB-1; r++) {
    if (!openVL.has(r)) g[r][VL] = T.WV;
    if (!openVR.has(r)) g[r][VR] = T.WV;
  }

  // ── Interior horizontal divider (row HW) ───────────────────────────
  const openH = new Set([...H_OPEN_L, ...H_OPEN_R]);
  // Left section: cols 3–12
  for (let c = HL+1; c <= VL-1; c++) {
    if (!openH.has(c)) g[HW][c] = T.WB;
  }
  // Right section: cols 26–32
  for (let c = VR+1; c <= HR-1; c++) {
    if (!openH.has(c)) g[HW][c] = T.WB;
  }
  // Center (cols VL+1 to VR-1) stays open → hallway passes through

  return g;
}

function buildDoorsWindowsFixtures() {
  const g = blank();

  // ── Windows along top outer wall ─────────────────────────────────────
  // Living room side: 2-tile-wide window at cols 5-6
  hline(g, HT, 5, 6, T.WIN);
  // Living room side: another window at cols 9-10
  hline(g, HT, 9, 10, T.WIN);
  // Center: windows at cols 16-17 and 21-22
  hline(g, HT, 16, 17, T.WIN);
  hline(g, HT, 21, 22, T.WIN);
  // Kitchen side: windows at cols 27-28 and 31
  hline(g, HT, 27, 28, T.WIN);
  g[HT][31] = T.WIN;

  // ── Staircase visual at basement stairs location ─────────────────────
  // Basement stairs object is at approx tile (24, 19)
  // Place stair tile slightly above to mark the area
  g[17][24] = T.STAIR;
  g[18][24] = T.STAIR;
  g[19][24] = T.STAIR;

  // ── Door frame hints at the vertical wall openings ───────────────────
  // (optional visual — marks where doorways are)
  // Upper living ↔ center doorway (col VL, rows 6-7)
  for (const r of VL_OPEN_U) g[r][VL] = T.DOOR;
  // Lower mudroom ↔ center doorway (col VL, rows 12-13)
  for (const r of VL_OPEN_D) g[r][VL] = T.DOOR;
  // Upper center ↔ kitchen doorway (col VR, rows 6-7)
  for (const r of VR_OPEN_U) g[r][VR] = T.DOOR;
  // Lower center ↔ utility doorway (col VR, rows 12-13)
  for (const r of VR_OPEN_D) g[r][VR] = T.DOOR;

  return g;
}

function buildFurniture() {
  // Empty for now — add via Tiled or a later paint pass
  return blank();
}

// ── Assemble and save ─────────────────────────────────────────────────────────

const map = JSON.parse(readFileSync(MAP_SRC, "utf8"));

const LAYER_DATA = {
  Floor:                flat(buildFloor()),
  Walls:                flat(buildWalls()),
  DoorsWindowsFixtures: flat(buildDoorsWindowsFixtures()),
  Furniture:            flat(buildFurniture()),
  Collision:            flat(blank()),
  Triggers:             flat(blank()),
};

let painted = 0;
for (const layer of map.layers) {
  if (layer.type === "tilelayer" && LAYER_DATA[layer.name] !== undefined) {
    layer.data = LAYER_DATA[layer.name];
    painted++;
  }
}

writeFileSync(MAP_SRC, JSON.stringify(map, null, 2), "utf8");
console.log(`✓  Painted ${painted} layers in new-house.json`);

// Regenerate the assets-active version automatically
console.log("  Re-running process-maps.mjs …");
execSync("node scripts/process-maps.mjs", { cwd: ROOT, stdio: "inherit" });
