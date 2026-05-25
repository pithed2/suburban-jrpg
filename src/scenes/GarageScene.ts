import Phaser from "phaser";
import { DialogueBox } from "../game/DialogueBox";
import { getDadBrainLine } from "../game/dadVoice";
import { DialogueRunner, type DialogueInput, type DialogueLine } from "../game/DialogueRunner";
import { GameMenu } from "../game/GameMenu";
import { isNear } from "../game/interaction";
import { PlayerStatsPanel } from "../game/PlayerStatsPanel";
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

type GarageMode = "explore" | "dialogue";

export class GarageScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private player!: Phaser.GameObjects.Rectangle;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private exit!: Phaser.GameObjects.Rectangle;
  private clutter!: Phaser.GameObjects.Rectangle;
  private wrench!: Phaser.GameObjects.Rectangle;
  private wrenchVisual!: Phaser.GameObjects.Rectangle;
  private wrenchLabel!: Phaser.GameObjects.BitmapText;
  private questText!: Phaser.GameObjects.BitmapText;
  private dialogueBox!: DialogueBox;
  private menu!: GameMenu;
  private statsPanel!: PlayerStatsPanel;
  private mode: GarageMode = "explore";
  private state!: GameState;
  private readonly dialogueRunner = new DialogueRunner();

  constructor() {
    super("GarageScene");
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

    if (!this.state.flags.foundWrench) {
      this.startDialogue([
        { speaker: "DAD'S BRAIN", text: getDadBrainLine("garage") },
        { speaker: "NARRATOR", text: "The garage receives Dad with the quiet hostility of unfinished projects." },
        { speaker: "DAD", text: "The wrench is not where he definitely, absolutely, probably left it." },
      ]);
    }
  }

  update(_time: number, delta: number): void {
    this.dialogueBox.update(delta);
    this.menu.update();

    if (this.menu.isOpen()) {
      this.statsPanel.hide();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.handleInteract();
    }

    if (this.mode !== "explore") {
      this.statsPanel.hide();
      return;
    }

    const speed = 1.2;
    let dx = 0;
    let dy = 0;

    if (this.cursors.left.isDown) dx -= speed;
    if (this.cursors.right.isDown) dx += speed;
    if (this.cursors.up.isDown) dy -= speed;
    if (this.cursors.down.isDown) dy += speed;
    const isMoving = dx !== 0 || dy !== 0;

    this.player.x = Phaser.Math.Clamp(this.player.x + dx, 18, 302);
    this.player.y = Phaser.Math.Clamp(this.player.y + dy, 40, 160);
    this.playerSprite.setPosition(this.player.x, this.player.y);
    this.statsPanel.update(delta, !isMoving, this.state);
  }

  private createWorld(): void {
    const map = this.make.tilemap({ key: "garage-map" });
    const tileset = map.addTilesetImage("suburban-placeholder", "suburban-placeholder");

    if (!tileset) {
      throw new Error("Missing tileset for garage map.");
    }

    map.createLayer("Ground", tileset, 0, 0);
    map.createLayer("Props", tileset, 0, 0);

    const spawn = getMapObjectCenter(map, "Objects", "player-spawn");
    const exit = getMapObjectCenter(map, "Objects", "house-exit");
    const clutter = getMapObjectCenter(map, "Objects", "clutter");
    const wrench = getMapObjectCenter(map, "Objects", "wrench");

    this.exit = this.add.rectangle(exit.x, exit.y, 28, 18, 0xffffff, 0);
    this.clutter = this.add.rectangle(clutter.x, clutter.y, 34, 24, 0xffffff, 0);
    this.wrench = this.add.rectangle(wrench.x, wrench.y, 22, 16, 0xffffff, 0);
    this.player = this.add.rectangle(spawn.x, spawn.y, 14, 18, 0xffffff, 0);

    addWorldSprite(this, exit.x, exit.y, spriteFrames.stairs);
    this.playerSprite = addWorldSprite(this, this.player.x, this.player.y, spriteFrames.dad);
    this.wrenchVisual = this.add.rectangle(wrench.x, wrench.y, 18, 4, 0xd1d5db).setStrokeStyle(1, 0x111827);

    addPixelText(this, exit.x - 10, exit.y + 11, "HOUSE", 6);
    addPixelText(this, clutter.x - 18, clutter.y + 16, "CLUTTER", 6);
    this.wrenchLabel = addPixelText(this, wrench.x - 16, wrench.y + 12, "WRENCH", 6);
    addPixelText(this, spawn.x - 9, spawn.y - 15, "DAD", 6);

    this.updateWrenchVisibility();
  }

  private createUi(): void {
    this.add.rectangle(8, 8, 236, 16, 0xfacc15).setOrigin(0, 0);
    this.questText = addPixelText(this, 12, 11, "", 8).setTint(0x111827);

    this.dialogueBox = new DialogueBox(this);
    this.statsPanel = new PlayerStatsPanel(this);
  }

  private handleInteract(): void {
    if (this.mode === "dialogue") {
      this.advanceDialogue();
      return;
    }

    const playerPosition = new Phaser.Math.Vector2(this.player.x, this.player.y);

    if (isNear(playerPosition, new Phaser.Math.Vector2(this.exit.x, this.exit.y), 24)) {
      this.scene.start("NeighborhoodScene");
      return;
    }

    if (isNear(playerPosition, new Phaser.Math.Vector2(this.clutter.x, this.clutter.y), 26)) {
      this.startDialogue([
        { speaker: "DAD'S BRAIN", text: getDadBrainLine("garage") },
        { speaker: "NARRATOR", text: "Old paint cans. A snow shovel. Three extension cords, none of them the good one." },
      ]);
      return;
    }

    if (
      !this.state.flags.foundWrench &&
      isNear(playerPosition, new Phaser.Math.Vector2(this.wrench.x, this.wrench.y), 26)
    ) {
      this.collectWrench();
      return;
    }

    this.startDialogue([
      { speaker: "DAD", text: "Somewhere in here is every tool Dad has ever needed, except the one he needs now." },
    ]);
  }

  private collectWrench(): void {
    this.state.flags.foundWrench = true;
    this.state.player.inventory.push("adjustable-wrench");
    this.state.player.equipment.weaponId = "adjustable-wrench";
    completeQuestStep(this.state, "find-wrench");
    setActiveQuestStep(this.state, "defeat-heating-coil");
    this.updateWrenchVisibility();
    this.updateQuestText();
    this.startDialogue([
      { speaker: "DAD'S BRAIN", text: getDadBrainLine("wrenchFound") },
      { speaker: "NARRATOR", text: "Dad finds the Adjustable Wrench behind a box labeled TAXES 2017." },
      { speaker: "DAD", text: "The appliance world has been put on notice." },
    ]);
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

  private updateQuestText(): void {
    setPixelText(
      this.questText,
      `GARAGE - ${getQuestStepLabel(this.state.quest.questId, this.state.quest.activeStepId)}`,
    );
  }

  private updateWrenchVisibility(): void {
    const visible = !this.state.flags.foundWrench;
    this.wrench.setVisible(visible);
    this.wrenchVisual.setVisible(visible);
    this.wrenchLabel.setVisible(visible);
  }

  private showMessage(message: DialogueLine | string): void {
    const line = typeof message === "string" ? { speaker: "DAD", text: message } : message;
    this.dialogueBox.show(line.text, line.speaker);
  }

  private hideMessage(): void {
    this.dialogueRunner.clear();
    this.dialogueBox.hide();
  }
}
