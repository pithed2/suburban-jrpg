/**
 * BasementScene — Dungeon
 * ─────────────────────────────────────────────────────────────────────────────
 * Dragon Warrior–style dungeon.  Winding corridors, random encounters
 * (dust bunnies + Freaky Icky Spiders), three interactive wall objects,
 * and a fixed boss encounter: the Evil Heating Coil.
 *
 * Tiles from garage-ts (garage_basement_16x16.png, 16×16, 64 cols × 96 rows):
 *   Frame 1416 = row 22 col  8 — cool blue-grey stone   → walls
 *   Frame 1640 = row 25 col 40 — dark blue-grey concrete → floor
 *   Frame  936 = row 14 col 40 — warm grey stairs        → exit tile
 *
 * Interactive objects
 * ───────────────────
 *   Circuit Breaker  — flip before fighting the boss or you risk a shock
 *   Safety Sticker   — the label Dad ignored
 *   Evil Heating Coil — fixed boss encounter; requires wrench + breaker off
 *
 * Quest flags consumed / produced
 * ────────────────────────────────
 *   foundWrench       (read-only — must be true to fight the coil)
 *   circuitBreakerOff (set here when breaker is flipped)
 *   bossDefeated      (set here on victory)
 */

import Phaser from "phaser";
import { BattleManager } from "../game/BattleManager";
import { CharacterSprite } from "../game/CharacterSprite";
import { DAD_DEF } from "../game/characterDefs";
import { dialogue, enemies } from "../game/content";
import { DialogueBox } from "../game/DialogueBox";
import { getDadBrainLine, getDadLine, getDadMovieQuote } from "../game/dadVoice";
import { DialogueRunner, type DialogueInput, type DialogueLine } from "../game/DialogueRunner";
import { RandomEncounterTracker } from "../game/EncounterManager";
import { GameMenu } from "../game/GameMenu";
import { GridMover } from "../game/GridMover";
import { PlayerStatsPanel } from "../game/PlayerStatsPanel";
import { getQuestStepLabel } from "../game/quests";
import { getGameState } from "../game/session";
import { addPixelText, setPixelText } from "../game/uiText";
import {
  completeQuestStep,
  setActiveQuestStep,
  type GameState,
} from "../game/state";

// ── Tile constants ─────────────────────────────────────────────────────────
const TILE = 16;

// garage-ts = garage_basement_16x16.png (64 cols × 96 rows, all at 16×16)
const BWALL_FRAME  = 1416; // row 22 col 8  — blue-grey basement stone
const BFLOOR_FRAME = 1640; // row 25 col 40 — dark concrete floor
const STAIR_FRAME  =  936; // row 14 col 40 — warm stairs going up

const W = 1; // wall
const F = 2; // floor (walkable)
const X = 3; // exit tile — triggers return to NeighborhoodScene

