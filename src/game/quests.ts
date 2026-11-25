import fixBathroom from "../data/quests/fix-bathroom.json";
import fixDryer from "../data/quests/fix-dryer.json";
import reclaimLawn from "../data/quests/reclaim-lawn.json";
import type { Condition } from "./engine/conditions";
import type { LineSpec, ScriptEvents } from "./engine/script";
import type { GameState, QuestStepId } from "./state";

export interface QuestStepDefinition {
  id: QuestStepId;
  label: string;
}

export interface QuestDefinition {
  id: string;
  title: string;
  countdownLabel: string;
  steps: QuestStepDefinition[];
  /** Lines shown after Dad loses a battle during this quest. */
  defeat?: {
    lines: LineSpec[];
    /** First matching hint is spoken by DAD'S BRAIN. */
    hints?: Array<{ when?: Condition; text: string }>;
  };
  /**
   * Quest-specific events, keyed "<areaId>:<eventKey>". They win over the
   * area's own events with the same key.
   */
  events?: ScriptEvents;
}

/** Story order. Add new quest files here. */
export const quests = [fixDryer, fixBathroom, reclaimLawn] as unknown as QuestDefinition[];

export function getQuest(questId: string): QuestDefinition {
  const quest = quests.find((candidate) => candidate.id === questId);

  if (!quest) {
    throw new Error(`Missing quest definition: ${questId}`);
  }

  return quest;
}

export function getQuestStepLabel(questId: string, stepId: QuestStepId): string {
  const step = getQuest(questId).steps.find((candidate) => candidate.id === stepId);

  // Never crash the HUD on a bad save. npm run check catches bad data.
  return step?.label ?? stepId.toUpperCase();
}

/**
 * Fixes saves whose quest progress points at a step the quest does not have.
 * Older builds replayed the intro on every boot and forced "inspect-dryer"
 * into whatever quest was active. Returns true when it changed the state.
 */
export function repairQuestProgress(state: GameState): boolean {
  const quest = quests.find((candidate) => candidate.id === state.quest.questId);
  if (!quest) {
    const next = quests.find((candidate) => !state.completedQuestIds.includes(candidate.id)) ?? quests[quests.length - 1];
    state.quest = { questId: next.id, activeStepId: next.steps[0].id, completedStepIds: [] };
    return true;
  }

  const stepIds = new Set(quest.steps.map((step) => step.id));
  const completed = state.quest.completedStepIds.filter((id, index, all) => stepIds.has(id) && all.indexOf(id) === index);
  let changed = completed.length !== state.quest.completedStepIds.length;
  state.quest.completedStepIds = completed;

  if (!stepIds.has(state.quest.activeStepId)) {
    const next = quest.steps.find((step) => !completed.includes(step.id)) ?? quest.steps[quest.steps.length - 1];
    state.quest.activeStepId = next.id;
    changed = true;
  }

  return changed;
}
