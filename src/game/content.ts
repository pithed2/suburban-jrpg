import dialogueData from "../data/dialogue.json";
import enemiesData from "../data/enemies.json";
import itemsData from "../data/items.json";
import { areas as areaList } from "./areaData";
import type { Condition } from "./engine/conditions";
import type { ScriptEvents, HotspotDefinition } from "./engine/script";

export type DialogueKey = keyof typeof dialogueData;

export interface EnemyDefinition {
  id: string;
  name: string;
  battleTexture?: string;
  level: number;
  hp: number;
  attack: number;
  agility?: number;
  dodgeChance?: number;
  xpReward: number;
  cashReward: number;
  emotionalMeaning: string;
  attackPattern: EnemyAttack[];
  actionResponses: EnemyActionResponses;
  initiative: EnemyInitiative;
  /** Bosses get boss music, cannot be skipped by encounter cooldowns, etc. */
  boss?: boolean;
  /** Audio key played during the battle. Loaded by BattleScene. */
  music?: string;
  /** dialogue.json enemyBanter key used after the enemy's turn. */
  banter?: string;
  /** dialogue.json dad.toEnemy mood used when the battle starts. */
  battleStartMood?: string;
  /** Fixed run chance (0-1). Without it the agility formula applies. */
  runChance?: number;
  runMessages?: { success?: string; fail?: string };
  /** Look of the enemy window. */
  battleView?: BattleView;
  /** Items the enemy may leave behind. Each entry rolls on its own. */
  drops?: Array<{ item: string; chance: number }>;
  /**
   * State-dependent changes, checked in order. Every matching modifier
   * applies; later ones override earlier ones field by field. This is how a
   * side-quest item or a switch makes a boss beatable.
   */
  modifiers?: EnemyModifier[];
}

export interface BattleView {
  /** Hex color of the enemy window, e.g. "#000000". */
  backdrop?: string;
  width?: number;
  height?: number;
  y?: number;
  /** Hex tint for palette-swapped enemies that share art, e.g. "#ffd54a". */
  tint?: string;
}

export interface EnemyModifier {
  when: Condition;
  /** Optional line shown when the battle starts and this modifier is active. */
  startMessage?: string;
  attackPattern?: EnemyAttack[];
  /** Multiplies enemy damage to Dad. */
  attackScale?: number;
  /** Multiplies the enemy defense used by Fight. */
  defenseScale?: number;
  /** Multiplies Dad's final damage (Fight and damage skills). */
  heroDamageScale?: number;
  runChance?: number;
  runMessages?: { success?: string; fail?: string };
  banter?: string;
}

export interface EnemyAttack {
  message: string;
  damage: number;
  /** When both are set, the listed damage is rolled in [damageMin, damageMax]. */
  damageMin?: number;
  damageMax?: number;
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

export interface AreaDefinition {
  id: string;
  label: string;
  /** Quest bar prefix (hold Q). "countdown" shows the quest's countdown label. */
  hud?: string;
  /** Item ids sold here, in menu order. */
  shop?: string[];
  /** Where Dad goes after a defeat or a "home" action. */
  returnTo: { scene: string; spawn?: string };
  /** Default enemy window color for battles in this area. */
  backdrop?: string;
  randomEncounters?: RandomEncounterDefinition;
  /** Interaction spots, checked in order. */
  hotspots?: HotspotDefinition[];
  /** Area-wide events. Quest files can override any key. */
  events?: ScriptEvents;
}

export interface RandomEncounterDefinition {
  enabled: boolean;
  /** World pixels walked between rolls (16 = one tile). */
  stepDistance: number;
  baseChance: number;
  cooldownRolls: number;
  /** No encounters while this passes. */
  disabledWhen?: Condition;
  introMessages: string[];
  entries: RandomEncounterEntry[];
}

export interface RandomEncounterEntry {
  enemyId: string;
  weight: number;
  minPlayerLevel?: number;
  maxPlayerLevel?: number;
  /** Entry only rolls while this passes. */
  when?: Condition;
  /**
   * Entry only rolls while Dad stands inside one of these [col0, row0, col1, row1]
   * rectangles (inclusive). Use it for deeper, tougher zones.
   */
  regions?: Array<[number, number, number, number]>;
  /** Per-enemy intro lines. Falls back to the area's introMessages if absent. */
  introMessages?: string[];
}

export interface ItemDefinition {
  id: string;
  name: string;
  kind: string;
  heal?: number;
  restoreDp?: number;
  power?: number;
  defense?: number;
  price?: number;
  battleMessage?: string;
  battleMessages?: string[];
  description: string;
}

export const dialogue = dialogueData;
export const enemies = enemiesData as EnemyDefinition[];
export const items = itemsData as ItemDefinition[];
export const areas = areaList;

export function getArea(areaId: string): AreaDefinition {
  const area = areas.find((candidate) => candidate.id === areaId);
  if (!area) throw new Error(`Missing area definition: ${areaId}`);
  return area;
}

export function getEnemy(enemyId: string): EnemyDefinition {
  const enemy = enemies.find((candidate) => candidate.id === enemyId);
  if (!enemy) throw new Error(`Missing enemy definition: ${enemyId}`);
  return enemy;
}

export function getItem(itemId: string): ItemDefinition | undefined {
  return items.find((candidate) => candidate.id === itemId);
}
