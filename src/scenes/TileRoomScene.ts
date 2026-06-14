import Phaser from "phaser";
import { CharacterSprite } from "../game/CharacterSprite";
import { DAD_DEF } from "../game/characterDefs";
import { installDevShortcuts } from "../game/devShortcuts";
import { GridMover } from "../game/GridMover";
import { DialogueBox } from "../game/DialogueBox";
import { DialogueRunner, type DialogueInput, type DialogueLine } from "../game/DialogueRunner";
import { GameMenu } from "../game/GameMenu";
import { PlayerStatsPanel } from "../game/PlayerStatsPanel";
import { getGameState } from "../game/session";
import { addPixelText, setPixelText } from "../game/uiText";
import { type GameState } from "../game/state";

// ── Tile constants ────────────────────────────────────────────────────────────
const TILE = 16; // world pixels per tile  (16px × zoom3 = 48px on screen — DW NES scale)

const FLOOR = 0;
const WALL  = 1;
const STAIR = 2; // walkable, triggers exit

// Int-A4 (512×512, 32px tiles = 16 cols × 16 rows)
// Frame 17 = row 1, col 1 — solid dark-stone fill inside the iron/stone border set
const WALL_FRAME  = 17;
// Int-A2 (512×384, 32px tiles = 16 cols × 12 rows)
// Frame 7 = row 0, col 7 — gray stone floor
const FLOOR_FRAME = 7;

// ── Room layout: 24 cols × 16 rows ───────────────────────────────────────────
// Walls ring the perimeter. Stair tile at top-center lets player exit.
// 2 = stair (no wall collision, player can step on it to leave)
const W = WALL;
const _ = FLOOR;
const S = STAIR;

const MAP: number[][] = [
  [W,W,W,W,W,W,W,W,W,W,W,S,W,W,W,W,W,W,W,W,W,W,W,W], // top wall, stair @ col 11
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W], // bottom wall
];

const ROWS = MAP.length;    // 16
const COLS = MAP[0].length; // 24
const WORLD_W = COLS * TILE;
const WORLD_H = ROWS * TILE;

// ── Tile-position helper ──────────────────────────────────────────────────────
// tp(col, row, tileCols, tileRows)
//   col/row       = top-left tile of the prop's footprint (0-based)
//   tileCols/Rows = how many tiles wide/tall the prop occupies
// Returns the world-pixel centre and pixel dimensions, both expressed as
// multiples of TILE so everything scales automatically when TILE changes.
function tp(col: number, row: number, tileCols: number, tileRows: number) {
  return {
    worldX: col * TILE + (tileCols * TILE) / 2,
    worldY: row * TILE + (tileRows * TILE) / 2,
    blockW: tileCols * TILE,
    blockH: tileRows * TILE,
  };
}

// ── Interactive props ─────────────────────────────────────────────────────────
// worldX/worldY = center of the prop (in world pixels)
// blockW/blockH = pixel dimensions of its solid footprint
// activateRadius = how close the player must be to interact (pixels)
interface RoomProp {
  label: string;
  worldX: number;
  worldY: number;
  blockW: number;
  blockH: number;
  activateRadius: number;
  // Int-B frame for the top sprite overlay (32×32 grid, 16 cols)
  // null = render label-only placeholder
  frame: number | null;
  tint?: number;
  lines: string[];
}

