/**
 * NeighborhoodScene
 * ─────────────────────────────────────────────────────────────────────────────
 * Main house-interior hub, Dragon Warrior style tile rendering.
 *
 * Tiles drawn from the full_set RPG-Maker sheets (same as TileRoomScene):
 *   walls  → full-set-int-a4  frame WALL_FRAME
 *   floors → full-set-int-a2  frame per room type
 *
 * Object positions (wife, dryer, exits) are taken directly from the values
 * in public/assets-active/maps/new-house.json Objects layer so they never drift.
 *
 * Talk-to-wife and dryer beats live in data: src/data/areas/house.json and the
 * "house:wife" event of each quest in src/data/quests/.
 */

import Phaser from "phaser";
import { loadAudioOnce } from "../game/audioAssets";
import { CharacterSprite } from "../game/CharacterSprite";
import { DAD_DEF, WIFE_DEF } from "../game/characterDefs";
import { FieldKit } from "../game/FieldKit";
import { GridMover } from "../game/GridMover";

// ── Tile constants ─────────────────────────────────────────────────────────
const TILE = 16;

// Walls — full-set-int-a4 (32×32 per frame)
const WALL_FRAME = 140; // warm cream plaster — suburban interior wall

// Floors — house-core-16 = house_core_16x16.png (16×16 per frame, 64 cols × 96 rows)
// These are the same frame numbers used before the full_set refactor.
// They look like a real suburban house rather than a stone-floor RPG.
const FLOOR_LIVING  = 2052; // row 32 col  4 — warm wood plank    → living room
const FLOOR_KITCHEN = 2060; // row 32 col 12 — ceramic tile        → kitchen
const FLOOR_HALL    = 2576; // row 40 col 16 — neutral hall floor  → hallway
const FLOOR_MUD     = 2116; // row 33 col  4 — entry/mudroom tile  → mudroom / utility

// ── Tile-type IDs used in the MAP array ───────────────────────────────────
const W = 1;   // wall  (solid)
const L = 2;   // living room floor  (warm)
const K = 3;   // kitchen floor      (cool)
const H = 4;   // hallway floor      (neutral)
const M = 5;   // mudroom floor      (concrete)
const D = 6;   // garage door        (solid wall bump marker)
const S = 7;   // basement stairs    (walkable exit marker)
const U = 8;   // bathroom stairs up (walkable exit marker)
const P = 9;   // front door         (solid wall bump marker — Dome Hepot)
const B = 10;  // back door          (solid wall bump marker — backyard, quest 3)

const WALKABLE = new Set([L, K, H, M, S, U]);

