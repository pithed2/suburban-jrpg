import Phaser from "phaser";
import { resetGameState } from "../game/session";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create(): void {
    resetGameState();
    this.scene.start("NeighborhoodScene");
  }
}
