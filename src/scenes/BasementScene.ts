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
  private coil!: Phaser.GameObjects.Rectangle;
  private coilSprite!: Phaser.GameObjects.Sprite;
  private questText!: Phaser.GameObjects.BitmapText;
  private messageBox!: Phaser.GameObjects.Rectangle;
  private messageText!: Phaser.GameObjects.BitmapText;
  private battleStatusBox!: Phaser.GameObjects.Rectangle;
  private battleStatusText!: Phaser.GameObjects.BitmapText;
  private battleEnemyBox!: Phaser.GameObjects.Rectangle;
  private battleEnemySprite!: Phaser.GameObjects.Sprite;
  private battleEnemyText!: Phaser.GameObjects.BitmapText;
  private commandBox!: Phaser.GameObjects.Rectangle;
  private commandText!: Phaser.GameObjects.BitmapText;
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

    const nextX = Phaser.Math.Clamp(this.player.x + dx, 18, 302);
    const nextY = Phaser.Math.Clamp(this.player.y + dy, 40, 160);
    this.player.x = nextX;
    this.player.y = nextY;
    this.playerSprite.setPosition(this.player.x, this.player.y);

    if (dx !== 0 || dy !== 0) {
      this.checkRandomEncounter();
    }
  }

  private createWorld(): void {
    const map = this.make.tilemap({ key: "basement-map" });
    const placeholderTileset = map.addTilesetImage("suburban-placeholder", "suburban-placeholder");
    const floorTileset = map.addTilesetImage("floor-options", "floor-options");

    if (!placeholderTileset || !floorTileset) {
      throw new Error("Missing tileset for basement map.");
    }

    map.createLayer("Ground", [placeholderTileset, floorTileset], 0, 0);
    map.createLayer("Props", placeholderTileset, 0, 0);

    const spawn = getMapObjectCenter(map, "Objects", "player-spawn");
    const exit = getMapObjectCenter(map, "Objects", "basement-exit");
    const coil = getMapObjectCenter(map, "Objects", "heating-coil");

    this.exit = this.add.rectangle(exit.x, exit.y, 28, 18, 0xffffff, 0);
    this.coil = this.add.rectangle(coil.x, coil.y, 24, 20, 0xffffff, 0);
    this.player = this.add.rectangle(spawn.x, spawn.y, 14, 18, 0xffffff, 0);
    addWorldSprite(this, exit.x, exit.y, spriteFrames.stairs);
    this.coilSprite = addWorldSprite(this, coil.x, coil.y, spriteFrames.heatingCoil);
    this.playerSprite = addWorldSprite(this, this.player.x, this.player.y, spriteFrames.dad);

    addPixelText(this, exit.x - 10, exit.y + 11, "STAIRS", 6);
    addPixelText(this, coil.x - 15, coil.y + 14, "COIL", 6);
    addPixelText(this, spawn.x - 9, spawn.y - 15, "DAD", 6);

    this.randomEncounters.resetPosition(new Phaser.Math.Vector2(this.player.x, this.player.y));
  }

  private createUi(): void {
    this.add.rectangle(8, 8, 236, 16, 0xfacc15).setOrigin(0, 0);
    this.questText = addPixelText(this, 12, 11, "", 8).setTint(0x111827);

    this.messageBox = this.add.rectangle(160, 150, 304, 50, 0x111827, 0.94)
      .setStrokeStyle(2, 0xf8fafc)
      .setVisible(false);

    this.messageText = addPixelText(this, 16, 132, "", 7)
      .setMaxWidth(288)
      .setVisible(false);

    this.battleStatusBox = this.add.rectangle(48, 78, 76, 92, 0x111827, 0.94)
      .setStrokeStyle(2, 0xf8fafc)
      .setVisible(false);
    this.battleStatusText = addPixelText(this, 16, 38, "", 7).setVisible(false);

    this.battleEnemyBox = this.add.rectangle(154, 84, 108, 62, 0x65a30d, 1)
      .setStrokeStyle(2, 0xf8fafc)
      .setVisible(false);
    this.battleEnemySprite = this.add.sprite(154, 88, spriteFrames.dustBunny.texture, spriteFrames.dustBunny.frame)
      .setScale(2)
      .setVisible(false);
    this.battleEnemyText = addPixelText(this, 108, 56, "", 6)
      .setMaxWidth(96)
      .setVisible(false);

    this.commandBox = this.add.rectangle(256, 58, 120, 58, 0x111827, 0.94)
      .setStrokeStyle(2, 0xf8fafc)
      .setVisible(false);
    this.commandText = addPixelText(this, 204, 38, "", 7).setVisible(false);
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
    this.showBattleUi(snapshot);

    if (snapshot.ambushed && snapshot.message) {
      this.battlePhase = "enemyResult";
      this.showMessage(snapshot.message);
      return;
    }

    this.showMessage(this.formatBattleSnapshot(snapshot));
    this.showBattleMenu();
  }

  private handleBattleTurn(): void {
    if (this.battlePhase === "enemyResult") {
      this.battlePhase = "command";
      const snapshot = this.battle.getSnapshot(this.state);
      this.updateBattlePanels(snapshot);
      this.showMessage(this.formatBattleSnapshot(snapshot));
      this.showBattleMenu();
      return;
    }

    if (this.battlePhase === "playerResult") {
      const enemyResult = this.battle.useEnemyTurn(this.state);
      this.battlePhase = "enemyResult";
      this.updateBattlePanels(enemyResult);
      this.showMessage(enemyResult.message);
      return;
    }

    const command = battleCommands[this.selectedCommandIndex];
    const result = this.resolveBattleCommand(command);
    this.updateBattlePanels(result);

    if (result.victory) {
      this.hideBattleMenu();
      this.handleBattleVictory(result.message);
      return;
    }

    if (result.escaped) {
      this.hideBattleMenu();
      this.handleBattleEscape(result.message);
      return;
    }

    this.battlePhase = "playerResult";
    this.hideBattleMenu();
    this.showMessage(result.message);
  }

  private handleBattleVictory(resultMessage: string): void {
    if (this.activeEnemyId === "dust-bunny") {
      this.updateQuestText("BASEMENT");
      this.startDialogue([resultMessage, "The basement briefly seems less judgmental."], () => {
        this.hideBattleUi();
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
      this.hideBattleUi();
      this.scene.start("NeighborhoodScene");
    });
  }

  private handleBattleEscape(resultMessage: string): void {
    this.updateQuestText("BASEMENT");
    this.randomEncounters.resetPosition(new Phaser.Math.Vector2(this.player.x, this.player.y));
    this.startDialogue([resultMessage], () => {
      this.hideBattleUi();
      this.mode = "explore";
      this.hideMessage();
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
        this.selectedCommandIndex - 2,
        0,
        battleCommands.length,
      );
      this.showBattleMenu();
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
      this.selectedCommandIndex = Phaser.Math.Wrap(
        this.selectedCommandIndex + 2,
        0,
        battleCommands.length,
      );
      this.showBattleMenu();
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) {
      this.selectedCommandIndex = Phaser.Math.Wrap(
        this.selectedCommandIndex - 1,
        0,
        battleCommands.length,
      );
      this.showBattleMenu();
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) {
      this.selectedCommandIndex = Phaser.Math.Wrap(
        this.selectedCommandIndex + 1,
        0,
        battleCommands.length,
      );
      this.showBattleMenu();
    }
  }

  private showBattleMenu(): void {
    const commandLabel = (index: number) =>
      `${index === this.selectedCommandIndex ? ">" : " "}${this.getCommandLabel(battleCommands[index])}`;
    const menu = `${commandLabel(0).padEnd(8)} ${commandLabel(1)}\n${commandLabel(2).padEnd(8)} ${commandLabel(3)}`;

    this.commandBox.setVisible(true);
    setPixelText(this.commandText, menu);
    this.commandText.setVisible(true);
  }

  private hideBattleMenu(): void {
    this.commandBox.setVisible(false);
    this.commandText.setVisible(false);
  }

  private showBattleUi(snapshot: {
    enemy: { id: string; name: string };
    enemyHp: number;
    enemyMaxHp: number;
    heroHp: number;
    heroMaxHp: number;
  }): void {
    this.battleStatusBox.setVisible(true);
    this.battleStatusText.setVisible(true);
    this.battleEnemyBox.setVisible(true);
    this.battleEnemySprite.setVisible(true);
    this.battleEnemyText.setVisible(true);
    this.updateBattlePanels(snapshot);
  }

  private hideBattleUi(): void {
    this.hideBattleMenu();
    this.battleStatusBox.setVisible(false);
    this.battleStatusText.setVisible(false);
    this.battleEnemyBox.setVisible(false);
    this.battleEnemySprite.setVisible(false);
    this.battleEnemyText.setVisible(false);
  }

  private updateBattlePanels(snapshot: {
    enemy: { id: string; name: string };
    enemyHp: number;
    enemyMaxHp: number;
    heroHp: number;
    heroMaxHp: number;
  }): void {
    const player = this.state.player;
    setPixelText(
      this.battleStatusText,
      `DAD\nLV ${player.level}\nHP ${snapshot.heroHp}/${snapshot.heroMaxHp}\nDP ${player.dadPoints}/${player.maxDadPoints}\n$  ${player.cash}\nXP ${player.xp}`,
    );
    setPixelText(this.battleEnemyText, `${snapshot.enemy.name}\nHP ${snapshot.enemyHp}/${snapshot.enemyMaxHp}`);

    if (snapshot.enemy.id === "evil-heating-coil") {
      this.battleEnemySprite
        .setTexture("dryer-boss")
        .setDisplaySize(48, 48);
      return;
    }

    this.battleEnemySprite
      .setTexture(spriteFrames.dustBunny.texture, spriteFrames.dustBunny.frame)
      .setScale(2);
  }

  private getCommandLabel(command: BattleCommand): string {
    if (command === "Dad Skills") {
      return "SKILL";
    }

    return command.toUpperCase();
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
    return "Command?";
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