// ── Four rooms, Dragon Warrior style ──────────────────────────────────────
//
//   ┌──────────────────────┬──────────────────────────┐
//   │     LIVING ROOM      │        KITCHEN           │
//   │      (wife ♥)        │       (dryer ○)          │
//   └────────┬─────────────┴──────────────┬───────────┘
//            │                            │
//   ┌────────┴────────────────────────────┴───────────┐
//   │                 HALLWAY                         │
//   │        (basement stairs ▼)  (util room →)       │
//   └────────┬────────────────────────────────────────┘
//            │
//   ┌────────┴───────────────┐
//   │   MUDROOM / ENTRY      │
//   │   (spawn ★)            │
//   │   [GARAGE ↓]           │
//   └────────────────────────┘
//
//  Doorways — 2-tile gaps in walls:
//    Living  → Hallway : cols 7–8,  row 11 passage
//    Kitchen → Hallway : cols 26–27, row 11 passage
//    Hallway → Mudroom : cols 7–8,  row 17 passage
//    Mudroom south     : cols 7–8,  row 21 (garage exit opening)
//
const _ = 0;
/* prettier-ignore */
const MAP: number[][] = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_], //  0
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_], //  1
  [_,_,W,W,W,W,W,W,W,W,W,P,P,W,W,_,_,_,_,_,_,_,W,W,W,W,W,W,W,W,W,W,W,W,_,_], //  2  top walls (front door 11-12)
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,W,_,_,_,_,_,_,_,W,K,K,K,K,K,K,K,K,K,K,K,W,_,_], //  3
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,W,_,_,_,_,_,_,_,W,K,K,K,K,K,K,K,K,K,K,K,W,_,_], //  4
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,W,_,_,_,_,_,_,_,W,K,K,K,K,K,K,K,K,K,K,K,W,_,_], //  5
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,W,_,_,_,_,_,_,_,W,K,K,K,K,K,K,K,K,K,K,K,W,_,_], //  6
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,W,_,_,_,_,_,_,_,W,K,K,K,K,K,K,K,K,K,K,K,W,_,_], //  7
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,W,_,_,_,_,_,_,_,W,K,K,K,K,K,K,K,K,K,K,K,W,_,_], //  8
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,W,_,_,_,_,_,_,_,W,K,K,K,K,K,K,K,K,K,K,K,B,_,_], //  9  back door at col 33
  [_,_,W,W,W,W,W,L,L,W,W,W,W,W,W,_,_,_,_,_,_,_,W,W,W,W,W,K,K,W,W,W,W,W,W,_,_], // 10  south walls + door gaps
  [_,_,_,_,_,_,_,L,L,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,K,K,_,_,_,_,_,_,_], // 11  passage tiles
  [_,_,W,W,W,W,W,H,H,W,W,W,W,S,S,W,W,W,W,W,U,U,W,W,W,W,W,H,H,W,W,W,W,W,_,_], // 12  hallway top wall (bathroom stairs 20-21)
  [_,_,W,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,W,_,_], // 13
  [_,_,W,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,W,_,_], // 14
  [_,_,W,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,W,_,_], // 15
  [_,_,W,W,W,W,W,H,H,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,_,_], // 16  hallway bottom wall
  [_,_,_,_,_,_,_,M,M,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_], // 17  passage to mudroom
  [_,_,W,W,W,W,W,M,M,W,W,W,W,W,W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_], // 18  mudroom top wall
  [_,_,W,M,M,M,M,M,M,M,M,M,M,M,W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_], // 19
  [_,_,W,M,M,M,M,M,M,M,M,M,M,M,W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_], // 20
  [_,_,W,W,W,W,W,D,D,W,W,W,W,W,W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_], // 21  mudroom bottom wall (garage at cols 7–8)
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_], // 22
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_], // 23
];

const ROWS    = MAP.length;
const COLS    = MAP[0].length;
const WORLD_W = COLS * TILE;
const WORLD_H = ROWS * TILE;

