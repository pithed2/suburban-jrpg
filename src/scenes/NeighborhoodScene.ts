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
import { DialogueBox } from "../game/DialogueBox";
import { getDadBrainLine, getDadLine } from "../game/dadVoice";
import { DialogueRunner, type DialogueInput, type DialogueLine } from "../game/DialogueRunner";
import { GameMenu } from "../game/GameMenu";
import { GridMover } from "../game/GridMover";
import { getQuest, getQuestStepLabel } from "../game/quests";
import { getGameState, resetGameState } from "../game/session";
import { addPixelText, setPixelText } from "../game/uiText";
import {
  completeQuestStep,
  setActiveQuestStep,
  type GameState,
} from "../game/state";

// ── Tile constants ─────────────────────────────────────────────────────────
const TILE = 16;

// Walls — full-set-int-a4 (32×32 per frame)
const WALL_FRAME = 17; // dark stone fill

// Floors — house-core-16 = house_core_16x16.png (16×16 per frame, 64 cols × 96 rows)
// These are the same frame numbers used before the full_set refactor.
// They look like a real suburban house rather than a stone-floor RPG.
const FLOOR_LIVING  = 2052; // row 32 col  4 — warm wood plank    → living room
const FLOOR_KITCHEN = 2060; // row 32 col 12 — ceramic tile        → kitchen
const FLOOR_HALL    = 2576; // row 40 col 16 — neutral hall floor  → hallway
const FLOOR_MUD     = 2116; // row 33 col  4 — entry/mudroom tile  → mudroom / utility

// Props — house-core-16 specific frames
const DOOR_FRAME    = 1084; // row 16 col 60 — standard interior door
const STAIR_FRAME   = 3072; // row 48 col  0 — basement staircase tile

// ── Tile-type IDs used in the MAP array ───────────────────────────────────
const W = 1;   // wall  (solid)
const L = 2;   // living room floor  (warm)
const K = 3;   // kitchen floor      (cool)
const H = 4;   // hallway floor      (neutral)
const M = 5;   // mudroom floor      (concrete)
const D = 6;   // garage door        (walkable exit marker)
const S = 7;   // basement stairs    (walkable exit marker)

const WALKABLE = new Set([L, K, H, M, D, S]);

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
  [_,_,W,W,W,W,W,W,W,W,W,W,W,W,W,_,_,_,_,_,_,_,W,W,W,W,W,W,W,W,W,W,W,W,_,_], //  2  top walls
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,W,_,_,_,_,_,_,_,W,K,K,K,K,K,K,K,K,K,K,K,W,_,_], //  3
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,W,_,_,_,_,_,_,_,W,K,K,K,K,K,K,K,K,K,K,K,W,_,_], //  4
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,W,_,_,_,_,_,_,_,W,K,K,K,K,K,K,K,K,K,K,K,W,_,_], //  5
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,W,_,_,_,_,_,_,_,W,K,K,K,K,K,K,K,K,K,K,K,W,_,_], //  6
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,W,_,_,_,_,_,_,_,W,K,K,K,K,K,K,K,K,K,K,K,W,_,_], //  7
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,W,_,_,_,_,_,_,_,W,K,K,K,K,K,K,K,K,K,K,K,W,_,_], //  8
  [_,_,W,L,L,L,L,L,L,L,L,L,L,L,W,_,_,_,_,_,_,_,W,K,K,K,K,K,K,K,K,K,K,K,W,_,_], //  9
  [_,_,W,W,W,W,W,L,L,W,W,W,W,W,W,_,_,_,_,_,_,_,W,W,W,W,W,K,K,W,W,W,W,W,W,_,_], // 10  south walls + door gaps
  [_,_,_,_,_,_,_,L,L,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,K,K,_,_,_,_,_,_,_], // 11  passage tiles
  [_,_,W,W,W,W,W,H,H,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,H,H,W,W,W,W,W,_,_], // 12  hallway top wall
  [_,_,W,H,H,H,H,H,H,H,H,H,H,S,S,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,W,_,_], // 13
  [_,_,W,H,H,H,H,H,H,H,H,H,H,S,S,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,W,_,_], // 14
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
const DRYER_PX    = px(27, 6);   // kitchen right-of-centre
const GARAGE_PX   = px(7,  21);  // bottom wall opening (garage)
const STAIRS_PX   = px(14, 14);  // hallway left-centre (basement stairs)
const TILEROOM_PX = px(28, 14);  // hallway right-centre (utility room door)
const SPAWN_COL   = 8;
const SPAWN_ROW   = 20;

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

