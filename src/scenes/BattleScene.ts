/**
 * BattleScene: the one battle screen every encounter uses.
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs on top of the paused field scene, Dragon Warrior style: the map stays
 * visible behind a status window (left), the enemy window (center), the
 * command window (right) and the message window (bottom).
 *
 * Start it with launchBattle() from src/game/FieldKit.ts. All turn math lives in
 * BattleManager. All enemy look, music and banter comes from enemies.json.
 */
import Phaser from "phaser";
import { loadAudioOnce } from "../game/audioAssets";
import { BattleManager, type BattleSnapshot } from "../game/BattleManager";
import { getArea, getEnemy, getItem, type EnemyDefinition } from "../game/content";
import { getDadBrainLine, getDadCombatLine, getDadLine, getDadMovieQuote, getEnemyBanter } from "../game/dadVoice";
import { balance } from "../game/dragonWarriorMath";
import { DialogueBox } from "../game/DialogueBox";
import type { BattleOutcome, DialogueLine } from "../game/engine/script";
import { getGameState, saveGameState } from "../game/session";
import type { GameState } from "../game/state";
import { addPixelText, setPixelText } from "../game/uiText";

export interface BattleSceneData {
  enemyId: string;
  areaId: string;
  /** Scene key to resume when the battle ends. */
  returnScene: string;
  /** Lines after "Everything goes white" on a loss. */
  defeatLines: DialogueLine[];
  onDone: (outcome: BattleOutcome) => void;
}

type Command = "FIGHT" | "SKILL" | "ITEM" | "RUN";
const COMMANDS: Command[] = ["FIGHT", "SKILL", "ITEM", "RUN"];
type Phase = "idle" | "say" | "command" | "item";

const DEFAULT_BACKDROP = "#65a30d";
const DEPTH = 40; // under the DialogueBox (70+) so its speaker label stays visible

export class BattleScene extends Phaser.Scene {
  private battleData!: BattleSceneData;
  private state!: GameState;
  private enemy!: EnemyDefinition;
  private readonly battle = new BattleManager();

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private confirmKey!: Phaser.Input.Keyboard.Key;
  private cancelKey!: Phaser.Input.Keyboard.Key;
  private dialogueBox!: DialogueBox;

  private statusText!: Phaser.GameObjects.BitmapText;
  private enemyBox!: Phaser.GameObjects.Rectangle;
  private enemySprite!: Phaser.GameObjects.Image;
  private enemyText!: Phaser.GameObjects.BitmapText;
  private commandBox!: Phaser.GameObjects.Rectangle;
  private commandText!: Phaser.GameObjects.BitmapText;
  private itemBox!: Phaser.GameObjects.Rectangle;
  private itemText!: Phaser.GameObjects.BitmapText;

  private phase: Phase = "idle";
  private selectedCommand = 0;
  private selectedItem = 0;
  private itemChoices: string[] = [];
  private queue: DialogueLine[] = [];
  private resolveSay?: () => void;
  private resolveChoice?: (choice: { command: Command; itemId?: string }) => void;
  private pausedSounds: Phaser.Sound.BaseSound[] = [];
  private music?: Phaser.Sound.BaseSound;

  constructor() {
    super("BattleScene");
  }

  init(data: BattleSceneData): void {
    this.battleData = data;
    this.state = getGameState();
    this.enemy = getEnemy(data.enemyId);
    this.phase = "idle";
    this.selectedCommand = 0;
    this.queue = [];
  }

  preload(): void {
    if (this.enemy.music) {
      loadAudioOnce(this, this.enemy.music, `/assets-active/audio/${this.enemy.music}.mp3`);
    }
  }

  create(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.confirmKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.cancelKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.createWindows();
    this.dialogueBox = new DialogueBox(this);
    this.startMusic();

    void this.run();
  }

