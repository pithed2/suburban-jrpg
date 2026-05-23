import Phaser from "phaser";
import { BattleManager } from "../game/BattleManager";
import { dialogue, enemies } from "../game/content";
import { DialogueRunner } from "../game/DialogueRunner";
import { RandomEncounterTracker } from "../game/EncounterManager";
import { isNear } from "../game/interaction";
import { getQuestStepLabel } from "../game/quests";
import { getGameState } from "../game/session";
import { addWorldSprite, spriteFrames } from "../game/sprites";
import { getMapObjectCenter } from "../game/tilemapObjects";
import { addPixelText, setPixelText } from "../game/uiText";
import {
  completeQuestStep,
  setActiveQuestStep,
  type GameState,
} from "../game/state";

type BasementMode = "explore" | "dialogue" | "battle";
type BattleCommand = "Fight" | "Dad Skills" | "Items" | "Run";
type BattlePhase = "command" | "playerResult" | "enemyResult";

const battleCommands: BattleCommand[] = ["Fight", "Dad Skills", "Items", "Run"];

export class BasementScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private player!: Phaser.GameObjects.Rectangle;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private exit!: Phaser.GameObjects.Rectangle;
  private dustBunny!: Phaser.GameObjects.Rectangle;
  private dustBunnySprite!: Phaser.GameObjects.Sprite;
  private dustLabel!: Phaser.GameObjects.Text;
  private coil!: Phaser.GameObjects.Rectangle;
  private coilSprite!: Phaser.GameObjects.Sprite;
  private questText!: Phaser.GameObjects.Text;
  private messageBox!: Phaser.GameObjects.Rectangle;
  private messageText!: Phaser.GameObjects.Text;
  private commandBox!: Phaser.GameObjects.Rectangle;
  private commandText!: Phaser.GameObjects.Text;
  private mode: BasementMode = "explore";
  private battlePhase: BattlePhase = "command";
  private selectedCommandIndex = 0;
  private state!: GameState;
  private readonly dialogueRunner = new DialogueRunner();
  private readonly battle = new BattleManager();
  private readonly randomEncounters = new RandomEncounterTracker("basement");
  private activeEnemyId = "evil-heating-coil";
  private readonly dustBunnyEnemy = enemies.find((candidate) => candidate.id === "dust-bunny");
  private readonly coilEnemy = enemies.find((candidate) => candidate.id === "evil-heating-coil");

  constructor() {
    super("BasementScene");
  }

  create(): void {
    if (!this.dustBunnyEnemy) {
      throw new Error("Missing enemy definition: dust-bunny");
    }

    if (!this.coilEnemy) {
      throw new Error("Missing enemy definition: evil-heating-coil");
    }

    this.state = getGameState();
    this.mode = "explore";
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.createWorld();
    this.createUi();
    this.updateQuestText("BASEMENT");

    if (!this.state.flags.bossDefeated) {
      this.startDialogue(dialogue.basementIntro);
    }
  }

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.handleInteract();
    }

    if (this.mode === "battle" && this.battlePhase === "command") {
      this.updateBattleMenuSelection();
      return;
    }

    if (this.mode !== "explore") {
      return;
    }

    const speed = 1.2;
    let dx = 0;
    let dy = 0;

    if (this.cursors.left.isDown) dx -= speed;
    if (this.cursors.right.isDown) dx += speed;
    if (this.cursors.up.isDown) dy -= speed;
    if (this.cursors.down.isDown) dy += speed;

    this.player.x = Phaser.Math.Clamp(this.player.x + dx, 18, 302);
    this.player.y = Phaser.Math.Clamp(this.player.y + dy, 40, 160);
    this.playerSprite.setPosition(this.player.x, this.player.y);

    if (dx !== 0 || dy !== 0) {
      this.checkRandomEncounter();
    }
  }

  private createWorld(): void {
    const map = this.make.tilemap({ key: "basement-map" });
    const tileset = map.addTilesetImage("suburban-placeholder", "suburban-placeholder");

    if (!tileset) {
      throw new Error("Missing tileset for basement map.");
    }

    map.createLayer("Ground", tileset, 0, 0);
    map.createLayer("Props", tileset, 0, 0);

    const spawn = getMapObjectCenter(map, "Objects", "player-spawn");
    const exit = getMapObjectCenter(map, "Objects", "basement-exit");
    const coil = getMapObjectCenter(map, "Objects", "heating-coil");

    this.exit = this.add.rectangle(exit.x, exit.y, 28, 18, 0xffffff, 0);
    this.dustBunny = this.add.rectangle(148, 126, 18, 12, 0xffffff, 0);
    this.coil = this.add.rectangle(coil.x, coil.y, 24, 20, 0xffffff, 0);
    this.player = this.add.rectangle(spawn.x, spawn.y, 14, 18, 0xffffff, 0);
    addWorldSprite(this, exit.x, exit.y, spriteFrames.stairs);
    this.dustBunnySprite = addWorldSprite(this, 148, 126, spriteFrames.dustBunny);
    this.coilSprite = addWorldSprite(this, coil.x, coil.y, spriteFrames.heatingCoil);
    this.playerSprite = addWorldSprite(this, this.player.x, this.player.y, spriteFrames.dad);

    addPixelText(this, exit.x - 10, exit.y + 11, "STAIRS", 6);
    this.dustLabel = addPixelText(this, 132, 137, "DUST", 6);
    addPixelText(this, coil.x - 15, coil.y + 14, "COIL", 6);
    addPixelText(this, spawn.x - 9, spawn.y - 15, "DAD", 6);

    this.updateDustBunnyVisibility();
    this.randomEncounters.resetPosition(new Phaser.Math.Vector2(this.player.x, this.player.y));
  }

  private createUi(): void {
    this.add.rectangle(8, 8, 236, 16, 0xfacc15).setOrigin(0, 0);
    this.questText = addPixelText(this, 12, 11, "", 8).setTint(0x111827);

    this.messageBox = this.add.rectangle(160, 150, 304, 50, 0x111827, 0.94)
      .setStrokeStyle(2, 0xf8fafc)
      .setVisible(false);

    this.messageText = addPixelText(this, 16, 132, "", 7)
      .setWordWrapWidth(288)
      .setVisible(false);

    this.commandBox = this.add.rectangle(208, 106, 96, 42, 0x111827, 0.94)
      .setStrokeStyle(2, 0xf8fafc)
      .setVisible(false);
    this.commandText = addPixelText(this, 212, 110, "", 7).setVisible(false);
  }

  private handleInteract(): void {
    if (this.mode === "dialogue") {
      this.advanceDialogue();
      return;
    }

    if (this.mode === "battle") {
      this.handleBattleTurn();
      return;
    }

    const playerPosition = new Phaser.Math.Vector2(this.player.x, this.player.y);

    if (isNear(playerPosition, new Phaser.Math.Vector2(this.exit.x, this.exit.y), 24)) {
      this.startDialogue(dialogue.basementExit, () => this.scene.start("NeighborhoodScene"));
      return;
    }

    if (isNear(playerPosition, new Phaser.Math.Vector2(this.coil.x, this.coil.y), 28)) {
      if (this.state.flags.bossDefeated) {
        this.startDialogue(["The heating coil is quiet now. Almost smugly quiet."]);
        return;
      }

      if (!this.state.flags.foundWrench) {
        setActiveQuestStep(this.state, "find-wrench");
        this.updateQuestText("BASEMENT");
        this.startDialogue([
          "Dad sizes up the coil with his bare hands.",
          "Nope. This is a wrench problem.",
          "The garage waits. Unfortunately.",
        ], () => this.scene.start("NeighborhoodScene"));
        return;
      }

      this.startDialogue(dialogue.battleIntro, () => this.startBattle("evil-heating-coil"));
      return;
    }

    this.startDialogue(["The basement smells like cardboard, old paint, and obligation."]);
  }

  private startDialogue(lines: string[], onComplete?: () => void): void {
    this.mode = "dialogue";
    this.showMessage(this.dialogueRunner.start(lines, onComplete));
  }

  private advanceDialogue(): void {
    const next = this.dialogueRunner.advance();

    if (next) {
      this.showMessage(next);
      return;
    }

    if (this.mode === "dialogue") {
      this.mode = "explore";
      this.hideMessage();
    }
  }

  private startBattle(enemyId: string): void {
    this.activeEnemyId = enemyId;
    const enemy = enemies.find((candidate) => candidate.id === enemyId);

    if (!enemy) {
      throw new Error(`Missing enemy definition: ${enemyId}`);
    }

    const snapshot = this.battle.start(enemy, this.state);
    this.mode = "battle";
    this.battlePhase = "command";
    this.selectedCommandIndex = 0;
    this.updateQuestText("BATTLE");

    if (snapshot.ambushed && snapshot.message) {
      this.battlePhase = "enemyResult";
      this.showMessage(`${snapshot.message}\nDad HP ${snapshot.heroHp}/${snapshot.heroMaxHp}`);
      return;
    }

    this.showMessage(this.formatBattleSnapshot(snapshot));
    this.showBattleMenu();
  }

  private handleBattleTurn(): void {
    if (this.battlePhase === "enemyResult") {
      this.battlePhase = "command";
      this.showMessage(this.formatBattleSnapshot(this.battle.getSnapshot(this.state)));
      this.showBattleMenu();
      return;
    }

    if (this.battlePhase === "playerResult") {
      const enemyResult = this.battle.useEnemyTurn(this.state);
      this.battlePhase = "enemyResult";
      this.showMessage(`${enemyResult.message}\nDad HP ${enemyResult.heroHp}/${enemyResult.heroMaxHp}`);
      return;
    }

    const command = battleCommands[this.selectedCommandIndex];
    const result = this.resolveBattleCommand(command);

    if (result.victory) {
      this.hideBattleMenu();
      this.handleBattleVictory(result.message);
      return;
    }

    this.battlePhase = "playerResult";
    this.hideBattleMenu();
    this.showMessage(`${result.message}\n${result.enemy.name} HP ${result.enemyHp}/${result.enemyMaxHp}`);
  }

  private handleBattleVictory(resultMessage: string): void {
    if (this.activeEnemyId === "dust-bunny") {
      this.updateQuestText("BASEMENT");
      this.startDialogue([resultMessage, "The basement briefly seems less judgmental."], () => {
        this.mode = "explore";
        this.hideMessage();
      });
      return;
    }

    this.state.flags.bossDefeated = true;
    completeQuestStep(this.state, "defeat-heating-coil");
    setActiveQuestStep(this.state, "return-to-wife");
    this.updateQuestText("VICTORY");
    this.startDialogue([resultMessage, "The vent stops rattling. Upstairs, a towel may yet become dry."], () => {
      this.scene.start("NeighborhoodScene");
    });
  }

  private resolveBattleCommand(command: BattleCommand) {
    if (command === "Fight") {
      return this.battle.useFight(this.state);
    }

    if (command === "Dad Skills") {
      return this.battle.useDadSkill(this.state);
    }

    if (command === "Items") {
      return this.battle.useItem(this.state, "ibuprofen");
    }

    return this.battle.useRun(this.state);
  }

  private updateBattleMenuSelection(): void {
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
      this.selectedCommandIndex = Phaser.Math.Wrap(
        this.selectedCommandIndex - 1,
        0,
        battleCommands.length,
      );
      this.showBattleMenu();
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
      this.selectedCommandIndex = Phaser.Math.Wrap(
        this.selectedCommandIndex + 1,
        0,
        battleCommands.length,
      );
      this.showBattleMenu();
    }
  }

  private showBattleMenu(): void {
    const menu = battleCommands
      .map((command, index) => `${index === this.selectedCommandIndex ? ">" : " "} ${command}`)
      .join("\n");

    this.commandBox.setVisible(true);
    setPixelText(this.commandText, menu);
    this.commandText.setVisible(true);
  }

  private hideBattleMenu(): void {
    this.commandBox.setVisible(false);
    this.commandText.setVisible(false);
  }

  private updateDustBunnyVisibility(): void {
    const visible = false;
    this.dustBunny.setVisible(visible);
    this.dustBunnySprite.setVisible(visible);
    this.dustLabel.setVisible(visible);
  }

  private checkRandomEncounter(): void {
    const encounter = this.randomEncounters.update(
      new Phaser.Math.Vector2(this.player.x, this.player.y),
      this.state,
    );

    if (!encounter) {
      return;
    }

    this.startDialogue(encounter.introMessages, () => this.startBattle(encounter.enemy.id));
  }

  private formatBattleSnapshot(snapshot: {
    enemy: { name: string };
    enemyHp: number;
    enemyMaxHp: number;
    heroHp: number;
    heroMaxHp: number;
  }): string {
    return `${snapshot.enemy.name} HP ${snapshot.enemyHp}/${snapshot.enemyMaxHp}\nDad HP ${snapshot.heroHp}/${snapshot.heroMaxHp}`;
  }

  private updateQuestText(prefix: string): void {
    setPixelText(
      this.questText,
      `${prefix} - ${getQuestStepLabel(this.state.quest.questId, this.state.quest.activeStepId)}`,
    );
  }

  private showMessage(message: string): void {
    this.messageBox.setVisible(true);
    setPixelText(this.messageText, message);
    this.messageText.setVisible(true);
  }

  private hideMessage(): void {
    this.dialogueRunner.clear();
    this.messageBox.setVisible(false);
    this.messageText.setVisible(false);
  }

}
