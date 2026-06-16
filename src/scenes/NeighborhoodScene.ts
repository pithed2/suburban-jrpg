/**
 * NeighborhoodScene
 * ─────────────────────────────────────────────────────────────────────────────
 * Main house-interior hub — Dragon Warrior–style tile rendering.
 *
 * Tiles drawn from the full_set RPG-Maker sheets (same as TileRoomScene):
 *   walls  → full-set-int-a4  frame WALL_FRAME
 *   floors → full-set-int-a2  frame per room type
 *
 * Object positions (wife, dryer, exits) are taken directly from the values
 * in public/assets/maps/new-house.json Objects layer so they never drift.
 *
 * Quest logic is identical to every previous version of this scene.
 */

import Phaser from "phaser";
import { CharacterSprite } from "../game/CharacterSprite";
import { DAD_DEF, WIFE_DEF } from "../game/characterDefs";
import { dialogue } from "../game/content";
import { installDevShortcuts } from "../game/devShortcuts";
import { DialogueBox } from "../game/DialogueBox";
import { getDadBrainLine, getDadLine } from "../game/dadVoice";
import { DialogueRunner, type DialogueInput, type DialogueLine } from "../game/DialogueRunner";
import { GameMenu } from "../game/GameMenu";
import { GridMover } from "../game/GridMover";
import { getNextLevelXp } from "../game/dragonWarriorMath";
import { getQuest, getQuestStepLabel } from "../game/quests";
import { getGameState, resetGameState, saveGameState } from "../game/session";
import { addPixelText, setPixelText } from "../game/uiText";
import {
  completeQuestStep,
  setActiveQuestStep,
  type GameState,
} from "../game/state";

// ── Tile constants ─────────────────────────────────────────────────────────
const TILE = 16;

// Walls — full-set-int-a4 (32×32 per frame)
const WALL_FRAME = 140; // warm cream plaster — suburban interior wall

// Floors — house-core-16 = house_core_16x16.png (16×16 per frame, 64 cols × 96 rows)
// These are the same frame numbers used before the full_set refactor.
// They look like a real suburban house rather than a stone-floor RPG.
const FLOOR_LIVING  = 2052; // row 32 col  4 — warm wood plank    → living room
const FLOOR_KITCHEN = 2060; // row 32 col 12 — ceramic tile        → kitchen
const FLOOR_HALL    = 2576; // row 40 col 16 — neutral hall floor  → hallway
const FLOOR_MUD     = 2116; // row 33 col  4 — entry/mudroom tile  → mudroom / utility

// ── Tile-type IDs used in the MAP array ───────────────────────────────────
const W = 1;   // wall  (solid)
const L = 2;   // living room floor  (warm)
const K = 3;   // kitchen floor      (cool)
const H = 4;   // hallway floor      (neutral)
const M = 5;   // mudroom floor      (concrete)
const D = 6;   // garage door        (solid wall bump marker)
const S = 7;   // basement stairs    (walkable exit marker)
const U = 8;   // bathroom stairs up (walkable exit marker)
const P = 9;   // front door         (solid wall bump marker — Home Depot)

const WALKABLE = new Set([L, K, H, M, S, U]);

// ── Four rooms, Dragon Warrior style ──────────────────────────────────────
//
//   ┌──────────────────────┬──────────────────────────┐
//   │     LIVING ROOM      │        KITCHEN           │
//   │      (wife ♥)        │       (dryer ○)          │
//   └────────┬─────────────┴──────────────┬───────────┘
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
//
const _ = 0;
/* prettier-ignore */
const MAP: number[][] = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_], //  0
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_], //  1
  [_,_,W,W,W,W,W,W,W,W,W,P,P,W,W,_,_,_,_,_,_,_,W,W,W,W,W,W,W,W,W,W,W,W,_,_], //  2  top walls (front door 11-12)
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,W,_,_,_,_,_,_,_,W,K,K,K,K,K,K,K,K,K,K,K,W,_,_], //  3
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,W,_,_,_,_,_,_,_,W,K,K,K,K,K,K,K,K,K,K,K,W,_,_], //  4
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,W,_,_,_,_,_,_,_,W,K,K,K,K,K,K,K,K,K,K,K,W,_,_], //  5
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,W,_,_,_,_,_,_,_,W,K,K,K,K,K,K,K,K,K,K,K,W,_,_], //  6
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,W,_,_,_,_,_,_,_,W,K,K,K,K,K,K,K,K,K,K,K,W,_,_], //  7
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,W,_,_,_,_,_,_,_,W,K,K,K,K,K,K,K,K,K,K,K,W,_,_], //  8
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,W,_,_,_,_,_,_,_,W,K,K,K,K,K,K,K,K,K,K,K,W,_,_], //  9
  [_,_,W,W,W,W,W,L,L,W,W,W,W,W,W,_,_,_,_,_,_,_,W,W,W,W,W,K,K,W,W,W,W,W,W,_,_], // 10  south walls + door gaps
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
const DRYER_PX    = px(27, 6);   // kitchen right-of-centre
const GARAGE_PX   = px(7,  21);  // bottom wall opening (garage)
const TILEROOM_PX = px(28, 14);  // hallway right-centre (utility room door)
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