  update(_time: number, delta: number): void {
    this.dialogueBox.update(delta);
    const confirm = Phaser.Input.Keyboard.JustDown(this.confirmKey);

    if (this.phase === "say") {
      if (confirm) this.advanceSay();
      return;
    }

    if (this.phase === "command") {
      this.navigateCommands();
      if (confirm) this.chooseCommand();
      return;
    }

    if (this.phase === "item") {
      this.navigateItems();
      if (Phaser.Input.Keyboard.JustDown(this.cancelKey)) {
        this.closeItems();
        return;
      }
      if (confirm) this.chooseItem();
    }
  }

  // ── Battle loop ────────────────────────────────────────────────────────────

  private async run(): Promise<void> {
    const start = this.battle.start(this.enemy, this.state);
    this.renderPanels(start);

    if (start.modifierMessages.length > 0) {
      await this.say(start.modifierMessages.map((text) => ({ speaker: "BATTLE", text })));
    }

    if (start.ambushed && start.message) {
      if (start.defeated) {
        await this.defeat(start.message);
        return;
      }
      await this.say([
        { speaker: "AMBUSH", text: start.message },
        { speaker: "DAD", text: getDadMovieQuote("ambush") },
      ]);
    }

    for (;;) {
      const choice = await this.chooseAction();
      const result = choice.command === "FIGHT" ? this.battle.useFight(this.state)
        : choice.command === "SKILL" ? this.battle.useDadSkill(this.state)
        : choice.command === "ITEM" ? this.battle.useItem(this.state, choice.itemId)
        : this.battle.useRun(this.state);
      this.renderPanels(result);

      if (result.victory) {
        await this.say([
          { speaker: "BATTLE", text: result.message },
          { speaker: "DAD'S BRAIN", text: getDadBrainLine("victory") },
          { speaker: "DAD", text: getDadLine("selfTalk", "victory") },
        ]);
        this.finish("victory");
        return;
      }

      if (result.escaped) {
        await this.say([
          { speaker: "BATTLE", text: result.message },
          { speaker: "DAD'S BRAIN", text: getDadBrainLine("basement") },
        ]);
        this.finish("escape");
        return;
      }

      await this.say([{ speaker: "BATTLE", text: result.message }]);

      const enemyTurn = this.battle.useEnemyTurn(this.state);
      this.renderPanels(enemyTurn);

      if (enemyTurn.defeated) {
        await this.defeat(enemyTurn.message);
        return;
      }

      const banterKey = this.battle.banter;
      const mood = enemyTurn.heroHp <= enemyTurn.heroMaxHp * 0.3 ? "lowHp" : "takingDamage";
      const commentary = banterKey ? getEnemyBanter(banterKey) : getDadCombatLine(mood);
      await this.say([{ speaker: "BATTLE", text: `${enemyTurn.message}\n${commentary}` }]);
    }
  }

  private async defeat(message: string): Promise<void> {
    await this.say([
      { speaker: "BATTLE", text: message },
      { speaker: "NARRATOR", text: "Everything goes white, then beige, then suspiciously recliner-shaped." },
      ...this.battleData.defeatLines,
    ]);

    const penalty = balance.defeat;
    const player = this.state.player;
    if (penalty.restoreHp) player.hp = player.maxHp;
    if (penalty.restoreDadPoints) player.dadPoints = player.maxDadPoints;
    player.cash = Math.max(0, player.cash - penalty.cashLoss);
    saveGameState(this.state);
    this.finish("defeat");
  }

  private finish(outcome: BattleOutcome): void {
    this.phase = "idle";
    this.stopMusic();
    const { onDone, returnScene } = this.battleData;
    this.scene.resume(returnScene);
    this.scene.stop();
    onDone(outcome);
  }

  // ── Messages ───────────────────────────────────────────────────────────────

  private say(lines: DialogueLine[]): Promise<void> {
    this.hideCommands();
    this.queue = [...lines];
    this.phase = "say";
    this.showLine(this.queue.shift()!);
    return new Promise((resolve) => { this.resolveSay = resolve; });
  }

