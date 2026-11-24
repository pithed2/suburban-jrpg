import { getItem, type EnemyActionResponse, type EnemyAttack, type EnemyDefinition, type EnemyModifier } from "./content";
import { chooseDadSkill, type DadSkillDefinition } from "./dadSkills";
import {
  applyExperienceAndLevelUps,
  rollDadSkillDamage,
  rollEnemyDamage,
  rollHealing,
  rollHeroDamage,
  rollRunSuccess,
} from "./dragonWarriorMath";
import { matches } from "./engine/conditions";
import { clamp, pick, random, randomInt } from "./engine/rng";
import type { GameState } from "./state";

export interface BattleSnapshot {
  enemy: EnemyDefinition;
  enemyHp: number;
  enemyMaxHp: number;
  heroHp: number;
  heroMaxHp: number;
}

export interface BattleTurnResult extends BattleSnapshot {
  message: string;
  victory: boolean;
  escaped?: boolean;
  xpReward?: number;
  cashReward?: number;
  leveledUp?: boolean;
}

export interface EnemyTurnResult extends BattleSnapshot {
  message: string;
  defeated: boolean;
}

export interface BattleStartResult extends BattleSnapshot {
  ambushed: boolean;
  message?: string;
  defeated?: boolean;
  /** Lines from active modifiers, e.g. "The coil is powered down." */
  modifierMessages: string[];
}

/** The enemy as it fights right now: base data plus every active modifier. */
export interface ResolvedEnemy {
  attackPattern: EnemyAttack[];
  attackScale: number;
  defenseScale: number;
  heroDamageScale: number;
  runChance?: number;
  runMessages: { success?: string; fail?: string };
  banter?: string;
  startMessages: string[];
}

export function resolveEnemy(enemy: EnemyDefinition, state: GameState): ResolvedEnemy {
  const resolved: ResolvedEnemy = {
    attackPattern: enemy.attackPattern,
    attackScale: 1,
    defenseScale: 1,
    heroDamageScale: 1,
    runChance: enemy.runChance,
    runMessages: { ...enemy.runMessages },
    banter: enemy.banter,
    startMessages: [],
  };

  for (const modifier of enemy.modifiers ?? []) {
    if (!matches(state, modifier.when)) continue;
    applyModifier(resolved, modifier);
  }

  return resolved;
}

function applyModifier(target: ResolvedEnemy, modifier: EnemyModifier): void {
  if (modifier.attackPattern) target.attackPattern = modifier.attackPattern;
  if (modifier.attackScale !== undefined) target.attackScale *= modifier.attackScale;
  if (modifier.defenseScale !== undefined) target.defenseScale *= modifier.defenseScale;
  if (modifier.heroDamageScale !== undefined) target.heroDamageScale *= modifier.heroDamageScale;
  if (modifier.runChance !== undefined) target.runChance = modifier.runChance;
  if (modifier.runMessages) target.runMessages = { ...target.runMessages, ...modifier.runMessages };
  if (modifier.banter) target.banter = modifier.banter;
  if (modifier.startMessage) target.startMessages.push(modifier.startMessage);
}

/**
 * Turn logic for one battle. No Phaser and no drawing: BattleScene draws it,
 * and the balance simulator runs it headless.
 */
export class BattleManager {
  private enemy?: EnemyDefinition;
  private resolved?: ResolvedEnemy;
  private enemyHp = 0;

  start(enemy: EnemyDefinition, state: GameState): BattleStartResult {
    this.enemy = enemy;
    this.enemyHp = enemy.hp;
    this.resolved = resolveEnemy(enemy, state);
    const modifierMessages = this.resolved.startMessages;
    const ambushChance = this.getAmbushChance(enemy, state);

    if (random() < ambushChance) {
      const enemyTurn = this.useEnemyTurn(state);

      return {
        ...enemyTurn,
        ambushed: true,
        message: `${enemy.initiative.ambushMessage}\n${enemyTurn.message}`,
        modifierMessages,
      };
    }

    return {
      ...this.getSnapshot(state),
      ambushed: false,
      modifierMessages,
    };
  }

  get banter(): string | undefined {
    return this.resolved?.banter;
  }

