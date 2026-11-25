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
    this.load.image("heating-coil-battle", "/assets-active/enemies/Heating_Coil.png");
    this.load.image("dryer-boss", "/assets-active/enemies/Heating_Coil.png");
    this.load.image("dryer-boss-world", "/assets-active/enemies/dryer_boss_world.png");
    this.load.image("dryer-fixed", "/assets-active/props/Happy_Dryer.png");
    this.load.image("dust-bunny", "/assets-active/enemies/Dust_Bunny.png");
    this.load.image("angry-dust-bunny", "/assets-active/enemies/Angry_Dust_Bunny_battle.png");
    this.load.image("icky-spider", "/assets-active/enemies/Icky_Spider_2.png"); // 74×64, pre-transparent
    this.load.image("single-ply-sam", "/assets-active/enemies/Single_Ply_Sam_battle.png");
    this.load.image("olfactory-ninja", "/assets-active/enemies/Olfactory_Ninja.png");
    this.load.image("toothpaste-slime", "/assets-active/enemies/toothpaste_slime.png");
    this.load.image("mold-patch", "/assets-active/enemies/mold-patch.png");
    this.load.image("clogged-toilet-battle", "/assets-active/enemies/clogged_toilet_boss.png");
    this.load.image("stink-bug", "/assets-active/enemies/stink_bug_battle.png");
    // Quest 3 (original art, made by scripts/art/quest3_art.py)
    this.load.image("crabgrass-creeper", "/assets-active/enemies/Crabgrass_Creeper.png");
    this.load.image("dandelion-puff", "/assets-active/enemies/Dandelion_Puff.png");
    this.load.image("lawn-grub", "/assets-active/enemies/Lawn_Grub.png");
    this.load.image("fire-ant-mound", "/assets-active/enemies/Fire_Ant_Mound.png");
    this.load.image("rogue-sprinkler", "/assets-active/enemies/Rogue_Sprinkler.png");
    this.load.image("vole-lieutenant", "/assets-active/enemies/Vole_Lieutenant.png");
    this.load.image("lucky-clover", "/assets-active/enemies/Lucky_Clover.png");
    this.load.image("mole-king", "/assets-active/enemies/Mole_King.png");
    this.load.spritesheet("lawn-tiles", "/assets-active/tilesets/lawn_16x16.png", { frameWidth: 16, frameHeight: 16 });
    this.load.audio("dramatic-bg", "/assets-active/audio/dramatic-bg.mp3");
    this.load.audio("home-bg", "/assets-active/audio/home-bg.mp3");
    this.load.audio("comfort-bg", "/assets-active/audio/comfort-bg.mp3");
    this.load.audio("mini-boss", "/assets-active/audio/mini-boss.mp3");
    this.load.image("intro-scene", "/assets-active/props/Intro.png");
    this.load.image("hd-cutscene", "/assets-active/props/HD_Cut_Scene.png");
    this.load.image("portrait-dad",        "/assets-active/portraits/dad.png");
    this.load.image("portrait-wife",       "/assets-active/portraits/wife.png");
    this.load.image("portrait-narrator",   "/assets-active/portraits/narrator.png");
    this.load.image("portrait-dads-brain", "/assets-active/portraits/brain.png");
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
    // Path: public/assets-active/characters/ → served at /assets-active/characters/
    // Layout per file: 3 walk-frames × 4 direction-rows per character block (48×64 px)
    // Multiple characters packed side-by-side — charSlot in characterDefs.ts picks the right one.
    // Garage tileset as a spritesheet so GarageScene can use individual frame indices.
    // Loaded alongside "ts-garage" (plain image) which TiledRoom uses separately.
    this.load.spritesheet(
      "garage-ts",
      "/assets-active/tilesets/Interiors_free/16x16/garage_basement_16x16.png",
      { frameWidth: 16, frameHeight: 16 },
    );

    const CHAR_PATH = "/assets-active/characters";
    const charSheet = (key: string, file: string) =>
      this.load.spritesheet(key, `${CHAR_PATH}/${file}`, { frameWidth: 16, frameHeight: 16 });

    charSheet("chars-generic",  "01-generic.png");   // 5 chars/row × 2 rows = 10 characters
    charSheet("chars-bard",     "02-bard.png");       // 4 chars/row × 2 rows =  8 characters
    charSheet("chars-soldier",  "03-soldier.png");    // 4 chars/row × 2 rows =  8 characters
    charSheet("chars-scout",    "04-scout.png");      // 4 chars/row × 2 rows =  8 characters
    charSheet("chars-devout",   "05-devout.png");     // 4 chars/row × 2 rows =  8 characters
    charSheet("chars-conjurer", "06-conjurer.png");   // 4 chars/row × 2 rows =  8 characters
    this.load.spritesheet("actors-4", "/assets-active/full_set/Characters/Actors_4.png", {
      frameWidth: 32,
      frameHeight: 48,
    });

    // Chest / treasure sprites (RPG Maker VX character sheet, 32×32 frames)
    this.load.spritesheet("chests", "/assets-active/full_set/Characters/Chests.png", {
      frameWidth: 32, frameHeight: 32,
    });
    this.load.spritesheet("full-set-doors", "/assets-active/full_set/Characters/!Doors.png", {
      frameWidth: 32, frameHeight: 32,
    });

    // Misc object sprites — "!other.png" from the full_set character set
    // 384×256 at 32×32 per frame = 12 cols × 8 rows = 96 frames
    // Circuit breaker panel: rows 5–8, cols 1–3 (RPG Maker 1-indexed)
    //   → row 5 col 1 = frame 48 (off)
    //   → row 7 col 3 = frame 74 (on)
    this.load.spritesheet("obj-other", "/assets-active/full_set/Characters/!other.png", {
      frameWidth: 32, frameHeight: 32,
    });

    // ── Interiors_free 16×16 tilesets (used by TiledRoom / new-house map) ───────
    // house-core-16 is already loaded above as a spritesheet; Phaser will use
    // the base texture for the tilemap so we don't need a second load.
    const INT = "/assets-active/tilesets/Interiors_free/16x16";
    this.load.image("ts-garage",   `${INT}/garage_basement_16x16.png`);
    this.load.image("ts-props",    `${INT}/props_interactables_16x16.png`);
    this.load.image("ts-exterior", `${INT}/suburb_exterior_16x16.png`);

    // full_set RPG-Maker-style tilesets (32×32 tiles)
    this.load.spritesheet(
      "full-set-int-a2",
      "/assets-active/full_set/Tilesets/Int-A2.png",
      { frameWidth: 32, frameHeight: 32 },
    );
    this.load.spritesheet(
      "full-set-int-a4",
      "/assets-active/full_set/Tilesets/Int-A4.png",
      { frameWidth: 32, frameHeight: 32 },
    );
    this.load.spritesheet(
      "full-set-int-b",
      "/assets-active/full_set/Tilesets/Int-B.png",
      { frameWidth: 32, frameHeight: 32 },
    );
    this.load.spritesheet(
      "full-set-int-c",
      "/assets-active/full_set/Tilesets/Int-C.png",
      { frameWidth: 32, frameHeight: 32 },
    );
    this.load.spritesheet(
      "kitchen-props",
      "/assets-active/tilesets/kitchen_LRK.png",
      { frameWidth: 16, frameHeight: 16 },
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
      .get("heating-coil-battle")
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures
      .get("dryer-boss")
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures
      .get("dryer-boss-world")
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("dust-bunny").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("angry-dust-bunny").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("single-ply-sam").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("olfactory-ninja").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("toothpaste-slime").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("mold-patch").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("clogged-toilet-battle").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("stink-bug").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("dryer-fixed").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("icky-spider").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("intro-scene").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("hd-cutscene").setFilter(Phaser.Textures.FilterMode.NEAREST);
    for (const key of ["portrait-dad", "portrait-wife", "portrait-narrator", "portrait-dads-brain"]) {
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
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
    for (const key of ["chars-generic","chars-bard","chars-soldier","chars-scout","chars-devout","chars-conjurer","actors-4"]) {
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    for (const key of ["ts-garage", "ts-props", "ts-exterior", "garage-ts"]) {
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    this.textures.get("full-set-int-a2").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("full-set-int-a4").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("full-set-int-b").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("full-set-int-c").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("kitchen-props").setFilter(Phaser.Textures.FilterMode.NEAREST);

    this.textures.get("chests").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("full-set-doors").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("obj-other").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.generateWrenchIcon();

    // Generate procedural placeholder character sheets.
    // Replace with real sprites by following the instructions in characterDefs.ts.
    generatePlaceholders(this);

    loadSavedGameState() ?? resetGameState();
    // New game: name entry, then the intro. A save past the intro continues in the house.
    const saved = getGameState();
    const pastIntro = saved.flags.talkedToWife || saved.quest.completedStepIds.includes("talk-to-wife") || saved.completedQuestIds.length > 0;
    const nextScene = !saved.player.name ? "NameEntryScene" : pastIntro ? "NeighborhoodScene" : "StoryIntroScene";
    this.scene.start(nextScene);
  }
}