export class NeighborhoodScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private mover!: GridMover;
  private wifeChar!: CharacterSprite;
  // Tiles occupied by solid NPCs — player cannot walk into them
  private npcTiles = new Set<string>();
  private mode: SceneMode = "explore";
  private dialogueBox!: DialogueBox;
  private menu!: GameMenu;
  private questText!: Phaser.GameObjects.BitmapText;
  private state!: GameState;
  private readonly dialogueRunner = new DialogueRunner();

  constructor() {
    super("NeighborhoodScene");
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  create(): void {
    this.state   = getGameState();
    this.mode    = "explore";
    this.cursors     = this.input.keyboard!.createCursorKeys();
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.drawTiles();
    this.placeDecorations();
    this.placeCharacters();
    this.createUi();
    this.menu = new GameMenu(this, () => this.state);
    this.updateQuestText();

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.mover.phaserSprite, true, 0.1, 0.1);
  }

  update(_time: number, delta: number): void {
    this.dialogueBox.update(delta);
    this.menu.update();

    if (this.menu.isOpen()) return;

    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.handleInteract();
    }

    if (this.mode !== "explore") return;

    this.mover.update(
      this.cursors,
      delta,
      (col, row) => this.canWalkTo(col, row),
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
          this.add.image(cx, cy, "house-core-16")
            .setFrame(DOOR_FRAME)
            .setDisplaySize(TILE, TILE * 2);
        } else if (tid === S) {
          this.add.image(cx, cy, "house-core-16")
            .setFrame(STAIR_FRAME)
            .setDisplaySize(TILE, TILE);
        } else {
          const frame = FLOOR_FRAME[tid] ?? FLOOR_HALL;
          this.add.image(cx, cy, "house-core-16")
            .setFrame(frame)
            .setDisplaySize(TILE, TILE);
        }
      }
    }
  }

  // ── Decorations ────────────────────────────────────────────────────────────
  // Subtle non-label markers for interactables that do not have final sprites yet.

  private placeDecorations(): void {
    // ── Utility room ───────────────────────────────────────────────────────
    // Subtle tinted marker until a prop is added.
    this.add.rectangle(TILEROOM_PX.x, TILEROOM_PX.y, 2 * TILE, TILE, 0x60a5fa, 0.12)
      .setStrokeStyle(1, 0x60a5fa, 0.5);
  }

  // ── Characters ─────────────────────────────────────────────────────────────

  private placeCharacters(): void {
    const dadChar = new CharacterSprite(this, 0, 0, DAD_DEF);
    this.mover = new GridMover(this, dadChar, TILE, SPAWN_COL, SPAWN_ROW);

    this.wifeChar = new CharacterSprite(this, WIFE_PX.x, WIFE_PX.y, WIFE_DEF);
    this.wifeChar.face("down");

    // Block the tile(s) the wife stands on
    const wCol = Math.round(WIFE_PX.x / TILE);
    const wRow = Math.round(WIFE_PX.y / TILE);
    this.npcTiles.add(`${wCol},${wRow}`);
  }

  // ── Collision ──────────────────────────────────────────────────────────────

  private canWalkTo(col: number, row: number): boolean {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    if (this.npcTiles.has(`${col},${row}`)) return false;
    return WALKABLE.has(MAP[row][col]);
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
    if (near(GARAGE_PX))   { this.scene.start("GarageScene");    return; }
    if (near(STAIRS_PX))   { this.scene.start("BasementScene");  return; }
    if (near(TILEROOM_PX)) { this.scene.start("TileRoomScene");  return; }

    this.startDialogue(["No crisis within reach. This is suspicious."]);
  }

  // ── Quest dialogues ────────────────────────────────────────────────────────

  private interactWithWife(): void {
    if (this.state.flags.bossDefeated) {
      if (this.state.flags.circuitBreakerOff) {
        setActiveQuestStep(this.state, "restore-power");
        this.updateQuestText("POWER OUT");
        this.startDialogue([
          { speaker: "WIFE",       text: "Now, nothing works! What did you do??" },
          { speaker: "DAD'S BRAIN", text: "Dude. Dryers don't work without power." },
          { speaker: "DAD",        text: "Small administrative follow-up. Totally under control." },
          { speaker: "NARRATOR",   text: "The basement breaker waits for Dad's victory lap." },
        ]);
        return;
      }

      completeQuestStep(this.state, "return-to-wife");
      this.state.flags.dryerFixed = true;
      this.updateQuestText("DRYER FIXED");
      this.startDialogue([
        { speaker: "DAD",      text: getDadLine("toWife", "greeting") },
        ...dialogue.victory.map((text) => ({ speaker: "NARRATOR", text })),
        { speaker: "DAD",      text: getDadLine("selfTalk", "victory") },
      ], () => {
        this.mode = "complete";
        this.showMessage({ speaker: "SYSTEM", text: "Quest complete! Press Space to restart." });
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
    ]);
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
    this.add.rectangle(8, 8, 260, 16, 0xfacc15).setOrigin(0, 0).setScrollFactor(0);
    this.questText = addPixelText(this, 12, 11, "", 8).setTint(0x111827).setScrollFactor(0);
    this.dialogueBox = new DialogueBox(this);
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
