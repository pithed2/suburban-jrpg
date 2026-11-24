/** Quest step ids live in src/data/quests/*.json. */
export type QuestStepId = string;

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
    armorId: string;
  };
}

/**
 * Story flags. Quest data can read and write any flag name, so this is an open
 * map. Unknown flags read as undefined (false).
 */
export type GameFlags = Record<string, boolean>;

export interface GameState {
  player: PlayerState;
  quest: QuestProgress;
  flags: GameFlags;
  openedChestIds: string[];
  completedQuestIds: string[];
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
      inventory: [],
      equipment: {
        weaponId: "two-hands",
        armorId: "dads-cardigan",
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
      basementFirstAidOpened: false,
      visitedHomeDepot: false,
      ownsPlunger: false,
      toiletInspected: false,
      clogBossDefeated: false,
      bathroomFixed: false,
      toiletPaperFound: false,
      rubberDuckFound: false,
    },
    openedChestIds: [],
    completedQuestIds: [],
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
