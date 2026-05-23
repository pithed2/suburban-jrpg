import Phaser from "phaser";
import { dialogue } from "../game/content";
import { DialogueRunner } from "../game/DialogueRunner";
import { isNear } from "../game/interaction";
import { getQuest, getQuestStepLabel } from "../game/quests";
import { getGameState, resetGameState } from "../game/session";
import { addWorldSprite, spriteFrames } from "../game/sprites";
import { getMapObjectCenter } from "../game/tilemapObjects";
import { addPixelText, setPixelText } from "../game/uiText";
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
  private playerSprite!: Phaser.GameObjects.Sprite;
  private wife!: Phaser.GameObjects.Rectangle;
  private dryer!: Phaser.GameObjects.Rectangle;
  private garage!: Phaser.GameObjects.Rectangle;
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
    this.playerSprite.setPosition(this.player.x, this.player.y);
  }

  private createWorld(): void {
    const map = this.make.tilemap({ key: "house-map" });
    const tileset = map.addTilesetImage("suburban-placeholder", "suburban-placeholder");

    if (!tileset) {
      throw new Error("Missing tileset for house map.");
    }

    map.createLayer("Ground", tileset, 0, 0);
    map.createLayer("Props", tileset, 0, 0);

    const spawn = getMapObjectCenter(map, "Objects", "player-spawn");
    const wife = getMapObjectCenter(map, "Objects", "wife");
    const dryer = getMapObjectCenter(map, "Objects", "dryer");
    const garage = getMapObjectCenter(map, "Objects", "garage");

    this.dryer = this.add.rectangle(dryer.x, dryer.y, 22, 18, 0xffffff, 0);
    this.garage = this.add.rectangle(garage.x, garage.y, 44, 22, 0xffffff, 0);
    this.wife = this.add.rectangle(wife.x, wife.y, 14, 18, 0xffffff, 0);
    this.player = this.add.rectangle(spawn.x, spawn.y, 14, 18, 0xffffff, 0);
    addWorldSprite(this, dryer.x, dryer.y, spriteFrames.dryer);
    addWorldSprite(this, wife.x, wife.y, spriteFrames.wife);
    this.playerSprite = addWorldSprite(this, this.player.x, this.player.y, spriteFrames.dad);

    addPixelText(this, spawn.x - 6, spawn.y - 15, "DAD", 6);
    addPixelText(this, garage.x - 18, garage.y + 15, "GARAGE", 6);
    addPixelText(this, wife.x - 10, wife.y - 15, "WIFE", 6);
    addPixelText(this, dryer.x - 9, dryer.y + 13, "DRYER", 6);
    addPixelText(this, dryer.x - 22, dryer.y - 28, "BASEMENT", 6);
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

    if (isNear(playerPosition, new Phaser.Math.Vector2(this.garage.x, this.garage.y), 28)) {
      this.scene.start("GarageScene");
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
    setPixelText(this.questText, label);
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
