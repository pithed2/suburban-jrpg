import dialogueData from "../data/dialogue.json";
import enemiesData from "../data/enemies.json";
import itemsData from "../data/items.json";

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
export const items = itemsData as ItemDefinition[];
