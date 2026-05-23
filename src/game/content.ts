import dialogueData from "../data/dialogue.json";
import enemiesData from "../data/enemies.json";
import encounterAreasData from "../data/encounterAreas.json";
import itemsData from "../data/items.json";
import type { GameFlags, QuestStepId } from "./state";

export type DialogueKey = keyof typeof dialogueData;

export interface EnemyDefinition {
  id: string;
  name: string;
  level: number;
  hp: number;
  attack: number;
  emotionalMeaning: string;
  attackPattern: EnemyAttack[];
  actionResponses: EnemyActionResponses;
  initiative: EnemyInitiative;
}

export interface EnemyAttack {
  message: string;
  damage: number;
}

export interface EnemyActionResponse {
  damage: number;
  damageByWeapon?: Record<string, number>;
  message: string;
  effectLabel?: string;
}

export interface EnemyActionResponses {
  fight: EnemyActionResponse;
  dadSkill: EnemyActionResponse;
}

export interface EnemyInitiative {
  baseAmbushChance: number;
  levelAdvantageBonus: number;
  maxAmbushChance: number;
  ambushMessage: string;
}

export interface EncounterAreaDefinition {
  id: string;
  label: string;
  randomEncounters?: RandomEncounterDefinition;
  fixedEncounters: FixedEncounterDefinition[];
}

export interface RandomEncounterDefinition {
  enabled: boolean;
  stepDistance: number;
  baseChance: number;
  cooldownRolls: number;
  disabledWhenFlags?: Array<keyof GameFlags>;
  introMessages: string[];
  entries: RandomEncounterEntry[];
}

export interface RandomEncounterEntry {
  enemyId: string;
  weight: number;
  minPlayerLevel?: number;
  maxPlayerLevel?: number;
}

export interface FixedEncounterDefinition {
  enemyId: string;
  kind: "boss" | "blocker" | "event";
  x: number;
  y: number;
  requiredQuestStepId?: QuestStepId;
}

export interface ItemDefinition {
  id: string;
  name: string;
  kind: string;
  heal?: number;
  power?: number;
  battleMessage?: string;
  description: string;
}

export const dialogue = dialogueData;
export const enemies = enemiesData as EnemyDefinition[];
export const encounterAreas = encounterAreasData as EncounterAreaDefinition[];
export const items = itemsData as ItemDefinition[];
