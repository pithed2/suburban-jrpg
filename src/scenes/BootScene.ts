import Phaser from "phaser";
import { resetGameState } from "../game/session";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    this.load.image("suburban-placeholder", "/assets/tilesets/suburban-placeholder.png");
    this.load.image("floor-options", "/assets/tilesets/floor-options.png");
    this.load.image("dryer-boss", "/assets/enemies/dryer_boss.png");
    this.load.bitmapFont(
      "dialogue-8x8",
      "/assets/fonts/round_6x6.png",
      "/assets/fonts/round_6x6-native.xml",
    );
    this.load.tilemapTiledJSON("house-map", "/assets/maps/house.json");
    this.load.tilemapTiledJSON("basement-map", "/assets/maps/basement.json");
    this.load.tilemapTiledJSON("garage-map", "/assets/maps/garage.json");

    this.load.spritesheet(
      "sixteen-pixel",
      "/assets/vendor/16Pixel/16%20Pixel%20Assets.png",
      {
        frameWidth: 16,
        frameHeight: 16,
      },
    );
  }

  create(): void {
    this.textures
      .get("dialogue-8x8")
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures
      .get("dryer-boss")
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
    resetGameState();
    this.scene.start("NeighborhoodScene");
  }
}
