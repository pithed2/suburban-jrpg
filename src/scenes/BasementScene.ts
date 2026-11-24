/**
 * BasementScene: dungeon for quest 1 (Fix the Dryer).
 * ─────────────────────────────────────────────────────────────────────────────
 * Dragon Warrior style dungeon. Winding corridors, random encounters, the
 * circuit breaker, and the Evil Heating Coil boss.
 *
 * This file only draws the map and handles exits. Hotspots, chests, encounter
 * tables and every quest beat live in src/data/areas/basement.json. FieldKit
 * runs them.
 *
 * Tiles from dungeon-16 (0x72_16x16DungeonTileset.v5.png, 16×16):
 *   Outer walls use explicit frame rules from the numbered tileset preview.
 *   Default wall = frame 32, default floor = frame 64.
 */

import Phaser from "phaser";
import { loadAudioOnce } from "../game/audioAssets";
import { CharacterSprite } from "../game/CharacterSprite";
import { DAD_DEF } from "../game/characterDefs";
import { FieldKit } from "../game/FieldKit";
import { GridMover } from "../game/GridMover";

// ── Tile constants ─────────────────────────────────────────────────────────
const TILE = 16;

const WALL_FRAME_DEFAULT = 32;
const FLOOR_FRAMES = [64, 65, 188, 227];

const W = 1; // wall
const F = 2; // floor (walkable)
const X = 3; // exit tile — triggers return to NeighborhoodScene

function buildBasementMap(): number[][] {
  const map = Array.from({ length: 24 }, () => Array(36).fill(W));
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

  return map;
}

const MAP: number[][] = buildBasementMap();

const ROWS    = MAP.length;
const COLS    = MAP[0].length;
const WORLD_W = COLS * TILE;
const WORLD_H = ROWS * TILE;

// Tiles occupied by the coil (boss) — player can't walk through it
const COIL_BLOCKED: ReadonlySet<string> = new Set(["32,19","33,19","32,20","33,20"]);

// ── Position helpers ──────────────────────────────────────────────────────
const px = (col: number, row: number) =>
  ({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });

const BREAKER_PX   = px(14, 10); // wall tile at the end of the breaker hall
const STICKER_PX   = px(30, 20); // the safety sticker Dad never read
const COIL_PX      = px(32, 19); // Evil Heating Coil, bottom-right room
const BREAKER_OFF_FRAME = 48; // !other.png row 5, column 1
const BREAKER_ON_FRAME = 74;  // !other.png row 7, column 3

export class BasementScene extends Phaser.Scene {
  private mover!: GridMover;
  private kit!: FieldKit;
  private breakerPanel!: Phaser.GameObjects.Image;
  private coilSprite!: Phaser.GameObjects.Image;

  constructor() {
    super("BasementScene");
  }

  preload(): void {
    loadAudioOnce(this, "dramatic-bg", "/assets-active/audio/dramatic-bg.mp3");
    loadAudioOnce(this, "mini-boss", "/assets-active/audio/mini-boss.mp3");
  }