  private advanceSay(): void {
    if (this.dialogueBox.advance() !== "done") return;
    const next = this.queue.shift();
    if (next) {
      this.showLine(next);
      return;
    }
    this.phase = "idle";
    const resolve = this.resolveSay;
    this.resolveSay = undefined;
    resolve?.();
  }

  private showLine(line: DialogueLine): void {
    const label = line.speaker === "DAD" ? (this.state.player.name || "DAD") : line.speaker;
    this.dialogueBox.show(line.text, label, line.speaker);
  }

  // ── Commands ───────────────────────────────────────────────────────────────

  private chooseAction(): Promise<{ command: Command; itemId?: string }> {
    this.phase = "command";
    this.showLine({ speaker: "BATTLE", text: "Command?" });
    this.renderCommands();
    return new Promise((resolve) => { this.resolveChoice = resolve; });
  }

  private navigateCommands(): void {
    const { up, down, left, right } = this.cursors;
    const before = this.selectedCommand;
    if (Phaser.Input.Keyboard.JustDown(up)) this.selectedCommand = Phaser.Math.Wrap(this.selectedCommand - 2, 0, 4);
    if (Phaser.Input.Keyboard.JustDown(down)) this.selectedCommand = Phaser.Math.Wrap(this.selectedCommand + 2, 0, 4);
    if (Phaser.Input.Keyboard.JustDown(left)) this.selectedCommand = Phaser.Math.Wrap(this.selectedCommand - 1, 0, 4);
    if (Phaser.Input.Keyboard.JustDown(right)) this.selectedCommand = Phaser.Math.Wrap(this.selectedCommand + 1, 0, 4);
    if (before !== this.selectedCommand) this.renderCommands();
  }

  private chooseCommand(): void {
    const command = COMMANDS[this.selectedCommand];

    if (command === "ITEM") {
      this.itemChoices = this.usableItems();
      if (this.itemChoices.length > 0) {
        this.openItems();
        return;
      }
    }

    this.submit({ command });
  }

  private submit(choice: { command: Command; itemId?: string }): void {
    this.phase = "idle";
    this.hideCommands();
    const resolve = this.resolveChoice;
    this.resolveChoice = undefined;
    resolve?.(choice);
  }

  private usableItems(): string[] {
    const seen = new Set<string>();
    for (const itemId of this.state.player.inventory) {
      const item = getItem(itemId);
      if (item?.kind === "consumable") seen.add(itemId);
    }
    return [...seen];
  }

  private openItems(): void {
    this.phase = "item";
    this.selectedItem = 0;
    this.renderItems();
  }

  private closeItems(): void {
    this.itemBox.setVisible(false);
    this.itemText.setVisible(false);
    this.phase = "command";
    this.renderCommands();
  }

