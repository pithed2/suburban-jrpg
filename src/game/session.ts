import { createInitialGameState, type GameState } from "./state";

let currentState = createInitialGameState();

export function getGameState(): GameState {
  return currentState;
}

export function resetGameState(): GameState {
  currentState = createInitialGameState();
  return currentState;
}

