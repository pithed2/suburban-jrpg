import Phaser from "phaser";
import type { EnemyDefinition } from "./content";
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

export class BattleManager {
  private enemy?: EnemyDefinition;
  private enemyHp = 0;

  start(enemy: EnemyDefinition): BattleSnapshot {
    this.enemy = enemy;
    this.enemyHp = enemy.hp;
    return this.getSnapshot();
  }

  useFight(state: GameState): BattleTurnResult {
    return this.resolveHeroAction(state, 5, "You use Percussive Maintenance.");
  }

  useDadSkill(state: GameState): BattleTurnResult {
    return this.resolveHeroAction(state, 7, "You take a Deep Sigh. The basement respects it.");
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

    const move = Phaser.Utils.Array.GetRandom(enemy.moves);
    state.player.hp = Math.max(1, state.player.hp - enemy.attack);

    return {
      ...this.getSnapshot(state),
      message: `You use Ibuprofen.\n${enemy.name} ${move}.`,
      victory: false,
    };
  }

  useRun(state: GameState): BattleTurnResult {
    const enemy = this.requireEnemy();
    const move = Phaser.Utils.Array.GetRandom(enemy.moves);
    state.player.hp = Math.max(1, state.player.hp - enemy.attack);

    return {
      ...this.getSnapshot(state),
      message: `You consider retreat.\nThe basement door feels very far away.\n${enemy.name} ${move}.`,
      victory: false,
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

  private resolveHeroAction(state: GameState, damage: number, actionMessage: string): BattleTurnResult {
    const enemy = this.requireEnemy();
    this.enemyHp = Math.max(0, this.enemyHp - damage);

    if (this.enemyHp <= 0) {
      return {
        ...this.getSnapshot(state),
        message: `${actionMessage}\n${enemy.name} gives one last ominous click.`,
        victory: true,
      };
    }

    const move = Phaser.Utils.Array.GetRandom(enemy.moves);
    state.player.hp = Math.max(1, state.player.hp - enemy.attack);

    return {
      ...this.getSnapshot(state),
      message: `${actionMessage}\n${enemy.name} ${move}.`,
      victory: false,
    };
  }

  private requireEnemy(): EnemyDefinition {
    if (!this.enemy) {
      throw new Error("Battle has not started.");
    }

    return this.enemy;
  }
}
