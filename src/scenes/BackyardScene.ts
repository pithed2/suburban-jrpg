/**
 * BackyardScene: overworld for quest 3 (Reclaim the Lawn).
 * ─────────────────────────────────────────────────────────────────────────
 * Fenced lawn behind the house. Back door to the kitchen (top), Dad's shed
 * (rest point), Mrs. Okafor at the east fence (side quest), and the big hole
 * down to the Mole Tunnels.
 *
 * This file only draws the map and handles exits. Hotspots, encounters and
 * quest beats live in src/data/areas/backyard.json.
 */

import Phaser from "phaser";
import { loadAudioOnce } from "../game/audioAssets";
import { CharacterSprite } from "../game/CharacterSprite";
import { DAD_DEF, NPC9_DEF } from "../game/characterDefs";
import { FieldKit } from "../game/FieldKit";
import { GridMover } from "../game/GridMover";
import { LAWN } from "../game/lawnTiles";
import { COLS, F, H, MAP, MOLEHILLS, PATH_TILES, ROWS, S, SPAWNS, T, W, X } from "../game/maps/backyard";
import { addPixelText } from "../game/uiText";

const TILE = 16;
const OKAFOR: [number, number] = [33, 11];

type BackyardSpawn = keyof typeof SPAWNS;

export class BackyardScene extends Phaser.Scene {
  private mover!: GridMover;
  private kit!: FieldKit;
  private spawn: BackyardSpawn = "house";
  private molehills: Phaser.GameObjects.Image[] = [];

  constructor() { super("BackyardScene"); }

  init(data?: { spawn?: BackyardSpawn }): void {
    this.spawn = data?.spawn && data.spawn in SPAWNS ? data.spawn : "house";
  }

  preload(): void {
    loadAudioOnce(this, "home-bg", "/assets-active/audio/home-bg.mp3");
  }

  create(): void {
    this.kit = new FieldKit(this, {
      areaId: "backyard",
      mover: () => this.mover,
      statsPanel: true,
      onRefresh: () => this.syncMolehills(),
    });

    this.drawTiles();
    this.placeDecorations();
    this.placeCharacters();
    this.kit.create();

    this.cameras.main.setBounds(0, 0, COLS * TILE, ROWS * TILE);
    this.cameras.main.startFollow(this.mover.phaserSprite, true, 0.1, 0.1);

    const bgMusic = this.sound.add("home-bg", { loop: true, volume: 0.35 });
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
        if (t === F) this.tile(c, r, (c * 7 + r * 13) % 11 === 0 ? LAWN.flowers : LAWN.grass);
        else if (t === W) this.tile(c, r, LAWN.fence);
        else if (t === H) this.tile(c, r, LAWN.siding);
        else if (t === X) this.tile(c, r, LAWN.door);
        else if (t === S) this.tile(c, r, LAWN.shed);
        else if (t === T) this.tile(c, r, LAWN.bigHole);
      }
    }
    for (const [c, r] of PATH_TILES) this.tile(c, r, LAWN.path);
  }

  private placeDecorations(): void {
    this.tile(5, 5, LAWN.door);
    addPixelText(this, 4 * TILE + 2, 1 * TILE + 6, "SHED", 6).setTint(0xfacc15);
    this.tile(29, 3, LAWN.gnome);
    this.tile(15, 16, LAWN.sign);
    addPixelText(this, 15 * TILE + 4, 18 * TILE + 2, "MOLE TUNNELS", 6).setTint(0xfacc15);
    this.molehills = MOLEHILLS.map(([c, r]) => this.tile(c, r, LAWN.molehill));
  }

  private syncMolehills(): void {
    const flat = Boolean(this.kit.state.flags.moleKingDefeated);
    for (const hill of this.molehills) hill.setVisible(!flat);
  }

  private placeCharacters(): void {
    const neighbor = new CharacterSprite(this, OKAFOR[0] * TILE + TILE / 2, OKAFOR[1] * TILE + TILE / 2, NPC9_DEF);
    neighbor.face("left");
    const [col, row] = SPAWNS[this.spawn];
    this.mover = new GridMover(this, new CharacterSprite(this, 0, 0, DAD_DEF), TILE, col, row);
  }

  private canWalkTo(col: number, row: number): boolean {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    if (col === OKAFOR[0] && row === OKAFOR[1]) return false;
    if (this.kit.isBlocked(col, row)) return false;
    const t = MAP[row][col];
    return t === F || t === X || t === T;
  }

  private onLand(col: number, row: number): void {
    const t = MAP[row][col];
    if (t === X) {
      this.kit.goto("NeighborhoodScene", "backyard");
      return;
    }
    if (t === T) {
      this.kit.goto("TunnelScene");
      return;
    }
    this.kit.onStep();
  }
}