// All prop positions are expressed in tile coordinates via tp() so they scale
// automatically when TILE changes. Stair exit is at tile (11, 0).
const PROPS: RoomProp[] = [
  {
    // Top-left: workbench along the north wall — cols 1-3, row 1
    label: "WORKBENCH",
    ...tp(1, 1, 3, 1),
    activateRadius: 3 * TILE,
    frame: 192,
    tint: 0x8B5E3C,
    lines: [
      "Three half-finished birdhouses. A router Dad bought in April 2020.",
      "He watched eleven tutorials and built one wall.",
      "\"The birdhouse teaches patience,\" he told no one.",
    ],
  },
  {
    // Top-right: metal shelving — cols 20-22, row 1
    label: "SHELVES",
    ...tp(20, 1, 3, 1),
    activateRadius: 3 * TILE,
    frame: 32,
    tint: 0x607080,
    lines: [
      "Holiday decorations. A box labeled TAXES 2017.",
      "Dad's college textbooks. He never sold them.",
      "\"I might need Organic Chemistry again,\" he said in 2011.",
    ],
  },
  {
    // Left side: old CRT television — cols 1-2, rows 8-9
    label: "OLD TV",
    ...tp(1, 8, 2, 2),
    activateRadius: 3 * TILE,
    frame: 224,
    tint: 0x2a2a2a,
    lines: [
      "A 27-inch Trinitron CRT. Circa 2001.",
      "Dad insists it has better blacks than any OLED.",
      "The remote is lost. It has been lost since Obama's first term.",
    ],
  },
  {
    // Right side: padlocked mini-fridge — cols 21-22, rows 8-9
    label: "MINI-FRIDGE",
    ...tp(21, 8, 2, 2),
    activateRadius: 3 * TILE,
    frame: 162,
    tint: 0xCCCCCC,
    lines: [
      "It's padlocked.",
      "The kids respect this boundary.",
      "It contains: one IPA, a Snickers, and the quiet dignity of boundaries.",
    ],
  },
  {
    // Center-bottom: mysterious cardboard box — cols 11-12, row 12
    label: "DAD'S BOX",
    ...tp(11, 12, 2, 1),
    activateRadius: 3 * TILE,
    frame: 128,
    tint: 0xD2A679,
    lines: [
      "A cardboard box labeled \"DAD'S STUFF\" in permanent marker.",
      "Inside: a bowling trophy, a mix CD labeled \"Jamz 2004\",",
      "and a copy of What to Expect When You're Expecting.",
      "He was not expecting this.",
    ],
  },
  {
    // Bottom-left: water heater — col 2, rows 13-14
    label: "WATER HEATER",
    ...tp(2, 13, 1, 2),
    activateRadius: 3 * TILE,
    frame: null,
    tint: 0x888888,
    lines: [
      "The water heater hums ominously.",
      "Dad read a forum post about sediment flushing.",
      "He has not flushed the sediment.",
      "\"I'll do it this weekend,\" said Dad, for the 11th consecutive weekend.",
    ],
  },
  {
    // Bottom-right: weight bench — cols 20-21, row 13
    label: "WEIGHT BENCH",
    ...tp(20, 13, 2, 1),
    activateRadius: 3 * TILE,
    frame: null,
    tint: 0x555555,
    lines: [
      "The weight bench has not been used for weights.",
      "It currently holds: one fleece vest, a foam roller, and a broken oscillating fan.",
      "\"I'm still going to start,\" he said. He hasn't started.",
    ],
  },
];

// ── Scene ─────────────────────────────────────────────────────────────────────
type RoomMode = "explore" | "dialogue";

