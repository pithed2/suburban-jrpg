import type { GameState } from "../state";

/**
 * A condition block used by quest events, encounter tables and boss modifiers.
 * Every listed check must pass. An empty or missing block always passes.
 */
export interface Condition {
  /** All of these flags are true. */
  flags?: string[];
  /** None of these flags are true. */
  notFlags?: string[];
  /** Dad carries every one of these items (inventory or equipped). */
  items?: string[];
  /** Dad carries none of these items. */
  notItems?: string[];
  /** Dad has this weapon or armor equipped. */
  equipped?: string[];
  /** The active quest is this one. */
  quest?: string;
  /** The active quest step is one of these. */
  step?: string | string[];
  /** These quest steps are complete (in the active quest). */
  stepsDone?: string[];
  /** These quests are complete. */
  questsDone?: string[];
  /** These chest or pickup ids are opened. */
  opened?: string[];
  notOpened?: string[];
  minLevel?: number;
  maxLevel?: number;
  /** Passes when any one of the nested blocks passes. */
  any?: Condition[];
  /** Passes when the nested block fails. */
  not?: Condition;
}

export function hasItem(state: GameState, itemId: string): boolean {
  const { inventory, equipment } = state.player;
  return inventory.includes(itemId) || equipment.weaponId === itemId || equipment.armorId === itemId;
}

export function matches(state: GameState, condition: Condition | undefined): boolean {
  if (!condition) return true;
  const { flags, player, quest } = state;

  if (condition.flags && !condition.flags.every((flag) => flags[flag])) return false;
  if (condition.notFlags && condition.notFlags.some((flag) => flags[flag])) return false;
  if (condition.items && !condition.items.every((id) => hasItem(state, id))) return false;
  if (condition.notItems && condition.notItems.some((id) => hasItem(state, id))) return false;
  if (condition.equipped && !condition.equipped.every(
    (id) => player.equipment.weaponId === id || player.equipment.armorId === id,
  )) return false;
  if (condition.quest && quest.questId !== condition.quest) return false;
  if (condition.step !== undefined) {
    const steps = Array.isArray(condition.step) ? condition.step : [condition.step];
    if (!steps.includes(quest.activeStepId)) return false;
  }
  if (condition.stepsDone && !condition.stepsDone.every((id) => quest.completedStepIds.includes(id))) return false;
  if (condition.questsDone && !condition.questsDone.every((id) => state.completedQuestIds.includes(id))) return false;
  if (condition.opened && !condition.opened.every((id) => state.openedChestIds.includes(id))) return false;
  if (condition.notOpened && condition.notOpened.some((id) => state.openedChestIds.includes(id))) return false;
  if (condition.minLevel !== undefined && player.level < condition.minLevel) return false;
  if (condition.maxLevel !== undefined && player.level > condition.maxLevel) return false;
  if (condition.any && !condition.any.some((nested) => matches(state, nested))) return false;
  if (condition.not && matches(state, condition.not)) return false;

  return true;
}
