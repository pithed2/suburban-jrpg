import Phaser from "phaser";
import type { GameState } from "./state";
import { addPixelText, setPixelText } from "./uiText";

export class PlayerStatsPanel {
  private readonly box: Phaser.GameObjects.Rectangle;
  private readonly text: Phaser.GameObjects.BitmapText;
  private idleMs = 0;

  constructor(scene: Phaser.Scene, x = 50, y = 66) {
    this.box = scene.add.rectangle(x, y, 82, 92, 0x050505, 0.95)
      .setStrokeStyle(2, 0xf8fafc)
      .setDepth(60)
      .setScrollFactor(0)
      .setVisible(false);

    this.text = addPixelText(scene, x - 31, y - 39, "", 7)
      .setDepth(61)
      .setScrollFactor(0)
      .setVisible(false);
  }

  update(deltaMs: number, isIdle: boolean, state: GameState): void {
    if (!isIdle) {
      this.idleMs = 0;
      this.setVisible(false);
      return;
    }

    this.idleMs += deltaMs;

    if (this.idleMs < 2000) {
      return;
    }

    const player = state.player;
    setPixelText(
      this.text,
      `${player.name || "DAD"}\nLV ${player.level}\nHP ${player.hp}\nDP ${player.dadPoints}\nLOVE ${player.cash}\nXP ${player.xp}`,
    );
    this.setVisible(true);
  }

  hide(): void {
    this.idleMs = 0;
    this.setVisible(false);
  }

  private setVisible(visible: boolean): void {
    this.box.setVisible(visible);
    this.text.setVisible(visible);
  }
}
