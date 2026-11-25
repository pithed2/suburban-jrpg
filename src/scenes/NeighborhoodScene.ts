/**
 * NeighborhoodScene
 * ─────────────────────────────────────────────────────────────────────────────
 * Main house-interior hub, Dragon Warrior style tile rendering.
 *
 * Art: original tiles from scripts/art/house_art.py ("house-tiles" sheet,
 * frame names in src/game/houseTiles.ts). Furniture is the FURNITURE list
 * below; solid pieces block walking.
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
import { HOUSE, type HouseFrame } from "../game/houseTiles";

// ── Tile constants ─────────────────────────────────────────────────────────
const TILE = 16;

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

// ── Five rooms, Dragon Warrior style ──────────────────────────────────────
//
//   ┌─────────────┬─────────────┬─────────────────────┐
//   │ LIVING ROOM │   DINING    │      KITCHEN        │
//   │  (wife ♥)   =    ROOM     =  (washer/dryer ○)   │
//   └────────┬────┴─────────────┴──────────┬──────────┘
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
//    Living ↔ Dining ↔ Kitchen : rows 5–6 through cols 14 and 22
//
const _ = 0;
/* prettier-ignore */
const MAP: number[][] = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_], //  0
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_], //  1
  [_,_,W,W,W,W,W,W,W,W,W,P,P,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,_,_], //  2  top walls (front door 11-12)
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,W,L,L,L,L,L,L,L,W,K,K,K,K,K,K,K,K,K,K,K,W,_,_], //  3
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,W,L,L,L,L,L,L,L,W,K,K,K,K,K,K,K,K,K,K,K,W,_,_], //  4
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,K,K,K,K,K,K,K,K,K,K,K,W,_,_], //  5
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,K,K,K,K,K,K,K,K,K,K,K,W,_,_], //  6
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,W,L,L,L,L,L,L,L,W,K,K,K,K,K,K,K,K,K,K,K,W,_,_], //  7
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,W,L,L,L,L,L,L,L,W,K,K,K,K,K,K,K,K,K,K,K,W,_,_], //  8
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,W,L,L,L,L,L,L,L,W,K,K,K,K,K,K,K,K,K,K,K,B,_,_], //  9  back door at col 33
  [_,_,W,W,W,W,W,L,L,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,K,K,W,W,W,W,W,W,_,_], // 10  south walls + door gaps
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


// ── Floor frame lookup ─────────────────────────────────────────────────────
const FLOOR_FRAME: Record<number, number> = {
  [L]: HOUSE.livingFloor,
  [K]: HOUSE.kitchenFloor,
  [H]: HOUSE.hallFloor,
  [M]: HOUSE.mudFloor,
  [S]: HOUSE.stairsDown,
  [U]: HOUSE.stairsUp,
};

// ── Furniture: [col, row, frame, solid] ───────────────────────────────────
// Wall pieces (window, TV, pictures, doors) sit on wall tiles.
const FURNITURE: [number, number, HouseFrame, boolean?][] = [
  // Living room
  [3, 3, "bookshelf", true],
  [5, 2, "tv"], [5, 3, "tvStand", true],
  [8, 2, "window"], [9, 2, "window"],
  [11, 2, "door"], [12, 2, "door"],
  [13, 3, "plant", true],
  [10, 6, "coffeeTable", true],
  [10, 7, "rug"],
  [9, 8, "couchLeft", true], [10, 8, "couchMid", true], [11, 8, "couchRight", true],
  [12, 8, "endTable", true],
  [3, 9, "plant", true],
  // Dining room
  [16, 2, "picture"], [18, 2, "window"], [20, 2, "picture"],
  [17, 6, "tableLeft", true], [18, 6, "tableRight", true],
  [16, 6, "chair", true], [19, 6, "chair", true],
  [15, 3, "plant", true], [21, 3, "plant", true],
  [18, 8, "rug"],
  // Kitchen: counters and laundry along the north wall
  [24, 2, "window"], [30, 2, "window"],
  [23, 3, "counter", true], [24, 3, "sink", true], [25, 3, "counter", true],
  [26, 3, "stove", true], [27, 3, "dryer", true], [28, 3, "washer", true],
  [29, 3, "counter", true], [30, 3, "counter", true], [31, 3, "counter", true],
  [33, 3, "fridge", true],
  [29, 7, "tableLeft", true], [30, 7, "tableRight", true],
  [28, 7, "chair", true], [31, 7, "chair", true],
  [34, 9, "door"],
  // Hallway
  [4, 12, "picture"], [11, 12, "picture"], [17, 12, "picture"], [24, 12, "picture"], [31, 12, "picture"],
  [3, 13, "plant", true], [32, 13, "plant", true],
  [28, 16, "utilityDoor"],
  // Mudroom
  [4, 18, "coatHooks"], [11, 18, "coatHooks"],
  [4, 19, "bench", true], [5, 19, "bench", true],
  [12, 20, "shoes", true],
  ...Array.from({ length: 28 }, (_, i): [number, number, HouseFrame] => [4 + i, 14, "runner"]),
  [7, 21, "garageDoor"], [8, 21, "garageDoor"],
];

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

  private tile(col: number, row: number, frame: number): Phaser.GameObjects.Image {
    return this.add.image(col * TILE + TILE / 2, row * TILE + TILE / 2, "house-tiles", frame);
  }

  private isFloor(col: number, row: number): boolean {
    return WALKABLE.has(MAP[row]?.[col]);
  }

  private drawTiles(): void {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const tid = MAP[row][col];
        const floor = FLOOR_FRAME[tid];
        if (floor !== undefined) {
          this.tile(col, row, floor);
        } else {
          // Walls, door markers and the space outside the rooms.
          this.tile(col, row, this.isFloor(col, row + 1) && tid !== 0 ? HOUSE.wallFace : HOUSE.wallTop);
        }
      }
    }
  }

  // ── Furniture ──────────────────────────────────────────────────────────────

  private placeDecorations(): void {
    for (const [col, row, frame, solid] of FURNITURE) {
      this.tile(col, row, HOUSE[frame]);
      if (solid) this.npcTiles.add(`${col},${row}`);
    }
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
