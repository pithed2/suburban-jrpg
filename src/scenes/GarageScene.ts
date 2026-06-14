/**
 * GarageScene — Dungeon
 * ─────────────────────────────────────────────────────────────────────────────
 * Dragon Warrior–style dungeon. Winding corridors, four dead ends, random
 * encounters, and a toolbox (treasure chest) hiding the Adjustable Wrench.
 *
 * MAP legend
 * ──────────
 *  W = 1  solid wall
 *  F = 2  floor (walkable)
 *  X = 3  exit tile — stepping on it returns to NeighborhoodScene
 */

import Phaser from "phaser";
import { BattleManager } from "../game/BattleManager";
import { CharacterSprite } from "../game/CharacterSprite";
import { DAD_DEF } from "../game/characterDefs";
import { enemies } from "../game/content";
import { installDevShortcuts } from "../game/devShortcuts";
import { DialogueBox } from "../game/DialogueBox";
import { getDadBrainLine, getDadCombatLine, getDadLine, getDadMovieQuote } from "../game/dadVoice";
import { DialogueRunner, type DialogueInput, type DialogueLine } from "../game/DialogueRunner";
import { RandomEncounterTracker } from "../game/EncounterManager";
import { GameMenu } from "../game/GameMenu";
import { GridMover } from "../game/GridMover";
import { PlayerStatsPanel } from "../game/PlayerStatsPanel";
import { getQuestStepLabel } from "../game/quests";
import { getGameState, saveGameState } from "../game/session";
import { addPixelText, setPixelText } from "../game/uiText";
import { completeQuestStep, setActiveQuestStep, type GameState } from "../game/state";

// ── Tile constants ─────────────────────────────────────────────────────────
const TILE = 16;
// Walls — full-set-int-a4 (512×480, 32×32, 16 cols × 15 rows)
//   Frame 17 = row 1 col 1 — dark iron/stone fill
const WALL_FRAME = 134; // gray concrete block — garage wall

// Floor — garage-ts = garage_basement_16x16.png (1024×1536, 16×16, 64 cols × 96 rows)
//   Frame 424 = row 6 col 40 — medium-dark grey concrete (GARAGE FLOOR section)
const GARAGE_FLOOR_FRAME = 424;

const W = 1; // wall
const F = 2; // floor
const X = 3; // exit (to house)

// ── Dungeon layout: 30 cols × 20 rows = 480 × 320 world px ───────────────
//
//  Entry/exit  cols 13–14, row 0
//
//  DEAD ENDS (flavor text only):
//    NW     cols 3–4,  rows 1–2   paint cans
//    NE     cols 20–21,rows 1–2   three boxes of Xmas stuff
//    Power  cols 4–13, row  6     old power tools you'll "get to"
//    Cords  cols 4–13, row  9     extension cord mandala
//    Bikes  cols 3–4,  rows 15–18 exercise equipment graveyard
//
//  SIDE CHESTS (dialogue items, no game effect):
//    Easter      col 25, row  1   Easter decorations / the bunny
//    Cards       col 17, row  6   1990 Fleer baseball card complete set
//    Taxes       col 13, row 16   TAXES 2017 and related artifacts
//
//  MAIN CHEST (wrench):
//    Toolbox     col 25, row  9   requires long path
//
//  Path to toolbox:
//    Enter → south → row 3 junction → west → main south (col 3–4) →
//    row 14 E-junction → east col 22–23 → north N-path rows 12–7 →
//    toolbox room cols 22–28, rows 7–11  CHEST at col 25, row 9
//
//  col 21 is a wall in rows 7–11 separating baseball-cards area from
//  toolbox room so the player MUST take the long southern route.
//
/* prettier-ignore */
const MAP: number[][] = [
  [W,W,W,W,W,W,W,W,W,W,W,W,W,X,X,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W], //  0  exit 13-14
  [W,W,W,F,F,W,W,W,W,W,W,W,W,F,F,W,W,W,W,W,F,F,W,W,W,F,F,W,W,W], //  1  NW|entry|NE|Easter-N
  [W,W,W,F,F,W,W,W,W,W,W,W,W,F,F,W,W,W,W,W,F,F,W,W,W,F,F,W,W,W], //  2
  [W,W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W,W], //  3  wide junction 3-26
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W], //  4  main + baseball-cards room
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W], //  5
  [W,W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W], //  6  power-tools branch + cards room (CARDS CHEST 17,6)
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,W,F,F,W,W,W,W,W,W], //  7  main + cards + toolbox N-path starts 22-23
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,W,F,F,F,F,F,F,F,W], //  8  main + cards + toolbox room 22-28
  [W,W,W,F,F,F,F,F,F,F,F,F,F,F,W,F,F,F,F,F,F,W,F,F,F,F,F,F,F,W], //  9  cords branch | cards | wall | toolbox (WRENCH 25,9)
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,W,F,F,F,F,F,F,F,W], // 10  main + cards + toolbox room
  [W,W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,F,F,F,F,F,F,F,W], // 11  E-branch main→cards, toolbox room bottom
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,F,W,W,W,W,W,W], // 12  main + N-path 22-23
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,F,W,W,W,W,W,W], // 13
  [W,W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W,W,W,W,W], // 14  E-junction 3-23
  [W,W,W,F,F,W,W,W,W,W,W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W], // 15  S dead-end + taxes branch
  [W,W,W,F,F,W,W,W,W,W,W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W], // 16  S dead-end + TAXES CHEST 13,16
  [W,W,W,F,F,W,W,W,W,W,W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W], // 17
  [W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W], // 18  S dead-end bottom
  [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W], // 19  bottom wall
];

