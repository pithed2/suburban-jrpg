import { items, type EnemyDefinition } from "./content";
import { getDadSkillLearnedAtLevel } from "./dadSkills";
import type { GameState } from "./state";

export interface DamageRoll {
  amount: number;
  dodged: boolean;
}

export interface LevelUpResult {
  leveledUp: boolean;
  message?: string;
}

export const levelTable = [
  { level: 1, xp: 0, maxHp: 24, maxDadPoints: 8, strength: 8, agility: 5 },
  { level: 2, xp: 8, maxHp: 30, maxDadPoints: 10, strength: 11, agility: 7 },
  { level: 3, xp: 24, maxHp: 38, maxDadPoints: 12, strength: 14, agility: 9 },
  { level: 4, xp: 48, maxHp: 46, maxDadPoints: 15, strength: 18, agility: 12 },
];

export function getNextLevelXp(currentLevel: number): number | undefined {
  return levelTable.find((entry) => entry.level > currentLevel)?.xp;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getWeaponPower(state: GameState): number {
  const weapon = items.find((item) => item.id === state.player.equipment.weaponId);
  return weapon?.power ?? 0;
}

function getArmorDefense(state: GameState): number {
  const armor = items.find((item) => item.id === state.player.equipment.armorId);
  return armor?.defense ?? 0;
}

export function rollHeroDamage(state: GameState, enemy: EnemyDefinition): DamageRoll {
  const dodgeChance = (enemy.dodgeChance ?? 1 / 64);

  if (Math.random() < dodgeChance) {
    return { amount: 0, dodged: true };
  }

  const attackPower = state.player.strength + getWeaponPower(state);
  const enemyDefense = Math.floor((enemy.agility ?? enemy.level * 3) / 2);
  const baseDamage = Math.max(1, Math.floor((attackPower - enemyDefense) / 2));
  const spread = Math.max(1, Math.floor(baseDamage / 4));

  return {
    amount: randomInt(Math.max(1, baseDamage - spread), baseDamage + spread),
    dodged: false,
  };
}

export function rollDadSkillDamage(state: GameState, enemy: EnemyDefinition): number {
  const focus = Math.ceil(state.player.agility / 2) + state.player.level;
  const enemyResistance = Math.floor((enemy.agility ?? 0) / 4);
  const baseDamage = Math.max(2, focus + 4 - enemyResistance);
  return randomInt(Math.max(2, baseDamage - 2), baseDamage + 3);
}

export function rollEnemyDamage(state: GameState, enemy: EnemyDefinition, listedDamage: number): number {
  const defense = Math.floor(state.player.agility / 2) + state.player.defense + getArmorDefense(state);
  const baseDamage = Math.max(1, Math.floor((enemy.attack - defense) / 2));
  const dramaticFloor = Math.max(1, listedDamage - 1);
  const dramaticCeiling = Math.max(dramaticFloor, listedDamage + 1);
  return Math.max(randomInt(dramaticFloor, dramaticCeiling), randomInt(1, baseDamage + 2));
}

export function rollHealing(min = 23, max = 30): number {
  return randomInt(min, max);
}

export function rollRunSuccess(state: GameState, enemy: EnemyDefinition): boolean {
  const heroAgility = state.player.agility;
  const enemyAgility = enemy.agility ?? enemy.level * 4;
  const chance = Math.min(0.92, Math.max(0.18, 0.45 + (heroAgility - enemyAgility) * 0.04));
  return Math.random() < chance;
}

export function applyExperienceAndLevelUps(state: GameState, xpReward: number): LevelUpResult {
  const previousLevel = state.player.level;
  const previousMaxHp = state.player.maxHp;
  const previousMaxDadPoints = state.player.maxDadPoints;
  const previousStrength = state.player.strength;
  const previousDefense = state.player.defense;
  state.player.xp += xpReward;

  const nextLevel = [...levelTable].reverse().find((entry) => state.player.xp >= entry.xp);

  if (!nextLevel || nextLevel.level <= state.player.level) {
    return { leveledUp: false };
  }

  state.player.level = nextLevel.level;
  state.player.maxHp = nextLevel.maxHp;
  state.player.hp = nextLevel.maxHp;
  state.player.maxDadPoints = nextLevel.maxDadPoints;
  state.player.dadPoints = nextLevel.maxDadPoints;
  state.player.strength = nextLevel.strength;
  state.player.agility = nextLevel.agility;
  state.player.defense = Math.floor(nextLevel.agility / 2);
  const learnedSkill = getDadSkillLearnedAtLevel(nextLevel.level, previousLevel);
  const skillLine = learnedSkill ? `\nNEW DAD SKILL: ${learnedSkill.name}.` : "";

  return {
    leveledUp: true,
    message: [
      `LEVEL UP! DAD REACHED LV ${nextLevel.level}!`,
      `MAX HP ${previousMaxHp} -> ${nextLevel.maxHp}.`,
      `MAX DP ${previousMaxDadPoints} -> ${nextLevel.maxDadPoints}.`,
      `STR ${previousStrength} -> ${nextLevel.strength}. DEF ${previousDefense} -> ${state.player.defense}.`,
      `HP AND DP RESTORED.${skillLine}`,
    ].join("\n"),
  };
}
