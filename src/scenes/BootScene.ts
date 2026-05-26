import Phaser from "phaser";
import { logger } from "../game/logger";
import { getGameState, loadSavedGameState, resetGameState } from "../game/session";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    logger.info("boot preload");

    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      logger.error("asset load failed", {
        key: file.key,
        type: file.type,
        url: file.url,
      });
    });

    this.load.image("suburban-placeholder", "/assets-active/tilesets/suburban-placeholder.png");
    this.load.image("floor-options", "/assets-active/tilesets/floor-options.png");
    this.load.spritesheet(
      "interiors-free-16",
      "/assets-active/tilesets/Interiors_free/16x16/Interiors_free_16x16.png",
      {
        frameWidth: 16,
        frameHeight: 16,
      },
    );
    this.load.image("dryer-boss", "/assets-active/enemies/dryer_boss.png");
    this.load.bitmapFont(
      "dialogue-8x8",
      "/assets-active/fonts/round_6x6.png",
      "/assets-active/fonts/round_6x6-native.xml",
    );
    this.load.tilemapTiledJSON("house-map", "/assets-active/maps/house.json");
    this.load.tilemapTiledJSON("basement-map", "/assets-active/maps/basement.json");
    this.load.tilemapTiledJSON("garage-map", "/assets-active/maps/garage.json");

    this.load.spritesheet(
      "dad-bob-idle",
      "/assets-active/tilesets/Characters_free/Bob_idle_16x16.png",
      {
        frameWidth: 16,
        frameHeight: 32,
      },
    );

    this.load.spritesheet(
      "wife-amelia-idle",
      "/assets-active/tilesets/Characters_free/Amelia_idle_16x16.png",
      {
        frameWidth: 16,
        frameHeight: 32,
      },
    );

    this.load.spritesheet(
      "dungeon-16",
      "/assets-active/tilesets/0x72_16x16DungeonTileset.v5.png",
      {
        frameWidth: 16,
        frameHeight: 16,
      },
    );

    this.load.spritesheet(
      "sixteen-pixel",
      "/assets-active/vendor/16Pixel/16%20Pixel%20Assets.png",
      {
        frameWidth: 16,
        frameHeight: 16,
      },
    );
  }

  create(): void {
    logger.info("boot create");

    this.textures
      .get("dialogue-8x8")
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures
      .get("dryer-boss")
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures
      .get("dungeon-16")
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures
      .get("dad-bob-idle")
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures
      .get("wife-amelia-idle")
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
    loadSavedGameState() ?? resetGameState();
    const nextScene = getGameState().player.name ? "StoryIntroScene" : "NameEntryScene";
    this.scene.start(nextScene);
  }
}
