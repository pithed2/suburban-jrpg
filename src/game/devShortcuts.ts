import Phaser from "phaser";
import {
  clearSavedGameState,
  getGameState,
  startFirstQuestGameState,
} from "./session";

export function installDevShortcuts(scene: Phaser.Scene): void {
  const keyboard = scene.input.keyboard;

  if (!keyboard) {
    return;
  }

  keyboard.on("keydown", (event: KeyboardEvent) => {
    if (!event.shiftKey) {
      return;
    }

    if (event.code === "KeyD") {
      event.preventDefault();
      event.stopImmediatePropagation();
      startFirstQuestGameState(getGameState().player.name || "DAD");
      scene.scene.start("NeighborhoodScene");
      return;
    }

    if (event.code === "KeyC") {
      event.preventDefault();
      event.stopImmediatePropagation();
      clearSavedGameState();
      scene.scene.start("NameEntryScene");
    }
  });
}
