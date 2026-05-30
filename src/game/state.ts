export type QuestStepId =
  | "talk-to-wife"
  | "inspect-dryer"
  | "find-wrench"
  | "flip-breaker"
  | "defeat-heating-coil"
  | "restore-power"
  | "return-to-wife";

export interface QuestProgress {
  questId: string;
  activeStepId: QuestStepId;
  completedStepIds: QuestStepId[];
}

export interface PlayerState {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  dadPoints: number;
  maxDadPoints: number;
  strength: number;
  agility: number;
  defense: number;
  cash: number;
  xp: number;
  inventory: string[];
  equipment: {
    weaponId: string;
  };
}

export interface GameFlags {
  talkedToWife: boolean;
  inspectedDryer: boolean;
  foundWrench: boolean;
  circuitBreakerOff: boolean;
  bossDefeated: boolean;
  dryerFixed: boolean;
  devRandomEncountersDisabled: boolean;
}

export interface GameState {
  player: PlayerState;
  quest: QuestProgress;
  flags: GameFlags;
}

export function createInitialGameState(): GameState {
  return {
    player: {
      name: "",
      level: 1,
      hp: 24,
      maxHp: 24,
      dadPoints: 8,
      maxDadPoints: 8,
      strength: 8,
      agility: 5,
      defense: 2,
      cash: 12,
      xp: 0,
      inventory: ["ibuprofen"],
      equipment: {
        weaponId: "percussive-maintenance",
      },
    },
    quest: {
      questId: "fix-dryer",
      activeStepId: "talk-to-wife",
      completedStepIds: [],
    },
    flags: {
      talkedToWife: false,
      inspectedDryer: false,
      foundWrench: false,
      circuitBreakerOff: false,
      bossDefeated: false,
      dryerFixed: false,
      devRandomEncountersDisabled: false,
    },
  };
}

export function completeQuestStep(state: GameState, stepId: QuestStepId): void {
  if (!state.quest.completedStepIds.includes(stepId)) {
    state.quest.completedStepIds.push(stepId);
  }
}

export function setActiveQuestStep(state: GameState, stepId: QuestStepId): void {
  state.quest.activeStepId = stepId;
}
