import { createInitialGameState, type GameState } from "./state";

const saveKey = "the-in-laws-are-coming-save";
const legacySaveKey = "suburban-jrpg-save";
let currentState = createInitialGameState();

export function getGameState(): GameState {
  return currentState;
}

export function resetGameState(): GameState {
  const playerName = currentState.player.name;
  currentState = createInitialGameState();
  currentState.player.name = playerName;
  return currentState;
}

export function clearSavedGameState(): GameState {
  localStorage.removeItem(saveKey);
  localStorage.removeItem(legacySaveKey);
  currentState = createInitialGameState();
  return currentState;
}

export function startFirstQuestGameState(playerName = "DAD"): GameState {
  currentState = createInitialGameState();
  currentState.player.name = playerName.trim() || "DAD";
  currentState.flags.talkedToWife = true;
  currentState.quest.activeStepId = "inspect-dryer";
  currentState.quest.completedStepIds = ["talk-to-wife"];
  saveGameState(currentState);
  return currentState;
}

export function saveGameState(state: GameState = currentState): void {
  localStorage.setItem(saveKey, JSON.stringify(state));
}

export function loadSavedGameState(): GameState | undefined {
  const saved = localStorage.getItem(saveKey) ?? localStorage.getItem(legacySaveKey);

  if (!saved) {
    return undefined;
  }

  currentState = normalizeGameState(JSON.parse(saved) as GameState);
  return currentState;
}

function normalizeGameState(state: GameState): GameState {
  const fallback = createInitialGameState();

  state.player.name ??= fallback.player.name;
  state.player.strength ??= fallback.player.strength;
  state.player.agility ??= fallback.player.agility;
  state.player.defense ??= fallback.player.defense;
  state.player.cash ??= fallback.player.cash;
  state.flags.circuitBreakerOff ??= fallback.flags.circuitBreakerOff;

  return state;
}
