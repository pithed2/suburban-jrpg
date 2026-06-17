import Phaser from "phaser";
import { BasementScene } from "./scenes/BasementScene";
import { BathroomScene } from "./scenes/BathroomScene";
import { BootScene } from "./scenes/BootScene";
import { GarageScene } from "./scenes/GarageScene";
import { HDCutScene } from "./scenes/HDCutScene";
import { HardwareStoreScene } from "./scenes/HardwareStoreScene";
import { NameEntryScene } from "./scenes/NameEntryScene";
import { NeighborhoodScene } from "./scenes/NeighborhoodScene";
import { StoryIntroScene } from "./scenes/StoryIntroScene";
import { TileRoomScene } from "./scenes/TileRoomScene";
import { installGlobalErrorLogging, logger } from "./game/logger";
import "./styles.css";

installGlobalErrorLogging();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#1f2933",
  pixelArt: true,
  roundPixels: true,
  render: {
    antialias: false,
    antialiasGL: false,
    pixelArt: true,
    roundPixels: true,
  },
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 320,
    height: 180,
    zoom: 3,
  },
  scene: [BootScene, NameEntryScene, StoryIntroScene, NeighborhoodScene, BasementScene, GarageScene, TileRoomScene, HDCutScene, HardwareStoreScene, BathroomScene],
};

logger.info("starting game", { width: 320, height: 180, zoom: 3 });
new Phaser.Game(config);