// ── Object positions — tile centres in world pixels ───────────────────────
// Derived from the new room layout above.
// tc(col, row) = { x: col*TILE + TILE/2, y: row*TILE + TILE/2 }
function px(col: number, row: number) {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

const WIFE_PX     = px(7,  6);   // living room centre
const TILEROOM_PX = px(28, 14);  // hallway right-centre (utility room door)
const WIFE_COL    = 7;
const WIFE_ROW    = 6;
const SPAWN_COL   = 8;
const SPAWN_ROW   = 20;
const BASEMENT_RETURN_COL = 13;
const BASEMENT_RETURN_ROW = 13;
const GARAGE_RETURN_COL   = 8;
const GARAGE_RETURN_ROW   = 20;
const BATHROOM_RETURN_COL = 20;
const BATHROOM_RETURN_ROW = 13;
const HOMEDEPOT_RETURN_COL = 11;
const HOMEDEPOT_RETURN_ROW = 3;
const BACKYARD_RETURN_COL = 32;
const BACKYARD_RETURN_ROW = 9;


// ── Floor frame lookup (house-core-16 texture) ────────────────────────────
const FLOOR_FRAME: Record<number, number> = {
  [L]: FLOOR_LIVING,
  [K]: FLOOR_KITCHEN,
  [H]: FLOOR_HALL,
  [M]: FLOOR_MUD,
};

// ── Scene ─────────────────────────────────────────────────────────────────
type NeighborhoodSpawn = "default" | "basement" | "garage" | "bathroom" | "homedepot" | "backyard";

export class NeighborhoodScene extends Phaser.Scene {
  private mover!: GridMover;
  private kit!: FieldKit;
  private wifeChar!: CharacterSprite;
  // Tiles occupied by solid NPCs — player cannot walk into them
  private npcTiles = new Set<string>();
  private spawn: NeighborhoodSpawn = "default";

  constructor() {
    super("NeighborhoodScene");
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  init(data?: { spawn?: NeighborhoodSpawn }): void {
    this.spawn = data?.spawn ?? "default";
  }

  preload(): void {
    loadAudioOnce(this, "comfort-bg", "/assets-active/audio/comfort-bg.mp3");
  }

  create(): void {
    this.kit = new FieldKit(this, { areaId: "house", mover: () => this.mover });
    this.npcTiles.clear();

    this.drawTiles();
    this.placeDecorations();
    this.placeCharacters();
    this.kit.create();

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.mover.phaserSprite, true, 0.1, 0.1);

    const bgMusic = this.sound.add("comfort-bg", { loop: true, volume: 0.4 });
    bgMusic.play();
    this.events.once("shutdown", () => bgMusic.stop());

    this.kit.enter();
  }

  update(_time: number, delta: number): void {
    if (!this.kit.update(delta)) return;

    this.mover.update(
      this.kit.cursors,
      delta,
      (col, row) => this.canWalkTo(col, row),
      (col, row) => this.onLand(col, row),
      (col, row) => this.onBump(col, row),
    );
  }

  // ── Tile rendering ─────────────────────────────────────────────────────────

  private drawTiles(): void {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const tid = MAP[row][col];
        if (tid === 0) continue; // exterior — leave as game background colour

        const cx = col * TILE + TILE / 2;
        const cy = row * TILE + TILE / 2;

        if (tid === W || tid === B) {
          this.add.image(cx, cy, "full-set-int-a4")
            .setFrame(WALL_FRAME)
            .setDisplaySize(TILE, TILE);
        } else if (tid === D) {
          this.addFloorTile(cx, cy, FLOOR_MUD);
        } else if (tid === S) {
          this.add.image(cx, cy, "full-set-int-a4")
            .setFrame(WALL_FRAME)
            .setDisplaySize(TILE, TILE);
        } else {
          const frame = FLOOR_FRAME[tid] ?? FLOOR_HALL;
          this.addFloorTile(cx, cy, frame);
        }
      }
    }

    this.addMapOverlays();
  }

  private addMapOverlays(): void {
    this.add.image(7 * TILE, 21 * TILE, "garage-door")
      .setDisplaySize(TILE * 2, TILE)
      .setOrigin(0, 0);

    this.add.image(13 * TILE, 12 * TILE, "stairs-down")
      .setDisplaySize(TILE * 2, TILE)
      .setOrigin(0, 0);

    this.add.image(20 * TILE, 12 * TILE, "stairs-up")
      .setDisplaySize(TILE * 2, TILE)
      .setOrigin(0, 0);

    // Back door to the backyard (quest 3).
    this.add.image(33 * TILE + TILE / 2, 9 * TILE + TILE / 2, "lawn-tiles", 6);

    this.add.image(11 * TILE, 2 * TILE, "garage-door")
      .setDisplaySize(TILE * 2, TILE)
      .setOrigin(0, 0)
      .setTint(0x93c5fd);
  }

  private addFloorTile(x: number, y: number, frame: number): void {
    this.add.image(x, y, "house-core-16")
      .setFrame(frame)
      .setDisplaySize(TILE, TILE);
  }

  // ── Decorations ────────────────────────────────────────────────────────────

  private placeDecorations(): void {
    // ── Utility room marker ────────────────────────────────────────────────
    this.add.rectangle(TILEROOM_PX.x, TILEROOM_PX.y, 2 * TILE, TILE, 0x60a5fa, 0.12)
      .setStrokeStyle(1, 0x60a5fa, 0.5);

    const spr16 = (col: number, row: number, frame: number) =>
      this.add.image(col * TILE + TILE / 2, row * TILE + TILE / 2, "interiors-free-16")
        .setFrame(frame).setDisplaySize(TILE, TILE);

    // kitchen_LRK.png: 26 cols × 25 rows, 16×16 px per frame
    const KW = 26;
    const kitchen = (col: number, row: number, tsRow: number, tsCol: number) =>
      this.add.image(col * TILE + TILE / 2, row * TILE + TILE / 2, "kitchen-props")
        .setFrame(tsRow * KW + tsCol).setDisplaySize(TILE, TILE);

    const web = (cx: number, cy: number, alpha = 0.75) =>
      this.add.image(cx, cy, "full-set-int-c")
        .setFrame(167).setDisplaySize(TILE * 2, TILE * 2).setAlpha(alpha);

    const block = (col: number, row: number) => this.npcTiles.add(`${col},${row}`);

    // ── Living room ────────────────────────────────────────────────────────
    // TV + stand against north wall (cols 4-5, rows 2-3; row 2 = wall, no block needed)
    spr16(4, 2, 224); spr16(5, 2, 225);  // screen on wall
    spr16(4, 3, 240); spr16(5, 3, 241);  // stand on floor — block
    block(4, 3); block(5, 3);

    // Window on north wall (row 2 = wall, no block)
    spr16(9, 2, 208); spr16(10, 2, 209);

    // Sofa against south wall (cols 8-11, rows 8-9)
    spr16(8, 8, 160); spr16(9, 8, 161); spr16(10, 8, 162); spr16(11, 8, 163);
    spr16(8, 9, 176); spr16(9, 9, 177); spr16(10, 9, 178); spr16(11, 9, 179);
    for (let c = 8; c <= 11; c++) { block(c, 8); block(c, 9); }

    // End table beside sofa
    spr16(12, 8, 187);
    block(12, 8);

    // ── Kitchen ────────────────────────────────────────────────────────────
    // Window on north wall (row 2 = wall, no block)
    spr16(25, 2, 208); spr16(26, 2, 209);

    // Counter top + sink + stove: gray kitchen set row 21 (frames 546-555), 10 tiles
    // Cabinet fronts:             gray kitchen set row 22 (frames 572-581), 10 tiles
    for (let i = 0; i < 10; i++) {
      kitchen(23 + i, 3, 21, i);  // counter surface (sink ~col2, stove ~cols6-9)
      kitchen(23 + i, 4, 22, i);  // cabinet fronts
      block(23 + i, 3);
      block(23 + i, 4);
    }

    // Fridge against east wall: 2 tiles wide × 4 tiles tall (cols 31-32, rows 5-8)
    // kitchen_LRK fridge: rows 1-4, cols 22-23 → frames 48-49, 74-75, 100-101, 126-127
    const fridgeRows = [1, 2, 3, 4];
    for (let r = 0; r < 4; r++) {
      kitchen(31, 5 + r, fridgeRows[r], 22);
      kitchen(32, 5 + r, fridgeRows[r], 23);
      block(31, 5 + r); block(32, 5 + r);
    }

    // ── Hallway — cobweb in NE corner near basement stairs ────────────────
    web(33 * TILE, 12 * TILE, 0.6);
  }

  // ── Characters ─────────────────────────────────────────────────────────────

  private placeCharacters(): void {
    const dadChar = new CharacterSprite(this, 0, 0, DAD_DEF);
    const spawnTable: Record<NeighborhoodSpawn, { col: number; row: number }> = {
      default: { col: SPAWN_COL, row: SPAWN_ROW },
      basement: { col: BASEMENT_RETURN_COL, row: BASEMENT_RETURN_ROW },
      garage: { col: GARAGE_RETURN_COL, row: GARAGE_RETURN_ROW },
      bathroom: { col: BATHROOM_RETURN_COL, row: BATHROOM_RETURN_ROW },
      homedepot: { col: HOMEDEPOT_RETURN_COL, row: HOMEDEPOT_RETURN_ROW },
      backyard: { col: BACKYARD_RETURN_COL, row: BACKYARD_RETURN_ROW },
    };
    const spawn = spawnTable[this.spawn] ?? spawnTable.default;
    const spawnCol = spawn.col;
    const spawnRow = spawn.row;
    this.mover = new GridMover(this, dadChar, TILE, spawnCol, spawnRow);

    this.wifeChar = new CharacterSprite(this, WIFE_PX.x, WIFE_PX.y, WIFE_DEF);
    this.wifeChar.setScale(0.5);
    this.wifeChar.face("down");

    this.npcTiles.add(`${WIFE_COL},${WIFE_ROW}`);
  }

  // ── Collision ──────────────────────────────────────────────────────────────

  private canWalkTo(col: number, row: number): boolean {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    if (this.npcTiles.has(`${col},${row}`)) return false;
    return WALKABLE.has(MAP[row][col]);
  }

  private onLand(col: number, row: number): void {
    if (MAP[row]?.[col] === S) {
      this.kit.goto("BasementScene");
    }
    if (MAP[row]?.[col] === U) {
      this.kit.goto("BathroomScene");
    }
  }

  private onBump(col: number, row: number): void {
    if (MAP[row]?.[col] === D) {
      this.kit.goto("GarageScene");
    }
    if (MAP[row]?.[col] === P) {
      this.kit.goto("HDCutScene");
    }
    if (MAP[row]?.[col] === B && this.kit.isIdle) {
      void this.kit.run("backdoor");
    }
  }
}
