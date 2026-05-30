import Phaser from "phaser";
import {
  clearSavedGameState,
  getGameState,
  saveGameState,
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
      return;
    }

    if (event.code === "KeyE") {
      event.preventDefault();
      event.stopImmediatePropagation();
      const state = getGameState();
      state.flags.devRandomEncountersDisabled = !state.flags.devRandomEncountersDisabled;
      saveGameState(state);
      // eslint-disable-next-line no-console
      console.info(
        `Dev shortcut: random encounters ${state.flags.devRandomEncountersDisabled ? "disabled" : "enabled"}`,
      );
    }
  });
}
