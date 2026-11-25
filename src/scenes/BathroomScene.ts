/**
 * BathroomScene: dungeon for quest 2 (Unclog the Bathroom).
 * ─────────────────────────────────────────────────────────────────────────
 * Compact maze. Linen closet (TP side quest), vanity/sink, shower stall
 * (rubber ducky side quest), and the toilet nook boss room at the south end.
 *
 * This file only draws the map and handles exits. Hotspots, encounter tables
 * and quest beats live in src/data/areas/bathroom.json.
 *
 * MAP legend
 * ──────────
 *  W = 1  solid wall
 *  F = 2  floor (walkable)
 *  X = 3  exit tile (stairs), returns to the house
 *
 * Art: original tiles from scripts/art/bathroom_art.py (bathroom-tiles sheet).
 * Fixtures (tub, vanity, shelves) are listed in src/game/maps/bathroom.ts.
 */

import Phaser from "phaser";
import { loadAudioOnce } from "../game/audioAssets";
import { CharacterSprite } from "../game/CharacterSprite";
import { DAD_DEF } from "../game/characterDefs";
import { FieldKit } from "../game/FieldKit";
import { GridMover } from "../game/GridMover";
import { BATH } from "../game/bathroomTiles";
import { F, FIXTURES, isGrimy, MAP, PIPE_ROW, W, X } from "../game/maps/bathroom";

const TILE = 16;

const ROWS    = MAP.length;
const COLS    = MAP[0].length;
const WORLD_W = COLS * TILE;
const WORLD_H = ROWS * TILE;

// Boss tile (the toilet hotspot in src/data/areas/bathroom.json)
const TOILET_PX = { col: 11, row: 13 };

export class BathroomScene extends Phaser.Scene {
  private mover!: GridMover;
  private kit!: FieldKit;
  private toiletSprite!: Phaser.GameObjects.Image;
  private readonly solid = new Set<string>();

  constructor() { super("BathroomScene"); }

  preload(): void {
    loadAudioOnce(this, "dramatic-bg", "/assets-active/audio/dramatic-bg.mp3");
    loadAudioOnce(this, "mini-boss", "/assets-active/audio/mini-boss.mp3");
  }

  create(): void {
    this.kit = new FieldKit(this, {
      areaId: "bathroom",
      mover: () => this.mover,
      statsPanel: true,
      onRefresh: () => this.syncToilet(),
    });

    this.drawTiles();
    this.placeDecorations();
    this.placeToilet();
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

  // ── Tile rendering ───────────────────────────────────────────────────────

  private tile(col: number, row: number, frame: number): Phaser.GameObjects.Image {
    return this.add.image(col * TILE + TILE / 2, row * TILE + TILE / 2, "bathroom-tiles", frame);
  }

  private isFloor(col: number, row: number): boolean {
    const t = MAP[row]?.[col];
    return t === F || t === X;
  }

  private drawTiles(): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = MAP[r][c];
        if (t === 0) continue;
        if (t === X) {
          this.tile(c, r, BATH.stairs);
        } else if (t === W) {
          const pipe = r === PIPE_ROW.row && c >= PIPE_ROW.from && c <= PIPE_ROW.to;
          const face = this.isFloor(c, r + 1);
          this.tile(c, r, face ? (pipe ? BATH.wallPipe : BATH.wallFace) : BATH.wallTop);
        } else {
          this.tile(c, r, isGrimy(c, r) ? BATH.grimyFloor : BATH.floor);
        }
      }
    }
  }

  private placeDecorations(): void {
    for (const f of FIXTURES) {
      this.tile(f.col, f.row, BATH[f.frame as keyof typeof BATH]);
      if (f.solid) this.solid.add(`${f.col},${f.row}`);
    }
  }

  private placeToilet(): void {
    this.toiletSprite = this.tile(TOILET_PX.col, TOILET_PX.row, BATH.toiletClogged);
  }

  private syncToilet(): void {
    this.toiletSprite.setFrame(this.kit.state.flags.clogBossDefeated ? BATH.toiletClean : BATH.toiletClogged);
  }

  private placePlayer(): void {
    const char = new CharacterSprite(this, 0, 0, DAD_DEF);
    this.mover = new GridMover(this, char, TILE, 11, 2);
  }

  // ── Collision and exits ──────────────────────────────────────────────────

  private canWalkTo(col: number, row: number): boolean {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    if (this.kit.isBlocked(col, row)) return false;
    if (this.solid.has(`${col},${row}`)) return false;
    const t = MAP[row][col];
    return t === F || t === X;
  }

  private onLand(col: number, row: number): void {
    if (MAP[row][col] === X) {
      this.kit.goto("NeighborhoodScene", "bathroom");
      return;
    }
    this.kit.onStep();
  }
}
