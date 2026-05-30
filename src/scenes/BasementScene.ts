/**
 * BasementScene — Dungeon
 * ─────────────────────────────────────────────────────────────────────────────
 * Dragon Warrior–style dungeon.  Winding corridors, random encounters
 * (dust bunnies + Freaky Icky Spiders), three interactive wall objects,
 * and a fixed boss encounter: the Evil Heating Coil.
 *
 * Tiles from dungeon-16 (0x72_16x16DungeonTileset.v5.png, 16×16):
 *   Outer walls use explicit frame rules from the numbered tileset preview.
 *   Default wall = frame 32, default floor = frame 64.
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
import { installDevShortcuts } from "../game/devShortcuts";
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

const WALL_FRAME_DEFAULT = 32;
const FLOOR_FRAMES = [64, 65, 188, 227];

const W = 1; // wall
const F = 2; // floor (walkable)
const X = 3; // exit tile — triggers return to NeighborhoodScene

function buildBasementMap(): number[][] {
  const map = Array.from({ length: 24 }, () => Array(36).fill(W));
  const room = (c1: number, r1: number, c2: number, r2: number) => {
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) map[r][c] = F;
    }
  };
  const h = (row: number, c1: number, c2: number) => room(c1, row, c2, row);
  const v = (col: number, r1: number, r2: number) => room(col, r1, col, r2);

  map[0][17] = X;
  map[0][18] = X;

  room(15, 1, 20, 3);  // entry room
  h(3, 3, 32);         // main choice corridor
  v(4, 3, 15);         // west long path
  room(2, 8, 7, 12);
  h(10, 4, 13);        // breaker dead-end hall
  v(10, 3, 8);
  h(8, 10, 16);
  v(16, 8, 18);
  room(12, 15, 18, 18);
  v(24, 3, 14);
  room(22, 11, 28, 14);
  h(6, 24, 33);
  v(33, 6, 18);
  h(18, 20, 33);
  v(20, 14, 18);
  room(29, 17, 34, 21); // dryer room
  h(21, 4, 12);         // south-west false branch
  v(12, 18, 21);
  room(8, 20, 14, 22);

  return map;
}

const MAP: number[][] = buildBasementMap();

const ROWS    = MAP.length;
const COLS    = MAP[0].length;
const WORLD_W = COLS * TILE;
const WORLD_H = ROWS * TILE;

// Tiles occupied by the coil (boss) — player can't walk through it
const COIL_BLOCKED: ReadonlySet<string> = new Set(["32,19","33,19","32,20","33,20"]);

// ── Position helpers ──────────────────────────────────────────────────────
const px = (col: number, row: number) =>
  ({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });

// ── Dead-end flavour ──────────────────────────────────────────────────────
interface DeadEnd { x: number; y: number; lines: string[] }
const DEAD_ENDS: DeadEnd[] = [
  {
    ...px(4, 12),
    lines: [
      "Old insulation, partially detached from the pipe.",
      "Dad has been meaning to reattach it since 2020.",
      "He means it still. He will keep meaning it.",
    ],
  },
  {
    ...px(26, 13),
    lines: [
      "A water stain on the north wall in the shape of South America.",
      "There was 'an incident' in 2018. Insurance 'handled it'.",
      "The stain remains. The stain is not handled.",
    ],
  },
  {
    ...px(13, 21),
    lines: [
      "A wire-rack shelving unit. Completely empty.",
      "Dad purchased it during an organizational phase in 2019.",
      "The organizational phase lasted eleven days. The shelf has been empty since.",
    ],
  },
  {
    ...px(7, 21),
    lines: [
      "Pool noodles. Seven of them. Dad does not own a pool.",
      "\"You never know,\" said Dad, in 2017, at a garage sale.",
      "He has since known. He does not need pool noodles.",
    ],
  },
];

const DEAD_END_RADIUS = 3 * TILE;

// ── Interactive object positions ──────────────────────────────────────────
const BREAKER_PX   = px(14, 10); // wall tile at the end of the breaker hall
const STICKER_PX   = px(12, 11); // nearby — the safety sticker Dad never read
const COIL_PX      = px(32, 19); // Evil Heating Coil — bottom-right room
const COIL_RADIUS  = 2 * TILE;
const STICKER_RADIUS = 2 * TILE;
const BREAKER_COL = 14;
const BREAKER_ROW = 10;
const BREAKER_OFF_FRAME = 48; // !other.png row 5, column 1
const BREAKER_ON_FRAME = 74;  // !other.png row 7, column 3

interface BasementChest {
  col: number;
  row: number;
  frame: number;
  tint?: number;
  contents: DialogueInput[];
  itemId?: string;
}

const BASEMENT_CHESTS: BasementChest[] = [
  {
    col: 6,
    row: 11,
    frame: 0,
    contents: [
      { speaker: "NARRATOR", text: "Dad opens a plastic tote and finds three furnace filters, all different sizes." },
      { speaker: "DAD", text: "One of these is definitely correct for something." },
    ],
  },
  {
    col: 17,
    row: 17,
    frame: 4,
    tint: 0xaaaaaa,
    itemId: "ibuprofen",
    contents: [
      { speaker: "NARRATOR", text: "A dented metal first-aid tin. Inside: one travel bottle of ibuprofen." },
      { speaker: "DAD'S BRAIN", text: "Treasure, by suburban dungeon standards." },
    ],
  },
  {
    col: 27,
    row: 13,
    frame: 8,
    tint: 0xc084fc,
    contents: [
      { speaker: "NARRATOR", text: "A cardboard box of coax cables, speaker wire, and one charger for a device nobody remembers." },
      { speaker: "DAD", text: "Can't throw these out. What if the mystery device comes back?" },
    ],
  },
  {
    col: 33,
    row: 18,
    frame: 0,
    tint: 0x94a3b8,
    contents: [
      { speaker: "NARRATOR", text: "Holiday candles. All labeled Fresh Snow. All smelling faintly like crayons." },
      { speaker: "DAD", text: "Seasonal." },
    ],
  },
];

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
  private questKey!: Phaser.Input.Keyboard.Key;
  private mover!: GridMover;

  // world objects
  private breakerPanel!: Phaser.GameObjects.Image;   // the full breaker box sprite
  private coilSprite!: Phaser.GameObjects.Image;
  private openedChests = new Set<string>();
  private chestSprites = new Map<string, Phaser.GameObjects.Image>();

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
  private questBox!: Phaser.GameObjects.Rectangle;
  private questText!: Phaser.GameObjects.BitmapText;

  constructor() { super("BasementScene"); }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  create(): void {
    installDevShortcuts(this);

    this.state = getGameState();
    this.mode  = "explore";
    this.openedChests.clear();
    this.chestSprites.clear();
    this.cursors     = this.input.keyboard!.createCursorKeys();
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.questKey    = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

    this.drawTiles();
    this.placeObjects();
    this.placeChests();
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
          this.add.image(cx, cy, "dungeon-16")
            .setFrame(this.getBasementWallFrame(c, r))
            .setDisplaySize(TILE, TILE);
        } else if (t === X) {
          this.add.image(cx, cy, "dungeon-16")
            .setFrame(WALL_FRAME_DEFAULT)
            .setDisplaySize(TILE, TILE);
        } else {
          this.add.image(cx, cy, "dungeon-16")
            .setFrame(this.getBasementFloorFrame(c, r))
            .setDisplaySize(TILE, TILE);
        }
      }
    }

    this.add.image(17 * TILE, 0, "stairs-down")
      .setDisplaySize(TILE * 2, TILE)
      .setOrigin(0, 0);
  }

  private getBasementWallFrame(col: number, row: number): number {
    const lastCol = COLS - 1;

    if (row === 0) {
      if (col === 0) return 16;
      if (col === lastCol) return 18;
      return 0;
    }

    if (row === 1) {
      if (col === 0) return 48;
      if (col === lastCol) return 50;
      return 32;
    }

    if (row === ROWS - 3) {
      if (col === 0) return 83;
      if (col === lastCol) return 84;
      return WALL_FRAME_DEFAULT;
    }

    if (row === ROWS - 2) return 115;
    if (row === ROWS - 1) return 21;

    if (col === 0) return 48;
    if (col === 1) return 49;
    if (col === lastCol - 1) return 49;
    if (col === lastCol) return 50;

    return WALL_FRAME_DEFAULT;
  }

  private getBasementFloorFrame(col: number, row: number): number {
    return FLOOR_FRAMES[Math.abs(col * 13 + row * 17) % FLOOR_FRAMES.length];
  }

  // ── World objects ─────────────────────────────────────────────────────────

  private placeObjects(): void {
    // ── Circuit breaker ────────────────────────────────────────────────────
    const breakerFrame = this.state.flags.circuitBreakerOff
      ? BREAKER_OFF_FRAME
      : BREAKER_ON_FRAME;
    this.breakerPanel = this.add.image(BREAKER_PX.x, BREAKER_PX.y, "obj-other")
      .setFrame(breakerFrame)
      .setOrigin(0.5, 0.5)
      .setDisplaySize(TILE, TILE);

    // ── Safety sticker ─────────────────────────────────────────────────────
    this.add.image(STICKER_PX.x, STICKER_PX.y, "safety-sticker")
      .setOrigin(0.5, 0.5)
      .setDisplaySize(TILE, TILE);

    // ── Coil / dryer boss ──────────────────────────────────────────────────
    if (!this.state.flags.bossDefeated) {
      this.coilSprite = this.add.image(COIL_PX.x, COIL_PX.y, "dryer-boss-world")
        .setOrigin(0.5, 0.75)
        .setDisplaySize(30, 30);
    }
  }

  private placeChests(): void {
    for (const chest of BASEMENT_CHESTS) {
      const pos = px(chest.col, chest.row);
      const sprite = this.add.image(pos.x, pos.y, "chests")
        .setFrame(chest.frame)
        .setDisplaySize(TILE, TILE)
        .setTint(chest.tint ?? 0xffffff);
      this.chestSprites.set(`${chest.col},${chest.row}`, sprite);
    }
  }

  // ── Player ────────────────────────────────────────────────────────────────

  private placePlayer(): void {
    const char = new CharacterSprite(this, 0, 0, DAD_DEF);
    this.mover = new GridMover(this, char, TILE, 17, 1);
  }

  // ── Collision ─────────────────────────────────────────────────────────────

  private canWalkTo(col: number, row: number): boolean {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    if (!this.state.flags.bossDefeated && COIL_BLOCKED.has(`${col},${row}`)) return false;
    if (BASEMENT_CHESTS.some((chest) => chest.col === col && chest.row === row)) return false;
    const t = MAP[row][col];
    return t === F || t === X;
  }

  private onLand(col: number, row: number): void {
    if (MAP[row][col] === X) {
      this.returnToHouse();
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
      this.returnToHouse();
      return;
    }

    // Coil / dryer boss
    if (dist(COIL_PX) < COIL_RADIUS + TILE) {
      this.interactWithCoil();
      return;
    }

    // Circuit breaker — must stand directly next to the breaker wall tile.
    if (this.isAdjacentTo(BREAKER_COL, BREAKER_ROW)) {
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

    for (const chest of BASEMENT_CHESTS) {
      if (dist(px(chest.col, chest.row)) < TILE * 1.75) {
        this.interactWithChest(chest);
        return;
      }
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

  private isAdjacentTo(col: number, row: number): boolean {
    return Math.abs(this.mover.col - col) + Math.abs(this.mover.row - row) === 1;
  }

  private interactWithChest(chest: BasementChest): void {
    const key = `${chest.col},${chest.row}`;
    if (this.openedChests.has(key)) {
      this.startDialogue([{ speaker: "NARRATOR", text: "The box contains only the echo of Dad's previous curiosity." }]);
      return;
    }

    this.openedChests.add(key);
    this.chestSprites.get(key)?.setFrame(12).clearTint();
    if (chest.itemId) {
      this.state.player.inventory.push(chest.itemId);
    }
    this.startDialogue(chest.contents);
  }

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
      ], () => this.returnToHouse());
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
        this.breakerPanel.setFrame(BREAKER_ON_FRAME);
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
    this.breakerPanel.setFrame(BREAKER_OFF_FRAME);
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
      this.returnToHouse();
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
        this.returnToHouse();
      },
    );
  }

  private returnToHouse(): void {
    this.scene.start("NeighborhoodScene", { spawn: "basement" });
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
    this.questBox = this.add.rectangle(8, 8, 236, 16, 0xfacc15)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setVisible(false);
    this.questText = addPixelText(this, 12, 11, "", 8)
      .setTint(0x111827)
      .setScrollFactor(0)
      .setVisible(false);
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

  private updateQuestPrompt(): void {
    const visible = this.questKey.isDown;
    this.questBox.setVisible(visible);
    this.questText.setVisible(visible);
  }
}