const ROWS    = MAP.length;    // 20
const COLS    = MAP[0].length; // 30
const WORLD_W = COLS * TILE;   // 480
const WORLD_H = ROWS * TILE;   // 320

// ── Position helper ────────────────────────────────────────────────────────
const px = (c: number, r: number) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 });

// ── Dead-end flavor positions ──────────────────────────────────────────────
interface DeadEnd { x: number; y: number; lines: string[] }
const DEAD_ENDS: DeadEnd[] = [
  {
    ...px(3, 1),
    lines: [
      "Three cans of paint from 2008.",
      "Colors: 'Dusty Mauve', 'Regret Beige', and 'I Was Told This Was Cream'.",
      "Dad bought them for the garage. The garage remains unambiguously gray.",
    ],
  },
  {
    ...px(20, 1),
    lines: [
      "A box labeled XMAS STUFF. Another labeled XMAS STUFF 2.",
      "A third labeled XMAS (THE REAL ONE).",
      "There is no telling which one has the lights.",
    ],
  },
  {
    ...px(10, 6),
    lines: [
      "A drill press. A router still in its original box. A scroll saw.",
      "A belt sander Dad bought because he saw someone use one on YouTube.",
      "He watched the whole video. He has not used the sander.",
      "\"I'm getting to these,\" said Dad. He has been getting to these for six years.",
    ],
  },
  {
    ...px(9, 9),
    lines: [
      "Extension cords. Dozens of them. Tangled into a shape",
      "that may be a cry for help or a reef knot.",
      "None of them are three-prong.",
    ],
  },
  {
    ...px(3, 17),
    lines: [
      "A treadmill. A stationary bike. A set of dumbbells rated for a man",
      "who no longer exists. They all face the wall.",
      "\"I was going to start,\" said Dad. He did not start.",
    ],
  },
];

const DEAD_END_RADIUS = 3 * TILE;

