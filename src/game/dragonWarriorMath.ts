import balanceData from "../data/balance.json";
import { items, type EnemyDefinition } from "./content";
import { random, randomInt } from "./engine/rng";
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

export interface LevelRow {
  level: number;
  xp: number;
  maxHp: number;
  maxDadPoints: number;
  strength: number;
  agility: number;
}

export const balance = balanceData;
export const levelTable: LevelRow[] = balanceData.levels;

export function getNextLevelXp(currentLevel: number): number | undefined {
  return levelTable.find((entry) => entry.level > currentLevel)?.xp;
}


function getWeaponPower(state: GameState): number {
  const weapon = items.find((item) => item.id === state.player.equipment.weaponId);
  return weapon?.power ?? 0;
}

function getArmorDefense(state: GameState): number {
  const armor = items.find((item) => item.id === state.player.equipment.armorId);
  return armor?.defense ?? 0;
}

/**
 * Enemy defense against Fight. defenseScale comes from boss modifiers
 * (for example a side-quest item that softens the boss).
 */
export function rollHeroDamage(state: GameState, enemy: EnemyDefinition, defenseScale = 1): DamageRoll {
  const dodgeChance = enemy.dodgeChance ?? balance.combat.defaultDodgeChance;

  if (random() < dodgeChance) {
    return { amount: 0, dodged: true };
  }

  const attackPower = state.player.strength + getWeaponPower(state);
  const enemyDefense = Math.floor(((enemy.agility ?? enemy.level * 3) / 2) * defenseScale);
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

/**
 * Enemy damage against Dad. The listed attack damage (+/-1) is the main
 * number, and the worn armor's defense comes off it, so armor always counts.
 * Enemy listed damage is tuned for the armor that balance.json expects in each
 * area; better armor than that makes the area easier. The stat formula is a
 * fallback for enemies whose attack stat outgrows their listed damage.
 */
export function rollEnemyDamage(state: GameState, enemy: EnemyDefinition, listedDamage: number): number {
  const armor = getArmorDefense(state);
  const defense = Math.floor(state.player.agility / 2) + state.player.defense + armor;
  const baseDamage = Math.max(1, Math.floor((enemy.attack - defense) / 2));
  const dramaticFloor = Math.max(1, listedDamage - 1);
  const dramaticCeiling = Math.max(dramaticFloor, listedDamage + 1);
  const dramatic = Math.max(1, randomInt(dramaticFloor, dramaticCeiling) - armor);
  return Math.max(dramatic, randomInt(1, baseDamage + 2));
}

export function rollHealing(min = 23, max = 30): number {
  return randomInt(min, max);
}

export function getRunChance(state: GameState, enemy: EnemyDefinition): number {
  const tuning = balance.combat.runChance;
  const heroAgility = state.player.agility;
  const enemyAgility = enemy.agility ?? enemy.level * 4;
  return Math.min(tuning.max, Math.max(tuning.min, tuning.base + (heroAgility - enemyAgility) * tuning.perAgilityPoint));
}

export function rollRunSuccess(state: GameState, enemy: EnemyDefinition, fixedChance?: number): boolean {
  return random() < (fixedChance ?? getRunChance(state, enemy));
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
