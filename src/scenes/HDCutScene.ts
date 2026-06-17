import Phaser from "phaser";
import { addPixelText } from "../game/uiText";

const LINES = [
  { speaker: "NARRATOR",    text: "Dad jumps in the old cruiser, keys jangling with purpose." },
  { speaker: "NARRATOR",    text: "The path to THEE Dome Hepot. A path Dad knows all too well." },
  { speaker: "DAD'S BRAIN", text: "It's a wonderland in there. A fluorescent, orange-aproned wonderland." },
];

const W = 320;
const H = 180;

export class HDCutScene extends Phaser.Scene {
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private lineIndex = 0;
  private speakerText!: Phaser.GameObjects.BitmapText;
  private bodyText!: Phaser.GameObjects.BitmapText;
  private continueHint!: Phaser.GameObjects.BitmapText;
  private canAdvance = false;

  constructor() {
    super("HDCutScene");
  }

  create(): void {
    this.lineIndex = 0;
    this.canAdvance = false;
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Black letterbox background
    this.add.rectangle(0, 0, W, H, 0x000000).setOrigin(0, 0);

    // Cinematic image — centred, scaled to fill width with letterbox bars
    const img = this.add.image(W / 2, 66, "hd-cutscene");
    const scaleX = W / img.width;
    const scaleY = 100 / img.height;
    img.setScale(Math.min(scaleX, scaleY));
    img.setY(Math.round(img.displayHeight / 2 + 8));

    // Letterbox bars
    this.add.rectangle(0, 0, W, 8, 0x000000).setOrigin(0, 0);
    const imgBottom = img.y + img.displayHeight / 2;
    this.add.rectangle(0, imgBottom, W, H - imgBottom, 0x000000).setOrigin(0, 0);

    // Dialogue panel
    const panelTop = imgBottom + 2;
    const panelH = H - panelTop - 2;
    this.add.rectangle(4, panelTop, W - 8, panelH, 0x111827, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0xf96302, 1);

    // HD orange accent stripe
    this.add.rectangle(4, panelTop, W - 8, 3, 0xf96302).setOrigin(0, 0);

    this.speakerText = addPixelText(this, 10, panelTop + 6, "", 7)
      .setTint(0xf96302);

    this.bodyText = addPixelText(this, 10, panelTop + 17, "", 7)
      .setTint(0xffffff)
      .setMaxWidth(W - 20);

    this.continueHint = addPixelText(this, W - 6, H - 5, "SPACE", 6)
      .setTint(0xf96302)
      .setAlpha(0)
      .setOrigin(1, 1);

    this.showLine(0);
  }

  update(): void {
    if (!this.canAdvance) return;
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.advance();
    }
  }

  private showLine(index: number): void {
    this.canAdvance = false;
    this.continueHint.setAlpha(0);

    const line = LINES[index];
    this.speakerText.setText(line.speaker);
    this.bodyText.setText(line.text);

    this.time.delayedCall(300, () => {
      this.canAdvance = true;
      this.tweens.add({
        targets: this.continueHint,
        alpha: { from: 0, to: 0.7 },
        duration: 400,
        yoyo: true,
        repeat: -1,
      });
    });
  }

  private advance(): void {
    this.tweens.killTweensOf(this.continueHint);
    this.continueHint.setAlpha(0);
    this.lineIndex++;

    if (this.lineIndex >= LINES.length) {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.scene.start("HardwareStoreScene");
      });
      return;
    }

    this.showLine(this.lineIndex);
  }
}
