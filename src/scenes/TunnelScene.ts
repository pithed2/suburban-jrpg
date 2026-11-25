/**
 * TunnelScene: dungeon for quest 3 (Reclaim the Lawn).
 * ─────────────────────────────────────────────────────────────────────────
 * Three depths under the lawn. Depth 1: root cellar and storeroom. Depth 2:
 * sprinkler junction, flooded line and the irrigation vault (Biscuit the cat).
 * Depth 3 (deep zone): grub gallery and the Mole King's throne room.
 *
 * This file only draws the map and handles exits. Hotspots, encounters and
 * quest beats live in src/data/areas/tunnels.json.
 */

import Phaser from "phaser";
import { loadAudioOnce } from "../game/audioAssets";
import { CharacterSprite } from "../game/CharacterSprite";
import { DAD_DEF } from "../game/characterDefs";
import { FieldKit } from "../game/FieldKit";
import { GridMover } from "../game/GridMover";
import { LAWN } from "../game/lawnTiles";
import { A, F, MAP, ORNAMENTS, SPAWN, W, X } from "../game/maps/tunnels";
import { addPixelText } from "../game/uiText";

const TILE = 16;
const ROWS = MAP.length;
const COLS = MAP[0].length;

const BURROWS: Array<{ flag: string; col: number; row: number }> = [
  { flag: "burrowPlugged1", col: 30, row: 3 },
  { flag: "burrowPlugged2", col: 39, row: 14 },
  { flag: "burrowPlugged3", col: 45, row: 32 },
];
const BISCUIT: [number, number] = [11, 25];
const KING: [number, number] = [13, 31];

export class TunnelScene extends Phaser.Scene {
  private mover!: GridMover;
  private kit!: FieldKit;
  private burrowSprites: Phaser.GameObjects.Image[] = [];
  private catSprite!: Phaser.GameObjects.Image;
  private kingSprite!: Phaser.GameObjects.Image;

  constructor() { super("TunnelScene"); }

  preload(): void {
    loadAudioOnce(this, "dramatic-bg", "/assets-active/audio/dramatic-bg.mp3");
    loadAudioOnce(this, "mini-boss", "/assets-active/audio/mini-boss.mp3");
  }

  create(): void {
    this.kit = new FieldKit(this, {
      areaId: "tunnels",
      mover: () => this.mover,
      statsPanel: true,
      onRefresh: () => this.syncSprites(),
    });

    this.drawTiles();
    this.placeProps();
    this.mover = new GridMover(this, new CharacterSprite(this, 0, 0, DAD_DEF), TILE, SPAWN[0], SPAWN[1]);
    this.kit.create();

    this.cameras.main.setBounds(0, 0, COLS * TILE, ROWS * TILE);
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

  private tile(col: number, row: number, frame: number): Phaser.GameObjects.Image {
    return this.add.image(col * TILE + TILE / 2, row * TILE + TILE / 2, "lawn-tiles", frame);
  }

  private drawTiles(): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = MAP[r][c];
        if (t === W) {
          // Only draw walls that touch floor; the rest stays dark.
          const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => MAP[r + dr]?.[c + dc] !== undefined && MAP[r + dr][c + dc] !== W);
          if (edge) this.tile(c, r, (c * 5 + r * 3) % 7 === 0 ? LAWN.roots : LAWN.tunnelWall);
        } else if (t === X) {
          this.tile(c, r, LAWN.ladder);
        } else if (t === A) {
          this.tile(c, r, LAWN.water);
        } else if (t === F) {
          this.tile(c, r, LAWN.tunnelFloor);
        }
      }
    }
    // Depth markers.
    addPixelText(this, 12 * TILE, 14 * TILE - 10, "DEPTH 2", 6).setTint(0xfacc15);
    addPixelText(this, 32 * TILE, 31 * TILE - 10, "DEPTH 3", 6).setTint(0xfacc15);
  }

  private placeProps(): void {
    this.burrowSprites = BURROWS.map(({ col, row }) => this.tile(col, row, LAWN.burrow));
    for (const [c, r] of ORNAMENTS) this.tile(c, r, LAWN.gnome);
    this.catSprite = this.tile(BISCUIT[0], BISCUIT[1], LAWN.cat);
    this.kingSprite = this.add.image(KING[0] * TILE + TILE / 2, KING[1] * TILE + TILE / 2, "mole-king")
      .setDisplaySize(24, 24);
    addPixelText(this, (KING[0] - 2) * TILE, (KING[1] - 2) * TILE + 6, "THRONE ROOM", 6).setTint(0xfacc15);
  }

  private syncSprites(): void {
    const flags = this.kit.state.flags;
    BURROWS.forEach(({ flag }, i) => this.burrowSprites[i]?.setFrame(flags[flag] ? LAWN.plugged : LAWN.burrow));
    this.catSprite?.setVisible(!flags.foundBiscuit);
    this.kingSprite?.setVisible(!flags.moleKingDefeated);
  }

  private canWalkTo(col: number, row: number): boolean {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    if (this.kit.isBlocked(col, row)) return false;
    const t = MAP[row][col];
    return t === F || t === X;
  }

  private onLand(col: number, row: number): void {
    if (MAP[row][col] === X) {
      this.kit.goto("BackyardScene", "tunnels");
      return;
    }
    this.kit.onStep();
  }
}
