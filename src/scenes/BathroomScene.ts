/**
 * BathroomScene — Dungeon
 * ─────────────────────────────────────────────────────────────────────────
 * Compact maze, Garage-style. Linen closet (TP side quest), vanity/sink
 * area (Mold Patch wanders here), shower stall (Toothpaste Slime + rubber
 * ducky side quest), and the toilet nook boss room at the south end.
 *
 * MAP legend
 * ──────────
 *  W = 1  solid wall
 *  F = 2  floor (walkable)
 *  X = 3  exit tile — stepping on it returns to NeighborhoodScene upstairs
 */

import Phaser from "phaser";
import { BattleManager } from "../game/BattleManager";
import { CharacterSprite } from "../game/CharacterSprite";
import { DAD_DEF } from "../game/characterDefs";
import { enemies } from "../game/content";
import { getDadBrainLine, getDadCombatLine, getDadLine, getDadMovieQuote, getEnemyBanter } from "../game/dadVoice";
import { installDevShortcuts } from "../game/devShortcuts";
import { DialogueBox } from "../game/DialogueBox";
import { applyExperienceAndLevelUps } from "../game/dragonWarriorMath";
import { DialogueRunner, type DialogueInput, type DialogueLine } from "../game/DialogueRunner";
import { RandomEncounterTracker } from "../game/EncounterManager";
import { GameMenu } from "../game/GameMenu";
import { GridMover } from "../game/GridMover";
import { PlayerStatsPanel } from "../game/PlayerStatsPanel";
import { getQuestStepLabel } from "../game/quests";
import { getGameState, saveGameState } from "../game/session";
import { addPixelText, setPixelText } from "../game/uiText";
import { completeQuestStep, setActiveQuestStep, type GameState } from "../game/state";

const TILE = 16;
const WALL_FRAME = 140; // warm cream plaster — matches the house interior

const W = 1; // wall
const F = 2; // floor
const X = 3; // exit (to house)

/* prettier-ignore */
const MAP: number[][] = [
  [W,W,W,W,W,W,W,W,W,W,W,X,X,W,W,W,W,W,W,W,W,W,W,W], //  0  exit 11-12
  [W,W,W,W,W,W,W,W,W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W], //  1  entry corridor
  [W,W,W,W,W,W,W,W,W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W], //  2
  [W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W], //  3  wide junction
  [W,W,F,F,F,F,W,W,W,F,F,F,F,F,W,W,W,F,F,F,F,W,W,W], //  4  linen closet | vanity | shower
  [W,W,F,F,F,F,W,W,W,F,F,F,F,F,W,W,W,F,F,F,F,W,W,W], //  5
  [W,W,F,F,F,F,W,W,W,F,F,F,F,F,W,W,W,F,F,F,F,W,W,W], //  6
  [W,W,F,F,F,F,W,W,W,F,F,F,F,F,W,W,W,F,F,F,F,W,W,W], //  7
  [W,W,W,W,W,W,W,W,W,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W], //  8  south corridor begins
  [W,W,W,W,W,W,W,W,W,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W], //  9
  [W,W,W,W,W,W,W,W,W,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W], // 10
  [W,W,W,W,W,W,W,W,W,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W], // 11  toilet nook begins
  [W,W,W,W,W,W,W,W,W,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W], // 12
  [W,W,W,W,W,W,W,W,W,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W], // 13  TOILET at col 11
  [W,W,W,W,W,W,W,W,W,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W], // 14
  [W,W,W,W,W,W,W,W,W,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W], // 15
  [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W], // 16  bottom wall
];

const ROWS    = MAP.length;
const COLS    = MAP[0].length;
const WORLD_W = COLS * TILE;
const WORLD_H = ROWS * TILE;

const px = (c: number, r: number) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 });

// ── Side quest spots ─────────────────────────────────────────────────────
const LINEN_PX = px(3, 5);
const LINEN_RADIUS = 2 * TILE;

const DUCK_PX = px(18, 6);
const DUCK_RADIUS = 2 * TILE;

const SINK_PX = px(11, 5);
const SINK_RADIUS = 2 * TILE;

// ── Boss ─────────────────────────────────────────────────────────────────
const TOILET_PX = px(11, 13);
const TOILET_RADIUS = 2 * TILE;
const TOILET_BLOCKED: ReadonlySet<string> = new Set(["11,13"]);

