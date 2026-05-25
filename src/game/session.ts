import { createInitialGameState, type GameState } from "./state";

const saveKey = "suburban-jrpg-save";
let currentState = createInitialGameState();

export function getGameState(): GameState {
  return currentState;
}

export function resetGameState(): GameState {
  currentState = createInitialGameState();
  return currentState;
}

export function saveGameState(state: GameState = currentState): void {
  localStorage.setItem(saveKey, JSON.stringify(state));
}

export function loadSavedGameState(): GameState | undefined {
  const saved = localStorage.getItem(saveKey);

  if (!saved) {
    return undefined;
  }

  currentState = normalizeGameState(JSON.parse(saved) as GameState);
  return currentState;
}

function normalizeGameState(state: GameState): GameState {
  const fallback = createInitialGameState();

  state.player.strength ??= fallback.player.strength;
  state.player.agility ??= fallback.player.agility;
  state.player.defense ??= fallback.player.defense;

  return state;
}