// ── Dungeon map: 28 cols × 20 rows = 448 × 320 world px ──────────────────
//
//  Entry / exit   cols 13–14, row 0
//
//  Dead ends:
//    NW  cols 3–4,   rows 1–2   old insulation, WD-40 from 2020
//    NE  cols 22–24, rows 1–2   water-damage stain shaped like South America
//    E   cols 4–11,  row  9     empty wire shelving — the "organization phase"
//    S   cols 3–4,   rows 15–18 pool noodles (Dad has no pool)
//
//  Main path:
//    Enter → south shaft → row 3 junction → west → south (col 3–4) →
//    BREAKER at col 3 row 6   (must flip before fighting boss)
//    → row 14 E-junction → north N-path (col 19–20) →
//    boss room cols 19–26 rows 4–8   COIL at col 23 row 6
//
/* prettier-ignore */
const MAP: number[][] = [
  [W,W,W,W,W,W,W,W,W,W,W,W,W,X,X,W,W,W,W,W,W,W,W,W,W,W,W,W], //  0  exit 13-14
  [W,W,W,F,F,W,W,W,W,W,W,W,W,F,F,W,W,W,W,W,W,W,F,F,F,W,W,W], //  1  NW|entry shaft|NE dead-end
  [W,W,W,F,F,W,W,W,W,W,W,W,W,F,F,W,W,W,W,W,W,W,F,F,F,W,W,W], //  2
  [W,W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W,W], //  3  wide junction
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,F,W], //  4  main + boss room top
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,F,W], //  5
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,F,W], //  6  BREAKER≈col3  COIL at 23
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,F,W], //  7  boss room
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,F,W,W,W,W,W,W,W], //  8  boss room bottom
  [W,W,W,F,F,F,F,F,F,F,F,F,W,W,W,W,W,W,W,F,F,W,W,W,W,W,W,W], //  9  E shelf stub | N-path
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,F,W,W,W,W,W,W,W], // 10
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,F,W,W,W,W,W,W,W], // 11
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,F,W,W,W,W,W,W,W], // 12
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,F,W,W,W,W,W,W,W], // 13
  [W,W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W,W,W,W,W,W], // 14  E-junction 3–20
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W], // 15  S dead-end
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W], // 16
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W], // 17
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W], // 18
  [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W], // 19  bottom wall
];

const ROWS    = MAP.length;    // 20
const COLS    = MAP[0].length; // 28
const WORLD_W = COLS * TILE;   // 448
const WORLD_H = ROWS * TILE;   // 320

// Tiles occupied by the coil (boss) — player can't walk through it
const COIL_BLOCKED: ReadonlySet<string> = new Set(["22,5","23,5","22,6","23,6"]);

// ── Position helpers ──────────────────────────────────────────────────────
const px = (col: number, row: number) =>
  ({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });

// ── Dead-end flavour ──────────────────────────────────────────────────────
interface DeadEnd { x: number; y: number; lines: string[] }
const DEAD_ENDS: DeadEnd[] = [
  {
    ...px(3, 1),
    lines: [
      "Old insulation, partially detached from the pipe.",
      "Dad has been meaning to reattach it since 2020.",
      "He means it still. He will keep meaning it.",
    ],
  },
  {
    ...px(22, 1),
    lines: [
      "A water stain on the north wall in the shape of South America.",
      "There was 'an incident' in 2018. Insurance 'handled it'.",
      "The stain remains. The stain is not handled.",
    ],
  },
  {
    ...px(7, 9),
    lines: [
      "A wire-rack shelving unit. Completely empty.",
      "Dad purchased it during an organizational phase in 2019.",
      "The organizational phase lasted eleven days. The shelf has been empty since.",
    ],
  },
  {
    ...px(3, 16),
    lines: [
      "Pool noodles. Seven of them. Dad does not own a pool.",
      "\"You never know,\" said Dad, in 2017, at a garage sale.",
      "He has since known. He does not need pool noodles.",
    ],
  },
];

const DEAD_END_RADIUS = 3 * TILE;

// ── Interactive object positions ──────────────────────────────────────────
const BREAKER_PX   = px(3, 6);   // on the left wall of the main south corridor
const STICKER_PX   = px(5, 6);   // nearby — the safety sticker Dad never read
const COIL_PX      = px(23, 6);  // Evil Heating Coil — fixed boss
const COIL_RADIUS  = 2 * TILE;
const BREAKER_RADIUS = 2 * TILE;
const STICKER_RADIUS = 2 * TILE;

// ── Battle types ──────────────────────────────────────────────────────────
type BasementMode  = "explore" | "dialogue" | "battle";
type BattleCommand = "Fight" | "Dad Skills" | "Items" | "Run";
type BattlePhase   = "command" | "playerResult" | "enemyResult";
const BATTLE_COMMANDS: BattleCommand[] = ["Fight", "Dad Skills", "Items", "Run"];

// ── Scene ─────────────────────────────────────────────────────────────────
export class BasementScene extends Phaser.Scene {
  // movement
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private mover!: GridMover;

