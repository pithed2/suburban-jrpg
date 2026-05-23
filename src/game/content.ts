import dialogueData from "../data/dialogue.json";
import enemiesData from "../data/enemies.json";
import itemsData from "../data/items.json";

export type DialogueKey = keyof typeof dialogueData;

export interface EnemyDefinition {
  id: string;
  name: string;
  hp: number;
  attack: number;
  emotionalMeaning: string;
  moves: string[];
}

export interface ItemDefinition {
  id: string;
  name: string;
  kind: string;
  heal?: number;
  power?: number;
  description: string;
}

export const dialogue = dialogueData;
export const enemies = enemiesData as EnemyDefinition[];
export const items = itemsData as ItemDefinition[];
