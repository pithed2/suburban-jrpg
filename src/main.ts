import Phaser from "phaser";
import { BasementScene } from "./scenes/BasementScene";
import { BootScene } from "./scenes/BootScene";
import { NeighborhoodScene } from "./scenes/NeighborhoodScene";
import "./styles.css";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#1f2933",
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 320,
    height: 180,
  },
  scene: [BootScene, NeighborhoodScene, BasementScene],
};

new Phaser.Game(config);
