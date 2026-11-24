/**
 * Cross-checks the content files: every enemy, item, quest step, event and
 * scene a script names must exist. Typos in JSON fail here, not mid-game.
 */
import { areas } from "../src/game/areaData";
import { dialogue, enemies, items } from "../src/game/content";
import type { Condition } from "../src/game/engine/conditions";
import { voiceLine, type Action, type LineSpec, type Rule } from "../src/game/engine/script";
import { quests } from "../src/game/quests";

const SCENES = [
  "NeighborhoodScene", "BasementScene", "GarageScene", "BathroomScene", "HardwareStoreScene",
  "HDCutScene", "TileRoomScene", "NameEntryScene", "StoryIntroScene",
];

export function validateContent(): string[] {
  const problems: string[] = [];
  const enemyIds = new Set(enemies.map((enemy) => enemy.id));
  const itemIds = new Set(items.map((item) => item.id));
  const questIds = new Set(quests.map((quest) => quest.id));
  const allSteps = new Set(quests.flatMap((quest) => quest.steps.map((step) => step.id)));
  const areaIds = new Set(areas.map((area) => area.id));

  const dup = (label: string, ids: string[]) => {
    const seen = new Set<string>();
    ids.forEach((id) => { if (seen.has(id)) problems.push(`duplicate ${label} id: ${id}`); seen.add(id); });
  };
  dup("enemy", enemies.map((e) => e.id));
  dup("item", items.map((i) => i.id));
  dup("quest", quests.map((q) => q.id));
  dup("step", quests.flatMap((q) => q.steps.map((s) => s.id)));

  const checkCondition = (where: string, condition?: Condition) => {
    if (!condition) return;
    [...(condition.items ?? []), ...(condition.notItems ?? []), ...(condition.equipped ?? [])]
      .forEach((id) => { if (!itemIds.has(id)) problems.push(`${where}: unknown item ${id}`); });
    const steps = condition.step === undefined ? [] : Array.isArray(condition.step) ? condition.step : [condition.step];
    [...steps, ...(condition.stepsDone ?? [])]
      .forEach((id) => { if (!allSteps.has(id)) problems.push(`${where}: unknown step ${id}`); });
    [condition.quest, ...(condition.questsDone ?? [])].filter(Boolean)
      .forEach((id) => { if (!questIds.has(id!)) problems.push(`${where}: unknown quest ${id}`); });
    condition.any?.forEach((nested) => checkCondition(where, nested));
    checkCondition(where, condition.not);
  };

  const checkLines = (where: string, lines: LineSpec[]) => {
    for (const line of lines) {
      if (Array.isArray(line)) continue;
      if ("narrate" in line) {
        if (!Array.isArray((dialogue as Record<string, unknown>)[line.narrate])) problems.push(`${where}: no dialogue list ${line.narrate}`);
        continue;
      }
      if (line.voice) {
        try {
          if (!voiceLine(line.voice)) problems.push(`${where}: voice pool is empty: ${line.voice}`);
        } catch (error) {
          problems.push(`${where}: ${(error as Error).message}`);
        }
      }
    }
  };

  const checkActions = (where: string, actions: Action[], eventKeys: Set<string>) => {
    for (const action of actions) {
      if ("say" in action) checkLines(where, action.say);
      if ("complete" in action) {
        (Array.isArray(action.complete) ? action.complete : [action.complete])
          .forEach((id) => { if (!allSteps.has(id)) problems.push(`${where}: unknown step ${id}`); });
      }
      if ("step" in action && !allSteps.has(action.step)) problems.push(`${where}: unknown step ${action.step}`);
      if ("startQuest" in action && !questIds.has(action.startQuest)) problems.push(`${where}: unknown quest ${action.startQuest}`);
      if ("completeQuest" in action && !questIds.has(action.completeQuest)) problems.push(`${where}: unknown quest ${action.completeQuest}`);
      for (const key of ["give", "take", "equip"] as const) {
        if (key in action) {
          const id = (action as Record<string, string>)[key];
          if (!itemIds.has(id)) problems.push(`${where}: unknown item ${id}`);
        }
      }
      if ("battle" in action) {
        if (!enemyIds.has(action.battle)) problems.push(`${where}: unknown enemy ${action.battle}`);
        checkActions(where, action.victory ?? [], eventKeys);
        checkActions(where, action.defeat ?? [], eventKeys);
        checkActions(where, action.escape ?? [], eventKeys);
      }
      if ("goto" in action && !SCENES.includes(action.goto)) problems.push(`${where}: unknown scene ${action.goto}`);
      if ("if" in action) {
        checkCondition(where, action.if);
        checkActions(where, action.then, eventKeys);
        checkActions(where, action.else ?? [], eventKeys);
      }
      if ("run" in action && !eventKeys.has(action.run)) problems.push(`${where}: run of missing event ${action.run}`);
    }
  };

  const checkRules = (where: string, rules: Rule[], eventKeys: Set<string>) => {
    rules.forEach((rule, index) => {
      checkCondition(`${where}#${index}`, rule.when);
      checkActions(`${where}#${index}`, rule.do, eventKeys);
    });
    const last = rules[rules.length - 1];
    if (rules.length > 0 && last.when && !rules.some((rule) => !rule.when)) {
      // Not an error: an event may do nothing in some states.
    }
  };

  for (const area of areas) {
    const keys = new Set(Object.keys(area.events ?? {}));
    if (!SCENES.includes(area.returnTo.scene)) problems.push(`area ${area.id}: unknown returnTo scene ${area.returnTo.scene}`);
    for (const spot of area.hotspots ?? []) {
      const questHas = quests.some((quest) => quest.events?.[`${area.id}:${spot.id}`]);
      if (!keys.has(spot.id) && !questHas && spot.id !== "clerk") problems.push(`area ${area.id}: hotspot ${spot.id} has no event`);
      checkCondition(`area ${area.id} hotspot ${spot.id}`, spot.when);
    }
    for (const [key, rules] of Object.entries(area.events ?? {})) checkRules(`area ${area.id}:${key}`, rules, keys);
    for (const entry of area.randomEncounters?.entries ?? []) {
      if (!enemyIds.has(entry.enemyId)) problems.push(`area ${area.id}: unknown encounter enemy ${entry.enemyId}`);
      checkCondition(`area ${area.id} encounter`, entry.when);
    }
    checkCondition(`area ${area.id} disabledWhen`, area.randomEncounters?.disabledWhen);
    (area.shop ?? []).forEach((id) => {
      const item = items.find((candidate) => candidate.id === id);
      if (!item) problems.push(`area ${area.id}: shop sells unknown item ${id}`);
      else if (item.price === undefined) problems.push(`area ${area.id}: shop item ${id} has no price`);
    });
  }

  for (const quest of quests) {
    for (const [key, rules] of Object.entries(quest.events ?? {})) {
      const [areaId, eventKey] = key.split(":");
      if (!areaIds.has(areaId) || !eventKey) problems.push(`quest ${quest.id}: event key ${key} should be <areaId>:<event>`);
      const areaKeys = new Set(Object.keys(areas.find((area) => area.id === areaId)?.events ?? {}));
      checkRules(`quest ${quest.id} ${key}`, rules, areaKeys);
    }
    quest.defeat?.hints?.forEach((hint) => checkCondition(`quest ${quest.id} defeat hint`, hint.when));
    if (quest.defeat) checkLines(`quest ${quest.id} defeat`, quest.defeat.lines);
  }

  for (const enemy of enemies) {
    enemy.modifiers?.forEach((modifier) => checkCondition(`enemy ${enemy.id} modifier`, modifier.when));
    if (enemy.banter && !voiceLine(`banter:${enemy.banter}`)) problems.push(`enemy ${enemy.id}: banter pool ${enemy.banter} is empty`);
  }

  return problems;
}
