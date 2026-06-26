import type { GameState } from "./state";

export type DadSkillKind = "damage" | "heal";

export interface DadSkillDefinition {
  id: string;
  name: string;
  levelRequired: number;
  cost: number;
  kind: DadSkillKind;
  /** Damage skills: multiplies the base dadSkill damage roll. */
  multiplier?: number;
  /** Heal skills: HP restored range. */
  healMin?: number;
  healMax?: number;
}

export const DAD_SKILLS: DadSkillDefinition[] = [
  { id: "deep-sigh",          name: "Deep Sigh",          levelRequired: 1, cost: 3, kind: "damage", multiplier: 1 },
  { id: "authoritative-sigh", name: "Authoritative Sigh", levelRequired: 2, cost: 3, kind: "damage", multiplier: 1.3 },
  { id: "walk-it-off",        name: "Walk It Off",        levelRequired: 3, cost: 4, kind: "heal",   healMin: 10, healMax: 16 },
  { id: "dad-glare",          name: "Dad Glare",          levelRequired: 4, cost: 5, kind: "damage", multiplier: 1.6 },
];

export function getUnlockedDadSkills(level: number): DadSkillDefinition[] {
  return DAD_SKILLS.filter((skill) => skill.levelRequired <= level);
}

export function getDadSkillLearnedAtLevel(newLevel: number, oldLevel: number): DadSkillDefinition | undefined {
  return DAD_SKILLS.find((skill) => skill.levelRequired > oldLevel && skill.levelRequired <= newLevel);
}

/**
 * Dad doesn't pick a spell from a menu — he instinctively does the right thing.
 * Heal when hurt (if he's learned to), otherwise his strongest affordable attack.
 */
export function chooseDadSkill(state: GameState): DadSkillDefinition {
  const unlocked = getUnlockedDadSkills(state.player.level)
    .filter((skill) => state.player.dadPoints >= skill.cost);

  if (unlocked.length === 0) {
    return DAD_SKILLS[0];
  }

  const hpRatio = state.player.hp / state.player.maxHp;
  const healSkill = [...unlocked].reverse().find((skill) => skill.kind === "heal");
  if (hpRatio < 0.45 && healSkill) {
    return healSkill;
  }

  const damageSkills = unlocked.filter((skill) => skill.kind === "damage");
  return damageSkills[damageSkills.length - 1] ?? unlocked[unlocked.length - 1];
}
