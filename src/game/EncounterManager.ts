import Phaser from "phaser";
import {
  encounterAreas,
  enemies,
  type EncounterAreaDefinition,
  type EnemyDefinition,
  type RandomEncounterDefinition,
  type RandomEncounterEntry,
} from "./content";
import type { GameState } from "./state";

export interface RandomEncounterResult {
  enemy: EnemyDefinition;
  introMessages: string[];
}

export class RandomEncounterTracker {
  private lastPosition?: Phaser.Math.Vector2;
  private distanceSinceRoll = 0;
  private cooldownRollsRemaining = 0;
  private readonly area: EncounterAreaDefinition;

  constructor(areaId: string) {
    const area = encounterAreas.find((candidate) => candidate.id === areaId);

    if (!area) {
      throw new Error(`Missing encounter area definition: ${areaId}`);
    }

    this.area = area;
  }

  update(position: Phaser.Math.Vector2, state: GameState): RandomEncounterResult | undefined {
    const randomEncounters = this.area.randomEncounters;

    if (!this.canRoll(randomEncounters, state)) {
      this.lastPosition = position.clone();
      return undefined;
    }

    if (!this.lastPosition) {
      this.lastPosition = position.clone();
      return undefined;
    }

    this.distanceSinceRoll += Phaser.Math.Distance.BetweenPoints(this.lastPosition, position);
    this.lastPosition = position.clone();

    if (this.distanceSinceRoll < randomEncounters.stepDistance) {
      return undefined;
    }

    this.distanceSinceRoll = 0;

    if (this.cooldownRollsRemaining > 0) {
      this.cooldownRollsRemaining -= 1;
      return undefined;
    }

    if (Math.random() >= randomEncounters.baseChance) {
      return undefined;
    }

    const enemy = this.pickEnemy(randomEncounters.entries, state);

    if (!enemy) {
      return undefined;
    }

    this.cooldownRollsRemaining = randomEncounters.cooldownRolls;

    // Use per-enemy intro messages if the entry defines them;
    // otherwise fall back to the area-wide intro messages.
    const matchedEntry = randomEncounters.entries.find(
      (e) => e.enemyId === enemy.id,
    );
    const introMessages = matchedEntry?.introMessages ?? randomEncounters.introMessages;

    return { enemy, introMessages };
  }

  resetPosition(position: Phaser.Math.Vector2): void {
    this.lastPosition = position.clone();
    this.distanceSinceRoll = 0;
  }

  private canRoll(
    randomEncounters: RandomEncounterDefinition | undefined,
    state: GameState,
  ): randomEncounters is RandomEncounterDefinition {
    if (!randomEncounters?.enabled) {
      return false;
    }

    if (state.flags.devRandomEncountersDisabled) {
      return false;
    }

    return !randomEncounters.disabledWhenFlags?.some((flag) => state.flags[flag]);
  }

  private pickEnemy(entries: RandomEncounterEntry[], state: GameState): EnemyDefinition | undefined {
    const eligibleEntries = entries.filter((entry) => {
      const minimumMet = entry.minPlayerLevel === undefined || state.player.level >= entry.minPlayerLevel;
      const maximumMet = entry.maxPlayerLevel === undefined || state.player.level <= entry.maxPlayerLevel;
      return minimumMet && maximumMet;
    });

    const totalWeight = eligibleEntries.reduce((sum, entry) => sum + entry.weight, 0);

    if (totalWeight <= 0) {
      return undefined;
    }

    let roll = Math.random() * totalWeight;

    for (const entry of eligibleEntries) {
      roll -= entry.weight;

      if (roll <= 0) {
        return enemies.find((enemy) => enemy.id === entry.enemyId);
      }
    }

    return undefined;
  }
}
