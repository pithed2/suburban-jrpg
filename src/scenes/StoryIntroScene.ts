import Phaser from "phaser";
import { addPixelText, setPixelText } from "../game/uiText";

const introLines = [
  "TWELVE DAYS UNTIL THE IN-LAWS ARRIVE.",
  "THE HOUSE HAS CHOSEN THIS MOMENT TO BECOME A QUEST LOG.",
  "ONE DAD. ONE DRYER. MANY SUSPICIOUS NOISES.",
];

export class StoryIntroScene extends Phaser.Scene {
  private advanceKey!: Phaser.Input.Keyboard.Key;
  private lineText!: Phaser.GameObjects.BitmapText;
  private promptText!: Phaser.GameObjects.BitmapText;
  private lineIndex = 0;

  constructor() {
    super("StoryIntroScene");
  }

  create(): void {
    this.advanceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.add.rectangle(160, 90, 320, 180, 0x1f2933);
    this.add.rectangle(160, 66, 248, 80, 0x050505, 0.96)
      .setStrokeStyle(2, 0xf8fafc);
    addPixelText(this, 55, 28, "THE IN-LAWS", 8).setTint(0xfacc15);
    addPixelText(this, 54, 42, "ARE COMING", 8).setTint(0xfacc15);
    addPixelText(this, 84, 56, "A SUBURBAN RPG", 6).setTint(0xfb923c);

    this.add.rectangle(160, 142, 304, 56, 0x050505, 0.96)
      .setStrokeStyle(2, 0xf8fafc);
    addPixelText(this, 18, 114, "DAD BRAIN", 6).setTint(0xfb923c);
    this.lineText = addPixelText(this, 18, 125, introLines[0], 7).setMaxWidth(284);
    this.promptText = addPixelText(this, 204, 164, "SPACE", 6).setTint(0x93c5fd);
  }

  update(): void {
    this.promptText.setAlpha(this.time.now % 900 < 650 ? 1 : 0.3);

    if (!Phaser.Input.Keyboard.JustDown(this.advanceKey)) {
      return;
    }

    this.lineIndex += 1;

    if (this.lineIndex >= introLines.length) {
      this.scene.start("NeighborhoodScene");
      return;
    }

    setPixelText(this.lineText, introLines[this.lineIndex]);
  }
}
