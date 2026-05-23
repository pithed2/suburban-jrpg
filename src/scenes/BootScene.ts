import Phaser from "phaser";
import { resetGameState } from "../game/session";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    this.load.spritesheet(
      "sixteen-pixel",
      "/assets/vendor/16Pixel/16%20Pixel%20Assets.png",
      {
        frameWidth: 16,
        frameHeight: 16,
      },
    );

    this.load.spritesheet(
      "kenney-1bit",
      "/assets/vendor/kenney-1-bit/Tilesheet/colored-transparent_packed.png",
      {
        frameWidth: 16,
        frameHeight: 16,
      },
    );
  }

  create(): void {
    resetGameState();
    this.scene.start("NeighborhoodScene");
  }
}
