import Phaser from "phaser";
import { BattleManager } from "../game/BattleManager";
import { dialogue, enemies } from "../game/content";
import { DialogueRunner } from "../game/DialogueRunner";
import { isNear } from "../game/interaction";
import { getQuestStepLabel } from "../game/quests";
import { getGameState } from "../game/session";
import {
  completeQuestStep,
  setActiveQuestStep,
  type GameState,
} from "../game/state";

type BasementMode = "explore" | "dialogue" | "battle";
type BattleCommand = "Fight" | "Dad Skills" | "Items" | "Run";

const battleCommands: BattleCommand[] = ["Fight", "Dad Skills", "Items", "Run"];

export class BasementScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private player!: Phaser.GameObjects.Rectangle;
  private exit!: Phaser.GameObjects.Rectangle;
  private dustBunny!: Phaser.GameObjects.Rectangle;
  private dustLabel!: Phaser.GameObjects.Text;
  private coil!: Phaser.GameObjects.Rectangle;
  private questText!: Phaser.GameObjects.Text;
  private messageBox!: Phaser.GameObjects.Rectangle;
  private messageText!: Phaser.GameObjects.Text;
  private commandText!: Phaser.GameObjects.Text;
  private mode: BasementMode = "explore";
  private selectedCommandIndex = 0;
  private state!: GameState;
  private readonly dialogueRunner = new DialogueRunner();
  private readonly battle = new BattleManager();
  private activeEnemyId: "dust-bunny" | "evil-heating-coil" = "evil-heating-coil";
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

    if (this.mode === "battle") {
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
  }

  private createWorld(): void {
    this.add.rectangle(160, 90, 320, 180, 0x26212c);
    this.add.rectangle(160, 112, 272, 76, 0x3b3442).setStrokeStyle(2, 0x17131d);
    this.add.rectangle(66, 84, 54, 24, 0x4b5563).setStrokeStyle(2, 0x111827);
    this.add.rectangle(238, 70, 42, 22, 0x6b7280).setStrokeStyle(2, 0x111827);
    this.add.rectangle(248, 98, 12, 52, 0x64748b);

    this.exit = this.add.rectangle(34, 146, 28, 18, 0x854d0e).setStrokeStyle(2, 0x431407);
    this.dustBunny = this.add.rectangle(148, 126, 18, 12, 0xcbd5e1).setStrokeStyle(2, 0x64748b);
    this.coil = this.add.rectangle(244, 118, 24, 20, 0xef4444).setStrokeStyle(2, 0x7f1d1d);
    this.player = this.add.rectangle(62, 142, 12, 18, 0x2563eb).setStrokeStyle(1, 0x172554);

    this.add.text(24, 157, "STAIRS", this.labelStyle());
    this.dustLabel = this.add.text(132, 137, "DUST", this.labelStyle());
    this.add.text(229, 132, "COIL", this.labelStyle());
    this.add.text(53, 127, "DAD", this.labelStyle());

    this.updateDustBunnyVisibility();
  }

  private createUi(): void {
    this.questText = this.add.text(8, 8, "", {
      color: "#111827",
      fontFamily: "monospace",
      fontSize: "8px",
      backgroundColor: "#facc15",
      padding: { x: 4, y: 2 },
    });

    this.messageBox = this.add.rectangle(160, 150, 304, 50, 0x111827, 0.94)
      .setStrokeStyle(2, 0xf8fafc)
      .setVisible(false);

    this.messageText = this.add.text(16, 130, "", {
      color: "#f8fafc",
      fontFamily: "monospace",
      fontSize: "7px",
      lineSpacing: 2,
      wordWrap: { width: 288 },
    }).setVisible(false);

    this.commandText = this.add.text(212, 110, "", {
      color: "#f8fafc",
      fontFamily: "monospace",
      fontSize: "7px",
      lineSpacing: 2,
      backgroundColor: "#111827",
      padding: { x: 4, y: 4 },
    }).setVisible(false);
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

    if (
      !this.state.flags.basementDustCleared &&
      isNear(playerPosition, new Phaser.Math.Vector2(this.dustBunny.x, this.dustBunny.y), 24)
    ) {
      this.startDialogue(["A Dust Bunny blocks the path with the confidence of months."], () => {
        this.startBattle("dust-bunny");
      });
      return;
    }

    if (isNear(playerPosition, new Phaser.Math.Vector2(this.coil.x, this.coil.y), 28)) {
      if (this.state.flags.bossDefeated) {
        this.startDialogue(["The heating coil is quiet now. Almost smugly quiet."]);
        return;
      }

      if (!this.state.flags.basementDustCleared) {
        this.startDialogue(["You can see the coil, but the Dust Bunny is holding the room emotionally hostage."]);
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

  private startBattle(enemyId: "dust-bunny" | "evil-heating-coil"): void {
    this.activeEnemyId = enemyId;
    const enemy = enemyId === "dust-bunny" ? this.dustBunnyEnemy! : this.coilEnemy!;
    const snapshot = this.battle.start(enemy);
    this.mode = "battle";
    this.selectedCommandIndex = 0;
    this.updateQuestText("BATTLE");
    this.showMessage(this.formatBattleSnapshot(snapshot));
    this.showBattleMenu();
  }

  private handleBattleTurn(): void {
    const command = battleCommands[this.selectedCommandIndex];
    const result = this.resolveBattleCommand(command);

    if (result.victory) {
      this.hideBattleMenu();
      this.handleBattleVictory(result.message);
      return;
    }

    this.showMessage(`${result.message}\n${this.formatBattleSnapshot(result)}`);
  }

  private handleBattleVictory(resultMessage: string): void {
    if (this.activeEnemyId === "dust-bunny") {
      this.state.flags.basementDustCleared = true;
      this.updateDustBunnyVisibility();
      this.updateQuestText("BASEMENT");
      this.startDialogue([resultMessage, "The path to the dryer vent is marginally less embarrassing."], () => {
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

    this.commandText.setText(menu).setVisible(true);
  }

  private hideBattleMenu(): void {
    this.commandText.setVisible(false);
  }

  private updateDustBunnyVisibility(): void {
    const visible = !this.state.flags.basementDustCleared;
    this.dustBunny.setVisible(visible);
    this.dustLabel.setVisible(visible);
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
    this.questText.setText(
      `${prefix} - ${getQuestStepLabel(this.state.quest.questId, this.state.quest.activeStepId)}`,
    );
  }

  private showMessage(message: string): void {
    this.messageBox.setVisible(true);
    this.messageText.setText(message).setVisible(true);
  }

  private hideMessage(): void {
    this.dialogueRunner.clear();
    this.messageBox.setVisible(false);
    this.messageText.setVisible(false);
  }

  private labelStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      color: "#f8fafc",
      fontFamily: "monospace",
      fontSize: "6px",
    };
  }
}