export class TileRoomScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private questKey!: Phaser.Input.Keyboard.Key;
  private mover!: GridMover;
  private propBlockers: { rect: Phaser.Geom.Rectangle; prop: RoomProp }[] = [];
  private stairWorldX = 0;
  private stairWorldY = 0;
  private questBox!: Phaser.GameObjects.Rectangle;
  private questText!: Phaser.GameObjects.BitmapText;
  private dialogueBox!: DialogueBox;
  private statsPanel!: PlayerStatsPanel;
  private menu!: GameMenu;
  private mode: RoomMode = "explore";
  private state!: GameState;
  private readonly dialogueRunner = new DialogueRunner();

  constructor() {
    super("TileRoomScene");
  }

  create(): void {
    installDevShortcuts(this);

    this.state = getGameState();
    this.mode = "explore";
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.questKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

    this.drawTiles();
    this.placeProps();
    this.placePlayer();
    this.createUi();
    this.menu = new GameMenu(this, () => this.state);

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.mover.phaserSprite, true, 0.1, 0.1);

    const bgMusic = this.sound.add("comfort-bg", { loop: true, volume: 0.4 });
    bgMusic.play();
    this.events.once("shutdown", () => bgMusic.stop());

    this.startDialogue([
      { speaker: "NARRATOR", text: "The utility basement. It smells like old carpet, regret, and possibility." },
      { speaker: "DAD'S BRAIN", text: "Don't touch the fridge. You know the rules. You MADE the rules." },
    ]);
  }

  update(_time: number, delta: number): void {
    this.dialogueBox.update(delta);
    this.menu.update();
    this.updateQuestPrompt();

    if (this.menu.isOpen()) {
      this.statsPanel.hide();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.handleInteract();
    }

    if (this.mode !== "explore") {
      this.statsPanel.hide();
      return;
    }

    this.mover.update(
      this.cursors,
      delta,
      (col, row) => this.canWalkTo(col, row),
      (col, row) => this.onPlayerLand(col, row),
    );

    this.statsPanel.update(delta, !this.mover.isMoving, this.state);
  }

  // ── Tile rendering ──────────────────────────────────────────────────────────

  private drawTiles(): void {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const tileId = MAP[row][col];
        const cx = col * TILE + TILE / 2;
        const cy = row * TILE + TILE / 2;

        if (tileId === WALL) {
          this.add.image(cx, cy, "full-set-int-a4")
            .setFrame(WALL_FRAME)
            .setDisplaySize(TILE, TILE);
        } else {
          // Floor tile for both FLOOR and STAIR positions
          this.add.image(cx, cy, "full-set-int-a2")
            .setFrame(FLOOR_FRAME)
            .setDisplaySize(TILE, TILE);

          if (tileId === STAIR) {
            this.stairWorldX = cx;
            this.stairWorldY = cy;
            // Overlay stair indicator
            addPixelText(this, cx - 12, cy - 5, "^UP^", 6).setTint(0xfacc15);
          }
        }
      }
    }
  }

  // ── Prop placement ──────────────────────────────────────────────────────────

  private placeProps(): void {
    for (const prop of PROPS) {
      this.drawPropSprite(prop);
      this.propBlockers.push({
        rect: new Phaser.Geom.Rectangle(
          prop.worldX - prop.blockW / 2,
          prop.worldY - prop.blockH / 2,
          prop.blockW,
          prop.blockH,
        ),
        prop,
      });
    }
  }

  private drawPropSprite(prop: RoomProp): void {
    const tileW = Math.max(1, Math.round(prop.blockW / TILE));
    const tileH = Math.max(1, Math.round(prop.blockH / TILE));
    const px = prop.worldX;
    const py = prop.worldY;

    if (prop.frame !== null) {
      // Use the Int-B spritesheet tile, scaled to the prop footprint
      this.add.image(px, py, "full-set-int-b")
        .setFrame(prop.frame)
        .setDisplaySize(prop.blockW, prop.blockH)
        .setTint(prop.tint ?? 0xffffff);
    } else {
      // Fallback: a tinted rectangle
      this.add.rectangle(px, py, prop.blockW, prop.blockH, prop.tint ?? 0x444444)
        .setStrokeStyle(1, 0x888888);
    }

    // Label floated above
    addPixelText(this, px - prop.label.length * 3.5, py - prop.blockH / 2 - 10, prop.label, 6)
      .setTint(0xfacc15);

    // Subtle floor shadow beneath prop
    this.add.rectangle(px, py + prop.blockH / 2 + 2, prop.blockW - 4, 4, 0x000000, 0.3);
  }

  // ── Player ──────────────────────────────────────────────────────────────────

  private placePlayer(): void {
    // Spawn one tile below the staircase (col 11, row 2 — just inside the room)
    const SPAWN_COL = 11;
    const SPAWN_ROW = 2;
    const char = new CharacterSprite(this, 0, 0, DAD_DEF);
    this.mover = new GridMover(this, char, TILE, SPAWN_COL, SPAWN_ROW);
    addPixelText(this, SPAWN_COL * TILE + 7, SPAWN_ROW * TILE - 6, "DAD", 6);
  }

  // ── Collision (GridMover callback) ──────────────────────────────────────────

  /**
   * Returns true when a tile at (col, row) is safe to walk onto.
   * GridMover calls this before every step.
   */
  private canWalkTo(col: number, row: number): boolean {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    if (MAP[row][col] === WALL) return false;
    // Check prop blockers — use the full tile footprint as the test rect
    const wx = col * TILE + TILE / 2;
    const wy = row * TILE + TILE / 2;
    const test = new Phaser.Geom.Rectangle(wx - TILE / 2 + 2, wy - TILE / 2 + 2, TILE - 4, TILE - 4);
    return !this.propBlockers.some(({ rect }) =>
      Phaser.Geom.Intersects.RectangleToRectangle(test, rect),
    );
  }

  /**
   * Called by GridMover when each step tween finishes.
   * Used to auto-trigger stair exit when the player lands on that tile.
   */
  private onPlayerLand(col: number, row: number): void {
    if (MAP[row][col] === STAIR && this.mode === "explore") {
      this.startDialogue(
        [{ speaker: "NARRATOR", text: "Dad heads back upstairs. The basement waits, as basements do." }],
        () => this.scene.start("NeighborhoodScene"),
      );
    }
  }

  // ── Interaction ─────────────────────────────────────────────────────────────

  private handleInteract(): void {
    if (this.mode === "dialogue") {
      this.advanceDialogue();
      return;
    }

    const px = this.mover.x;
    const py = this.mover.y;
    const dist = (ax: number, ay: number) => Math.hypot(px - ax, py - ay);

    // Stair exit — also auto-triggered by onPlayerLand, but keep Space as a fallback
    if (MAP[this.mover.row][this.mover.col] === STAIR) {
      this.startDialogue(
        [{ speaker: "NARRATOR", text: "Dad heads back upstairs. The basement waits, as basements do." }],
        () => this.scene.start("NeighborhoodScene"),
      );
      return;
    }

    // Props — check adjacent tiles (player must be standing next to them)
    for (const { prop } of this.propBlockers) {
      if (dist(prop.worldX, prop.worldY) < prop.activateRadius) {
        this.startDialogue(
          prop.lines.map((text) => ({ speaker: "NARRATOR", text })),
        );
        return;
      }
    }

    // Generic
    this.startDialogue([
      { speaker: "NARRATOR", text: "The basement holds its silence." },
      { speaker: "DAD'S BRAIN", text: "Every man needs a room. This is definitely a room." },
    ]);
  }

  // ── Dialogue ─────────────────────────────────────────────────────────────────

  private startDialogue(lines: DialogueInput[], onComplete?: () => void): void {
    this.mode = "dialogue";
    this.showMessage(this.dialogueRunner.start(lines, onComplete));
  }

  private advanceDialogue(): void {
    if (this.dialogueBox.advance() !== "done") return;

    const next = this.dialogueRunner.advance();
    if (next) {
      this.showMessage(next);
      return;
    }

    this.mode = "explore";
    this.dialogueRunner.clear();
    this.dialogueBox.hide();
  }

  // ── UI ───────────────────────────────────────────────────────────────────────

  private createUi(): void {
    this.questBox = this.add.rectangle(8, 8, 236, 16, 0x1e40af)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setVisible(false);
    this.questText = addPixelText(this, 12, 11, "UTILITY ROOM", 8)
      .setTint(0xfacc15)
      .setScrollFactor(0)
      .setVisible(false);
    this.dialogueBox = new DialogueBox(this);
    this.statsPanel = new PlayerStatsPanel(this);
  }

  private updateQuestPrompt(): void {
    const visible = this.questKey.isDown;
    this.questBox.setVisible(visible);
    this.questText.setVisible(visible);
  }

  private showMessage(message: DialogueLine | string): void {
    const line = typeof message === "string" ? { speaker: "NARRATOR", text: message } : message;
    this.dialogueBox.show(line.text, this.getSpeakerLabel(line.speaker));
  }

  private getSpeakerLabel(speaker: string): string {
    return speaker === "DAD" ? this.state.player.name || "DAD" : speaker;
  }
}
