import Phaser from "phaser";
import { items, type EnemyActionResponse, type EnemyAttack, type EnemyDefinition } from "./content";
import { chooseDadSkill, type DadSkillDefinition } from "./dadSkills";
import {
  applyExperienceAndLevelUps,
  rollDadSkillDamage,
  rollEnemyDamage,
  rollHealing,
  rollHeroDamage,
  rollRunSuccess,
} from "./dragonWarriorMath";
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
}

export class BattleManager {
  private enemy?: EnemyDefinition;
  private enemyHp = 0;

  start(enemy: EnemyDefinition, state: GameState): BattleStartResult {
    this.enemy = enemy;
    this.enemyHp = enemy.hp;
    const ambushChance = this.getAmbushChance(enemy, state);

    if (Math.random() < ambushChance) {
      const enemyTurn = this.useEnemyTurn(state);

      return {
        ...enemyTurn,
        ambushed: true,
        message: `${enemy.initiative.ambushMessage}\n${enemyTurn.message}`,
      };
    }

    return {
      ...this.getSnapshot(state),
      ambushed: false,
    };
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

  useItem(state: GameState, itemId: string): BattleTurnResult {
    const itemIndex = state.player.inventory.indexOf(itemId);

    if (itemIndex === -1) {
      return {
        ...this.getSnapshot(state),
        message: "You pat every cargo pocket.\nNo useful items answer the call.",
        victory: false,
      };
    }

    state.player.inventory.splice(itemIndex, 1);
    const item = items.find((candidate) => candidate.id === itemId);

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

    if (enemy.id === "evil-heating-coil") {
      const retreatChance = state.flags.circuitBreakerOff ? 0.65 : 0.38;

      if (Math.random() < retreatChance) {
        return {
          ...this.getSnapshot(state),
          message: state.flags.circuitBreakerOff
            ? "Dad retreats with uncommon wisdom.\nThe powered-down coil cannot stop him."
            : "Dad dives away from the live dryer.\nSomehow, dignity escapes too.",
          victory: false,
          escaped: true,
        };
      }

      return {
        ...this.getSnapshot(state),
        message: "Dad looks for an exit.\nThe coil blocks the retreat.",
        victory: false,
      };
    }

    if (rollRunSuccess(state, enemy)) {
      return {
        ...this.getSnapshot(state),
        message: "Dad backs away with heroic caution.\nThe threat loses interest.",
        victory: false,
        escaped: true,
      };
    }

    return {
      ...this.getSnapshot(state),
      message: "Dad looks for a clean exit.\nNo dice.",
      victory: false,
    };
  }

  useEnemyTurn(state: GameState): EnemyTurnResult {
    const enemy = this.requireEnemy();
    const attack = this.getEnemyAttack(enemy, state);
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
      const rewardLabel = enemy.cashReward === 1 ? "Love Point" : "Love Points";

      return {
        ...this.getSnapshot(state),
        message: `${actionMessage}\n${enemy.name} gives one last ominous click.\nYOU GAINED ${enemy.xpReward} XP.\nDAD LOVE +${enemy.cashReward}.${levelUpMessage}`,
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

  private formatActionMessage(
    response: EnemyActionResponse,
    action: keyof EnemyDefinition["actionResponses"],
    state: GameState,
    damage: number,
    skill?: DadSkillDefinition,
  ): string {
    const weapon = items.find((item) => item.id === state.player.equipment.weaponId);
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
      return Phaser.Utils.Array.GetRandom(weapon.battleMessages);
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
    if (action === "fight") {
      const roll = rollHeroDamage(state, enemy);
      const tunedDamage = response.damageByWeapon?.[state.player.equipment.weaponId] ?? response.damage;
      return {
        amount: roll.dodged ? 0 : Math.max(1, Math.round((roll.amount + tunedDamage) / 2)),
        dodged: roll.dodged,
      };
    }

    const multiplier = skill?.multiplier ?? 1;
    return {
      amount: Math.max(response.damage, Math.round(rollDadSkillDamage(state, enemy) * multiplier)),
      dodged: false,
    };
  }

  private getEnemyAttack(enemy: EnemyDefinition, state: GameState): EnemyAttack {
    if (enemy.id === "evil-heating-coil") {
      if (state.flags.circuitBreakerOff) {
        return Phaser.Utils.Array.GetRandom([
          { message: "casts Static Shock of a Random Sock", damage: Phaser.Math.Between(6, 8) },
          { message: "crackles with low-power spite", damage: Phaser.Math.Between(6, 8) },
          { message: "snaps with unplugged-but-still-angry static", damage: Phaser.Math.Between(6, 8) },
        ]);
      }

      return Phaser.Utils.Array.GetRandom([
        { message: "casts Badass Zap", damage: Phaser.Math.Between(10, 15) },
        { message: "surges with fully powered appliance hatred", damage: Phaser.Math.Between(10, 15) },
        { message: "throws live current like it pays the mortgage", damage: Phaser.Math.Between(10, 15) },
      ]);
    }

    return Phaser.Utils.Array.GetRandom(enemy.attackPattern);
  }

  private applyEnemyAttack(state: GameState, enemy: EnemyDefinition, attack: EnemyAttack): number {
    const damage = rollEnemyDamage(state, enemy, attack.damage);
    state.player.hp = Math.max(0, state.player.hp - damage);
    return damage;
  }

  private getAmbushChance(enemy: EnemyDefinition, state: GameState): number {
    const levelAdvantage = Math.max(0, enemy.level - state.player.level);
    const rawChance = enemy.initiative.baseAmbushChance +
      levelAdvantage * enemy.initiative.levelAdvantageBonus;

    return Phaser.Math.Clamp(rawChance, 0, enemy.initiative.maxAmbushChance);
  }

  private requireEnemy(): EnemyDefinition {
    if (!this.enemy) {
      throw new Error("Battle has not started.");
    }

    return this.enemy;
  }
}
