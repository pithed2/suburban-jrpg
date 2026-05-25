import Phaser from "phaser";
import { items, type EnemyActionResponse, type EnemyAttack, type EnemyDefinition } from "./content";
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
}

export interface BattleStartResult extends BattleSnapshot {
  ambushed: boolean;
  message?: string;
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
    const skillCost = 3;

    if (state.player.dadPoints < skillCost) {
      return {
        ...this.getSnapshot(state),
        message: "Dad reaches for inner calm.\nNot enough Dad Points.",
        victory: false,
      };
    }

    state.player.dadPoints -= skillCost;
    return this.resolveHeroAction(state, "dadSkill");
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
    const healing = item?.heal ? rollHealing(Math.max(1, item.heal - 3), item.heal + 4) : rollHealing();
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + healing);

    return {
      ...this.getSnapshot(state),
      message: `You use Ibuprofen.\nHP recovers by ${healing}.`,
      victory: false,
    };
  }

  useRun(state: GameState): BattleTurnResult {
    const enemy = this.requireEnemy();

    if (enemy.id === "evil-heating-coil") {
      return {
        ...this.getSnapshot(state),
        message: "Dad looks for an exit.\nThe coil blocks the only responsible path.",
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
    const attack = this.getEnemyAttack(enemy);
    const damage = this.applyEnemyAttack(state, enemy, attack);

    return {
      ...this.getSnapshot(state),
      message: `${enemy.name} ${attack.message}.\n${damage} damage.`,
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
  ): BattleTurnResult {
    const enemy = this.requireEnemy();
    const response = enemy.actionResponses[action];
    const damageRoll = this.getActionDamage(response, action, state, enemy);
    const damage = damageRoll.amount;
    this.enemyHp = Math.max(0, this.enemyHp - damage);
    const actionMessage = damageRoll.dodged
      ? `${enemy.name} dodges the attack.`
      : this.formatActionMessage(response, action, state, damage);

    if (this.enemyHp <= 0) {
      state.player.cash += enemy.cashReward;
      const levelUp = applyExperienceAndLevelUps(state, enemy.xpReward);
      const levelUpMessage = levelUp.message ? `\n${levelUp.message}` : "";

      return {
        ...this.getSnapshot(state),
        message: `${actionMessage}\n${enemy.name} gives one last ominous click.\n${enemy.xpReward} XP. $${enemy.cashReward}.${levelUpMessage}`,
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
  ): string {
    const weapon = items.find((item) => item.id === state.player.equipment.weaponId);
    const message = action === "fight" && weapon?.battleMessage ? weapon.battleMessage : response.message;
    const effect = response.effectLabel ? ` (${response.effectLabel})` : "";
    return `${message}\n${damage} damage${effect}.`;
  }

  private getActionDamage(
    response: EnemyActionResponse,
    action: keyof EnemyDefinition["actionResponses"],
    state: GameState,
    enemy: EnemyDefinition,
  ): { amount: number; dodged: boolean } {
    if (action === "fight") {
      const roll = rollHeroDamage(state, enemy);
      const tunedDamage = response.damageByWeapon?.[state.player.equipment.weaponId] ?? response.damage;
      return {
        amount: roll.dodged ? 0 : Math.max(1, Math.round((roll.amount + tunedDamage) / 2)),
        dodged: roll.dodged,
      };
    }

    return {
      amount: Math.max(response.damage, rollDadSkillDamage(state, enemy)),
      dodged: false,
    };
  }

  private getEnemyAttack(enemy: EnemyDefinition): EnemyAttack {
    return Phaser.Utils.Array.GetRandom(enemy.attackPattern);
  }

  private applyEnemyAttack(state: GameState, enemy: EnemyDefinition, attack: EnemyAttack): number {
    const damage = rollEnemyDamage(state, enemy, attack.damage);
    state.player.hp = Math.max(1, state.player.hp - damage);
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
