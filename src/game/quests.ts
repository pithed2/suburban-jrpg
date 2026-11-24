import fixBathroom from "../data/quests/fix-bathroom.json";
import fixDryer from "../data/quests/fix-dryer.json";
import type { Condition } from "./engine/conditions";
import type { LineSpec, ScriptEvents } from "./engine/script";
import type { QuestStepId } from "./state";

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
export const quests = [fixDryer, fixBathroom] as unknown as QuestDefinition[];

export function getQuest(questId: string): QuestDefinition {
  const quest = quests.find((candidate) => candidate.id === questId);

  if (!quest) {
    throw new Error(`Missing quest definition: ${questId}`);
  }

  return quest;
}

export function getQuestStepLabel(questId: string, stepId: QuestStepId): string {
  const step = getQuest(questId).steps.find((candidate) => candidate.id === stepId);

  if (!step) {
    throw new Error(`Missing quest step definition: ${questId}/${stepId}`);
  }

  return step.label;
}