// ── Side chests (flavor items — dialogue only, no game effect) ────────────
interface SideChest { id: string; col: number; row: number; frame: number; tint?: number; lines: DialogueInput[] }
const SIDE_CHESTS: SideChest[] = [
  {
    id: "garage:easter",
    col: 25, row: 1,
    frame: 0,
    lines: [
      { speaker: "NARRATOR",    text: "A purple Rubbermaid tub. Label: EASTER." },
      { speaker: "NARRATOR",    text: "Inside: one plastic egg with a desiccated jelly bean, a basket with no handle, seventeen feet of green plastic grass that will never fully leave this garage." },
      { speaker: "NARRATOR",    text: "And a 14-inch ceramic rabbit in a waistcoat." },
      { speaker: "DAD",         text: "The bunny." },
      { speaker: "NARRATOR",    text: "The bunny watches with painted eyes that suggest he has always been watching. He will always be watching." },
      { speaker: "DAD",         text: "He comes out for three weeks a year and judges the whole family." },
      { speaker: "DAD'S BRAIN", text: "The bunny was in here before 2019. The bunny was in here before the house." },
      { speaker: "NARRATOR",    text: "Dad carefully closes the tub. Some things should stay in the garage." },
    ],
  },
  {
    id: "garage:cards",
    col: 17, row: 6,
    frame: 4,
    tint: 0xaaaaaa,
    lines: [
      { speaker: "NARRATOR",    text: "A flat plastic case. Label in careful Sharpie: '1990 FLEER COMPLETE SET.'" },
      { speaker: "DAD",         text: "Oh. Oh wow." },
      { speaker: "NARRATOR",    text: "660 cards in protective sleeves. Dad spent three summers and most of his allowance on this." },
      { speaker: "DAD",         text: "These are in really good shape. Dad took care of these." },
      { speaker: "NARRATOR",    text: "Dad's kid mentioned last week that a PSA 10 Frank Thomas rookie from this exact set sold for two point five million dollars." },
      { speaker: "DAD",         text: "I have seventeen Frank Thomases." },
      { speaker: "DAD'S BRAIN", text: "We do have seventeen Frank Thomases. We also have six hundred Vince Colemans and a checklist card in a magnetic holder." },
      { speaker: "DAD",         text: "I need the Beckett Baseball Card Monthly." },
      { speaker: "NARRATOR",    text: "Dad has seventeen copies of the Beckett from 1991 to 1993. They are somewhere in this garage." },
      { speaker: "DAD",         text: "This whole trip may have just paid for itself." },
      { speaker: "NARRATOR",    text: "It probably hasn't. But it might." },
    ],
  },
  {
    id: "garage:taxes",
    col: 13, row: 16,
    frame: 8,
    tint: 0x94a3b8,
    lines: [
      { speaker: "NARRATOR",    text: "A manila folder. Label: TAXES 2017." },
      { speaker: "NARRATOR",    text: "Beneath it: TAXES 2016. TAXES 2015. A warranty card for a TV Dad no longer owns." },
      { speaker: "NARRATOR",    text: "A Bed Bath and Beyond coupon from 2011. Twenty percent off. No expiration date printed." },
      { speaker: "DAD",         text: "This coupon might still be good." },
      { speaker: "DAD'S BRAIN", text: "The store is gone, Dad." },
      { speaker: "DAD",         text: "The coupon transcends the store." },
      { speaker: "NARRATOR",    text: "There is also an envelope labeled IMPORTANT with nothing inside, and a birthday card signed only by someone named Gerald." },
      { speaker: "DAD",         text: "Who is Gerald?" },
      { speaker: "NARRATOR",    text: "This question will never be answered." },
    ],
  },
];

// ── Main wrench chest ──────────────────────────────────────────────────────
const CHEST_COL = 25, CHEST_ROW = 9;
const CHEST_ID = "garage:toolbox";
const CHEST_PX  = px(CHEST_COL, CHEST_ROW);
const CHEST_RADIUS = 2 * TILE;
const SIDE_CHEST_RADIUS = 2 * TILE;

// ── Battle types ───────────────────────────────────────────────────────────
type GarageMode = "explore" | "dialogue" | "battle";
type BattleCommand = "Fight" | "Dad Skills" | "Items" | "Run";
type BattlePhase   = "command" | "playerResult" | "enemyResult";
const BATTLE_COMMANDS: BattleCommand[] = ["Fight", "Dad Skills", "Items", "Run"];

// ── Scene ──────────────────────────────────────────────────────────────────
export class GarageScene extends Phaser.Scene {
  // movement
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private questKey!: Phaser.Input.Keyboard.Key;
  private mover!: GridMover;
  private chestSprite!: Phaser.GameObjects.Image;
  private sideChestSprites = new Map<string, Phaser.GameObjects.Image>();
  private chestOpened = false;

