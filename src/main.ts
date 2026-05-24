import Phaser from "phaser";
import { BasementScene } from "./scenes/BasementScene";
import { BootScene } from "./scenes/BootScene";
import { GarageScene } from "./scenes/GarageScene";
import { NeighborhoodScene } from "./scenes/NeighborhoodScene";
import "./styles.css";

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
  scene: [BootScene, NeighborhoodScene, BasementScene, GarageScene],
};

new Phaser.Game(config);
