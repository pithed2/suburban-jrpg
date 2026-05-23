export type QuestStepId =
  | "talk-to-wife"
  | "inspect-dryer"
  | "find-wrench"
  | "defeat-heating-coil"
  | "return-to-wife";

export interface QuestProgress {
  questId: string;
  activeStepId: QuestStepId;
  completedStepIds: QuestStepId[];
}

export interface PlayerState {
  level: number;
  hp: number;
  maxHp: number;
  inventory: string[];
  equipment: {
    weaponId: string;
  };
}

export interface GameFlags {
  talkedToWife: boolean;
  inspectedDryer: boolean;
  basementDustCleared: boolean;
  foundWrench: boolean;
  bossDefeated: boolean;
  dryerFixed: boolean;
}

export interface GameState {
  player: PlayerState;
  quest: QuestProgress;
  flags: GameFlags;
}

export function createInitialGameState(): GameState {
  return {
    player: {
      level: 1,
      hp: 24,
      maxHp: 24,
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
      basementDustCleared: false,
      foundWrench: false,
      bossDefeated: false,
      dryerFixed: false,
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
