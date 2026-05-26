import Phaser from "phaser";
import { dialogue } from "../game/content";
import { DialogueBox } from "../game/DialogueBox";
import { getDadBrainLine, getDadLine } from "../game/dadVoice";
import { DialogueRunner, type DialogueInput, type DialogueLine } from "../game/DialogueRunner";
import { GameMenu } from "../game/GameMenu";
import { isNear } from "../game/interaction";
import { getQuest, getQuestStepLabel } from "../game/quests";
import { getGameState, resetGameState } from "../game/session";
import { addWorldSprite, spriteFrames } from "../game/sprites";
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
  private basementStairs!: Phaser.GameObjects.Rectangle;
  private blockers: Phaser.GameObjects.Rectangle[] = [];
  private mode: SceneMode = "explore";
  private dialogueBox!: DialogueBox;
  private menu!: GameMenu;
  private questText!: Phaser.GameObjects.BitmapText;
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
    this.menu = new GameMenu(this, () => this.state);
    this.updateQuestText();
  }

  update(_time: number, delta: number): void {
    this.dialogueBox.update(delta);
    this.menu.update();

    if (this.menu.isOpen()) {
      return;
    }

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

    this.movePlayer(dx, dy);
    this.playerSprite.setPosition(this.player.x, this.player.y);
  }

  private createWorld(): void {
    this.add.rectangle(160, 90, 320, 180, 0x0f172a);
    this.addFloor(24, 32, 136, 116, 0xcdbb82);
    this.addFloor(160, 32, 88, 116, 0xd5c790);
    this.addFloor(248, 32, 48, 76, 0xbfc7c9);
    this.addFloor(104, 132, 64, 28, 0x737373);

    this.addWall(22, 30, 276, 5);
    this.addWall(22, 148, 76, 5);
    this.addWall(158, 148, 140, 5);
    this.addWall(20, 32, 5, 118);
    this.addWall(296, 32, 5, 118);
    this.addWall(158, 32, 5, 45);
    this.addWall(158, 111, 5, 37);
    this.addWall(246, 32, 5, 36);
    this.addWall(246, 102, 5, 46);
    this.addWall(90, 148, 5, 27);
    this.addWall(154, 148, 5, 27);

    this.addSlidingDoor(159, 94, 5, 34);
    this.addSlidingDoor(246, 84, 5, 34);
    this.addEntryway(122, 153);
    this.addGarageDoor(58, 148);

    this.addFurniture(43, 56, 46, 20, 0x8b5e3c, 0x593a27);
    this.addFurniture(44, 112, 42, 26, 0x72523b, 0x3f2b22);
    this.addFurniture(104, 94, 54, 32, 0x8f6f46, 0x4b3827);
    this.addFurniture(104, 94, 36, 20, 0x2f3b50, 0x1f2937);
    this.addFurniture(186, 54, 50, 18, 0x7b5f3c, 0x433121);
    this.addFurniture(214, 112, 42, 26, 0x6b7280, 0x374151);
    this.addFurniture(278, 54, 22, 28, 0x94a3b8, 0x475569);
    this.addFurniture(270, 92, 38, 22, 0x64748b, 0x334155);
    this.addStairs(272, 124);
    this.addPlant(136, 52);
    this.addPlant(36, 132);
    this.addPlant(228, 92);
    this.addPlant(282, 136);
    this.addWindow(72, 34);
    this.addWindow(202, 34);
    this.addWindow(278, 34);

    this.dryer = this.add.rectangle(270, 92, 30, 24, 0xffffff, 0);
    this.garage = this.add.rectangle(58, 148, 56, 32, 0xffffff, 0);
    this.basementStairs = this.add.rectangle(272, 124, 42, 32, 0xffffff, 0);
    this.wife = this.add.rectangle(90, 105, 14, 18, 0xffffff, 0);
    this.player = this.add.rectangle(128, 116, 14, 18, 0xffffff, 0);

    addWorldSprite(this, this.wife.x, this.wife.y, spriteFrames.wife);
    this.playerSprite = addWorldSprite(this, this.player.x, this.player.y, spriteFrames.dad);
  }

  private createUi(): void {
    this.add.rectangle(8, 8, 236, 16, 0xfacc15).setOrigin(0, 0);
    this.questText = addPixelText(this, 12, 11, "", 8).setTint(0x111827);

    this.dialogueBox = new DialogueBox(this);

  }

  private handleInteract(): void {
    if (this.mode === "dialogue") {
      this.advanceDialogue();
      return;
    }

    if (this.mode === "complete") {
      if (this.dialogueBox.advance() !== "done") {
        return;
      }

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

    if (isNear(playerPosition, new Phaser.Math.Vector2(this.garage.x, this.garage.y), 40)) {
      this.scene.start("GarageScene");
      return;
    }

    if (isNear(playerPosition, new Phaser.Math.Vector2(this.basementStairs.x, this.basementStairs.y), 36)) {
      this.scene.start("BasementScene");
      return;
    }

    this.startDialogue(["No crisis within reach. This is suspicious."]);
  }

  private interactWithWife(): void {
    if (this.state.flags.bossDefeated) {
      completeQuestStep(this.state, "return-to-wife");
      this.state.flags.dryerFixed = true;
      this.updateQuestText("DRYER FIXED");
      this.startDialogue([
        { speaker: "DAD", text: getDadLine("toWife", "greeting") },
        ...dialogue.victory.map((text) => ({ speaker: "NARRATOR", text })),
        { speaker: "DAD", text: getDadLine("selfTalk", "victory") },
      ], () => {
        this.mode = "complete";
        this.showMessage({ speaker: "SYSTEM", text: "Quest complete! Press Space to restart the vertical slice." });
      });
      return;
    }

    if (!this.state.flags.talkedToWife) {
      this.state.flags.talkedToWife = true;
      completeQuestStep(this.state, "talk-to-wife");
      setActiveQuestStep(this.state, "inspect-dryer");
      this.updateQuestText();
    }

    this.startDialogue([
      { speaker: "DAD'S BRAIN", text: getDadBrainLine("talkToWife") },
      { speaker: "DAD", text: getDadLine("toWife", "greeting") },
      ...dialogue.wife.map((text) => ({ speaker: "WIFE", text })),
      { speaker: "DAD", text: getDadLine("toWife", "questReceived") },
      { speaker: "DAD", text: getDadLine("toInLaws", "mentioned") },
    ]);
  }

  private interactWithDryer(): void {
    if (!this.state.flags.inspectedDryer) {
      this.state.flags.inspectedDryer = true;
      completeQuestStep(this.state, "inspect-dryer");
      setActiveQuestStep(this.state, "defeat-heating-coil");
      this.updateQuestText();
    }

    if (this.state.flags.bossDefeated) {
      this.startDialogue([
        { speaker: "NARRATOR", text: "The dryer radiates the calm authority of a repaired appliance." },
        { speaker: "DAD", text: getDadLine("selfTalk", "victory") },
      ]);
      return;
    }

    this.startDialogue([
      { speaker: "DAD'S BRAIN", text: getDadBrainLine("inspectDryer") },
      ...dialogue.dryer.map((text) => ({ speaker: "NARRATOR", text })),
      { speaker: "DAD", text: getDadLine("selfTalk", "frustrated") },
      { speaker: "NARRATOR", text: "The basement stairs wait near the kitchen." },
    ]);
  }

  private movePlayer(dx: number, dy: number): void {
    const nextX = Phaser.Math.Clamp(this.player.x + dx, 27, 291);
    const nextY = Phaser.Math.Clamp(this.player.y + dy, 38, 158);

    if (!this.wouldCollide(nextX, this.player.y)) {
      this.player.x = nextX;
    }

    if (!this.wouldCollide(this.player.x, nextY)) {
      this.player.y = nextY;
    }
  }

  private wouldCollide(x: number, y: number): boolean {
    const playerBounds = new Phaser.Geom.Rectangle(x - 5, y - 7, 10, 14);
    return this.blockers.some((blocker) =>
      Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, blocker.getBounds()),
    );
  }

  private addFloor(x: number, y: number, width: number, height: number, color: number): void {
    this.add.rectangle(x + width / 2, y + height / 2, width, height, color);

    for (let tileX = x; tileX <= x + width; tileX += 16) {
      this.add.rectangle(tileX, y + height / 2, 1, height, 0x7a6f55, 0.25);
    }

    for (let tileY = y; tileY <= y + height; tileY += 16) {
      this.add.rectangle(x + width / 2, tileY, width, 1, 0x7a6f55, 0.25);
    }
  }

  private addWall(x: number, y: number, width: number, height: number): void {
    const wall = this.add.rectangle(x + width / 2, y + height / 2, width, height, 0x1f2937)
      .setStrokeStyle(1, 0x94a3b8);
    this.blockers.push(wall);
  }

  private addSlidingDoor(x: number, y: number, width: number, height: number): void {
    this.add.rectangle(x + width / 2, y + height / 2, width, height, 0xe8d7b0, 0.9);
    for (let offset = 4; offset < height; offset += 8) {
      this.add.rectangle(x + width / 2, y + offset, width + 8, 1, 0x7c5f38, 0.7);
    }
  }

  private addEntryway(x: number, y: number): void {
    this.add.rectangle(x, y + 8, 56, 16, 0x111827);
    this.add.rectangle(x, y, 48, 8, 0x374151).setStrokeStyle(1, 0x94a3b8);
  }

  private addGarageDoor(x: number, y: number): void {
    this.add.rectangle(x, y, 42, 24, 0x1f2937).setStrokeStyle(2, 0x94a3b8);
    this.add.rectangle(x, y + 4, 30, 14, 0x7f5539).setStrokeStyle(1, 0x3f2a1f);
    this.add.rectangle(x + 9, y + 4, 3, 3, 0xfacc15);
    addPixelText(this, x - 16, y + 18, "GARAGE", 5).setTint(0xfacc15);
  }

  private addFurniture(x: number, y: number, width: number, height: number, fill: number, stroke: number): void {
    this.add.rectangle(x, y, width, height, fill).setStrokeStyle(2, stroke);
  }

  private addPlant(x: number, y: number): void {
    this.add.rectangle(x, y + 7, 8, 8, 0x7c4a2d).setStrokeStyle(1, 0x3f2a1f);
    this.add.circle(x - 4, y, 6, 0x2f855a);
    this.add.circle(x + 4, y, 6, 0x276749);
  }

  private addWindow(x: number, y: number): void {
    this.add.rectangle(x, y, 44, 8, 0xf8fafc).setStrokeStyle(1, 0x64748b);
    this.add.rectangle(x, y, 38, 4, 0x93c5fd, 0.75);
  }

  private addStairs(x: number, y: number): void {
    this.add.rectangle(x, y, 32, 24, 0x475569).setStrokeStyle(2, 0x1f2937);
    for (let offset = -8; offset <= 8; offset += 4) {
      this.add.rectangle(x, y + offset, 26, 1, 0xcbd5e1);
    }
    addPixelText(this, x - 20, y + 17, "BASEMENT", 5).setTint(0xfacc15);
  }

  private startDialogue(lines: DialogueInput[], onComplete?: () => void): void {
    this.mode = "dialogue";
    this.showMessage(this.dialogueRunner.start(lines, onComplete));
  }

  private advanceDialogue(): void {
    if (this.dialogueBox.advance() !== "done") {
      return;
    }

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

  private showMessage(message: DialogueLine | string): void {
    const line = typeof message === "string" ? { speaker: "DAD", text: message } : message;
    this.dialogueBox.show(line.text, this.getSpeakerLabel(line.speaker));
  }

  private getSpeakerLabel(speaker: string): string {
    return speaker === "DAD" ? this.state.player.name || "DAD" : speaker;
  }

  private hideMessage(): void {
    this.dialogueRunner.clear();
    this.dialogueBox.hide();
  }

}
