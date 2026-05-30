import Phaser from "phaser";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Direction = "down" | "left" | "right" | "up";

/**
 * Describes the physical layout of a character sprite sheet.
 *
 * Supported sheet shapes
 * ──────────────────────
 *  A) One character per file (most common for hand-drawn packs):
 *       charsPerRow = 1  (default)
 *       Sheet is frameW*framesPerDir wide × frameH*4 tall
 *
 *  B) Multiple characters packed side-by-side:
 *       charsPerRow = N
 *       Each character occupies a block of framesPerDir columns.
 *       CharacterDef.charSlot selects which block (0-based).
 *
 * Row→direction mapping (most packs follow this standard):
 *   row 0 = down  (facing camera)
 *   row 1 = left
 *   row 2 = right
 *   row 3 = up    (facing away)
 *
 * Walk frames per direction:
 *   framesPerDir = 2  →  simple stride-left / stride-right (NES style)
 *   framesPerDir = 3  →  RPG-Maker style: left / neutral / right
 *                         idle pose will auto-select the centre frame
 */
export interface SheetConfig {
  /** Phaser texture key (registered in BootScene via load.spritesheet) */
  key: string;
  frameW: number;
  frameH: number;
  framesPerDir: number;
  rows: Record<Direction, number>;
  fps: number;
  charsPerRow?: number; // default 1
}

export interface CharacterDef {
  /**
   * Unique identifier.
   * Animation keys are named "{id}-down", "{id}-left", etc.
   * Keep it short; it must be unique across all characters in the game.
   */
  id: string;
  sheet: SheetConfig;
  /** Which column block to use when charsPerRow > 1 (0-based). */
  charSlot?: number;
}

// ── CharacterSprite class ─────────────────────────────────────────────────────

const ALL_DIRS: Direction[] = ["down", "left", "right", "up"];

export class CharacterSprite {
  /**
   * The raw Phaser sprite.
   * Use this for camera.startFollow(), setDepth(), group membership, etc.
   */
  readonly phaserSprite: Phaser.GameObjects.Sprite;

  private readonly def: CharacterDef;
  private facing: Direction = "down";

  constructor(scene: Phaser.Scene, x: number, y: number, def: CharacterDef) {
    this.def = def;
    this.phaserSprite = scene.add.sprite(x, y, def.sheet.key);
    this.ensureAnims(scene);
    // Start idle, facing down
    this.face("down");
  }

  // ── Read-only props ─────────────────────────────────────────────────────────

  get x(): number { return this.phaserSprite.x; }
  get y(): number { return this.phaserSprite.y; }
  get facingDir(): Direction { return this.facing; }

  // ── Transform pass-throughs ─────────────────────────────────────────────────

  setPosition(x: number, y: number): this {
    this.phaserSprite.setPosition(x, y);
    return this;
  }

  setDepth(d: number):         this { this.phaserSprite.setDepth(d);          return this; }
  setScale(s: number):         this { this.phaserSprite.setScale(s);          return this; }
  setAlpha(a: number):         this { this.phaserSprite.setAlpha(a);          return this; }
  setVisible(v: boolean):      this { this.phaserSprite.setVisible(v);        return this; }
  setTint(t: number):          this { this.phaserSprite.setTint(t);           return this; }
  setScrollFactor(x: number, y = x): this {
    this.phaserSprite.setScrollFactor(x, y);
    return this;
  }

  // ── Animation API ───────────────────────────────────────────────────────────

  /**
   * Begin or continue the walk animation for the given direction.
   * Safe to call every frame — `play(key, true)` is idempotent.
   */
  walk(dir: Direction): void {
    this.facing = dir;
    this.phaserSprite.play(this.animKey(dir), true);
  }

  /**
   * Halt movement and freeze on the idle frame for the current facing direction.
   * For a 3-frame sheet the idle pose is the centre frame; for 2-frame it's frame 0.
   */
  stop(): void {
    this.phaserSprite.anims.stop();
    this.phaserSprite.setFrame(this.calcIdleFrame(this.facing));
  }

  /**
   * Snap to face a direction without starting any animation.
   * Useful for NPCs that should face a specific way at spawn.
   */
  face(dir: Direction): void {
    this.facing = dir;
    this.phaserSprite.anims.stop();
    this.phaserSprite.setFrame(this.calcIdleFrame(dir));
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Creates Phaser animations for all four directions if they don't already exist.
   * Because Phaser's AnimationManager is global, animations only need to be
   * registered once per game session, not once per scene.
   */
  private ensureAnims(scene: Phaser.Scene): void {
    const { id, sheet, charSlot = 0 } = this.def;
    const { key, framesPerDir, rows, fps, charsPerRow = 1 } = sheet;
    const colsPerRow = charsPerRow * framesPerDir;

    for (const dir of ALL_DIRS) {
      const aKey = this.animKey(dir);
      if (scene.anims.exists(aKey)) continue;

      const rowIdx   = rows[dir];
      const colStart = charSlot * framesPerDir;
      const frameNums: number[] = [];

      for (let f = 0; f < framesPerDir; f++) {
        frameNums.push(rowIdx * colsPerRow + colStart + f);
      }

      scene.anims.create({
        key: aKey,
        frames: scene.anims.generateFrameNumbers(key, { frames: frameNums }),
        frameRate: fps,
        repeat: -1,
      });
    }
  }

  private animKey(dir: Direction): string {
    return `${this.def.id}-${dir}`;
  }

  /**
   * First (or centre) frame index for the given direction.
   * For 3-frame sheets the neutral centre frame (index 1 within the direction)
   * makes the best static idle pose.
   */
  private calcIdleFrame(dir: Direction): number {
    const { sheet, charSlot = 0 } = this.def;
    const { framesPerDir, rows, charsPerRow = 1 } = sheet;
    const colsPerRow = charsPerRow * framesPerDir;
    const idleOffset = framesPerDir >= 3 ? 1 : 0; // centre frame for 3-frame walk cycle
    return rows[dir] * colsPerRow + charSlot * framesPerDir + idleOffset;
  }
}