  useFight(state: GameState): BattleTurnResult {
    return this.resolveHeroAction(state, "fight");
  }

  useDadSkill(state: GameState): BattleTurnResult {
    const skill = chooseDadSkill(state);

    if (state.player.dadPoints < skill.cost) {
      return {
        ...this.getSnapshot(state),
        message: "Dad reaches for inner calm.\nNot enough Dad Points.",
        victory: false,
      };
    }

    state.player.dadPoints -= skill.cost;

    if (skill.kind === "heal") {
      const healing = rollHealing(skill.healMin ?? 10, skill.healMax ?? 16);
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + healing);
      return {
        ...this.getSnapshot(state),
        message: `Dad uses ${skill.name}.\nHP restored by ${healing}.`,
        victory: false,
      };
    }

    return this.resolveHeroAction(state, "dadSkill", skill);
  }

  useItem(state: GameState, itemId: string | undefined): BattleTurnResult {
    const itemIndex = itemId ? state.player.inventory.indexOf(itemId) : -1;

    if (!itemId || itemIndex === -1) {
      return {
        ...this.getSnapshot(state),
        message: "You pat every cargo pocket.\nNo useful items answer the call.",
        victory: false,
      };
    }

    state.player.inventory.splice(itemIndex, 1);
    const item = getItem(itemId);

    if (item?.restoreDp) {
      const restored = Math.min(state.player.maxDadPoints - state.player.dadPoints, item.restoreDp);
      state.player.dadPoints = Math.min(state.player.maxDadPoints, state.player.dadPoints + item.restoreDp);
      return {
        ...this.getSnapshot(state),
        message: `You use ${item.name}.\nDad Points recover by ${restored}.`,
        victory: false,
      };
    }

    const healing = item?.heal ? rollHealing(Math.max(1, item.heal - 3), item.heal + 4) : rollHealing();
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + healing);

    return {
      ...this.getSnapshot(state),
      message: `You use ${item?.name ?? "Ibuprofen"}.\nHP recovers by ${healing}.`,
      victory: false,
    };
  }

  useRun(state: GameState): BattleTurnResult {
    const enemy = this.requireEnemy();
    const resolved = this.requireResolved();

    if (rollRunSuccess(state, enemy, resolved.runChance)) {
      return {
        ...this.getSnapshot(state),
        message: resolved.runMessages.success ?? "Dad backs away with heroic caution.\nThe threat loses interest.",
        victory: false,
        escaped: true,
      };
    }

    return {
      ...this.getSnapshot(state),
      message: resolved.runMessages.fail ?? "Dad looks for a clean exit.\nNo dice.",
      victory: false,
    };
  }

  useEnemyTurn(state: GameState): EnemyTurnResult {
    const enemy = this.requireEnemy();
    const attack = pick(this.requireResolved().attackPattern);
    const damage = this.applyEnemyAttack(state, enemy, attack);

    return {
      ...this.getSnapshot(state),
      message: `${enemy.name} ${attack.message}.\n${damage} damage.`,
      defeated: state.player.hp <= 0,
    };
  }

  getSnapshot(state?: GameState): BattleSnapshot {
    const enemy = this.requireEnemy();

    return {
      enemy,
      enemyHp: this.enemyHp,
      enemyMaxHp: enemy.hp,
      heroHp: state?.player.hp ?? 24,
      heroMaxHp: state?.player.maxHp ?? 24,
    };
  }

  private resolveHeroAction(
    state: GameState,
    action: keyof EnemyDefinition["actionResponses"],
    skill?: DadSkillDefinition,
  ): BattleTurnResult {
    const enemy = this.requireEnemy();
    const response = enemy.actionResponses[action];
    const damageRoll = this.getActionDamage(response, action, state, enemy, skill);
    const damage = damageRoll.amount;
    this.enemyHp = Math.max(0, this.enemyHp - damage);
    const actionMessage = damageRoll.dodged
      ? `${enemy.name} dodges the attack.`
      : this.formatActionMessage(response, action, state, damage, skill);

    if (this.enemyHp <= 0) {
      state.player.cash += enemy.cashReward;
      const levelUp = applyExperienceAndLevelUps(state, enemy.xpReward);
      const levelUpMessage = levelUp.message ? `\n${levelUp.message}` : "";
      const dropMessage = this.rollDrops(enemy, state);

      return {
        ...this.getSnapshot(state),
        message: `${actionMessage}\n${enemy.name} gives one last ominous click.\nYOU GAINED ${enemy.xpReward} XP.\nDAD LOVE +${enemy.cashReward}.${dropMessage}${levelUpMessage}`,
        victory: true,
        xpReward: enemy.xpReward,
        cashReward: enemy.cashReward,
        leveledUp: levelUp.leveledUp,
      };
    }

    return {
      ...this.getSnapshot(state),
      message: actionMessage,
      victory: false,
    };
  }

  private rollDrops(enemy: EnemyDefinition, state: GameState): string {
    const found: string[] = [];
    for (const drop of enemy.drops ?? []) {
      if (random() >= drop.chance) continue;
      state.player.inventory.push(drop.item);
      found.push((getItem(drop.item)?.name ?? drop.item).toUpperCase());
    }
    return found.length ? `\nIT DROPPED ${found.join(" AND ")}!` : "";
  }

  private formatActionMessage(
    response: EnemyActionResponse,
    action: keyof EnemyDefinition["actionResponses"],
    state: GameState,
    damage: number,
    skill?: DadSkillDefinition,
  ): string {
    const weapon = getItem(state.player.equipment.weaponId);
    let message = action === "fight" && weapon
      ? this.getWeaponBattleMessage(weapon, response.message)
      : response.message;

    if (action === "dadSkill" && skill) {
      message = `Dad uses ${skill.name}! ${message}`;
    }

    const effect = response.effectLabel ? ` (${response.effectLabel})` : "";
    return `${message}\n${damage} damage${effect}.`;
  }

  private getWeaponBattleMessage(
    weapon: { battleMessage?: string; battleMessages?: string[] },
    fallback: string,
  ): string {
    if (weapon.battleMessages?.length) {
      return pick(weapon.battleMessages);
    }

    return weapon.battleMessage ?? fallback;
  }

  private getActionDamage(
    response: EnemyActionResponse,
    action: keyof EnemyDefinition["actionResponses"],
    state: GameState,
    enemy: EnemyDefinition,
    skill?: DadSkillDefinition,
  ): { amount: number; dodged: boolean } {
    const resolved = this.requireResolved();
    const scale = (amount: number) => Math.max(1, Math.round(amount * resolved.heroDamageScale));

    if (action === "fight") {
      const roll = rollHeroDamage(state, enemy, resolved.defenseScale);
      const tunedDamage = response.damageByWeapon?.[state.player.equipment.weaponId] ?? response.damage;
      return {
        amount: roll.dodged ? 0 : scale(Math.max(1, Math.round((roll.amount + tunedDamage) / 2))),
        dodged: roll.dodged,
      };
    }

    const multiplier = skill?.multiplier ?? 1;
    return {
      amount: scale(Math.max(response.damage, Math.round(rollDadSkillDamage(state, enemy) * multiplier))),
      dodged: false,
    };
  }

  private applyEnemyAttack(state: GameState, enemy: EnemyDefinition, attack: EnemyAttack): number {
    const listed = attack.damageMin !== undefined && attack.damageMax !== undefined
      ? randomInt(attack.damageMin, attack.damageMax)
      : attack.damage;
    const raw = rollEnemyDamage(state, enemy, listed);
    const damage = Math.max(1, Math.round(raw * this.requireResolved().attackScale));
    state.player.hp = Math.max(0, state.player.hp - damage);
    return damage;
  }

  private getAmbushChance(enemy: EnemyDefinition, state: GameState): number {
    const levelAdvantage = Math.max(0, enemy.level - state.player.level);
    const rawChance = enemy.initiative.baseAmbushChance +
      levelAdvantage * enemy.initiative.levelAdvantageBonus;

    return clamp(rawChance, 0, enemy.initiative.maxAmbushChance);
  }

  private requireEnemy(): EnemyDefinition {
    if (!this.enemy) {
      throw new Error("Battle has not started.");
    }

    return this.enemy;
  }

  private requireResolved(): ResolvedEnemy {
    if (!this.resolved) {
      throw new Error("Battle has not started.");
    }

    return this.resolved;
  }
}
