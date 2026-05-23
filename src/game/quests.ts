import questsData from "../data/quests.json";
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
}

export const quests = questsData as QuestDefinition[];

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