  // systems
  private mode: GarageMode = "explore";
  private dialogueBox!: DialogueBox;
  private statsPanel!: PlayerStatsPanel;
  private menu!: GameMenu;
  private state!: GameState;
  private readonly dialogueRunner = new DialogueRunner();
  private readonly battle = new BattleManager();
  private readonly encounters = new RandomEncounterTracker("garage");

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
  private questBox!: Phaser.GameObjects.Rectangle;
  private questText!: Phaser.GameObjects.BitmapText;

  constructor() { super("GarageScene"); }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  create(): void {
    installDevShortcuts(this);

    this.state = getGameState();
    this.mode  = "explore";
    this.sideChestSprites.clear();
    this.cursors     = this.input.keyboard!.createCursorKeys();
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.questKey    = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.chestOpened = this.state.flags.foundWrench || this.state.openedChestIds.includes(CHEST_ID);

    this.drawTiles();
    this.placeDecorations();
    this.placeChest();
    this.placePlayer();
    this.createUi();
    this.menu = new GameMenu(this, () => this.state);
    this.updateQuestText();

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.mover.phaserSprite, true, 0.1, 0.1);

    const bgMusic = this.sound.add("dramatic-bg", { loop: true, volume: 0.4 });
    bgMusic.play();
    this.events.once("shutdown", () => bgMusic.stop());

