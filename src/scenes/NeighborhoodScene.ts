import Phaser from "phaser";
import { dialogue } from "../game/content";
import { DialogueRunner } from "../game/DialogueRunner";
import { isNear } from "../game/interaction";
import { getQuest, getQuestStepLabel } from "../game/quests";
import { getGameState, resetGameState } from "../game/session";
import {
  completeQuestStep,
  setActiveQuestStep,
  type GameState,
} from "../game/state";

type SceneMode = "explore" | "dialogue" | "complete";

export class NeighborhoodScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private player!: Phaser.GameObjects.Rectangle;
  private wife!: Phaser.GameObjects.Rectangle;
  private dryer!: Phaser.GameObjects.Rectangle;
  private mode: SceneMode = "explore";
  private messageBox!: Phaser.GameObjects.Rectangle;
  private messageText!: Phaser.GameObjects.Text;
  private questText!: Phaser.GameObjects.Text;
  private state!: GameState;
  private readonly dialogueRunner = new DialogueRunner();

  constructor() {
    super("NeighborhoodScene");
  }

  create(): void {
    this.state = getGameState();
    this.mode = "explore";
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.createTextures();
    this.createWorld();
    this.createUi();
    this.updateQuestText();
  }

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.handleInteract();
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

    this.player.x = Phaser.Math.Clamp(this.player.x + dx, 12, 308);
    this.player.y = Phaser.Math.Clamp(this.player.y + dy, 42, 162);
  }

  private createTextures(): void {
    const graphics = this.add.graphics();

    graphics.fillStyle(0x92c98f);
    graphics.fillRect(0, 0, 320, 180);
    graphics.fillStyle(0x6b7280);
    graphics.fillRect(0, 116, 320, 18);
    graphics.generateTexture("neighborhood", 320, 180);

    graphics.clear();
    graphics.fillStyle(0xdec58a);
    graphics.fillRect(0, 0, 64, 52);
    graphics.fillStyle(0x854d0e);
    graphics.fillTriangle(0, 0, 32, -20, 64, 0);
    graphics.generateTexture("house", 64, 72);

    graphics.destroy();
  }

  private createWorld(): void {
    this.add.image(160, 90, "neighborhood");
    this.add.image(78, 82, "house");

    this.add.rectangle(246, 76, 44, 30, 0x4b5563).setStrokeStyle(2, 0x111827);
    this.add.text(225, 70, "BASEMENT", {
      color: "#f8fafc",
      fontFamily: "monospace",
      fontSize: "6px",
    });

    this.dryer = this.add.rectangle(247, 98, 22, 18, 0xd1d5db).setStrokeStyle(2, 0x374151);
    this.wife = this.add.rectangle(132, 104, 12, 18, 0xf97316).setStrokeStyle(1, 0x7c2d12);
    this.player = this.add.rectangle(160, 136, 12, 18, 0x2563eb).setStrokeStyle(1, 0x172554);

    this.add.text(154, 121, "DAD", this.labelStyle());
    this.add.text(122, 89, "WIFE", this.labelStyle());
    this.add.text(238, 111, "DRYER", this.labelStyle());
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
  }

  private handleInteract(): void {
    if (this.mode === "dialogue") {
      this.advanceDialogue();
      return;
    }

    if (this.mode === "complete") {
      resetGameState();
      this.scene.restart();
      return;
    }

    const playerPosition = new Phaser.Math.Vector2(this.player.x, this.player.y);

    if (isNear(playerPosition, new Phaser.Math.Vector2(this.wife.x, this.wife.y))) {
      this.interactWithWife();
      return;
    }

    if (isNear(playerPosition, new Phaser.Math.Vector2(this.dryer.x, this.dryer.y), 26)) {
      this.interactWithDryer();
      return;
    }

    this.startDialogue(["No crisis within reach. This is suspicious."]);
  }

  private interactWithWife(): void {
    if (this.state.flags.bossDefeated) {
      completeQuestStep(this.state, "return-to-wife");
      this.state.flags.dryerFixed = true;
      this.updateQuestText("DRYER FIXED");
      this.startDialogue(dialogue.victory, () => {
        this.mode = "complete";
        this.showMessage("Quest complete! Press Space to restart the vertical slice.");
      });
      return;
    }

    if (!this.state.flags.talkedToWife) {
      this.state.flags.talkedToWife = true;
      completeQuestStep(this.state, "talk-to-wife");
      setActiveQuestStep(this.state, "inspect-dryer");
      this.updateQuestText();
    }

    this.startDialogue(dialogue.wife);
  }

  private interactWithDryer(): void {
    if (!this.state.flags.inspectedDryer) {
      this.state.flags.inspectedDryer = true;
      completeQuestStep(this.state, "inspect-dryer");
      setActiveQuestStep(this.state, "defeat-heating-coil");
      this.updateQuestText();
    }

    if (this.state.flags.bossDefeated) {
      this.startDialogue(["The dryer radiates the calm authority of a repaired appliance."]);
      return;
    }

    this.startDialogue([...dialogue.dryer, "The stairs to the basement await."], () => {
      this.scene.start("BasementScene");
    });
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

  private updateQuestText(prefix?: string): void {
    const quest = getQuest(this.state.quest.questId);
    const activeStepLabel = getQuestStepLabel(
      this.state.quest.questId,
      this.state.quest.activeStepId,
    );
    const label = prefix ? `${prefix} - ${activeStepLabel}` : `${quest.countdownLabel} - ${activeStepLabel}`;
    this.questText.setText(label);
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
      color: "#111827",
      fontFamily: "monospace",
      fontSize: "6px",
    };
  }
}
