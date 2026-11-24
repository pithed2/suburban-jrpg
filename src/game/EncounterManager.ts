import {
  getArea,
  getEnemy,
  type AreaDefinition,
  type EnemyDefinition,
  type RandomEncounterDefinition,
  type RandomEncounterEntry,
} from "./content";
import { matches } from "./engine/conditions";
import { random } from "./engine/rng";
import type { GameState } from "./state";

export interface RandomEncounterResult {
  enemy: EnemyDefinition;
  introMessages: string[];
}

interface Point {
  x: number;
  y: number;
}

/**
 * Rolls random encounters as Dad walks. Rules come from the area file:
 * src/data/areas/<id>.json -> randomEncounters.
 */
export class RandomEncounterTracker {
  private lastPosition?: Point;
  private distanceSinceRoll = 0;
  private cooldownRollsRemaining = 0;
  private readonly area: AreaDefinition;

  constructor(areaId: string) {
    this.area = getArea(areaId);
  }

  update(position: Point, state: GameState): RandomEncounterResult | undefined {
    const randomEncounters = this.area.randomEncounters;

    if (!this.canRoll(randomEncounters, state)) {
      this.lastPosition = { ...position };
      return undefined;
    }

    if (!this.lastPosition) {
      this.lastPosition = { ...position };
      return undefined;
    }

    this.distanceSinceRoll += Math.hypot(position.x - this.lastPosition.x, position.y - this.lastPosition.y);
    this.lastPosition = { ...position };

    if (this.distanceSinceRoll < randomEncounters.stepDistance) {
      return undefined;
    }

    this.distanceSinceRoll = 0;

    if (this.cooldownRollsRemaining > 0) {
      this.cooldownRollsRemaining -= 1;
      return undefined;
    }

    if (random() >= randomEncounters.baseChance) {
      return undefined;
    }

    const entry = this.pickEntry(randomEncounters.entries, state);

    if (!entry) {
      return undefined;
    }

    this.cooldownRollsRemaining = randomEncounters.cooldownRolls;

    return {
      enemy: getEnemy(entry.enemyId),
      // Per-enemy intro lines win over the area-wide ones.
      introMessages: entry.introMessages ?? randomEncounters.introMessages,
    };
  }

  resetPosition(position: Point): void {
    this.lastPosition = { ...position };
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

    return !(randomEncounters.disabledWhen && matches(state, randomEncounters.disabledWhen));
  }

  private pickEntry(entries: RandomEncounterEntry[], state: GameState): RandomEncounterEntry | undefined {
    const eligibleEntries = entries.filter((entry) => {
      const minimumMet = entry.minPlayerLevel === undefined || state.player.level >= entry.minPlayerLevel;
      const maximumMet = entry.maxPlayerLevel === undefined || state.player.level <= entry.maxPlayerLevel;
      return minimumMet && maximumMet && matches(state, entry.when);
    });

    const totalWeight = eligibleEntries.reduce((sum, entry) => sum + entry.weight, 0);

    if (totalWeight <= 0) {
      return undefined;
    }

    let roll = random() * totalWeight;

    for (const entry of eligibleEntries) {
      roll -= entry.weight;

      if (roll <= 0) {
        return entry;
      }
    }

    return undefined;
  }
}
