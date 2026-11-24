/**
 * FieldKit: everything a walkable scene shares.
 * ─────────────────────────────────────────────────────────────────────────────
 * A field scene (house, garage, basement, ...) owns its map art, collision and
 * exits. FieldKit owns the rest: dialogue box, menu, quest bar (hold Q), stats
 * panel, chest sprites, hotspots, random encounters, battles, and running the
 * quest event scripts from src/data.
 *
 * Usage in a scene:
 *   create():  this.kit = new FieldKit(this, { areaId: "garage", mover: () => this.mover });
 *              ...draw map, place mover...
 *              this.kit.create();
 *   update():  if (!this.kit.update(delta)) return;  // then move the player
 *   onLand():  this.kit.onStep();
 */
import Phaser from "phaser";
import { getArea, type AreaDefinition } from "./content";
import { installDevShortcuts } from "./devShortcuts";
import { DialogueBox } from "./DialogueBox";
import { matches } from "./engine/conditions";
import {
  expandLines,
  hasEvent,
  ScriptRunner,
  type Action,
  type BattleOutcome,
  type DialogueLine,
  type HotspotDefinition,
  type ScriptHost,
  voiceLine,
} from "./engine/script";
import { RandomEncounterTracker } from "./EncounterManager";
import { GameMenu } from "./GameMenu";
import { PlayerStatsPanel } from "./PlayerStatsPanel";
import { getQuest, getQuestStepLabel } from "./quests";
import { getGameState, saveGameState } from "./session";
import type { GameState } from "./state";
import { addPixelText, setPixelText } from "./uiText";
import type { BattleSceneData } from "../scenes/BattleScene";

const TILE = 16;
const OPEN_CHEST_FRAME = 12;

export interface FieldMover {
  x: number;
  y: number;
  col: number;
  row: number;
  isMoving: boolean;
}

export interface FieldKitOptions {
  areaId: string;
  mover: () => FieldMover;
  /** Show the idle stats panel (dungeons). */
  statsPanel?: boolean;
  /** Redraw scene-owned sprites after state changes. */
  onRefresh?: () => void;
  /** Scene-owned hotspot behavior (e.g. a shop menu). Return true when handled. */
  onHotspot?: (id: string) => boolean;
}

export class FieldKit implements ScriptHost {
  readonly areaId: string;
  readonly area: AreaDefinition;
  state!: GameState;
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  interactKey!: Phaser.Input.Keyboard.Key;

  private questKey!: Phaser.Input.Keyboard.Key;
  private dialogueBox!: DialogueBox;
  private menu!: GameMenu;
  private stats?: PlayerStatsPanel;
  private questBox!: Phaser.GameObjects.Rectangle;
  private questText!: Phaser.GameObjects.BitmapText;
  private hudPrefix: string | null = null;
  private readonly runner: ScriptRunner;
  private readonly encounters?: RandomEncounterTracker;
  private readonly chestSprites = new Map<string, Phaser.GameObjects.Image>();

  private sayQueue: DialogueLine[] = [];
  private resolveSay?: () => void;
  private busy = 0;
  private inBattle = false;
  private leaving = false;

  constructor(private readonly scene: Phaser.Scene, private readonly options: FieldKitOptions) {
    this.areaId = options.areaId;
    this.area = getArea(options.areaId);
    this.runner = new ScriptRunner(this);
    if (this.area.randomEncounters) this.encounters = new RandomEncounterTracker(options.areaId);
  }

