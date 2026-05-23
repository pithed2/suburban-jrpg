import Phaser from "phaser";
import { items, type EnemyActionResponse, type EnemyAttack, type EnemyDefinition } from "./content";
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
    return this.resolveHeroAction(state, "dadSkill");
  }

  useItem(state: GameState, itemId: string): BattleTurnResult {
    const enemy = this.requireEnemy();
    const itemIndex = state.player.inventory.indexOf(itemId);

    if (itemIndex === -1) {
      return {
        ...this.getSnapshot(state),
        message: "You pat every cargo pocket.\nNo useful items answer the call.",
        victory: false,
      };
    }

    state.player.inventory.splice(itemIndex, 1);
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 10);

    return {
      ...this.getSnapshot(state),
      message: "You use Ibuprofen.\nThe pain retreats to a more manageable zip code.",
      victory: false,
    };
  }

  useRun(state: GameState): BattleTurnResult {
    return {
      ...this.getSnapshot(state),
      message: "You consider retreat.\nThe basement door feels very far away.",
      victory: false,
    };
  }

  useEnemyTurn(state: GameState): EnemyTurnResult {
    const enemy = this.requireEnemy();
    const attack = this.getEnemyAttack(enemy);
    this.applyEnemyAttack(state, attack);

    return {
      ...this.getSnapshot(state),
      message: `${enemy.name} ${attack.message}.\n${attack.damage} damage.`,
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
    const damage = this.getActionDamage(response, action, state);
    this.enemyHp = Math.max(0, this.enemyHp - damage);
    const actionMessage = this.formatActionMessage(response, action, state, damage);

    if (this.enemyHp <= 0) {
      return {
        ...this.getSnapshot(state),
        message: `${actionMessage}\n${enemy.name} gives one last ominous click.`,
        victory: true,
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
  ): number {
    if (action === "fight") {
      return response.damageByWeapon?.[state.player.equipment.weaponId] ?? response.damage;
    }

    return response.damage;
  }

  private getEnemyAttack(enemy: EnemyDefinition): EnemyAttack {
    return Phaser.Utils.Array.GetRandom(enemy.attackPattern);
  }

  private applyEnemyAttack(state: GameState, attack: EnemyAttack): void {
    state.player.hp = Math.max(1, state.player.hp - attack.damage);
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
