import Phaser from "phaser";
import { generatePlaceholders } from "../game/characterDefs";
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
    this.load.spritesheet(
      "house-core-16",
      "/assets-active/tilesets/Interiors_free/16x16/house_core_16x16.png",
      {
        frameWidth: 16,
        frameHeight: 16,
      },
    );
    this.load.image("dryer-boss", "/assets-active/enemies/dryer_boss.png");
    this.load.image("dryer-boss-world", "/assets-active/enemies/dryer_boss_world.png");
    this.load.image("dust-bunny", "/assets-active/enemies/Dust_Bunny.png");
    this.load.image("icky-spider", "/assets-active/enemies/Icky_Spider_2.png"); // 74×64, pre-transparent
    this.load.image("circuit-breaker", "/assets-active/props/circuit_breaker.png");
    this.load.image("safety-sticker", "/assets-active/props/safety_sticker.png");
    this.load.image("stairs-up", "/assets-active/props/stairs_up.png");
    this.load.image("stairs-down", "/assets-active/tilesets/Stairs_Down.png");
    this.load.image("garage-door", "/assets-active/tilesets/Door_Single.png");
    this.load.bitmapFont(
      "dialogue-8x8",
      "/assets-active/fonts/round_6x6.png",
      "/assets-active/fonts/round_6x6-native.xml",
    );
    this.load.tilemapTiledJSON("house-map",     "/assets-active/maps/house.json");
    this.load.tilemapTiledJSON("basement-map",  "/assets-active/maps/basement.json");
    this.load.tilemapTiledJSON("garage-map",    "/assets-active/maps/garage.json");
    this.load.tilemapTiledJSON("new-house-map", "/assets-active/maps/new-house.json");

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

    // ── Character sheets (16×16 px/frame, RPG Maker VX layout) ─────────────────
    // Path: public/assets/characters/ → served at /assets/characters/
    // Layout per file: 3 walk-frames × 4 direction-rows per character block (48×64 px)
    // Multiple characters packed side-by-side — charSlot in characterDefs.ts picks the right one.
    // Garage tileset as a spritesheet so GarageScene can use individual frame indices.
    // Loaded alongside "ts-garage" (plain image) which TiledRoom uses separately.
    this.load.spritesheet(
      "garage-ts",
      "/assets-active/tilesets/Interiors_free/16x16/garage_basement_16x16.png",
      { frameWidth: 16, frameHeight: 16 },
    );

    const CHAR_PATH = "/assets/characters";
    const charSheet = (key: string, file: string) =>
      this.load.spritesheet(key, `${CHAR_PATH}/${file}`, { frameWidth: 16, frameHeight: 16 });

    charSheet("chars-generic",  "01-generic.png");   // 5 chars/row × 2 rows = 10 characters
    charSheet("chars-bard",     "02-bard.png");       // 4 chars/row × 2 rows =  8 characters
    charSheet("chars-soldier",  "03-soldier.png");    // 4 chars/row × 2 rows =  8 characters
    charSheet("chars-scout",    "04-scout.png");      // 4 chars/row × 2 rows =  8 characters
    charSheet("chars-devout",   "05-devout.png");     // 4 chars/row × 2 rows =  8 characters
    charSheet("chars-conjurer", "06-conjurer.png");   // 4 chars/row × 2 rows =  8 characters

    // Chest / treasure sprites (RPG Maker VX character sheet, 32×32 frames)
    this.load.spritesheet("chests", "/assets/full_set/Characters/Chests.png", {
      frameWidth: 32, frameHeight: 32,
    });
    this.load.spritesheet("full-set-doors", "/assets/full_set/Characters/!Doors.png", {
      frameWidth: 32, frameHeight: 32,
    });

    // Misc object sprites — "!other.png" from the full_set character set
    // 384×256 at 32×32 per frame = 12 cols × 8 rows = 96 frames
    // Circuit breaker panel: rows 5–8, cols 1–3 (RPG Maker 1-indexed)
    //   → row 5 col 1 = frame 48 (off)
    //   → row 7 col 3 = frame 74 (on)
    this.load.spritesheet("obj-other", "/assets/full_set/Characters/!other.png", {
      frameWidth: 32, frameHeight: 32,
    });

    // ── Interiors_free 16×16 tilesets (used by TiledRoom / new-house map) ───────
    // house-core-16 is already loaded above as a spritesheet; Phaser will use
    // the base texture for the tilemap so we don't need a second load.
    const INT = "/assets/tilesets/Interiors_free/16x16";
    this.load.image("ts-garage",   `${INT}/garage_basement_16x16.png`);
    this.load.image("ts-props",    `${INT}/props_interactables_16x16.png`);
    this.load.image("ts-exterior", `${INT}/suburb_exterior_16x16.png`);

    // full_set RPG-Maker-style tilesets (32×32 tiles)
    this.load.spritesheet(
      "full-set-int-a2",
      "/assets/full_set/Tilesets/Int-A2.png",
      { frameWidth: 32, frameHeight: 32 },
    );
    this.load.spritesheet(
      "full-set-int-a4",
      "/assets/full_set/Tilesets/Int-A4.png",
      { frameWidth: 32, frameHeight: 32 },
    );
    this.load.spritesheet(
      "full-set-int-b",
      "/assets/full_set/Tilesets/Int-B.png",
      { frameWidth: 32, frameHeight: 32 },
    );
  }

  /** Draws a tiny wrench icon for use in the inventory / item UI. */
  private generateWrenchIcon(): void {
    if (this.textures.exists("icon-wrench")) return;
    const g = this.add.graphics().setVisible(false);
    // Handle grip (dark)
    g.fillStyle(0x4b3621, 1);
    g.fillRect(1, 9, 6, 3);
    // Shaft
    g.fillStyle(0x9ca3af, 1);
    g.fillRect(5, 7, 8, 3);
    // Head jaw top
    g.fillRect(11, 4, 4, 3);
    // Head jaw bottom
    g.fillRect(11, 10, 4, 3);
    // Head bridge
    g.fillRect(13, 7, 2, 3);
    // Highlight
    g.fillStyle(0xd1d5db, 1);
    g.fillRect(6, 7, 6, 1);
    g.generateTexture("icon-wrench", 18, 16);
    g.destroy();
    this.textures.get("icon-wrench").setFilter(Phaser.Textures.FilterMode.NEAREST);
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
      .get("dryer-boss-world")
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("dust-bunny").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("icky-spider").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures
      .get("circuit-breaker")
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures
      .get("safety-sticker")
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures
      .get("stairs-up")
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures
      .get("stairs-down")
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures
      .get("garage-door")
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
    this.textures
      .get("house-core-16")
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
    for (const key of ["chars-generic","chars-bard","chars-soldier","chars-scout","chars-devout","chars-conjurer"]) {
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    for (const key of ["ts-garage", "ts-props", "ts-exterior", "garage-ts"]) {
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    this.textures.get("full-set-int-a2").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("full-set-int-a4").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("full-set-int-b").setFilter(Phaser.Textures.FilterMode.NEAREST);

    this.textures.get("chests").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("full-set-doors").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("obj-other").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.generateWrenchIcon();

    // Generate procedural placeholder character sheets.
    // Replace with real sprites by following the instructions in characterDefs.ts.
    generatePlaceholders(this);

    loadSavedGameState() ?? resetGameState();
    const nextScene = getGameState().player.name ? "StoryIntroScene" : "NameEntryScene";
    this.scene.start(nextScene);
  }
}