  /** Call after the map is drawn so the UI sits on top. */
  create(): void {
    const scene = this.scene;
    installDevShortcuts(scene);
    this.state = getGameState();
    this.busy = 0;
    this.inBattle = false;
    this.leaving = false;
    this.hudPrefix = null;

    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.interactKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.questKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

    this.drawChests();

    this.questBox = scene.add.rectangle(8, 8, 260, 16, 0xfacc15)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(90).setVisible(false);
    this.questText = addPixelText(scene, 12, 11, "", 8)
      .setTint(0x111827).setScrollFactor(0).setDepth(91).setVisible(false);
    this.dialogueBox = new DialogueBox(scene);
    if (this.options.statsPanel) this.stats = new PlayerStatsPanel(scene);
    this.menu = new GameMenu(scene, () => this.state);

    // Keys pressed during a battle must not leak into the field on resume.
    scene.events.on(Phaser.Scenes.Events.RESUME, () => scene.input.keyboard?.resetKeys());
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.RESUME);
      this.resolveSay = undefined;
    });

    this.refresh();
  }

  /** Runs the area's "enter" event if it has one. */
  enter(): void {
    void this.run("enter");
  }

  /**
   * Per-frame UI work. Returns true when the player may walk this frame.
   */
  update(delta: number): boolean {
    this.dialogueBox.update(delta);
    const showQuest = this.questKey.isDown;
    this.questBox.setVisible(showQuest);
    this.questText.setVisible(showQuest);

    if (this.leaving || this.inBattle) return false;

    this.menu.update();
    if (this.menu.isOpen()) {
      this.stats?.hide();
      return false;
    }

    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      if (this.resolveSay) {
        this.advanceSay();
      } else if (this.busy === 0) {
        this.interact();
      }
    }

    const canMove = this.busy === 0 && !this.resolveSay;
    if (!canMove) {
      this.stats?.hide();
      return false;
    }

    const mover = this.options.mover();
    this.stats?.update(delta, !mover.isMoving, this.state);
    return true;
  }

  get isIdle(): boolean {
    return this.busy === 0 && !this.resolveSay && !this.inBattle && !this.leaving;
  }

  /** Solid hotspot tiles (chests, the toilet). */
  isBlocked(col: number, row: number): boolean {
    return (this.area.hotspots ?? []).some((spot) =>
      spot.solid && spot.col === col && spot.row === row && matches(this.state, spot.when));
  }

  /** Space pressed while exploring. */
  interact(): void {
    const spot = this.findHotspot();
    if (spot) {
      if (this.options.onHotspot?.(spot.id)) return;
      void this.run(spot.id);
      return;
    }
    void this.run("default");
  }

  findHotspot(): HotspotDefinition | undefined {
    const mover = this.options.mover();
    return (this.area.hotspots ?? []).find((spot) => {
      if (!matches(this.state, spot.when)) return false;
      if (spot.adjacent) {
        return Math.abs(mover.col - spot.col) + Math.abs(mover.row - spot.row) === 1;
      }
      const cx = spot.col * TILE + TILE / 2;
      const cy = spot.row * TILE + TILE / 2;
      return Math.hypot(mover.x - cx, mover.y - cy) < (spot.radius ?? 2) * TILE;
    });
  }

  /** Runs an event by key. Resolves false when it does not exist. */
  async run(key: string): Promise<boolean> {
    if (!hasEvent(this.state, this.areaId, key)) return false;
    this.busy += 1;
    try {
      return await this.runner.runEvent(key);
    } finally {
      this.endScript();
    }
  }

  async runActions(actions: Action[]): Promise<void> {
    this.busy += 1;
    try {
      await this.runner.runActions(actions);
    } finally {
      this.endScript();
    }
  }

  /** Call when Dad lands on a tile. Rolls random encounters. */
  onStep(): void {
    if (!this.encounters || !this.isIdle) return;
    const mover = this.options.mover();
    const encounter = this.encounters.update({ x: mover.x, y: mover.y, col: mover.col, row: mover.row }, this.state);
    if (!encounter) return;

    const mood = encounter.enemy.battleStartMood ?? "battleStart";
    void (async () => {
      this.busy += 1;
      try {
        await this.say([
          ...encounter.introMessages.map((text) => ({ speaker: "NARRATOR", text })),
          { speaker: "DAD'S BRAIN", text: voiceLine("brain:battle") },
          { speaker: "DAD", text: voiceLine(`dad:toEnemy:${mood}`) },
        ]);
        const outcome = await this.battle(encounter.enemy.id);
        if (outcome === "defeat") {
          this.goto(this.area.returnTo.scene, this.area.returnTo.spawn);
        } else if (outcome === "escape") {
          const pos = this.options.mover();
          this.encounters?.resetPosition({ x: pos.x, y: pos.y });
        }
      } finally {
        this.endScript();
      }
    })();
  }

  // ── ScriptHost ─────────────────────────────────────────────────────────────

  say(lines: DialogueLine[]): Promise<void> {
    if (lines.length === 0) return Promise.resolve();
    this.sayQueue = [...lines];
    this.showLine(this.sayQueue.shift()!);
    return new Promise((resolve) => { this.resolveSay = resolve; });
  }

  battle(enemyId: string): Promise<BattleOutcome> {
    this.inBattle = true;
    this.stats?.hide();
    this.dialogueBox.hide();
    const sceneKey = this.scene.scene.key;

    return new Promise((resolve) => {
      const data: BattleSceneData = {
        enemyId,
        areaId: this.areaId,
        returnScene: sceneKey,
        defeatLines: this.defeatLines(),
        onDone: (outcome) => {
          this.inBattle = false;
          this.refresh();
          resolve(outcome);
        },
      };
      this.scene.scene.launch("BattleScene", data);
      this.scene.scene.bringToTop("BattleScene");
      this.scene.scene.pause();
    });
  }

  goto(sceneKey: string, spawn?: string): void {
    this.leaving = true;
    saveGameState(this.state);
    this.scene.scene.start(sceneKey, spawn ? { spawn } : undefined);
  }

  setHud(prefix: string | null): void {
    this.hudPrefix = prefix;
    this.renderHud();
  }

  refresh(): void {
    this.renderHud();
    this.refreshChests();
    this.options.onRefresh?.();
  }

  save(): void {
    saveGameState(this.state);
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private endScript(): void {
    this.busy = Math.max(0, this.busy - 1);
    if (this.busy === 0 && !this.leaving) {
      this.dialogueBox.hide();
      saveGameState(this.state);
      this.refresh();
    }
  }

  private advanceSay(): void {
    if (this.dialogueBox.advance() !== "done") return;
    const next = this.sayQueue.shift();
    if (next) {
      this.showLine(next);
      return;
    }
    const resolve = this.resolveSay;
    this.resolveSay = undefined;
    resolve?.();
  }

  private showLine(line: DialogueLine): void {
    const label = line.speaker === "DAD" ? (this.state.player.name || "DAD") : line.speaker;
    this.dialogueBox.show(line.text, label, line.speaker);
  }

  private defeatLines(): DialogueLine[] {
    const defeat = getQuest(this.state.quest.questId).defeat;
    if (!defeat) return [];
    const lines = expandLines(defeat.lines, this.state);
    const hint = defeat.hints?.find((candidate) => matches(this.state, candidate.when));
    if (hint) lines.push({ speaker: "DAD'S BRAIN", text: hint.text });
    return lines;
  }

  private renderHud(): void {
    if (!this.questText) return;
    const quest = getQuest(this.state.quest.questId);
    const stepLabel = getQuestStepLabel(quest.id, this.state.quest.activeStepId);
    const base = this.area.hud === "countdown" ? quest.countdownLabel : this.area.hud ?? this.area.label.toUpperCase();
    setPixelText(this.questText, `${this.hudPrefix ?? base} - ${stepLabel}`);
  }

  private drawChests(): void {
    this.chestSprites.clear();
    for (const spot of this.area.hotspots ?? []) {
      if (!spot.chest) continue;
      const sprite = this.scene.add.image(spot.col * TILE + TILE / 2, spot.row * TILE + TILE / 2, "chests")
        .setDisplaySize(TILE, TILE);
      this.chestSprites.set(spot.id, sprite);
    }
  }

  private refreshChests(): void {
    for (const spot of this.area.hotspots ?? []) {
      const sprite = spot.chest && this.chestSprites.get(spot.id);
      if (!sprite || !spot.chest) continue;
      const opened = this.isOpened(spot.chest);
      sprite.setFrame(opened ? OPEN_CHEST_FRAME : spot.chest.frame);
      if (opened || !spot.chest.tint) sprite.clearTint();
      else sprite.setTint(Phaser.Display.Color.HexStringToColor(spot.chest.tint).color);
    }
  }

  private isOpened(chest: NonNullable<HotspotDefinition["chest"]>): boolean {
    return this.state.openedChestIds.includes(chest.id) || Boolean(chest.flag && this.state.flags[chest.flag]);
  }
}
