import Phaser from "phaser";
import { BasementScene } from "./scenes/BasementScene";
import { BootScene } from "./scenes/BootScene";
import { GarageScene } from "./scenes/GarageScene";
import { NeighborhoodScene } from "./scenes/NeighborhoodScene";
import { StoryIntroScene } from "./scenes/StoryIntroScene";
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
  scene: [BootScene, StoryIntroScene, NeighborhoodScene, BasementScene, GarageScene],
};

logger.info("starting game", { width: 320, height: 180, zoom: 3 });
new Phaser.Game(config);
