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
import { addPixelText, setPixelText } from "../game/uiText";
import {
  completeQuestStep,
  setActiveQuestStep,
  type GameState,
} from "../game/state";

type GarageMode = "explore" | "dialogue";

const garageWorld = {
  width: 640,
  height: 360,
};
const garagePropFrames = [197, 198, 366, 367, 368, 369, 370, 371, 224, 225, 226, 227];
const garageFloorFrames = [98, 99, 100, 101, 228];
const interiorPropFrames = [44, 45, 46, 68, 69, 70, 178, 179, 194, 195, 226, 227, 740, 741, 742, 743];

export class GarageScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private player!: Phaser.GameObjects.Rectangle;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private exit!: Phaser.GameObjects.Rectangle;
  private wrench!: Phaser.GameObjects.Rectangle;
  private wrenchVisual!: Phaser.GameObjects.Container;
  private wrenchLabel!: Phaser.GameObjects.BitmapText;
  private blockers: Phaser.GameObjects.Rectangle[] = [];
  private clutterZones: Phaser.GameObjects.Rectangle[] = [];
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

    this.movePlayer(dx, dy);
    this.playerSprite.setPosition(this.player.x, this.player.y);
    this.statsPanel.update(delta, !isMoving, this.state);
  }

  private createWorld(): void {
    this.cameras.main.setBounds(0, 0, garageWorld.width, garageWorld.height);

    for (let y = 8; y < garageWorld.height; y += 16) {
      for (let x = 8; x < garageWorld.width; x += 16) {
        const frame = garageFloorFrames[((x / 16) + (y / 16) * 3) % garageFloorFrames.length];
        addWorldSprite(this, x, y, { texture: "dungeon-16", frame }, 1);
      }
    }

    this.addBlocker(320, 8, 640, 16, 0x111827);
    this.addBlocker(320, 352, 640, 16, 0x111827);
    this.addBlocker(8, 180, 16, 360, 0x111827);
    this.addBlocker(632, 180, 16, 360, 0x111827);

    this.addGarageClutter(112, 222, 122, 36, "PAINT");
    this.addGarageClutter(116, 122, 128, 36, "SHELVES");
    this.addGarageClutter(234, 306, 42, 92, "RAKES");
    this.addGarageClutter(258, 202, 42, 112, "CORDS");
    this.addGarageClutter(338, 276, 128, 42, "MOWER");
    this.addGarageClutter(378, 112, 42, 132, "BINS");
    this.addGarageClutter(484, 206, 42, 144, "TIRES");
    this.addGarageClutter(520, 304, 150, 42, "FREEZER");
    this.addGarageClutter(528, 132, 112, 36, "TOOLS");
    this.addGarageClutter(516, 42, 196, 28, "WORKBENCH");
    this.addGarageClutter(278, 66, 126, 36, "BOXES");
    this.addGarageClutter(176, 54, 72, 30, "DEAD END");

    this.exit = this.add.rectangle(42, 308, 34, 22, 0xffffff, 0);
    this.wrench = this.add.rectangle(570, 74, 26, 20, 0xffffff, 0);
    this.player = this.add.rectangle(66, 308, 14, 18, 0xffffff, 0);

    addWorldSprite(this, this.exit.x, this.exit.y, spriteFrames.stairs);
    this.playerSprite = addWorldSprite(this, this.player.x, this.player.y, spriteFrames.dad);
    this.cameras.main.startFollow(this.playerSprite, true, 0.12, 0.12);

    this.wrenchVisual = this.addWrenchSprite(this.wrench.x, this.wrench.y);

    addPixelText(this, this.exit.x - 12, this.exit.y + 12, "HOUSE", 6);
    this.wrenchLabel = addPixelText(this, this.wrench.x - 18, this.wrench.y + 13, "WRENCH", 6);
    addPixelText(this, this.player.x - 9, this.player.y - 15, "DAD", 6);

    this.updateWrenchVisibility();
  }

  private createUi(): void {
    this.add.rectangle(8, 8, 236, 16, 0xfacc15).setOrigin(0, 0).setScrollFactor(0);
    this.questText = addPixelText(this, 12, 11, "", 8).setTint(0x111827).setScrollFactor(0);

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

    if (this.clutterZones.some((zone) => isNear(playerPosition, new Phaser.Math.Vector2(zone.x, zone.y), 42))) {
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

  private movePlayer(dx: number, dy: number): void {
    const nextX = Phaser.Math.Clamp(this.player.x + dx, 18, garageWorld.width - 18);
    const nextY = Phaser.Math.Clamp(this.player.y + dy, 32, garageWorld.height - 18);

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

  private addBlocker(
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
  ): Phaser.GameObjects.Rectangle {
    const blocker = this.add.rectangle(x, y, width, height, color)
      .setStrokeStyle(1, 0x0f172a);
    this.blockers.push(blocker);
    return blocker;
  }

  private addGarageClutter(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
  ): void {
    const blocker = this.addBlocker(x, y, width, height, 0x1f2937);
    this.clutterZones.push(blocker);

    const columns = Math.max(1, Math.floor(width / 28));
    for (let index = 0; index < columns; index += 1) {
      const spriteX = x - width / 2 + 18 + index * 28;
      const useInteriorProp = index % 2 === 0;
      const framePool = useInteriorProp ? interiorPropFrames : garagePropFrames;
      const frame = framePool[(index + Math.floor(x + y)) % framePool.length];
      const texture = useInteriorProp ? "interiors-free-16" : "dungeon-16";
      addWorldSprite(this, spriteX, y, { texture, frame }, 1);
    }

    addPixelText(this, x - width / 2 + 5, y + height / 2 - 10, label, 6).setTint(0xfacc15);
  }

  private addWrenchSprite(x: number, y: number): Phaser.GameObjects.Container {
    const pixels: Phaser.GameObjects.Rectangle[] = [];
    const scale = 2;
    const body = 0xb8b8ae;
    const outline = 0x050505;

    const plot = (px: number, py: number, color: number) => {
      pixels.push(
        this.add.rectangle(px * scale, py * scale, scale, scale, color)
          .setOrigin(0, 0),
      );
    };

    const rows = [
      "....XXXX..",
      "...XXBBXX.",
      "..XXBBBXX.",
      "..XBBBXX..",
      "..XBBX..XX",
      "..XBBX.XBX",
      "..XBBBXXBX",
      "...XBBBBX.",
      "..XXBBBXX.",
      ".XXBBBXX..",
      "XXBBBXX...",
      "XBBBXX....",
      "XBBXX.....",
      "XBX.......",
      "XXX.......",
    ];

    rows.forEach((row, py) => {
      [...row].forEach((cell, px) => {
        if (cell === "X") plot(px, py, outline);
        if (cell === "B") plot(px, py, body);
      });
    });

    plot(2, 13, outline);
    plot(3, 13, body);
    plot(4, 13, outline);

    return this.add.container(x - 10, y - 16, pixels);
  }

  private showMessage(message: DialogueLine | string): void {
    const line = typeof message === "string" ? { speaker: "DAD", text: message } : message;
    this.dialogueBox.show(line.text, this.getSpeakerLabel(line.speaker));
  }

  private hideMessage(): void {
    this.dialogueRunner.clear();
    this.dialogueBox.hide();
  }

  private getSpeakerLabel(speaker: string): string {
    return speaker === "DAD" ? this.state.player.name || "DAD" : speaker;
  }
}
