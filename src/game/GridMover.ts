/**
 * GridMover
 * ─────────────────────────────────────────────────────────────────────────────
 * Implements Dragon Warrior–style grid-locked tile movement.
 *
 * Movement model
 * ──────────────
 * • The character always sits exactly on a tile-centre (col*TILE+TILE/2, etc.).
 * • A "step" moves one full tile in a cardinal direction.
 * • Each step is a linear Phaser tween (default 160 ms — matches ~6 steps/sec,
 *   close to the NES Dragon Warrior feel).
 * • Input is ignored while a step tween is in progress (isMoving = true).
 * • Tap   → one step, then stop.
 * • Hold  → one step, then continuous walking after a short hold-delay (250 ms).
 * • Facing always updates even if the target tile is blocked (character turns
 *   toward a wall without walking into it).
 *
 * Usage
 * ─────
 *   const mover = new GridMover(scene, playerChar, tileSize, startCol, startRow);
 *
 *   // In scene update():
 *   mover.update(cursors, delta, (col, row) => this.canWalkTo(col, row));
 *
 *   // Optional step callback (e.g. trigger stair exit when stepped onto):
 *   mover.update(cursors, delta, canWalk, (col, row) => this.onLand(col, row));
 *
 *   // Camera follow:
 *   camera.startFollow(mover.phaserSprite, true, 0.1, 0.1);
 */

import Phaser from "phaser";
import { CharacterSprite, type Direction } from "./CharacterSprite";

const STEP_MS    = 150; // tween duration per tile  (~6.7 steps/sec — DW NES feel)
const HOLD_DELAY =   0; // ms held before continuous stepping begins
// HOLD_DELAY=0 means: tap → exactly one step (key released before tween ends);
// hold → seamless continuous steps with zero gap between tweens.

export class GridMover {
  /** The underlying Phaser sprite — pass to camera.startFollow() etc. */
  get phaserSprite(): Phaser.GameObjects.Sprite {
    return this.char.phaserSprite;
  }

  /** Current tile column */
  get col(): number { return this._col; }
  /** Current tile row */
  get row(): number { return this._row; }
  /** True while a step tween is running */
  get isMoving(): boolean { return this._moving; }

  /** World-pixel X of the character's current position */
  get x(): number { return this.char.x; }
  /** World-pixel Y of the character's current position */
  get y(): number { return this.char.y; }

  private _col: number;
  private _row: number;
  private _moving = false;
  private holdTimer = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly char: CharacterSprite,
    private readonly tileSize: number,
    startCol: number,
    startRow: number,
  ) {
    this._col = startCol;
    this._row = startRow;
    // Snap sprite to grid centre on creation
    const { x, y } = this.tileCenter(startCol, startRow);
    char.setPosition(x, y);
    char.face("down");
  }

  // ── Main update — call once per frame from scene.update() ─────────────────

  /**
   * @param cursors   Phaser cursor keys from scene.input.keyboard.createCursorKeys()
   * @param delta     Frame delta time in ms
   * @param canWalkTo Returns true if the given tile col/row is passable
   * @param onLand    Optional callback fired each time a step completes (receives new col/row)
   */
  update(
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    delta: number,
    canWalkTo: (col: number, row: number) => boolean,
    onLand?: (col: number, row: number) => void,
  ): void {
    if (this._moving) return; // mid-tween: ignore all input

    const justPressed = this.getJustPressed(cursors);
    const heldDir     = this.getHeld(cursors);

    let dir: Direction | null = null;

    if (justPressed) {
      // Fresh key-down: step immediately, reset hold timer
      this.holdTimer = 0;
      dir = justPressed;
    } else if (heldDir) {
      // Key held: accumulate time, step once the delay expires
      this.holdTimer += delta;
      if (this.holdTimer >= HOLD_DELAY) {
        dir = heldDir;
      }
    } else {
      // No input: reset timer and make sure the sprite shows its idle frame
      this.holdTimer = 0;
      this.char.stop();
    }

    if (dir) {
      this.tryStep(dir, canWalkTo, onLand);
    }
  }

  // ── Programmatic step (for cutscenes, NPC pushes, etc.) ──────────────────

  /**
   * Attempt a single step in `dir`.  If blocked, the character turns to face
   * that direction but does not move.  Returns true if the step was accepted.
   */
  step(
    dir: Direction,
    canWalkTo: (col: number, row: number) => boolean,
    onLand?: (col: number, row: number) => void,
  ): boolean {
    if (this._moving) return false;
    return this.tryStep(dir, canWalkTo, onLand);
  }

  /** Instantly teleport to a tile (no tween, no animation). */
  warpTo(col: number, row: number): void {
    this._col = col;
    this._row = row;
    const { x, y } = this.tileCenter(col, row);
    this.char.setPosition(x, y);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private tryStep(
    dir: Direction,
    canWalkTo: (col: number, row: number) => boolean,
    onLand?: (col: number, row: number) => void,
  ): boolean {
    const targetCol = this._col + colDelta(dir);
    const targetRow = this._row + rowDelta(dir);

    // Always turn to face the attempted direction
    this.char.face(dir);

    if (!canWalkTo(targetCol, targetRow)) {
      return false; // blocked — character has already turned to face the wall
    }

    // Commit the step
    this._col = targetCol;
    this._row = targetRow;
    this._moving = true;

    const { x: tx, y: ty } = this.tileCenter(targetCol, targetRow);

    this.char.walk(dir);

    this.scene.tweens.add({
      targets: this.char.phaserSprite,
      x: tx,
      y: ty,
      duration: STEP_MS,
      ease: "Linear",
      onComplete: () => {
        // Hard-snap to exact tile centre (eliminates any float accumulation)
        this.char.phaserSprite.setPosition(tx, ty);
        this._moving = false;
        this.char.stop();
        onLand?.(this._col, this._row);
      },
    });

    return true;
  }

  private tileCenter(col: number, row: number): { x: number; y: number } {
    return {
      x: col * this.tileSize + this.tileSize / 2,
      y: row * this.tileSize + this.tileSize / 2,
    };
  }

  // Returns the direction of whichever key was *just* pressed this frame
  private getJustPressed(c: Phaser.Types.Input.Keyboard.CursorKeys): Direction | null {
    if (Phaser.Input.Keyboard.JustDown(c.left))  return "left";
    if (Phaser.Input.Keyboard.JustDown(c.right)) return "right";
    if (Phaser.Input.Keyboard.JustDown(c.up))    return "up";
    if (Phaser.Input.Keyboard.JustDown(c.down))  return "down";
    return null;
  }

  // Returns the direction of the first currently-held key (priority: left > right > up > down)
  private getHeld(c: Phaser.Types.Input.Keyboard.CursorKeys): Direction | null {
    if (c.left.isDown)  return "left";
    if (c.right.isDown) return "right";
    if (c.up.isDown)    return "up";
    if (c.down.isDown)  return "down";
    return null;
  }
}

// ── Pure helpers (no `this` needed) ──────────────────────────────────────────

function colDelta(dir: Direction): number {
  return dir === "right" ? 1 : dir === "left" ? -1 : 0;
}

function rowDelta(dir: Direction): number {
  return dir === "down" ? 1 : dir === "up" ? -1 : 0;
}
