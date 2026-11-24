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
 *  X = 3  exit tile, returns to NeighborhoodScene upstairs
 */

import Phaser from "phaser";
import { loadAudioOnce } from "../game/audioAssets";
import { CharacterSprite } from "../game/CharacterSprite";
import { DAD_DEF } from "../game/characterDefs";
import { FieldKit } from "../game/FieldKit";
import { GridMover } from "../game/GridMover";
import { F, MAP, W, X } from "../game/maps/bathroom";
import { addPixelText } from "../game/uiText";

const TILE = 16;
const WALL_FRAME = 140; // warm cream plaster — matches the house interior

const ROWS    = MAP.length;
const COLS    = MAP[0].length;
const WORLD_W = COLS * TILE;
const WORLD_H = ROWS * TILE;

const px = (c: number, r: number) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 });

// ── Side quest spots ─────────────────────────────────────────────────────
const LINEN_PX = px(3, 5);

const DUCK_PX = px(18, 6);

const SINK_PX = px(11, 5);

// ── Boss ─────────────────────────────────────────────────────────────────
const TOILET_PX = px(11, 13);

export class BathroomScene extends Phaser.Scene {
  private mover!: GridMover;
  private kit!: FieldKit;
  private toiletSprite!: Phaser.GameObjects.Image;

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

  private drawTiles(): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = MAP[r][c];
        if (t === 0) continue;
        const cx = c * TILE + TILE / 2;
        const cy = r * TILE + TILE / 2;
        if (t === W || t === X) {
          this.add.image(cx, cy, "full-set-int-a4")
            .setFrame(WALL_FRAME)
            .setDisplaySize(TILE, TILE);
        } else {
          this.add.image(cx, cy, "full-set-int-a2")
            .setFrame(7)
            .setDisplaySize(TILE, TILE);
        }
      }
    }
  }

  private placeDecorations(): void {
    const propB = (col: number, row: number, frame: number, size = TILE) =>
      this.add.image(col * TILE + TILE / 2, row * TILE + TILE / 2, "full-set-int-b")
        .setFrame(frame).setDisplaySize(size, size);

    // Linen closet — shelving
    propB(2, 4, 40); propB(2, 6, 40);
    addPixelText(this, LINEN_PX.x - 22, LINEN_PX.y - TILE, "LINEN CLOSET", 6).setTint(0xfacc15);

    // Vanity / sink
    propB(11, 5, 162);
    addPixelText(this, SINK_PX.x - 12, SINK_PX.y - TILE, "SINK", 6).setTint(0xfacc15);

    // Shower stall with curtain
    propB(17, 4, 178, TILE * 2);
    addPixelText(this, DUCK_PX.x - 26, DUCK_PX.y - TILE, "SHOWER CURTAIN", 6).setTint(0xfacc15);
  }

  private placeToilet(): void {
    this.toiletSprite = this.add.image(TOILET_PX.x, TOILET_PX.y, "clogged-toilet-battle")
      .setOrigin(0.5, 0.7)
      .setDisplaySize(28, 28);
    addPixelText(this, TOILET_PX.x - 14, TOILET_PX.y - TILE * 1.6, "TOILET", 6).setTint(0xfacc15);
  }

  private syncToilet(): void {
    this.toiletSprite.setTexture(this.kit.state.flags.clogBossDefeated ? "dryer-fixed" : "clogged-toilet-battle")
      .setDisplaySize(28, 28);
  }

  private placePlayer(): void {
    const char = new CharacterSprite(this, 0, 0, DAD_DEF);
    this.mover = new GridMover(this, char, TILE, 11, 2);
  }

  // ── Collision and exits ──────────────────────────────────────────────────

  private canWalkTo(col: number, row: number): boolean {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    if (this.kit.isBlocked(col, row)) return false;
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