  private navigateItems(): void {
    const count = this.itemChoices.length + 1; // + BACK
    const before = this.selectedItem;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) this.selectedItem = Phaser.Math.Wrap(this.selectedItem - 1, 0, count);
    if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) this.selectedItem = Phaser.Math.Wrap(this.selectedItem + 1, 0, count);
    if (before !== this.selectedItem) this.renderItems();
  }

  private chooseItem(): void {
    if (this.selectedItem >= this.itemChoices.length) {
      this.closeItems();
      return;
    }
    this.submit({ command: "ITEM", itemId: this.itemChoices[this.selectedItem] });
  }

  // ── Windows ────────────────────────────────────────────────────────────────

  private createWindows(): void {
    const panel = (x: number, y: number, w: number, h: number, fill = 0x111827) =>
      this.add.rectangle(x, y, w, h, fill, 0.94).setStrokeStyle(2, 0xf8fafc).setDepth(DEPTH);

    panel(48, 78, 76, 92);
    this.statusText = addPixelText(this, 16, 38, "", 7).setDepth(DEPTH + 1);

    const view = this.enemy.battleView ?? {};
    const backdrop = view.backdrop ?? getArea(this.battleData.areaId).backdrop ?? DEFAULT_BACKDROP;
    this.enemyBox = this.add.rectangle(154, 84, 108, 62, Phaser.Display.Color.HexStringToColor(backdrop).color)
      .setStrokeStyle(2, 0xf8fafc)
      .setDepth(DEPTH);
    this.enemySprite = this.add.image(154, view.y ?? 92, this.enemy.battleTexture ?? "__MISSING")
      .setDisplaySize(view.width ?? 42, view.height ?? 42)
      .setDepth(DEPTH + 1)
      .setVisible(Boolean(this.enemy.battleTexture));
    if (view.tint) this.enemySprite.setTint(Phaser.Display.Color.HexStringToColor(view.tint).color);
    this.enemyText = addPixelText(this, 108, 56, "", 6).setMaxWidth(96).setDepth(DEPTH + 2);

    this.commandBox = panel(256, 58, 120, 58).setVisible(false);
    this.commandText = addPixelText(this, 204, 38, "", 7).setDepth(DEPTH + 1).setVisible(false);

    this.itemBox = panel(256, 58, 120, 58).setDepth(DEPTH + 2).setVisible(false);
    this.itemText = addPixelText(this, 202, 34, "", 6).setDepth(DEPTH + 3).setVisible(false);
  }

  private renderPanels(snap: BattleSnapshot): void {
    const p = this.state.player;
    setPixelText(this.statusText, `${p.name || "DAD"}\nLV ${p.level}\nHP ${snap.heroHp}/${snap.heroMaxHp}\nDP ${p.dadPoints}/${p.maxDadPoints}\nCASH ${p.cash}\nXP ${p.xp}`);
    setPixelText(this.enemyText, `${snap.enemy.name}\nHP ${snap.enemyHp}/${snap.enemyMaxHp}`);
    this.enemySprite.setAlpha(snap.enemyHp <= 0 ? 0.25 : 1);
  }

  private renderCommands(): void {
    const label = (i: number) => `${i === this.selectedCommand ? ">" : " "}${COMMANDS[i]}`;
    setPixelText(this.commandText, `${label(0).padEnd(8)} ${label(1)}\n${label(2).padEnd(8)} ${label(3)}`);
    this.commandBox.setVisible(true);
    this.commandText.setVisible(true);
  }

  private renderItems(): void {
    const counts = (itemId: string) => this.state.player.inventory.filter((id) => id === itemId).length;
    const rows = this.itemChoices.map((itemId, i) => {
      const name = (getItem(itemId)?.name ?? itemId).slice(0, 12);
      const count = counts(itemId);
      return `${i === this.selectedItem ? ">" : " "}${name}${count > 1 ? ` x${count}` : ""}`;
    });
    rows.push(`${this.selectedItem === this.itemChoices.length ? ">" : " "}BACK`);
    const height = Math.max(58, rows.length * 9 + 14);
    this.itemBox.setSize(140, height).setPosition(246, 29 + height / 2).setVisible(true);
    this.itemBox.setOrigin(0.5, 0.5);
    this.itemText.setPosition(180, 36);
    setPixelText(this.itemText, rows.join("\n"));
    this.itemText.setVisible(true);
    this.commandBox.setVisible(false);
    this.commandText.setVisible(false);
  }

  private hideCommands(): void {
    this.commandBox?.setVisible(false);
    this.commandText?.setVisible(false);
    this.itemBox?.setVisible(false);
    this.itemText?.setVisible(false);
  }

  // ── Music ──────────────────────────────────────────────────────────────────

  private startMusic(): void {
    if (!this.enemy.music || !this.cache.audio.exists(this.enemy.music)) return;
    this.pausedSounds = this.sound.getAllPlaying();
    this.pausedSounds.forEach((sound) => sound.pause());
    this.music = this.sound.add(this.enemy.music, { loop: true, volume: 0.45 });
    this.music.play();
  }

  private stopMusic(): void {
    this.music?.stop();
    this.music?.destroy();
    this.music = undefined;
    this.pausedSounds.forEach((sound) => sound.resume());
    this.pausedSounds = [];
  }
}