    if (!this.state.flags.foundWrench) {
      this.startDialogue([
        { speaker: "DAD'S BRAIN", text: getDadBrainLine("garage") },
        { speaker: "NARRATOR",   text: "The garage receives Dad with the quiet hostility of unfinished projects." },
        { speaker: "DAD",        text: "The wrench is in here somewhere. Probably." },
      ]);
    }
  }

  update(_time: number, delta: number): void {
    this.dialogueBox.update(delta);
    this.updateQuestPrompt();

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
      (c, r) => this.canWalkTo(c, r),
      (c, r) => this.onLand(c, r),
    );

    this.statsPanel.update(delta, !this.mover.isMoving, this.state);
  }

  // ── Tile rendering ─────────────────────────────────────────────────────────

  private drawTiles(): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = MAP[r][c];
        if (t === 0) continue;
        const cx = c * TILE + TILE / 2;
        const cy = r * TILE + TILE / 2;
        if (t === W) {
          // Dark stone walls from full-set-int-a4
          this.add.image(cx, cy, "full-set-int-a4")
            .setFrame(WALL_FRAME)
            .setDisplaySize(TILE, TILE);
        } else if (t === X) {
          // Exit door is embedded in the wall but remains walkable as a trigger tile.
          this.add.image(cx, cy, "full-set-int-a4")
            .setFrame(WALL_FRAME)
            .setDisplaySize(TILE, TILE);
        } else {
          // Walkable floor — GARAGE FLOOR (CONCRETE) tile from garage_basement_16x16
          this.add.image(cx, cy, "garage-ts")
            .setFrame(GARAGE_FLOOR_FRAME)
            .setDisplaySize(TILE, TILE);
        }
      }
    }

    this.add.image(13 * TILE, 0, "garage-door")
      .setDisplaySize(TILE * 2, TILE)
      .setOrigin(0, 0);
  }

  private placeChest(): void {
    // Main wrench chest
    const { x, y } = CHEST_PX;
    this.chestSprite = this.add.image(x, y, "chests")
      .setFrame(this.chestOpened ? 12 : 0)   // 0 = closed, 12 = open
      .setDisplaySize(TILE, TILE);

    for (const sc of SIDE_CHESTS) {
      const sp = px(sc.col, sc.row);
      const isOpened = this.state.openedChestIds.includes(sc.id);
      const sprite = this.add.image(sp.x, sp.y, "chests")
        .setFrame(isOpened ? 12 : sc.frame)
        .setDisplaySize(TILE, TILE)
        .setTint(isOpened ? 0xffffff : sc.tint ?? 0xffffff);
      this.sideChestSprites.set(sc.id, sprite);
    }
  }

  private placeDecorations(): void {
    // Int-C frame 167 = cobweb. Place at wall-floor corners, 2×2 tile display.
    const web = (wx: number, wy: number, alpha = 0.8) =>
      this.add.image(wx, wy, "full-set-int-c")
        .setFrame(167).setDisplaySize(TILE * 2, TILE * 2).setAlpha(alpha);

    // Int-B props (32×32 art → display at TILE for clutter items)
    const propB = (col: number, row: number, frame: number, size = TILE) =>
      this.add.image(col * TILE + TILE / 2, row * TILE + TILE / 2, "full-set-int-b")
        .setFrame(frame).setDisplaySize(size, size);

    // NW dead end — paint cans corner (wall at row 0, col 2)
    web(2 * TILE, 0 * TILE, 0.8);               // NW wall corner
    propB(3, 1, 96);  propB(4, 1, 97);          // orange pots = paint cans
    propB(3, 2, 64);  propB(4, 2, 65);          // dark crates

    // NE dead end — Xmas boxes corner (wall at row 0, col 22)
    web(22 * TILE, 0 * TILE, 0.8);
    propB(20, 1, 67); propB(21, 1, 64);         // wooden crates = Xmas boxes
    propB(20, 2, 65); propB(21, 2, 67);

    // Power-tools branch — cobweb in the dead-end pocket (row 6, west wall)
    web(2 * TILE, 6 * TILE, 0.65);
    propB(5, 6, 70, TILE * 2);                  // large barrel (frame 70 is 2-tile art)
    propB(8, 6, 79);                             // small appliance

    // Extension-cord area — minimal web, cord mess speaks for itself
    web(2 * TILE, 9 * TILE, 0.55);

    // Exercise graveyard — most neglected, most webs (cols 3-4, rows 15-18)
    web(2 * TILE, 14 * TILE, 0.85);             // NW corner
    web(2 * TILE, 18 * TILE, 0.75);             // SW corner
    propB(3, 15, 128); propB(4, 15, 129);       // blue pots = dumbbells
    propB(3, 16, 112); propB(4, 17, 113);       // green pots = more junk
    propB(3, 18, 130);                           // stone pile = ankle weights

    // Toolbox room corners — the wrench has been here a while
    web(22 * TILE, 6 * TILE, 0.7);
    web(29 * TILE, 6 * TILE, 0.7);
    web(22 * TILE, 12 * TILE, 0.65);
    web(29 * TILE, 12 * TILE, 0.65);
    propB(23, 9, 65); propB(24, 9, 64);         // crates flanking the chest
  }

  private placePlayer(): void {
    const char = new CharacterSprite(this, 0, 0, DAD_DEF);
    this.mover = new GridMover(this, char, TILE, 13, 1); // spawn just inside entry (col 13-14 = exit tiles)
  }

  // ── Collision ──────────────────────────────────────────────────────────────

  /**
   * All chest footprints — blocked regardless of open/closed state.
   * Chests follow BasementScene's one-tile sprite footprint.
   */
  private static readonly CHEST_TILES: ReadonlySet<string> = new Set([
    // Main toolbox  (25, 9)
    "25,9",
    // Easter chest  (25, 1)
    "25,1",
    // Baseball cards chest (17, 6)
    "17,6",
    // Taxes chest   (13, 16)
    "13,16",
  ]);

  private canWalkTo(col: number, row: number): boolean {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    if (GarageScene.CHEST_TILES.has(`${col},${row}`)) return false;
    const t = MAP[row][col];
    return t === F || t === X;
  }

  private onLand(col: number, row: number): void {
    // Exit tile
    if (MAP[row][col] === X) {
      this.scene.start("NeighborhoodScene", { spawn: "garage" });
      return;
    }

    // Random encounter check
    if (this.mode !== "explore") return;
    const pos = new Phaser.Math.Vector2(this.mover.x, this.mover.y);
    const enc = this.encounters.update(pos, this.state);
    if (enc) {
      const isSpider = enc.enemy.id === "icky-spider";
      this.startDialogue(
        [
          ...enc.introMessages.map((text) => ({ speaker: "NARRATOR", text })),
          { speaker: "DAD'S BRAIN", text: getDadBrainLine("battle") },
          // Spiders get their own quote pool — pure Indiana Jones energy
          { speaker: "DAD", text: getDadLine("toEnemy", isSpider ? "spider" : "battleStart") },
        ],
        () => this.startBattle(enc.enemy.id),
      );
    }
  }

  // ── Interaction ────────────────────────────────────────────────────────────

  private handleInteract(): void {
    if (this.mode === "dialogue") { this.advanceDialogue(); return; }
    if (this.mode === "battle")   { this.handleBattleTurn(); return; }

    const dadX = this.mover.x;
    const dadY = this.mover.y;
    const dist = (a: { x: number; y: number }) => Math.hypot(dadX - a.x, dadY - a.y);

    // Exit
    if (MAP[this.mover.row]?.[this.mover.col] === X) {
      this.scene.start("NeighborhoodScene", { spawn: "garage" });
      return;
    }

    // Toolbox / chest
    if (!this.chestOpened && dist(CHEST_PX) < CHEST_RADIUS) {
      this.openChest();
      return;
    }
    if (this.chestOpened && dist(CHEST_PX) < CHEST_RADIUS) {
      this.startDialogue([{ speaker: "NARRATOR", text: "The toolbox is empty. The wrench has moved on to better things." }]);
      return;
    }

    // Side chests (Easter / baseball cards / taxes)
    for (const sc of SIDE_CHESTS) {
      if (dist(px(sc.col, sc.row)) < SIDE_CHEST_RADIUS) {
        this.openSideChest(sc);
        this.startDialogue(sc.lines);
        return;
      }
    }

    // Dead ends — NARRATOR describes the junk, then Dad quotes a movie
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
      { speaker: "NARRATOR", text: "The garage smells like motor oil and abandoned intentions." },
    ]);
  }

  private openChest(): void {
    this.state.flags.foundWrench = true;
    if (!this.state.openedChestIds.includes(CHEST_ID)) {
      this.state.openedChestIds.push(CHEST_ID);
    }
    this.state.player.inventory.push("adjustable-wrench");
    this.state.player.equipment.weaponId = "adjustable-wrench";
    completeQuestStep(this.state, "find-wrench");
    setActiveQuestStep(this.state, "flip-breaker");
    this.chestOpened = true;
    this.chestSprite.setFrame(12); // open chest
    saveGameState(this.state);
    this.updateQuestText();
    this.startDialogue([
      { speaker: "NARRATOR",   text: "Dad opens the toolbox. Inside, beneath a receipt for a drill he bought in 2019," },
      { speaker: "NARRATOR",   text: "and never used, and a bag of mystery screws — the Adjustable Wrench." },
      { speaker: "SYSTEM",     text: "The Dad had found ADJUSTABLE WRENCH!" },
      { speaker: "SYSTEM",     text: "You can feel your kick ass immediately improve." },
      { speaker: "DAD'S BRAIN", text: "Somewhere in the basement, you know the dryer is already worried its days of not drying shit are numbered." },
      { speaker: "DAD'S BRAIN", text: "When you get around to actually fixing it." },
      { speaker: "DAD'S BRAIN", text: getDadBrainLine("wrenchFound") },
      { speaker: "DAD",        text: getDadMovieQuote("findItem") },
      { speaker: "DAD",        text: getDadLine("selfTalk", "victory") },
    ]);
  }

  private openSideChest(chest: SideChest): void {
    if (this.state.openedChestIds.includes(chest.id)) return;
    this.state.openedChestIds.push(chest.id);
    this.sideChestSprites.get(chest.id)?.setFrame(12).clearTint();
    saveGameState(this.state);
  }

  // ── Dialogue ───────────────────────────────────────────────────────────────

  private startDialogue(lines: DialogueInput[], onComplete?: () => void): void {
    this.mode = "dialogue";
    this.showMessage(this.dialogueRunner.start(lines, onComplete));
  }

  private advanceDialogue(): void {
    if (this.dialogueBox.advance() !== "done") return;
    const next = this.dialogueRunner.advance();
    if (next) { this.showMessage(next); return; }
    // Only reset to explore if no callback (e.g. startBattle) already changed the mode.
    // Without this guard, startBattle() sets mode="battle" inside the callback, then
    // advanceDialogue overwrites it with "explore" and hides the dialogue box.
    if (this.mode === "dialogue") {
      this.mode = "explore";
      this.dialogueRunner.clear();
      this.dialogueBox.hide();
    }
  }

  private showMessage(msg: DialogueLine | string, speaker = "DAD"): void {
    const line = typeof msg === "string" ? { speaker, text: msg } : msg;
    this.dialogueBox.show(line.text, line.speaker === "DAD" ? (this.state.player.name || "DAD") : line.speaker);
  }

  // ── Battle ─────────────────────────────────────────────────────────────────

  private startBattle(enemyId: string): void {
    const enemy = enemies.find((e) => e.id === enemyId);
    if (!enemy) return;
    const snap = this.battle.start(enemy, this.state);
    this.mode = "battle";
    this.battlePhase = "command";
    this.selectedCommand = 0;
    this.updateQuestText();
    this.showBattleUi(snap);

    if (snap.ambushed && snap.message) {
      this.battlePhase = "enemyResult";
      this.showMessage(snap.message, "AMBUSH");
      if (snap.defeated) this.handleDefeat(snap.message);
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
      this.showMessage(`${res.message}\n${getDadCombatLine(res.heroHp <= res.heroMaxHp * 0.3 ? "lowHp" : "takingDamage")}`, "BATTLE");
      return;
    }

    const cmd = BATTLE_COMMANDS[this.selectedCommand];
    const res = this.resolveCommand(cmd);
    this.updateBattlePanels(res);

    if (res.victory) { this.hideCommandMenu(); this.handleVictory(res.message); return; }
    if (res.escaped) {
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
    this.startDialogue(
      [
        { speaker: "BATTLE",     text: msg },
        { speaker: "DAD'S BRAIN", text: getDadBrainLine("victory") },
        { speaker: "DAD",        text: getDadLine("selfTalk", "victory") },
      ],
      () => { this.hideBattleUi(); this.mode = "explore"; this.dialogueBox.hide(); },
    );
  }

  private handleDefeat(msg: string): void {
    this.hideCommandMenu();
    this.startDialogue(
      [
        { speaker: "BATTLE",   text: msg },
        { speaker: "NARRATOR", text: "Everything goes white, then beige, then suspiciously recliner-shaped." },
        { speaker: "WIFE",     text: "Why are you in the chair? The dryer is still broken." },
      ],
      () => {
        this.hideBattleUi();
        this.state.player.hp = this.state.player.maxHp;
        this.state.player.dadPoints = this.state.player.maxDadPoints;
        this.state.player.cash = Math.max(0, this.state.player.cash - 2);
        this.scene.start("NeighborhoodScene", { spawn: "garage" });
      },
    );
  }

  private resolveCommand(cmd: BattleCommand) {
    if (cmd === "Fight")       return this.battle.useFight(this.state);
    if (cmd === "Dad Skills")  return this.battle.useDadSkill(this.state);
    if (cmd === "Items")       return this.battle.useItem(this.state, "ibuprofen");
    return this.battle.useRun(this.state);
  }

  private updateBattleNav(): void {
    const { up, down, left, right } = this.cursors;
    if (Phaser.Input.Keyboard.JustDown(up))    { this.selectedCommand = Phaser.Math.Wrap(this.selectedCommand - 2, 0, 4); this.showCommandMenu(); }
    if (Phaser.Input.Keyboard.JustDown(down))  { this.selectedCommand = Phaser.Math.Wrap(this.selectedCommand + 2, 0, 4); this.showCommandMenu(); }
    if (Phaser.Input.Keyboard.JustDown(left))  { this.selectedCommand = Phaser.Math.Wrap(this.selectedCommand - 1, 0, 4); this.showCommandMenu(); }
    if (Phaser.Input.Keyboard.JustDown(right)) { this.selectedCommand = Phaser.Math.Wrap(this.selectedCommand + 1, 0, 4); this.showCommandMenu(); }
  }

  private formatSnap(s: { enemy: { name: string } }): string { return "Command?"; }

  // ── Battle UI ──────────────────────────────────────────────────────────────

  private createUi(): void {
    const { addPixelText: apt } = { addPixelText };

    // Quest bar — hidden until Q is held.
    this.questBox = this.add.rectangle(8, 8, 236, 16, 0xfacc15)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setVisible(false);
    this.questText = addPixelText(this, 12, 11, "", 8)
      .setTint(0x111827)
      .setScrollFactor(0)
      .setVisible(false);

    // Dialogue
    this.dialogueBox = new DialogueBox(this);
    this.statsPanel  = new PlayerStatsPanel(this);

    // Battle panels (hidden until needed)
    this.battleStatusBox = this.add.rectangle(48, 78, 76, 92, 0x111827, 0.94).setStrokeStyle(2, 0xf8fafc).setVisible(false).setScrollFactor(0);
    this.battleStatusText = addPixelText(this, 16, 38, "", 7).setVisible(false).setScrollFactor(0);

    this.battleEnemyBox = this.add.rectangle(154, 84, 108, 62, 0x65a30d).setStrokeStyle(2, 0xf8fafc).setVisible(false).setScrollFactor(0);
    this.battleEnemySprite = this.add.sprite(154, 92, "sixteen-pixel", 22).setScale(2).setVisible(false).setScrollFactor(0);
    this.battleEnemyText = addPixelText(this, 108, 56, "", 6).setMaxWidth(96).setVisible(false).setScrollFactor(0);

    this.commandBox = this.add.rectangle(256, 58, 120, 58, 0x111827, 0.94).setStrokeStyle(2, 0xf8fafc).setVisible(false).setScrollFactor(0);
    this.commandText = addPixelText(this, 204, 38, "", 7).setVisible(false).setScrollFactor(0);
  }

  private showBattleUi(snap: { enemy: { id: string; name: string; battleTexture?: string }; enemyHp: number; enemyMaxHp: number; heroHp: number; heroMaxHp: number }): void {
    this.battleStatusBox.setVisible(true);
    this.battleStatusText.setVisible(true);
    this.battleEnemyBox.setVisible(true);
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
    const { setPixelText: spt } = { setPixelText };
    setPixelText(this.battleStatusText, `${p.name || "DAD"}\nLV ${p.level}\nHP ${snap.heroHp}/${snap.heroMaxHp}\nDP ${p.dadPoints}/${p.maxDadPoints}\nCASH ${p.cash}\nXP ${p.xp}`);
    setPixelText(this.battleEnemyText, `${snap.enemy.name}\nHP ${snap.enemyHp}/${snap.enemyMaxHp}`);
    if (snap.enemy.battleTexture) {
      const isSpider = snap.enemy.id === "icky-spider";
      const isCoil = snap.enemy.id === "evil-heating-coil";
      // Spider is bigger on screen — it deserves to fill the box so you can see every leg
      const sw = isCoil ? 48 : isSpider ? 60 : 32;
      const sh = isCoil ? 42 : isSpider ? 52 : 32;
      const sy = isCoil ? 95 : isSpider ? 88 : 93;
      this.battleEnemyBox.setFillStyle(isSpider ? 0x1a0a2e : 0x65a30d); // dark for spider, green for others
      this.battleEnemySprite
        .setTexture(snap.enemy.battleTexture)
        .setPosition(154, sy)
        .setDisplaySize(sw, sh);
    }
  }

  private showCommandMenu(): void {
    const label = (i: number) => `${i === this.selectedCommand ? ">" : " "}${BATTLE_COMMANDS[i] === "Dad Skills" ? "SKILL" : BATTLE_COMMANDS[i].toUpperCase()}`;
    setPixelText(this.commandText, `${label(0).padEnd(8)} ${label(1)}\n${label(2).padEnd(8)} ${label(3)}`);
    this.commandBox.setVisible(true);
    this.commandText.setVisible(true);
  }

  private hideCommandMenu(): void {
    this.commandBox.setVisible(false);
    this.commandText.setVisible(false);
  }

  private updateQuestText(): void {
    setPixelText(this.questText, `GARAGE - ${getQuestStepLabel(this.state.quest.questId, this.state.quest.activeStepId)}`);
  }

  private updateQuestPrompt(): void {
    const visible = this.questKey.isDown;
    this.questBox.setVisible(visible);
    this.questText.setVisible(visible);
  }
}