  create(): void {
    this.kit = new FieldKit(this, {
      areaId: "basement",
      mover: () => this.mover,
      statsPanel: true,
      onRefresh: () => this.syncObjects(),
    });

    this.drawTiles();
    this.placeDecorations();
    this.placeObjects();
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
      (col, row) => this.canWalkTo(col, row),
      (col, row) => this.onLand(col, row),
    );
  }

  // ── Tile rendering ────────────────────────────────────────────────────────

  private drawTiles(): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = MAP[r][c];
        if (t === 0) continue;
        const cx = c * TILE + TILE / 2;
        const cy = r * TILE + TILE / 2;

        if (t === W) {
          this.add.image(cx, cy, "dungeon-16")
            .setFrame(this.getBasementWallFrame(c, r))
            .setDisplaySize(TILE, TILE);
        } else if (t === X) {
          this.add.image(cx, cy, "dungeon-16")
            .setFrame(WALL_FRAME_DEFAULT)
            .setDisplaySize(TILE, TILE);
        } else {
          this.add.image(cx, cy, "dungeon-16")
            .setFrame(this.getBasementFloorFrame(c, r))
            .setDisplaySize(TILE, TILE);
        }
      }
    }

    this.add.image(17 * TILE, 0, "stairs-down")
      .setDisplaySize(TILE * 2, TILE)
      .setOrigin(0, 0);
  }

  private getBasementWallFrame(col: number, row: number): number {
    const lastCol = COLS - 1;

    if (row === 0) {
      if (col === 0) return 16;
      if (col === lastCol) return 18;
      return 0;
    }

    if (row === 1) {
      if (col === 0) return 48;
      if (col === lastCol) return 50;
      return 32;
    }

    if (row === ROWS - 3) {
      if (col === 0) return 83;
      if (col === lastCol) return 84;
      return WALL_FRAME_DEFAULT;
    }

    if (row === ROWS - 2) {
      if (col === 0) return 83;
      if (col === lastCol) return 84;
      return 115;
    }
    if (row === ROWS - 1) {
      if (col === 0) return 83;
      if (col === lastCol) return 84;
      return 21;
    }

    if (col === 0) return 48;
    if (col === 1) return 49;
    if (col === lastCol - 1) return 49;
    if (col === lastCol) return 50;

    return WALL_FRAME_DEFAULT;
  }

  private getBasementFloorFrame(col: number, row: number): number {
    return FLOOR_FRAMES[Math.abs(col * 13 + row * 17) % FLOOR_FRAMES.length];
  }

  // ── Decorations ───────────────────────────────────────────────────────────

  private placeDecorations(): void {
    // Int-C frame 167 = cobweb. Anchored at wall corners, 2×2 tile display.
    const web = (wx: number, wy: number, alpha = 0.8) =>
      this.add.image(wx, wy, "full-set-int-c")
        .setFrame(167).setDisplaySize(TILE * 2, TILE * 2).setAlpha(alpha);

    // Int-B prop
    const propB = (col: number, row: number, frame: number, size = TILE) =>
      this.add.image(col * TILE + TILE / 2, row * TILE + TILE / 2, "full-set-int-b")
        .setFrame(frame).setDisplaySize(size, size);

    // NW room (insulation pipe dead end) — room cols 2-7, rows 8-12
    web(1 * TILE, 7 * TILE, 0.85);   // top-left corner
    web(1 * TILE, 12 * TILE, 0.7);   // bottom-left corner
    web(7 * TILE, 7 * TILE, 0.6);    // top-right corner
    propB(3, 10, 67); propB(4, 10, 64); propB(5, 10, 65); // old crates/stuff

    // Water stain room (cols 22-28, rows 11-14)
    web(21 * TILE, 10 * TILE, 0.8);   // top-left
    web(28 * TILE, 10 * TILE, 0.75);  // top-right
    web(21 * TILE, 14 * TILE, 0.65);  // bottom-left
    web(28 * TILE, 14 * TILE, 0.7);   // bottom-right

    // Pool noodles dead end (row 21, cols 4-12)
    web(3 * TILE, 20 * TILE, 0.75);   // west corner
    web(12 * TILE, 20 * TILE, 0.65);  // east corner
    propB(6, 21, 128); propB(7, 21, 129); propB(9, 21, 112); // pool noodles → colourful pots

    // Wire rack dead end (cols 8-14, rows 20-22)
    web(7 * TILE, 19 * TILE, 0.8);
    web(14 * TILE, 19 * TILE, 0.7);
    propB(10, 21, 8, TILE * 2);  // empty wooden shelving unit

    // Dryer boss room — heavy cobwebs in all four corners (cols 29-34, rows 17-21)
    web(28 * TILE, 16 * TILE, 0.9);  // top-left
    web(34 * TILE, 16 * TILE, 0.9);  // top-right
    web(28 * TILE, 21 * TILE, 0.8);  // bottom-left
    web(34 * TILE, 21 * TILE, 0.85); // bottom-right
    web(31 * TILE, 16 * TILE, 0.5);  // top-centre extra wisp

    // Long west corridor (col 4) — scattered single webs
    web(3 * TILE, 4 * TILE, 0.5);
    web(3 * TILE, 9 * TILE, 0.45);
    web(3 * TILE, 13 * TILE, 0.5);

    // Long east corridor (col 33) — scattered
    web(33 * TILE, 7 * TILE, 0.5);
    web(33 * TILE, 12 * TILE, 0.45);
    web(33 * TILE, 16 * TILE, 0.5);
  }

  // ── World objects ─────────────────────────────────────────────────────────

  private placeObjects(): void {
    this.breakerPanel = this.add.image(BREAKER_PX.x, BREAKER_PX.y, "obj-other")
      .setFrame(BREAKER_ON_FRAME)
      .setOrigin(0.5, 0.5)
      .setDisplaySize(TILE, TILE);

    this.add.image(STICKER_PX.x, STICKER_PX.y, "safety-sticker")
      .setOrigin(0.5, 0.5)
      .setDisplaySize(TILE, TILE);

    this.coilSprite = this.add.image(COIL_PX.x, COIL_PX.y, "dryer-boss-world")
      .setOrigin(0.5, 0.75);
  }

  /** Breaker and coil follow the story flags. */
  private syncObjects(): void {
    const flags = this.kit.state.flags;
    this.breakerPanel.setFrame(flags.circuitBreakerOff ? BREAKER_OFF_FRAME : BREAKER_ON_FRAME);
    if (flags.bossDefeated) {
      this.coilSprite.setTexture("dryer-fixed").setDisplaySize(32, 32);
    } else {
      this.coilSprite.setTexture("dryer-boss-world").setDisplaySize(30, 30);
    }
  }

  private placePlayer(): void {
    const char = new CharacterSprite(this, 0, 0, DAD_DEF);
    this.mover = new GridMover(this, char, TILE, 17, 1);
  }

  // ── Collision and exits ───────────────────────────────────────────────────

  private canWalkTo(col: number, row: number): boolean {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    if (COIL_BLOCKED.has(`${col},${row}`)) return false;
    if (this.kit.isBlocked(col, row)) return false;
    const t = MAP[row][col];
    return t === F || t === X;
  }

  private onLand(col: number, row: number): void {
    if (MAP[row][col] === X) {
      this.kit.goto("NeighborhoodScene", "basement");
      return;
    }
    this.kit.onStep();
  }
}