  // world objects
  private breakerPanel!: Phaser.GameObjects.Image;   // the full breaker box sprite
  private breakerSwitch!: Phaser.GameObjects.Rectangle; // the colored on/off indicator
  private coilSprite!: Phaser.GameObjects.Image;

  // systems
  private mode: BasementMode = "explore";
  private activeEnemyId = "evil-heating-coil";
  private dialogueBox!: DialogueBox;
  private statsPanel!: PlayerStatsPanel;
  private menu!: GameMenu;
  private state!: GameState;
  private readonly dialogueRunner = new DialogueRunner();
  private readonly battle = new BattleManager();
  private readonly encounters = new RandomEncounterTracker("basement");

  // battle UI
  private battlePhase: BattlePhase = "command";
  private selectedCommand = 0;
  private battleStatusBox!: Phaser.GameObjects.Rectangle;
  private battleStatusText!: Phaser.GameObjects.BitmapText;
  private battleEnemyBox!: Phaser.GameObjects.Rectangle;
  private battleEnemySprite!: Phaser.GameObjects.Sprite;
  private battleEnemyText!: Phaser.GameObjects.BitmapText;
  private commandBox!: Phaser.GameObjects.Rectangle;
  private commandText!: Phaser.GameObjects.BitmapText;
  private questText!: Phaser.GameObjects.BitmapText;

  constructor() { super("BasementScene"); }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  create(): void {
    this.state = getGameState();
    this.mode  = "explore";
    this.cursors     = this.input.keyboard!.createCursorKeys();
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.drawTiles();
    this.placeObjects();
    this.placePlayer();
    this.createUi();
    this.menu = new GameMenu(this, () => this.state);
    this.updateQuestText("BASEMENT");

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.mover.phaserSprite, true, 0.1, 0.1);