type BathroomMode = "explore" | "dialogue" | "battle";
type BattleCommand = "Fight" | "Dad Skills" | "Items" | "Run";
type BattlePhase   = "command" | "playerResult" | "enemyResult";
const BATTLE_COMMANDS: BattleCommand[] = ["Fight", "Dad Skills", "Items", "Run"];

export class BathroomScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private questKey!: Phaser.Input.Keyboard.Key;
  private mover!: GridMover;
  private toiletSprite!: Phaser.GameObjects.Image;
  private activeEnemyId = "clogged-toilet";
  private bgMusic?: Phaser.Sound.BaseSound;
  private bossMusicActive = false;

  private mode: BathroomMode = "explore";
  private dialogueBox!: DialogueBox;
  private statsPanel!: PlayerStatsPanel;
  private menu!: GameMenu;
  private state!: GameState;
  private readonly dialogueRunner = new DialogueRunner();
  private readonly battle = new BattleManager();
  private readonly encounters = new RandomEncounterTracker("bathroom");

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

  constructor() { super("BathroomScene"); }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  create(): void {
    installDevShortcuts(this);

    this.state = getGameState();
    this.mode = "explore";
    this.cursors     = this.input.keyboard!.createCursorKeys();
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.questKey    = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

    this.drawTiles();
    this.placeDecorations();
    this.placeToilet();
    this.placePlayer();
    this.createUi();
    this.menu = new GameMenu(this, () => this.state);
    this.updateQuestText();

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.mover.phaserSprite, true, 0.1, 0.1);

    this.bgMusic = this.sound.add("dramatic-bg", { loop: true, volume: 0.4 });
    this.bgMusic.play();
    this.events.once("shutdown", () => { this.bgMusic?.stop(); });

    if (this.state.quest.activeStepId === "talk-to-wife-bathroom") {
      // Defensive: should already be set by NeighborhoodScene, but keeps this scene safe standalone.
      completeQuestStep(this.state, "talk-to-wife-bathroom");
      setActiveQuestStep(this.state, "visit-home-depot");
    }

    if (!this.state.flags.toiletInspected) {
      this.startDialogue([
        { speaker: "DAD'S BRAIN", text: "The smell got here before we did." },
        { speaker: "NARRATOR",   text: "The bathroom waits, tiled and unforgiving." },
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

  // ── Tile rendering ───────────────────────────────────────────────────────

  private drawTiles(): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = MAP[r][c];
        if (t === 0) continue;
        const cx = c * TILE + TILE / 2;
        const cy = r * TILE + TILE / 2;
        if (t === W || t === X) {
          this.add.image(cx, cy, "full-set-int-a4")
            .setFrame(WALL_FRAME)
            .setDisplaySize(TILE, TILE);
        } else {
          this.add.image(cx, cy, "full-set-int-a2")
            .setFrame(7)
            .setDisplaySize(TILE, TILE);
        }
      }
    }
  }

  private placeDecorations(): void {
    const propB = (col: number, row: number, frame: number, size = TILE) =>
      this.add.image(col * TILE + TILE / 2, row * TILE + TILE / 2, "full-set-int-b")
        .setFrame(frame).setDisplaySize(size, size);

    // Linen closet — shelving
    propB(2, 4, 40); propB(2, 6, 40);
    addPixelText(this, LINEN_PX.x - 22, LINEN_PX.y - TILE, "LINEN CLOSET", 6).setTint(0xfacc15);

    // Vanity / sink
    propB(11, 5, 162);
    addPixelText(this, SINK_PX.x - 12, SINK_PX.y - TILE, "SINK", 6).setTint(0xfacc15);

    // Shower stall with curtain
    propB(17, 4, 178, TILE * 2);
    addPixelText(this, DUCK_PX.x - 26, DUCK_PX.y - TILE, "SHOWER CURTAIN", 6).setTint(0xfacc15);
  }

  private placeToilet(): void {
    const texture = this.state.flags.clogBossDefeated ? "dryer-fixed" : "clogged-toilet-battle";
    this.toiletSprite = this.add.image(TOILET_PX.x, TOILET_PX.y, texture)
      .setOrigin(0.5, 0.7)
      .setDisplaySize(28, 28);
    addPixelText(this, TOILET_PX.x - 14, TOILET_PX.y - TILE * 1.6, "TOILET", 6).setTint(0xfacc15);
  }

  private placePlayer(): void {
    const char = new CharacterSprite(this, 0, 0, DAD_DEF);
    this.mover = new GridMover(this, char, TILE, 11, 2);
  }

  // ── Collision ────────────────────────────────────────────────────────────

  private canWalkTo(col: number, row: number): boolean {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    if (TOILET_BLOCKED.has(`${col},${row}`)) return false;
    const t = MAP[row][col];
    return t === F || t === X;
  }

  private onLand(col: number, row: number): void {
    if (MAP[row][col] === X) {
      this.scene.start("NeighborhoodScene", { spawn: "bathroom" });
      return;
    }

    if (this.mode !== "explore") return;
    const pos = new Phaser.Math.Vector2(this.mover.x, this.mover.y);
    const enc = this.encounters.update(pos, this.state);
    if (enc) {
      this.startDialogue(
        [
          ...enc.introMessages.map((text) => ({ speaker: "NARRATOR", text })),
          { speaker: "DAD'S BRAIN", text: getDadBrainLine("battle") },
          { speaker: "DAD", text: getDadLine("toEnemy", "battleStart") },
        ],
        () => this.startBattle(enc.enemy.id),
      );
    }
  }

  // ── Interaction ──────────────────────────────────────────────────────────

  private handleInteract(): void {
    if (this.mode === "dialogue") { this.advanceDialogue(); return; }
    if (this.mode === "battle")   { this.handleBattleTurn(); return; }

    const dadX = this.mover.x;
    const dadY = this.mover.y;
    const dist = (a: { x: number; y: number }) => Math.hypot(dadX - a.x, dadY - a.y);

    if (MAP[this.mover.row]?.[this.mover.col] === X) {
      this.scene.start("NeighborhoodScene", { spawn: "bathroom" });
      return;
    }

    if (dist(TOILET_PX) < TOILET_RADIUS) {
      this.interactWithToilet();
      return;
    }

    if (dist(LINEN_PX) < LINEN_RADIUS) {
      this.interactWithLinenCloset();
      return;
    }

    if (dist(DUCK_PX) < DUCK_RADIUS) {
      this.interactWithShowerCurtain();
      return;
    }

    if (dist(SINK_PX) < SINK_RADIUS) {
      this.startDialogue([
        { speaker: "NARRATOR", text: "The sink drips. It has always dripped. It will outlive everyone in this house." },
      ]);
      return;
    }

    this.startDialogue([
      { speaker: "NARRATOR", text: "The bathroom holds its breath, which is generous given the smell." },
    ]);
  }

  private interactWithToilet(): void {
    if (!this.state.flags.toiletInspected) {
      this.state.flags.toiletInspected = true;
      completeQuestStep(this.state, "inspect-toilet");
      setActiveQuestStep(this.state, "defeat-clogged-toilet");
      saveGameState(this.state);
      this.updateQuestText();
    }

    if (this.state.flags.clogBossDefeated) {
      this.startDialogue([
        { speaker: "NARRATOR", text: "The toilet flushes proudly. Order has been restored to this small porcelain kingdom." },
      ]);
      return;
    }

    if (!this.state.flags.ownsPlunger) {
      this.startDialogue([
        { speaker: "NARRATOR",   text: "The clog gurgles ominously. Dad's bare hands are not going to be enough this time." },
        { speaker: "DAD'S BRAIN", text: "We need a plunger. A real one. THEE Home Depot has what we need." },
      ]);
      return;
    }

    this.startDialogue(
      [
        { speaker: "NARRATOR",   text: "The Clogged Toilet rumbles, sensing the plunger in Dad's hand." },
        { speaker: "DAD",        text: "We're gonna need a bigger plunger." },
        { speaker: "DAD'S BRAIN", text: getDadBrainLine("battle") },
        { speaker: "DAD",        text: getDadLine("toEnemy", "battleStart") },
      ],
      () => this.startBattle("clogged-toilet"),
    );
  }

  private interactWithLinenCloset(): void {
    if (this.state.flags.toiletPaperFound) {
      this.startDialogue([
        { speaker: "NARRATOR", text: "The linen closet is fully stocked. The quilted double-ply stands tall and trustworthy." },
      ]);
      return;
    }

    this.state.flags.toiletPaperFound = true;
    this.state.player.cash += 3;
    saveGameState(this.state);

    this.startDialogue([
      { speaker: "NARRATOR",   text: "Dad opens the linen closet. A lone roll of single-ply teeters on the shelf, thin and untrustworthy." },
      { speaker: "DAD",        text: "Gotta get that quilted double-ply." },
      { speaker: "DAD'S BRAIN", text: "Single-ply might not stick to the bottom. It has shady ulterior motives. No one can trust it. It leaves you hurtin'." },
      { speaker: "NARRATOR",   text: "Behind it: a fresh twelve-pack of quilted double-ply, hoarded for exactly this emergency." },
      { speaker: "SYSTEM",     text: "Dad restocked the toilet paper. +3 Love Points." },
    ]);
  }

  private interactWithShowerCurtain(): void {
    if (this.state.flags.rubberDuckFound) {
      this.startDialogue([
        { speaker: "NARRATOR", text: "The shower curtain hangs there, fully accounted for. No more ducks to find." },
      ]);
      return;
    }

    this.state.flags.rubberDuckFound = true;
    this.state.player.cash += 5;
    const levelUp = applyExperienceAndLevelUps(this.state, 3);
    saveGameState(this.state);

    this.startDialogue([
      { speaker: "NARRATOR",   text: "Dad pulls back the shower curtain. Something small and yellow stares back." },
      { speaker: "DAD",        text: "There you are." },
      { speaker: "NARRATOR",   text: "The kids' missing rubber ducky. Last seen during an incident Dad has chosen not to remember." },
      { speaker: "DAD'S BRAIN", text: "Find that so the kids can be happy. Also so that Ernie's stupid song stops running through your head." },
      { speaker: "DAD",        text: "Rubber Duckie, you're the one... no. NO. Get out of my head." },
      { speaker: "SYSTEM",     text: `Dad found the RUBBER DUCKY! +5 Love Points. +3 XP.${levelUp.message ? `\n${levelUp.message}` : ""}` },
    ]);
  }

  // ── Dialogue ─────────────────────────────────────────────────────────────

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
    this.dialogueBox.show(line.text, line.speaker === "DAD" ? (this.state.player.name || "DAD") : line.speaker);
  }

  // ── Battle ───────────────────────────────────────────────────────────────

  private startBossMusicSwap(): void {
    if (this.bossMusicActive) return;
    this.bossMusicActive = true;
    this.bgMusic?.stop();
    const bossMusic = this.sound.add("mini-boss", { loop: true, volume: 0.45 });
    bossMusic.play();
    this.bgMusic = bossMusic;
  }

  private stopBossMusicSwap(): void {
    if (!this.bossMusicActive) return;
    this.bossMusicActive = false;
    this.bgMusic?.stop();
    this.bgMusic = this.sound.add("dramatic-bg", { loop: true, volume: 0.4 });
    this.bgMusic.play();
  }

  private startBattle(enemyId: string): void {
    const enemy = enemies.find((e) => e.id === enemyId);
    if (!enemy) return;
    this.activeEnemyId = enemyId;
    if (enemyId === "clogged-toilet") this.startBossMusicSwap();
    const snap = this.battle.start(enemy, this.state);
    this.mode = "battle";
    this.battlePhase = "command";
    this.selectedCommand = 0;
    this.updateQuestText();
    this.showBattleUi(snap);

    if (snap.ambushed && snap.message) {
      this.battlePhase = "enemyResult";
      this.showMessage(getDadMovieQuote("ambush"), "DAD");
      if (snap.defeated) this.handleDefeat(snap.message);
      return;
    }
    this.showMessage(this.formatSnap(), "BATTLE");
    this.showCommandMenu();
  }

  private handleBattleTurn(): void {
    if (this.dialogueBox.advance() !== "done") return;

    if (this.battlePhase === "enemyResult") {
      this.battlePhase = "command";
      const snap = this.battle.getSnapshot(this.state);
      this.updateBattlePanels(snap);
      this.showMessage(this.formatSnap(), "BATTLE");
      this.showCommandMenu();
      return;
    }

    if (this.battlePhase === "playerResult") {
      const res = this.battle.useEnemyTurn(this.state);
      this.battlePhase = "enemyResult";
      this.updateBattlePanels(res);
      if (res.defeated) { this.handleDefeat(res.message); return; }
      const mood = res.heroHp <= res.heroMaxHp * 0.3 ? "lowHp" : "takingDamage";
      const isBoss = this.activeEnemyId === "clogged-toilet";
      const colorCommentary = isBoss ? getEnemyBanter("cloggedToilet") : getDadCombatLine(mood);
      this.showMessage(`${res.message}\n${colorCommentary}`, "BATTLE");
      return;
    }

    const cmd = BATTLE_COMMANDS[this.selectedCommand];
    const res = this.resolveCommand(cmd);
    this.updateBattlePanels(res);

    if (res.victory) { this.hideCommandMenu(); this.handleVictory(res.message); return; }
    if (res.escaped) {
      this.stopBossMusicSwap();
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
    if (this.activeEnemyId !== "clogged-toilet") {
      this.startDialogue([
        { speaker: "BATTLE",     text: msg },
        { speaker: "DAD'S BRAIN", text: getDadBrainLine("victory") },
        { speaker: "DAD",        text: getDadLine("selfTalk", "victory") },
      ], () => { this.hideBattleUi(); this.mode = "explore"; this.dialogueBox.hide(); });
      return;
    }

    // Clogged Toilet boss victory
    this.stopBossMusicSwap();
    this.state.flags.clogBossDefeated = true;
    this.toiletSprite.setTexture("dryer-fixed");
    completeQuestStep(this.state, "defeat-clogged-toilet");
    setActiveQuestStep(this.state, "mop-up");
    saveGameState(this.state);
    this.updateQuestText("VICTORY");

    this.startDialogue([
      { speaker: "BATTLE",     text: msg },
      { speaker: "DAD'S BRAIN", text: getDadBrainLine("victory") },
      { speaker: "DAD",        text: getDadLine("selfTalk", "victory") },
      { speaker: "DAD",        text: "That'll do, toilet. That'll do." },
      { speaker: "NARRATOR",   text: "The toilet flushes clean. Somewhere, plumbing angels sing." },
    ], () => {
      this.hideBattleUi();
      this.scene.start("NeighborhoodScene", { spawn: "bathroom" });
    });
  }

  private handleDefeat(msg: string): void {
    this.stopBossMusicSwap();
    this.hideCommandMenu();
    this.startDialogue(
      [
        { speaker: "BATTLE",   text: msg },
        { speaker: "NARRATOR", text: "Everything goes white, then beige, then suspiciously recliner-shaped." },
        { speaker: "WIFE",     text: "Why are you in the chair? The toilet is still clogged." },
      ],
      () => {
        this.hideBattleUi();
        this.state.player.hp = this.state.player.maxHp;
        this.state.player.dadPoints = this.state.player.maxDadPoints;
        this.state.player.cash = Math.max(0, this.state.player.cash - 2);
        this.scene.start("NeighborhoodScene", { spawn: "bathroom" });
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

  private formatSnap(): string { return "Command?"; }

  // ── Battle UI ────────────────────────────────────────────────────────────

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

    this.commandBox = this.add.rectangle(256, 58, 120, 58, 0x111827, 0.94).setStrokeStyle(2, 0xf8fafc).setVisible(false).setScrollFactor(0);
    this.commandText = addPixelText(this, 204, 38, "", 7).setVisible(false).setScrollFactor(0);
  }

  private showBattleUi(snap: { enemy: { id: string; name: string; battleTexture?: string }; enemyHp: number; enemyMaxHp: number; heroHp: number; heroMaxHp: number }): void {
    const isBoss = snap.enemy.id === "clogged-toilet";
    this.battleEnemyBox.setFillStyle(isBoss ? 0x1e3a5f : 0x65a30d).setVisible(true);
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
      const isBoss = snap.enemy.id === "clogged-toilet";
      const sw = isBoss ? 48 : 42;
      const sh = isBoss ? 42 : 42;
      const sy = isBoss ? 95 : 92;
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

  private updateQuestText(prefix?: string): void {
    const label = prefix
      ? `${prefix} - ${getQuestStepLabel(this.state.quest.questId, this.state.quest.activeStepId)}`
      : `BATHROOM - ${getQuestStepLabel(this.state.quest.questId, this.state.quest.activeStepId)}`;
    setPixelText(this.questText, label);
  }

  private updateQuestPrompt(): void {
    const visible = this.questKey.isDown;
    this.questBox.setVisible(visible);
    this.questText.setVisible(visible);
  }
}