const INTERACT_PX     = 36; // proximity threshold in world pixels

// ── Floor frame lookup (house-core-16 texture) ────────────────────────────
const FLOOR_FRAME: Record<number, number> = {
  [L]: FLOOR_LIVING,
  [K]: FLOOR_KITCHEN,
  [H]: FLOOR_HALL,
  [M]: FLOOR_MUD,
};

// ── Scene ─────────────────────────────────────────────────────────────────
type SceneMode = "explore" | "dialogue" | "complete";
type NeighborhoodSpawn = "default" | "basement" | "garage" | "bathroom" | "homedepot";

export class NeighborhoodScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private questKey!: Phaser.Input.Keyboard.Key;
  private mover!: GridMover;
  private wifeChar!: CharacterSprite;
  // Tiles occupied by solid NPCs — player cannot walk into them
  private npcTiles = new Set<string>();
  private mode: SceneMode = "explore";
  private dialogueBox!: DialogueBox;
  private menu!: GameMenu;
  private questBox!: Phaser.GameObjects.Rectangle;
  private questText!: Phaser.GameObjects.BitmapText;
  private state!: GameState;
  private spawn: NeighborhoodSpawn = "default";
  private readonly dialogueRunner = new DialogueRunner();

  constructor() {
    super("NeighborhoodScene");
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  init(data?: { spawn?: NeighborhoodSpawn }): void {
    this.spawn = data?.spawn ?? "default";
  }

  create(): void {
    installDevShortcuts(this);

    this.state   = getGameState();
    this.mode    = "explore";
    this.cursors     = this.input.keyboard!.createCursorKeys();
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.questKey    = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

    this.drawTiles();
    this.placeDecorations();
    this.placeCharacters();
    this.createUi();
    this.menu = new GameMenu(this, () => this.state);
    this.updateQuestText();

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.mover.phaserSprite, true, 0.1, 0.1);

    const bgMusic = this.sound.add("comfort-bg", { loop: true, volume: 0.4 });
    bgMusic.play();
    this.events.once("shutdown", () => bgMusic.stop());
  }

  update(_time: number, delta: number): void {
    this.dialogueBox.update(delta);
    this.menu.update();
    this.updateQuestPrompt();

    if (this.menu.isOpen()) return;

    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.handleInteract();
    }

    if (this.mode !== "explore") return;

    this.mover.update(
      this.cursors,
      delta,
      (col, row) => this.canWalkTo(col, row),
      (col, row) => this.onLand(col, row),
      (col, row) => this.onBump(col, row),
    );
  }

  // ── Tile rendering ─────────────────────────────────────────────────────────

  private drawTiles(): void {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const tid = MAP[row][col];
        if (tid === 0) continue; // exterior — leave as game background colour

        const cx = col * TILE + TILE / 2;
        const cy = row * TILE + TILE / 2;

        if (tid === W) {
          this.add.image(cx, cy, "full-set-int-a4")
            .setFrame(WALL_FRAME)
            .setDisplaySize(TILE, TILE);
        } else if (tid === D) {
          this.addFloorTile(cx, cy, FLOOR_MUD);
        } else if (tid === S) {
          this.add.image(cx, cy, "full-set-int-a4")
            .setFrame(WALL_FRAME)
            .setDisplaySize(TILE, TILE);
        } else {
          const frame = FLOOR_FRAME[tid] ?? FLOOR_HALL;
          this.addFloorTile(cx, cy, frame);
        }
      }
    }

    this.addMapOverlays();
  }

  private addMapOverlays(): void {
    this.add.image(7 * TILE, 21 * TILE, "garage-door")
      .setDisplaySize(TILE * 2, TILE)
      .setOrigin(0, 0);

    this.add.image(13 * TILE, 12 * TILE, "stairs-down")
      .setDisplaySize(TILE * 2, TILE)
      .setOrigin(0, 0);

    this.add.image(20 * TILE, 12 * TILE, "stairs-up")
      .setDisplaySize(TILE * 2, TILE)
      .setOrigin(0, 0);

    this.add.image(11 * TILE, 2 * TILE, "garage-door")
      .setDisplaySize(TILE * 2, TILE)
      .setOrigin(0, 0)
      .setTint(0x93c5fd);
  }

  private addFloorTile(x: number, y: number, frame: number): void {
    this.add.image(x, y, "house-core-16")
      .setFrame(frame)
      .setDisplaySize(TILE, TILE);
  }

  // ── Decorations ────────────────────────────────────────────────────────────

  private placeDecorations(): void {
    // ── Utility room marker ────────────────────────────────────────────────
    this.add.rectangle(TILEROOM_PX.x, TILEROOM_PX.y, 2 * TILE, TILE, 0x60a5fa, 0.12)
      .setStrokeStyle(1, 0x60a5fa, 0.5);

    const spr16 = (col: number, row: number, frame: number) =>
      this.add.image(col * TILE + TILE / 2, row * TILE + TILE / 2, "interiors-free-16")
        .setFrame(frame).setDisplaySize(TILE, TILE);

    // kitchen_LRK.png: 26 cols × 25 rows, 16×16 px per frame
    const KW = 26;
    const kitchen = (col: number, row: number, tsRow: number, tsCol: number) =>
      this.add.image(col * TILE + TILE / 2, row * TILE + TILE / 2, "kitchen-props")
        .setFrame(tsRow * KW + tsCol).setDisplaySize(TILE, TILE);

    const web = (cx: number, cy: number, alpha = 0.75) =>
      this.add.image(cx, cy, "full-set-int-c")
        .setFrame(167).setDisplaySize(TILE * 2, TILE * 2).setAlpha(alpha);

    const block = (col: number, row: number) => this.npcTiles.add(`${col},${row}`);

    // ── Living room ────────────────────────────────────────────────────────
    // TV + stand against north wall (cols 4-5, rows 2-3; row 2 = wall, no block needed)
    spr16(4, 2, 224); spr16(5, 2, 225);  // screen on wall
    spr16(4, 3, 240); spr16(5, 3, 241);  // stand on floor — block
    block(4, 3); block(5, 3);

    // Window on north wall (row 2 = wall, no block)
    spr16(9, 2, 208); spr16(10, 2, 209);

    // Sofa against south wall (cols 8-11, rows 8-9)
    spr16(8, 8, 160); spr16(9, 8, 161); spr16(10, 8, 162); spr16(11, 8, 163);
    spr16(8, 9, 176); spr16(9, 9, 177); spr16(10, 9, 178); spr16(11, 9, 179);
    for (let c = 8; c <= 11; c++) { block(c, 8); block(c, 9); }

    // End table beside sofa
    spr16(12, 8, 187);
    block(12, 8);

    // ── Kitchen ────────────────────────────────────────────────────────────
    // Window on north wall (row 2 = wall, no block)
    spr16(25, 2, 208); spr16(26, 2, 209);

    // Counter top + sink + stove: gray kitchen set row 21 (frames 546-555), 10 tiles
    // Cabinet fronts:             gray kitchen set row 22 (frames 572-581), 10 tiles
    for (let i = 0; i < 10; i++) {
      kitchen(23 + i, 3, 21, i);  // counter surface (sink ~col2, stove ~cols6-9)
      kitchen(23 + i, 4, 22, i);  // cabinet fronts
      block(23 + i, 3);
      block(23 + i, 4);
    }

    // Fridge against east wall: 2 tiles wide × 4 tiles tall (cols 31-32, rows 5-8)
    // kitchen_LRK fridge: rows 1-4, cols 22-23 → frames 48-49, 74-75, 100-101, 126-127
    const fridgeRows = [1, 2, 3, 4];
    for (let r = 0; r < 4; r++) {
      kitchen(31, 5 + r, fridgeRows[r], 22);
      kitchen(32, 5 + r, fridgeRows[r], 23);
      block(31, 5 + r); block(32, 5 + r);
    }

    // ── Hallway — cobweb in NE corner near basement stairs ────────────────
    web(33 * TILE, 12 * TILE, 0.6);
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
    };
    const spawnCol = spawnTable[this.spawn].col;
    const spawnRow = spawnTable[this.spawn].row;
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
      this.scene.start("BasementScene");
    }
    if (MAP[row]?.[col] === U) {
      this.scene.start("BathroomScene");
    }
  }

  private onBump(col: number, row: number): void {
    if (MAP[row]?.[col] === D) {
      this.scene.start("GarageScene");
    }
    if (MAP[row]?.[col] === P) {
      this.startDialogue(
        [
          { speaker: "NARRATOR",   text: "Dad jumps in the old cruiser, keys jangling with purpose." },
          { speaker: "NARRATOR",   text: "The path to THEE Home Depot. A path Dad knows all too well." },
          { speaker: "DAD'S BRAIN", text: "It's a wonderland in there. A fluorescent, orange-aproned wonderland." },
        ],
        () => this.scene.start("HardwareStoreScene"),
      );
    }
  }

  // ── Interaction ────────────────────────────────────────────────────────────

  private handleInteract(): void {
    if (this.mode === "dialogue") {
      this.advanceDialogue();
      return;
    }

    if (this.mode === "complete") {
      if (this.dialogueBox.advance() !== "done") return;
      resetGameState();
      this.scene.restart();
      return;
    }

    const px = this.mover.x;
    const py = this.mover.y;
    const near = (pos: { x: number; y: number }) =>
      Math.hypot(px - pos.x, py - pos.y) < INTERACT_PX;

    if (near(WIFE_PX))     { this.interactWithWife();            return; }
    if (near(DRYER_PX))    { this.interactWithDryer();           return; }
    if (near(TILEROOM_PX)) { this.scene.start("TileRoomScene");  return; }

    this.startDialogue(["No crisis within reach. This is suspicious."]);
  }

  // ── Quest dialogues ────────────────────────────────────────────────────────

  private interactWithWife(): void {
    const wifeCheckIn = this.getWifeCheckInLines();

    if (this.state.quest.questId === "fix-bathroom") {
      this.interactWithWifeBathroomQuest(wifeCheckIn);
      return;
    }

    if (this.state.flags.dryerFixed) {
      this.startDialogue([
        { speaker: "WIFE", text: "The dryer is still working. I am choosing to believe this is permanent." },
        { speaker: "DAD", text: "That's wise. Also brave." },
        ...wifeCheckIn,
      ]);
      return;
    }

    if (this.state.flags.bossDefeated) {
      if (this.state.flags.circuitBreakerOff) {
        setActiveQuestStep(this.state, "restore-power");
        this.updateQuestText("POWER OUT");
        this.startDialogue([
          { speaker: "WIFE",       text: "Now, nothing works! What did you do??" },
          { speaker: "DAD'S BRAIN", text: "Dude. Dryers don't work without power." },
          { speaker: "DAD",        text: "Small administrative follow-up. Totally under control." },
          { speaker: "NARRATOR",   text: "The basement breaker waits for Dad's victory lap." },
          ...wifeCheckIn,
        ]);
        return;
      }

      completeQuestStep(this.state, "return-to-wife");
      this.state.flags.dryerFixed = true;
      this.updateQuestText("DRYER FIXED");
      saveGameState(this.state);
      this.startDialogue([
        { speaker: "DAD",      text: getDadLine("toWife", "greeting") },
        { speaker: "WIFE",     text: "You fixed it? The towels are actually dry?" },
        ...dialogue.victory.map((text) => ({ speaker: "NARRATOR", text })),
        { speaker: "DAD",      text: "What can I say? The Dad shows up, identifies the problem, defeats the problem, and restores domestic order." },
        { speaker: "WIFE",     text: "It only took you one garage expedition, one basement expedition, and a full appliance duel." },
        { speaker: "DAD",      text: "That's called commitment. Also, I got a pretty good arm workout in. Honestly? Feeling a little swole." },
        { speaker: "DAD",      text: "You should feel these arms right now. Big flex." },
        { speaker: "WIFE",     text: "Aw. Look at you." },
        { speaker: "WIFE",     text: "You wish. Your to-do list is way too long." },
        { speaker: "WIFE",     text: "Thank you. Sincerely. I will be impressed for at least the next ninety seconds." },
        { speaker: "KID",      text: "Hey Dad, the toilet is doing that thing again." },
        { speaker: "DAD",      text: "That's not vague at all." },
        { speaker: "WIFE",     text: "Now... about the upstairs toilet." },
        { speaker: "DAD",      text: "..." },
        { speaker: "WIFE",     text: "It's been making that sound again." },
        { speaker: "DAD'S BRAIN", text: "There is always another sound." },
        { speaker: "DAD",      text: "I handled a live heating coil today. The toilet doesn't scare me." },
        { speaker: "WIFE",     text: "It should." },
        { speaker: "NARRATOR", text: "The Dad's brief moment of peace ends. Upstairs, something gurgles." },
        { speaker: "DAD'S BRAIN", text: "One disaster at a time. That's the code." },
        ...wifeCheckIn,
        { speaker: "DAD",      text: getDadLine("selfTalk", "victory") },
      ], () => {
        this.state.quest = { questId: "fix-bathroom", activeStepId: "talk-to-wife-bathroom", completedStepIds: [] };
        completeQuestStep(this.state, "talk-to-wife-bathroom");
        setActiveQuestStep(this.state, "visit-home-depot");
        saveGameState(this.state);
        this.updateQuestText();
        this.mode = "explore";
        this.dialogueBox.hide();
      });
      return;
    }

    // talkedToWife is set by the opening cutscene — no replay needed.
    // In-game wife dialogue is the "check-in / nag" branch.
    this.startDialogue([
      { speaker: "DAD'S BRAIN", text: getDadBrainLine("talkToWife") },
      { speaker: "DAD",  text: getDadLine("toWife", "greeting") },
      { speaker: "WIFE", text: "How's the dryer coming?" },
      { speaker: "DAD",  text: getDadLine("toWife", "questReceived") },
      ...wifeCheckIn,
    ]);
  }

  private interactWithWifeBathroomQuest(wifeCheckIn: DialogueLine[]): void {
    if (this.state.flags.bathroomFixed) {
      this.startDialogue([
        { speaker: "WIFE", text: "The bathroom is still working. I'm choosing to believe this is also permanent." },
        ...wifeCheckIn,
      ]);
      return;
    }

    if (this.state.flags.clogBossDefeated) {
      completeQuestStep(this.state, "mop-up");
      completeQuestStep(this.state, "return-to-wife-bathroom");
      this.state.flags.bathroomFixed = true;
      this.updateQuestText("BATHROOM FIXED");
      saveGameState(this.state);
      this.startDialogue([
        { speaker: "DAD",      text: "The toilet has been... handled." },
        { speaker: "WIFE",     text: "Handled how?" },
        { speaker: "DAD",      text: "With confidence. And the Plunger of the Gods." },
        { speaker: "WIFE",     text: "We're going to need that receipt for our records." },
        { speaker: "NARRATOR", text: "Somewhere upstairs, a toilet flushes with newfound dignity." },
        ...wifeCheckIn,
        { speaker: "DAD",      text: getDadLine("selfTalk", "victory") },
      ]);
      return;
    }

    if (!this.state.flags.toiletInspected) {
      this.startDialogue([
        { speaker: "WIFE", text: "Have you looked at the toilet yet?" },
        { speaker: "DAD",  text: "On my way. Building up courage." },
        ...wifeCheckIn,
      ]);
      return;
    }

    if (!this.state.flags.ownsPlunger) {
      this.startDialogue([
        { speaker: "WIFE", text: "Did you get a plunger yet?" },
        { speaker: "DAD",  text: "Working on it. Might need a Home Depot run." },
        ...wifeCheckIn,
      ]);
      return;
    }

    this.startDialogue([
      { speaker: "WIFE", text: "How's the bathroom situation?" },
      { speaker: "DAD",  text: "Armed and ready. The clog has no idea what's coming." },
      ...wifeCheckIn,
    ]);
  }

  private getWifeCheckInLines(): DialogueLine[] {
    const player = this.state.player;
    const nextLevelXp = getNextLevelXp(player.level);
    const xpLine = nextLevelXp === undefined
      ? "You're already at peak Dad, statistically speaking. I am as surprised as you are."
      : `You need ${Math.max(0, nextLevelXp - player.xp)} XP before your next level.`;

    const wasHurt = player.hp < player.maxHp;
    player.hp = player.maxHp;
    saveGameState(this.state);

    return [
      { speaker: "WIFE", text: xpLine },
      {
        speaker: "WIFE",
        text: wasHurt
          ? "Come here. Kiss. There. Try not to lose a fight to lint."
          : "You still get a kiss. Preventative maintenance.",
      },
      { speaker: "SYSTEM", text: `HP RESTORED TO ${player.maxHp}.` },
    ];
  }

  private interactWithDryer(): void {
    if (!this.state.flags.inspectedDryer) {
      this.state.flags.inspectedDryer = true;
      completeQuestStep(this.state, "inspect-dryer");
      setActiveQuestStep(this.state, "defeat-heating-coil");
      this.updateQuestText();
    }

    if (this.state.flags.bossDefeated) {
      if (this.state.flags.circuitBreakerOff) {
        setActiveQuestStep(this.state, "restore-power");
        this.updateQuestText("POWER OUT");
        this.startDialogue([
          { speaker: "NARRATOR",   text: "The dryer is repaired, but completely lifeless." },
          { speaker: "DAD'S BRAIN", text: "Dude. Dryers don't work without power." },
          { speaker: "DAD",        text: "Right. Basement. Breaker. Victory, but with paperwork." },
        ]);
        return;
      }
      this.startDialogue([
        { speaker: "NARRATOR", text: "The dryer radiates the calm authority of a repaired appliance." },
        { speaker: "DAD",      text: getDadLine("selfTalk", "victory") },
      ]);
      return;
    }

    this.startDialogue([
      { speaker: "DAD'S BRAIN", text: getDadBrainLine("inspectDryer") },
      ...dialogue.dryer.map((text) => ({ speaker: "NARRATOR", text })),
      { speaker: "DAD",      text: getDadLine("selfTalk", "frustrated") },
      { speaker: "NARRATOR", text: "The basement stairs are in the centre hallway." },
    ]);
  }

  // ── Dialogue helpers ───────────────────────────────────────────────────────

  private startDialogue(lines: DialogueInput[], onComplete?: () => void): void {
    this.mode = "dialogue";
    this.showMessage(this.dialogueRunner.start(lines, onComplete));
  }

  private advanceDialogue(): void {
    if (this.dialogueBox.advance() !== "done") return;
    const next = this.dialogueRunner.advance();
    if (next) { this.showMessage(next); return; }
    if (this.mode === "dialogue") {
      this.mode = "explore";
      this.dialogueRunner.clear();
      this.dialogueBox.hide();
    }
  }

  // ── UI ─────────────────────────────────────────────────────────────────────

  private createUi(): void {
    this.questBox = this.add.rectangle(8, 8, 260, 16, 0xfacc15)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setVisible(false);
    this.questText = addPixelText(this, 12, 11, "", 8)
      .setTint(0x111827)
      .setScrollFactor(0)
      .setVisible(false);
    this.dialogueBox = new DialogueBox(this);
  }

  private updateQuestPrompt(): void {
    const visible = this.questKey.isDown;
    this.questBox.setVisible(visible);
    this.questText.setVisible(visible);
  }

  private updateQuestText(prefix?: string): void {
    const quest     = getQuest(this.state.quest.questId);
    const stepLabel = getQuestStepLabel(this.state.quest.questId, this.state.quest.activeStepId);
    const label     = prefix
      ? `${prefix} - ${stepLabel}`
      : `${quest.countdownLabel} - ${stepLabel}`;
    setPixelText(this.questText, label);
  }

  private showMessage(message: DialogueLine | string): void {
    const line = typeof message === "string" ? { speaker: "DAD", text: message } : message;
    this.dialogueBox.show(line.text, this.getSpeakerLabel(line.speaker));
  }

  private getSpeakerLabel(speaker: string): string {
    return speaker === "DAD" ? this.state.player.name || "DAD" : speaker;
  }
}
