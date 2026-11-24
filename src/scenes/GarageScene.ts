/**
 * GarageScene: dungeon for quest 1 (Fix the Dryer).
 * ─────────────────────────────────────────────────────────────────────────────
 * Dragon Warrior style dungeon. Winding corridors, dead ends, random
 * encounters, and a toolbox hiding the Adjustable Wrench.
 *
 * This file only draws the map and handles exits. Chests, dead ends, encounter
 * tables and quest beats live in src/data/areas/garage.json.
 *
 * MAP legend
 * ──────────
 *  W = 1  solid wall
 *  F = 2  floor
 *  X = 3  exit tile, returns to NeighborhoodScene
 */

import Phaser from "phaser";
import { loadAudioOnce } from "../game/audioAssets";
import { CharacterSprite } from "../game/CharacterSprite";
import { DAD_DEF } from "../game/characterDefs";
import { FieldKit } from "../game/FieldKit";
import { GridMover } from "../game/GridMover";
import { F, MAP, W, X } from "../game/maps/garage";

// ── Tile constants ─────────────────────────────────────────────────────────
const TILE = 16;
// Walls — full-set-int-a4 (512×480, 32×32, 16 cols × 15 rows)
//   Frame 17 = row 1 col 1 — dark iron/stone fill
const WALL_FRAME = 134; // gray concrete block — garage wall

// Floor — garage-ts = garage_basement_16x16.png (1024×1536, 16×16, 64 cols × 96 rows)
//   Frame 424 = row 6 col 40 — medium-dark grey concrete (GARAGE FLOOR section)
const GARAGE_FLOOR_FRAME = 424;

const ROWS    = MAP.length;
const COLS    = MAP[0].length; // 30
const WORLD_W = COLS * TILE;   // 480
const WORLD_H = ROWS * TILE;   // 320


// ── Scene ──────────────────────────────────────────────────────────────────
export class GarageScene extends Phaser.Scene {
  private mover!: GridMover;
  private kit!: FieldKit;

  constructor() { super("GarageScene"); }

  preload(): void {
    loadAudioOnce(this, "dramatic-bg", "/assets-active/audio/dramatic-bg.mp3");
  }

  create(): void {
    this.kit = new FieldKit(this, { areaId: "garage", mover: () => this.mover, statsPanel: true });

    this.drawTiles();
    this.placeDecorations();
    this.placePlayer();
    this.kit.create();

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.mover.phaserSprite, true, 0.1, 0.1);

    const bgMusic = this.sound.add("dramatic-bg", { loop: true, volume: 0.4 });
    bgMusic.play();
    this.events.once("shutdown", () => bgMusic.stop());

    this.kit.enter();
  }

  update(_time: number, delta: number): void {
    if (!this.kit.update(delta)) return;

    this.mover.update(
      this.kit.cursors,
      delta,
      (c, r) => this.canWalkTo(c, r),
      (c, r) => this.onLand(c, r),
    );
  }

  // ── Tile rendering ─────────────────────────────────────────────────────────

  private drawTiles(): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = MAP[r][c];
        if (t === 0) continue;
        const cx = c * TILE + TILE / 2;
        const cy = r * TILE + TILE / 2;
        if (t === W) {
          // Dark stone walls from full-set-int-a4
          this.add.image(cx, cy, "full-set-int-a4")
            .setFrame(WALL_FRAME)
            .setDisplaySize(TILE, TILE);
        } else if (t === X) {
          // Exit door is embedded in the wall but remains walkable as a trigger tile.
          this.add.image(cx, cy, "full-set-int-a4")
            .setFrame(WALL_FRAME)
            .setDisplaySize(TILE, TILE);
        } else {
          // Walkable floor — GARAGE FLOOR (CONCRETE) tile from garage_basement_16x16
          this.add.image(cx, cy, "garage-ts")
            .setFrame(GARAGE_FLOOR_FRAME)
            .setDisplaySize(TILE, TILE);
        }
      }
    }

    this.add.image(13 * TILE, 0, "garage-door")
      .setDisplaySize(TILE * 2, TILE)
      .setOrigin(0, 0);
  }

  private placeDecorations(): void {
    // Int-C frame 167 = cobweb. Place at wall-floor corners, 2×2 tile display.
    const web = (wx: number, wy: number, alpha = 0.8) =>
      this.add.image(wx, wy, "full-set-int-c")
        .setFrame(167).setDisplaySize(TILE * 2, TILE * 2).setAlpha(alpha);

    // Int-B props (32×32 art → display at TILE for clutter items)
    const propB = (col: number, row: number, frame: number, size = TILE) =>
      this.add.image(col * TILE + TILE / 2, row * TILE + TILE / 2, "full-set-int-b")
        .setFrame(frame).setDisplaySize(size, size);

    // NW dead end — paint cans corner (wall at row 0, col 2)
    web(2 * TILE, 0 * TILE, 0.8);               // NW wall corner
    propB(3, 1, 96);  propB(4, 1, 97);          // orange pots = paint cans
    propB(3, 2, 64);  propB(4, 2, 65);          // dark crates

    // NE dead end — Xmas boxes corner (wall at row 0, col 22)
    web(22 * TILE, 0 * TILE, 0.8);
    propB(20, 1, 67); propB(21, 1, 64);         // wooden crates = Xmas boxes
    propB(20, 2, 65); propB(21, 2, 67);

    // Power-tools branch — cobweb in the dead-end pocket (row 6, west wall)
    web(2 * TILE, 6 * TILE, 0.65);
    propB(5, 6, 70, TILE * 2);                  // large barrel (frame 70 is 2-tile art)
    propB(8, 6, 79);                             // small appliance

    // Extension-cord area — minimal web, cord mess speaks for itself
    web(2 * TILE, 9 * TILE, 0.55);

    // Exercise graveyard — most neglected, most webs (cols 3-4, rows 15-18)
    web(2 * TILE, 14 * TILE, 0.85);             // NW corner
    web(2 * TILE, 18 * TILE, 0.75);             // SW corner
    propB(3, 15, 128); propB(4, 15, 129);       // blue pots = dumbbells
    propB(3, 16, 112); propB(4, 17, 113);       // green pots = more junk
    propB(3, 18, 130);                           // stone pile = ankle weights

    // Toolbox room corners — the wrench has been here a while
    web(22 * TILE, 6 * TILE, 0.7);
    web(29 * TILE, 6 * TILE, 0.7);
    web(22 * TILE, 12 * TILE, 0.65);
    web(29 * TILE, 12 * TILE, 0.65);
    propB(23, 9, 65); propB(24, 9, 64);         // crates flanking the chest
  }

  private placePlayer(): void {
    const char = new CharacterSprite(this, 0, 0, DAD_DEF);
    this.mover = new GridMover(this, char, TILE, 13, 1); // spawn just inside entry (col 13-14 = exit tiles)
  }

  // ── Collision and exits ────────────────────────────────────────────────────

  private canWalkTo(col: number, row: number): boolean {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    if (this.kit.isBlocked(col, row)) return false;
    const t = MAP[row][col];
    return t === F || t === X;
  }

  private onLand(col: number, row: number): void {
    if (MAP[row][col] === X) {
      this.kit.goto("NeighborhoodScene", "garage");
      return;
    }
    this.kit.onStep();
  }
}
