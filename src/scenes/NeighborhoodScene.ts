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

const houseCoreFrames = {
  woodFloor: 2052,
  kitchenFloor: 2060,
  mudroomFloor: 2116,
  hallFloor: 2576,
  topWall: 512,
  sideWall: 528,
  bottomWall: 1024,
  window: 560,
  door: 1084,
  stairs: 3072,
};

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
    this.addFloor(32, 40, 128, 88, 0xcdbb82);
    this.addFloor(160, 72, 48, 56, 0xb7a06a);
    this.addFloor(208, 40, 88, 88, 0xd5c790);
    this.addFloor(32, 128, 64, 36, 0x737373);
    this.addFloor(176, 128, 32, 36, 0x8a8170);
    this.addFloor(208, 128, 88, 36, 0x475569);

    this.addWall(30, 38, 268, 5);
    this.addWall(30, 164, 268, 5);
    this.addWall(30, 40, 5, 124);
    this.addWall(296, 40, 5, 124);
    this.addWall(160, 40, 5, 24);
    this.addWall(160, 112, 5, 52);
    this.addWall(208, 40, 5, 24);
    this.addWall(208, 112, 5, 16);
    this.addWall(208, 148, 5, 16);
    this.addWall(96, 128, 64, 5);
    this.addWall(208, 128, 88, 5);
    this.addWall(96, 148, 80, 5);

    this.addHouseCoreShell();

    this.addSlidingDoor(160, 78, 5, 26);
    this.addSlidingDoor(208, 78, 5, 26);
    this.addEntryway(64, 132);
    this.addGarageDoor(64, 154);
    this.addStairs(192, 144);

    this.addFurniture(76, 60, 52, 18, 0x8b5e3c, 0x593a27);
    this.addFurniture(74, 108, 50, 18, 0x72523b, 0x3f2b22);
    this.addFurniture(118, 92, 36, 24, 0x8f6f46, 0x4b3827);
    this.addFurniture(118, 91, 26, 16, 0x2f3b50, 0x1f2937);
    this.addFurniture(250, 58, 64, 18, 0x7b5f3c, 0x433121);
    this.addFurniture(270, 98, 38, 24, 0x64748b, 0x334155);
    this.addFurniture(236, 146, 42, 22, 0x4b5563, 0x1f2937);
    this.addFurniture(276, 146, 28, 22, 0x334155, 0x111827);
    this.addFurniture(44, 146, 20, 18, 0x6b7280, 0x374151);
    this.addFurniture(84, 146, 20, 18, 0x6b7280, 0x374151);
    this.addPlant(144, 54);
    this.addPlant(40, 116);
    this.addPlant(286, 116);
    this.addWindow(82, 42);
    this.addWindow(252, 42);

    addPixelText(this, 62, 48, "QUEST", 5).setTint(0xfacc15);
    addPixelText(this, 225, 78, "FRIDGE", 5).setTint(0x111827);
    addPixelText(this, 221, 153, "LOCKED", 5).setTint(0xfacc15);

    this.dryer = this.add.rectangle(270, 98, 30, 24, 0xffffff, 0);
    this.garage = this.add.rectangle(64, 154, 56, 28, 0xffffff, 0);
    this.basementStairs = this.add.rectangle(192, 144, 42, 32, 0xffffff, 0);
    this.wife = this.add.rectangle(94, 78, 14, 18, 0xffffff, 0);
    this.player = this.add.rectangle(104, 112, 14, 18, 0xffffff, 0);

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
      if (this.state.flags.circuitBreakerOff) {
        setActiveQuestStep(this.state, "restore-power");
        this.updateQuestText("POWER OUT");
        this.startDialogue([
          { speaker: "WIFE", text: "Now, nothing works! What did you do??" },
          { speaker: "DAD'S BRAIN", text: "Dude. Dryers don't work without power." },
          { speaker: "DAD", text: "Small administrative follow-up. Totally under control." },
          { speaker: "NARRATOR", text: "The basement breaker waits for Dad's victory lap." },
        ]);
        return;
      }

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
      if (this.state.flags.circuitBreakerOff) {
        setActiveQuestStep(this.state, "restore-power");
        this.updateQuestText("POWER OUT");
        this.startDialogue([
          { speaker: "NARRATOR", text: "The dryer is repaired, but completely lifeless." },
          { speaker: "DAD'S BRAIN", text: "Dude. Dryers don't work without power." },
          { speaker: "DAD", text: "Right. Basement. Breaker. Victory, but with paperwork." },
        ]);
        return;
      }

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

  private addHouseCoreShell(): void {
    this.addHouseTileBlock(32, 40, 8, 6, houseCoreFrames.woodFloor);
    this.addHouseTileBlock(160, 72, 3, 4, houseCoreFrames.hallFloor);
    this.addHouseTileBlock(208, 40, 6, 6, houseCoreFrames.kitchenFloor);
    this.addHouseTileBlock(32, 128, 4, 3, houseCoreFrames.mudroomFloor);
    this.addHouseTileBlock(176, 128, 2, 3, houseCoreFrames.hallFloor);
    this.addHouseTileBlock(208, 128, 6, 3, houseCoreFrames.mudroomFloor);

    this.addHouseTileBlock(32, 40, 8, 1, houseCoreFrames.topWall);
    this.addHouseTileBlock(176, 40, 2, 1, houseCoreFrames.topWall);
    this.addHouseTileBlock(224, 40, 5, 1, houseCoreFrames.topWall);
    this.addHouseTileBlock(32, 160, 17, 1, houseCoreFrames.bottomWall);
    this.addHouseTileBlock(32, 56, 1, 7, houseCoreFrames.sideWall);
    this.addHouseTileBlock(288, 56, 1, 7, houseCoreFrames.sideWall);
    this.addHouseTileBlock(160, 40, 1, 2, houseCoreFrames.sideWall);
    this.addHouseTileBlock(160, 112, 1, 4, houseCoreFrames.sideWall);
    this.addHouseTileBlock(208, 40, 1, 2, houseCoreFrames.sideWall);
    this.addHouseTileBlock(208, 112, 1, 1, houseCoreFrames.sideWall);
    this.addHouseTileBlock(208, 144, 1, 2, houseCoreFrames.sideWall);
    this.addHouseTileBlock(96, 128, 4, 1, houseCoreFrames.bottomWall);
    this.addHouseTileBlock(208, 128, 6, 1, houseCoreFrames.bottomWall);

    this.addHouseTileBlock(80, 40, 3, 1, houseCoreFrames.window);
    this.addHouseTileBlock(240, 40, 3, 1, houseCoreFrames.window);
    this.addHouseTileBlock(144, 112, 2, 1, houseCoreFrames.door);
    this.addHouseTileBlock(256, 112, 2, 1, houseCoreFrames.door);
    this.addHouseTileBlock(176, 136, 2, 2, houseCoreFrames.stairs);
  }

  private addHouseTileBlock(x: number, y: number, columns: number, rows: number, frame: number): void {
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        this.add.image(x + column * 16, y + row * 16, "house-core-16", frame).setOrigin(0, 0);
      }
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