    if (!this.state.flags.bossDefeated) {
      this.startDialogue([
        { speaker: "DAD'S BRAIN", text: getDadBrainLine("basement") },
        ...dialogue.basementIntro.map((text) => ({ speaker: "NARRATOR", text })),
      ]);
    }
  }

  update(_time: number, delta: number): void {
    this.dialogueBox.update(delta);

    if (this.mode !== "battle") {
      this.menu.update();
      if (this.menu.isOpen()) { this.statsPanel.hide(); return; }
    }

    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.handleInteract();
    }

    if (this.mode === "battle" && this.battlePhase === "command") {
      this.updateBattleNav();
      return;
    }

    if (this.mode !== "explore") { this.statsPanel.hide(); return; }

    this.mover.update(
      this.cursors,
      delta,
      (col, row) => this.canWalkTo(col, row),
      (col, row) => this.onLand(col, row),
    );

    this.statsPanel.update(delta, !this.mover.isMoving, this.state);
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
          this.add.image(cx, cy, "garage-ts").setFrame(BWALL_FRAME).setDisplaySize(TILE, TILE);
        } else if (t === X) {
          this.add.image(cx, cy, "garage-ts").setFrame(STAIR_FRAME).setDisplaySize(TILE, TILE);
        } else {
          this.add.image(cx, cy, "garage-ts").setFrame(BFLOOR_FRAME).setDisplaySize(TILE, TILE);
        }
      }
    }
    addPixelText(this, 13 * TILE, 2, "EXIT ↑", 5).setTint(0x60a5fa);
  }

  // ── World objects ─────────────────────────────────────────────────────────

  private placeObjects(): void {
    // ── Circuit breaker ────────────────────────────────────────────────────
    // obj-other frame 49 = row 5 col 2 (1-indexed) = neutral front view of the panel
    // frame 61 = row 6 col 2 = alternate state (switches thrown)
    const breakerFrame = this.state.flags.circuitBreakerOff ? 61 : 49;
    this.breakerPanel = this.add.image(BREAKER_PX.x, BREAKER_PX.y - 4, "obj-other")
      .setFrame(breakerFrame)
      .setOrigin(0.5, 0.5)
      .setDisplaySize(28, 28);
    this.breakerSwitch = this.add.rectangle(
      BREAKER_PX.x,
      BREAKER_PX.y + (this.state.flags.circuitBreakerOff ? 10 : 6),
      5, 12,
      this.state.flags.circuitBreakerOff ? 0x22c55e : 0xf97316,
    );
    addPixelText(this, BREAKER_PX.x - 20, BREAKER_PX.y + 17, "BREAKER", 6);

    // ── Safety sticker ─────────────────────────────────────────────────────
    this.add.image(STICKER_PX.x, STICKER_PX.y, "safety-sticker")
      .setOrigin(0.5, 0.5)
      .setDisplaySize(20, 20);

    // ── Coil / dryer boss ──────────────────────────────────────────────────
    if (!this.state.flags.bossDefeated) {
      this.coilSprite = this.add.image(COIL_PX.x, COIL_PX.y, "dryer-boss-world")
        .setOrigin(0.5, 0.75)
        .setDisplaySize(30, 30);
      addPixelText(this, COIL_PX.x - 14, COIL_PX.y + 14, "DRYER", 6);
    }
  }

  // ── Player ────────────────────────────────────────────────────────────────

  private placePlayer(): void {
    const char = new CharacterSprite(this, 0, 0, DAD_DEF);
    this.mover = new GridMover(this, char, TILE, 13, 1);
    addPixelText(this, 13 * TILE + 3, 1 * TILE - 6, "DAD", 6);
  }

  // ── Collision ─────────────────────────────────────────────────────────────

  private canWalkTo(col: number, row: number): boolean {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    if (!this.state.flags.bossDefeated && COIL_BLOCKED.has(`${col},${row}`)) return false;
    const t = MAP[row][col];
    return t === F || t === X;
  }

  private onLand(col: number, row: number): void {
    if (MAP[row][col] === X) {
      this.scene.start("NeighborhoodScene");
      return;
    }

    if (this.mode !== "explore") return;
    const pos = new Phaser.Math.Vector2(this.mover.x, this.mover.y);
    const enc = this.encounters.update(pos, this.state);
    if (enc) {
      const isSpider = enc.enemy.id === "icky-spider";
      this.startDialogue(
        [
          ...enc.introMessages.map((text) => ({ speaker: "NARRATOR", text })),
          { speaker: "DAD'S BRAIN", text: getDadBrainLine("battle") },
          { speaker: "DAD", text: getDadLine("toEnemy", isSpider ? "spider" : "battleStart") },
        ],
        () => this.startBattle(enc.enemy.id),
      );
    }
  }

  // ── Interaction ───────────────────────────────────────────────────────────

  private handleInteract(): void {
    if (this.mode === "dialogue") { this.advanceDialogue(); return; }
    if (this.mode === "battle")   { this.handleBattleTurn(); return; }

    const dadX = this.mover.x;
    const dadY = this.mover.y;
    const dist = (p: { x: number; y: number }) => Math.hypot(dadX - p.x, dadY - p.y);

    // Exit (Space at top)
    if (MAP[this.mover.row]?.[this.mover.col] === X) {
      this.scene.start("NeighborhoodScene");
      return;
    }

    // Coil / dryer boss
    if (dist(COIL_PX) < COIL_RADIUS + TILE) {
      this.interactWithCoil();
      return;
    }

    // Circuit breaker
    if (dist(BREAKER_PX) < BREAKER_RADIUS + TILE) {
      this.interactWithBreaker();
      return;
    }

    // Safety sticker
    if (dist(STICKER_PX) < STICKER_RADIUS + TILE) {
      this.startDialogue([
        { speaker: "NARRATOR", text: "A faded sticker: TURN OFF POWER BEFORE SERVICING ELECTRICAL APPLIANCE." },
        { speaker: "DAD'S BRAIN", text: "A lesser man would ignore that. Dad is occasionally not a lesser man." },
        { speaker: "DAD", text: "Fine. Breaker first. Heroics after." },
      ]);
      return;
    }

    // Dead ends
    for (const de of DEAD_ENDS) {
      if (dist(de) < DEAD_END_RADIUS) {
        this.startDialogue([
          ...de.lines.map((text) => ({ speaker: "NARRATOR", text })),
          { speaker: "DAD", text: getDadMovieQuote("deadEnd") },
        ]);
        return;
      }
    }

    this.startDialogue([
      { speaker: "NARRATOR", text: "The basement smells like cardboard, old paint, and obligation." },
    ]);
  }

  // ── Quest interactions ────────────────────────────────────────────────────

  private interactWithCoil(): void {
    if (this.state.flags.bossDefeated) {
      this.startDialogue([{ speaker: "NARRATOR", text: "The heating coil is quiet now. Almost smugly quiet." }]);
      return;
    }

    if (!this.state.flags.foundWrench) {
      setActiveQuestStep(this.state, "find-wrench");
      this.updateQuestText("BASEMENT");
      this.startDialogue([
        { speaker: "DAD'S BRAIN", text: getDadBrainLine("findWrench") },
        { speaker: "NARRATOR", text: "Dad sizes up the coil with his bare hands." },
        { speaker: "DAD", text: "Nope. This is a wrench problem." },
        { speaker: "DAD", text: getDadLine("selfTalk", "frustrated") },
        { speaker: "NARRATOR", text: "The garage waits." },
      ], () => this.scene.start("NeighborhoodScene"));
      return;
    }

    const breakerWarning = this.state.flags.circuitBreakerOff ? [] : [
      { speaker: "DAD'S BRAIN", text: "The breaker is still on. Certified Zap is very much on the menu." },
      { speaker: "NARRATOR", text: "The coil crackles with live current. Dad can still try, technically." },
    ];

    this.startDialogue([
      ...breakerWarning,
      ...dialogue.battleIntro.map((text) => ({ speaker: "NARRATOR", text })),
      { speaker: "DAD'S BRAIN", text: getDadBrainLine("battle") },
      { speaker: "DAD", text: getDadLine("toEnemy", "battleStart") },
    ], () => this.startBattle("evil-heating-coil"));
  }

  private interactWithBreaker(): void {
    if (this.state.flags.circuitBreakerOff) {
      if (this.state.flags.bossDefeated) {
        this.state.flags.circuitBreakerOff = false;
        completeQuestStep(this.state, "restore-power");
        setActiveQuestStep(this.state, "return-to-wife");
        this.breakerPanel.setFrame(49);
        this.breakerSwitch.setY(BREAKER_PX.y + 6).setFillStyle(0xf97316);
        this.updateQuestText("BASEMENT");
        this.startDialogue([
          { speaker: "NARRATOR", text: "Dad flips the breaker back on. The house wakes up with a chorus of appliance beeps." },
          { speaker: "DAD'S BRAIN", text: "Dryers don't work without power." },
          { speaker: "DAD", text: "I knew that. I was creating suspense." },
        ]);
        return;
      }
      this.startDialogue([
        { speaker: "NARRATOR", text: "The breaker is off. Good. Leave it off until the angry coil is not angry." },
        { speaker: "DAD", text: "Already handled." },
      ]);
      return;
    }

    this.state.flags.circuitBreakerOff = true;
    completeQuestStep(this.state, "flip-breaker");
    setActiveQuestStep(this.state, "defeat-heating-coil");
    this.breakerPanel.setFrame(61);
    this.breakerSwitch.setY(BREAKER_PX.y + 10).setFillStyle(0x22c55e);
    this.updateQuestText("BASEMENT");
    this.startDialogue([
      { speaker: "DAD'S BRAIN", text: "Kill the power before poking the angry appliance. Revolutionary." },
      { speaker: "NARRATOR", text: "Dad flips the circuit breaker. The dryer coil loses its worst idea." },
      { speaker: "DAD", text: "Okay. Now the wrench gets to be the bad cop." },
    ]);
  }

  // ── Dialogue ──────────────────────────────────────────────────────────────

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

  private showMessage(msg: DialogueLine | string, speaker = "DAD"): void {
    const line = typeof msg === "string" ? { speaker, text: msg } : msg;
    const label = line.speaker === "DAD" ? (this.state.player.name || "DAD") : line.speaker;
    this.dialogueBox.show(line.text, label);
  }

  // ── Battle ────────────────────────────────────────────────────────────────

  private startBattle(enemyId: string): void {
    const enemy = enemies.find((e) => e.id === enemyId);
    if (!enemy) return;
    this.activeEnemyId = enemyId;
    const snap = this.battle.start(enemy, this.state);
    this.mode = "battle";
    this.battlePhase = "command";
    this.selectedCommand = 0;
    this.updateQuestText("BATTLE");
    this.showBattleUi(snap);

    if (snap.ambushed && snap.message) {
      this.battlePhase = "enemyResult";
      this.showMessage(getDadMovieQuote("ambush"), "DAD");
      if (snap.defeated) { this.handleDefeat(snap.message); return; }
      return;
    }
    this.showMessage(this.formatSnap(snap), "BATTLE");
    this.showCommandMenu();
  }

  private handleBattleTurn(): void {
    if (this.dialogueBox.advance() !== "done") return;

    if (this.battlePhase === "enemyResult") {
      this.battlePhase = "command";
      const snap = this.battle.getSnapshot(this.state);
      this.updateBattlePanels(snap);
      this.showMessage(this.formatSnap(snap), "BATTLE");
      this.showCommandMenu();
      return;
    }

    if (this.battlePhase === "playerResult") {
      const res = this.battle.useEnemyTurn(this.state);
      this.battlePhase = "enemyResult";
      this.updateBattlePanels(res);
      if (res.defeated) { this.handleDefeat(res.message); return; }
      const mood = res.heroHp <= res.heroMaxHp * 0.3 ? "lowHp" : "takingDamage";
      this.showMessage(`${res.message}\n${getDadLine("toEnemy", mood)}`, "BATTLE");
      return;
    }

    const cmd = BATTLE_COMMANDS[this.selectedCommand];
    const res = this.resolveCommand(cmd);
    this.updateBattlePanels(res);

    if (res.victory)  { this.hideCommandMenu(); this.handleVictory(res.message);  return; }
    if (res.escaped)  {
      this.hideCommandMenu();
      this.encounters.resetPosition(new Phaser.Math.Vector2(this.mover.x, this.mover.y));
      this.startDialogue(
        [{ speaker: "BATTLE", text: res.message }, { speaker: "DAD'S BRAIN", text: getDadBrainLine("basement") }],
        () => { this.hideBattleUi(); this.mode = "explore"; this.dialogueBox.hide(); },
      );
      return;
    }
    this.battlePhase = "playerResult";
    this.hideCommandMenu();
    this.showMessage(res.message, "BATTLE");
  }

  private handleVictory(msg: string): void {
    if (this.activeEnemyId === "dust-bunny" || this.activeEnemyId === "icky-spider") {
      this.startDialogue([
        { speaker: "BATTLE",     text: msg },
        { speaker: "DAD'S BRAIN", text: getDadBrainLine("victory") },
        { speaker: "DAD",        text: getDadLine("selfTalk", "victory") },
      ], () => { this.hideBattleUi(); this.mode = "explore"; this.dialogueBox.hide(); });
      return;
    }

    // Heating coil boss victory
    this.state.flags.bossDefeated = true;
    completeQuestStep(this.state, "defeat-heating-coil");
    setActiveQuestStep(
      this.state,
      this.state.flags.circuitBreakerOff ? "restore-power" : "return-to-wife",
    );
    this.updateQuestText("VICTORY");
    if (this.coilSprite) this.coilSprite.setVisible(false);

    this.startDialogue([
      { speaker: "BATTLE",     text: msg },
      { speaker: "DAD'S BRAIN", text: getDadBrainLine("victory") },
      { speaker: "DAD",        text: getDadLine("selfTalk", "victory") },
      {
        speaker: "NARRATOR",
        text: this.state.flags.circuitBreakerOff
          ? "The vent stops rattling. The breaker, however, is still off."
          : "The vent stops rattling. Upstairs, a towel may yet become dry.",
      },
      ...(this.state.flags.circuitBreakerOff
        ? [{ speaker: "DAD'S BRAIN", text: "One last heroic act: turn the power back on." }]
        : []),
    ], () => {
      this.hideBattleUi();
      this.scene.start("NeighborhoodScene");
    });
  }

  private handleDefeat(msg: string): void {
    this.hideCommandMenu();
    this.startDialogue(
      [
        { speaker: "BATTLE",   text: msg },
        { speaker: "NARRATOR", text: "Everything goes white, then beige, then suspiciously recliner-shaped." },
        { speaker: "WIFE",     text: "Why are you in the chair? The dryer is still broken." },
        { speaker: "DAD'S BRAIN", text: this.getDefeatHint() },
      ],
      () => {
        this.hideBattleUi();
        this.state.player.hp       = this.state.player.maxHp;
        this.state.player.dadPoints = this.state.player.maxDadPoints;
        this.state.player.cash     = Math.max(0, this.state.player.cash - 2);
        this.scene.start("NeighborhoodScene");
      },
    );
  }

  private getDefeatHint(): string {
    if (!this.state.flags.foundWrench)       return "New plan: find the wrench, then worry about appliance combat.";
    if (!this.state.flags.circuitBreakerOff) return "New plan: keep the wrench, turn off the breaker, then try heroics again.";
    return "New plan: breaker stayed off. Heal up, keep the wrench, and go finish this.";
  }

  private resolveCommand(cmd: BattleCommand) {
    if (cmd === "Fight")      return this.battle.useFight(this.state);
    if (cmd === "Dad Skills") return this.battle.useDadSkill(this.state);
    if (cmd === "Items")      return this.battle.useItem(this.state, "ibuprofen");
    return this.battle.useRun(this.state);
  }

  private updateBattleNav(): void {
    const { up, down, left, right } = this.cursors;
    if (Phaser.Input.Keyboard.JustDown(up))    { this.selectedCommand = Phaser.Math.Wrap(this.selectedCommand - 2, 0, 4); this.showCommandMenu(); }
    if (Phaser.Input.Keyboard.JustDown(down))  { this.selectedCommand = Phaser.Math.Wrap(this.selectedCommand + 2, 0, 4); this.showCommandMenu(); }
    if (Phaser.Input.Keyboard.JustDown(left))  { this.selectedCommand = Phaser.Math.Wrap(this.selectedCommand - 1, 0, 4); this.showCommandMenu(); }
    if (Phaser.Input.Keyboard.JustDown(right)) { this.selectedCommand = Phaser.Math.Wrap(this.selectedCommand + 1, 0, 4); this.showCommandMenu(); }
  }

  private formatSnap(_s: unknown): string { return "Command?"; }

  // ── Battle UI ─────────────────────────────────────────────────────────────

  private createUi(): void {
    this.add.rectangle(8, 8, 236, 16, 0xfacc15).setOrigin(0, 0).setScrollFactor(0);
    this.questText = addPixelText(this, 12, 11, "", 8).setTint(0x111827).setScrollFactor(0);
    this.dialogueBox = new DialogueBox(this);
    this.statsPanel  = new PlayerStatsPanel(this);

    this.battleStatusBox = this.add.rectangle(48, 78, 76, 92, 0x111827, 0.94).setStrokeStyle(2, 0xf8fafc).setVisible(false).setScrollFactor(0);
    this.battleStatusText = addPixelText(this, 16, 38, "", 7).setVisible(false).setScrollFactor(0);

    this.battleEnemyBox = this.add.rectangle(154, 84, 108, 62, 0x65a30d).setStrokeStyle(2, 0xf8fafc).setVisible(false).setScrollFactor(0);
    this.battleEnemySprite = this.add.sprite(154, 92, "sixteen-pixel", 22).setScale(2).setVisible(false).setScrollFactor(0);
    this.battleEnemyText = addPixelText(this, 108, 56, "", 6).setMaxWidth(96).setVisible(false).setScrollFactor(0);

    this.commandBox  = this.add.rectangle(256, 58, 120, 58, 0x111827, 0.94).setStrokeStyle(2, 0xf8fafc).setVisible(false).setScrollFactor(0);
    this.commandText = addPixelText(this, 204, 38, "", 7).setVisible(false).setScrollFactor(0);
  }

  private showBattleUi(snap: { enemy: { id: string; name: string; battleTexture?: string }; enemyHp: number; enemyMaxHp: number; heroHp: number; heroMaxHp: number }): void {
    const isSpider = snap.enemy.id === "icky-spider";
    this.battleEnemyBox.setFillStyle(isSpider ? 0x1a0a2e : 0x65a30d).setVisible(true);
    this.battleStatusBox.setVisible(true);
    this.battleStatusText.setVisible(true);
    this.battleEnemySprite.setVisible(true);
    this.battleEnemyText.setVisible(true);
    this.updateBattlePanels(snap);
  }

  private hideBattleUi(): void {
    this.hideCommandMenu();
    this.battleStatusBox.setVisible(false);
    this.battleStatusText.setVisible(false);
    this.battleEnemyBox.setVisible(false);
    this.battleEnemySprite.setVisible(false);
    this.battleEnemyText.setVisible(false);
  }

  private updateBattlePanels(snap: { enemy: { id: string; name: string; battleTexture?: string }; enemyHp: number; enemyMaxHp: number; heroHp: number; heroMaxHp: number }): void {
    const p = this.state.player;
    setPixelText(this.battleStatusText, `${p.name || "DAD"}\nLV ${p.level}\nHP ${snap.heroHp}/${snap.heroMaxHp}\nDP ${p.dadPoints}/${p.maxDadPoints}\nCASH ${p.cash}\nXP ${p.xp}`);
    setPixelText(this.battleEnemyText, `${snap.enemy.name}\nHP ${snap.enemyHp}/${snap.enemyMaxHp}`);
    if (snap.enemy.battleTexture) {
      const isSpider = snap.enemy.id === "icky-spider";
      const sw = isSpider ? 60 : 42; // spider native 74×64, displayed at 60×52
      const sh = isSpider ? 52 : 42;
      const sy = isSpider ? 88 : 92;
      this.battleEnemySprite.setTexture(snap.enemy.battleTexture).setPosition(154, sy).setDisplaySize(sw, sh);
    }
  }

  private showCommandMenu(): void {
    const label = (i: number) =>
      `${i === this.selectedCommand ? ">" : " "}${BATTLE_COMMANDS[i] === "Dad Skills" ? "SKILL" : BATTLE_COMMANDS[i].toUpperCase()}`;
    setPixelText(this.commandText, `${label(0).padEnd(8)} ${label(1)}\n${label(2).padEnd(8)} ${label(3)}`);
    this.commandBox.setVisible(true);
    this.commandText.setVisible(true);
  }

  private hideCommandMenu(): void {
    this.commandBox.setVisible(false);
    this.commandText.setVisible(false);
  }

  private updateQuestText(prefix: string): void {
    setPixelText(this.questText, `${prefix} - ${getQuestStepLabel(this.state.quest.questId, this.state.quest.activeStepId)}`);
  }
}
