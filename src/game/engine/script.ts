/**
 * Quest event scripts.
 *
 * Content lives in JSON (src/data/quests/*.json and src/data/areas/*.json).
 * An event is a list of rules. The runner takes the first rule whose `when`
 * passes and runs its actions in order. A rule with `continue: true` lets the
 * runner keep looking for the next matching rule after it.
 *
 * This file has no Phaser dependency, so node tests can drive it with a fake
 * host (see scripts/check-quests.ts).
 */
import { dialogue, getArea, items } from "../content";
import { getDadBrainLine, getDadCombatLine, getDadLine, getDadMovieQuote, getEnemyBanter } from "../dadVoice";
import { applyExperienceAndLevelUps, getNextLevelXp } from "../dragonWarriorMath";
import { getQuest } from "../quests";
import { completeQuestStep, setActiveQuestStep, type GameState } from "../state";
import { matches, type Condition } from "./conditions";
import { random, randomInt } from "./rng";

export interface DialogueLine {
  speaker: string;
  text: string;
}

/**
 * A line in data. Forms:
 *   ["NARRATOR", "Text"]                      plain line
 *   { "speaker": "DAD", "text": "Hi {name}" }  plain line with variables
 *   { "speaker": "DAD'S BRAIN", "voice": "brain:battle" }  random pool line
 *   { "narrate": "basementIntro" }            every line of a dialogue.json list, as NARRATOR
 * Voice tokens: brain:<context>, dad:<context>:<mood>, movie:<context>,
 * banter:<enemyKey>, combat:<mood>.
 */
export type LineSpec =
  | [string, string]
  | { speaker: string; text?: string; voice?: string }
  | { narrate: string; speaker?: string };

/** One row of a loot table. Give either cash [min, max] or an item id. */
export interface LootEntry {
  weight: number;
  cash?: [number, number];
  item?: string;
}

export type Action =
  | { say: LineSpec[] }
  | { set: Record<string, boolean> }
  | { complete: string | string[] }
  | { step: string }
  | { startQuest: string }
  | { completeQuest: string }
  | { give: string }
  | { take: string }
  | { equip: string }
  | { cash: number }
  | { xp: number }
  | { open: string }
  | { loot: LootEntry[] }
  | { heal: "hp" | "all" }
  | { checkIn: true }
  | { hud: string | null }
  | { battle: string; victory?: Action[]; defeat?: Action[]; escape?: Action[] }
  | { goto: string; spawn?: string }
  | { home: true }
  | { if: Condition; then: Action[]; else?: Action[] }
  | { run: string }
  | { save: true }
  | { stop: true };

export interface Rule {
  when?: Condition;
  do: Action[];
  /** Keep checking later rules after this one runs. */
  continue?: boolean;
}

export type ScriptEvents = Record<string, Rule[]>;

export interface HotspotDefinition {
  id: string;
  col: number;
  row: number;
  /** Trigger distance in tiles, measured from tile centers (strictly less than). */
  radius?: number;
  /** Trigger only from the four tiles next to it. */
  adjacent?: boolean;
  /** Dad cannot walk onto this tile. */
  solid?: boolean;
  /** Only active while this passes. */
  when?: Condition;
  /** Draw a chest here. Opened when its id is in openedChestIds or `flag` is set. */
  chest?: { id: string; frame: number; tint?: string; flag?: string; loot?: LootEntry[] };
}

export type BattleOutcome = "victory" | "defeat" | "escape";

export interface ScriptHost {
  readonly state: GameState;
  readonly areaId: string;
  say(lines: DialogueLine[]): Promise<void>;
  battle(enemyId: string): Promise<BattleOutcome>;
  /** Leave the scene. The script stops after this. */
  goto(scene: string, spawn?: string): void;
  setHud(prefix: string | null): void;
  /** State changed: redraw sprites and HUD. */
  refresh(): void;
  save(): void;
}

class StopScript extends Error {}

export function findRules(state: GameState, areaId: string, key: string): Rule[] | undefined {
  const quest = getQuest(state.quest.questId);
  const area = getArea(areaId);
  const explicit = quest.events?.[`${areaId}:${key}`] ?? area.events?.[key];
  if (explicit) return explicit;
  const chest = area.hotspots?.find((spot) => spot.id === key)?.chest;
  return chest?.loot ? lootChestRules(chest) : undefined;
}

export function hasEvent(state: GameState, areaId: string, key: string): boolean {
  return findRules(state, areaId, key) !== undefined;
}

export class ScriptRunner {
  private vars: Record<string, string> = { levelUp: "" };

  constructor(private readonly host: ScriptHost) {}

  /** Runs an event. Resolves false when no event with this key exists. */
  async runEvent(key: string): Promise<boolean> {
    const rules = findRules(this.host.state, this.host.areaId, key);
    if (!rules) return false;
    try {
      await this.runRules(rules);
    } catch (error) {
      if (!(error instanceof StopScript)) throw error;
    }
    return true;
  }

  async runActions(actions: Action[]): Promise<void> {
    try {
      await this.exec(actions);
    } catch (error) {
      if (!(error instanceof StopScript)) throw error;
    }
  }

  private async runRules(rules: Rule[]): Promise<void> {
    for (const rule of rules) {
      if (!matches(this.host.state, rule.when)) continue;
      await this.exec(rule.do);
      if (!rule.continue) return;
    }
  }

  private async exec(actions: Action[]): Promise<void> {
    for (const action of actions) {
      await this.execOne(action);
    }
  }

  private async execOne(action: Action): Promise<void> {
    const host = this.host;
    const state = host.state;

    if ("say" in action) {
      await host.say(expandLines(action.say, state, this.vars));
      return;
    }
    if ("set" in action) {
      Object.assign(state.flags, action.set);
      host.refresh();
      return;
    }
    if ("complete" in action) {
      const ids = Array.isArray(action.complete) ? action.complete : [action.complete];
      ids.forEach((id) => completeQuestStep(state, id));
      host.refresh();
      return;
    }
    if ("step" in action) {
      setActiveQuestStep(state, action.step);
      host.refresh();
      return;
    }
    if ("startQuest" in action) {
      const quest = getQuest(action.startQuest);
      state.quest = { questId: quest.id, activeStepId: quest.steps[0].id, completedStepIds: [] };
      host.setHud(null);
      host.refresh();
      return;
    }
    if ("completeQuest" in action) {
      if (!state.completedQuestIds.includes(action.completeQuest)) {
        state.completedQuestIds.push(action.completeQuest);
      }
      return;
    }
    if ("give" in action) {
      if (!state.player.inventory.includes(action.give)) state.player.inventory.push(action.give);
      host.refresh();
      return;
    }
    if ("take" in action) {
      const index = state.player.inventory.indexOf(action.take);
      if (index >= 0) state.player.inventory.splice(index, 1);
      host.refresh();
      return;
    }
    if ("equip" in action) {
      equipItem(state, action.equip);
      host.refresh();
      return;
    }
    if ("cash" in action) {
      state.player.cash = Math.max(0, state.player.cash + action.cash);
      return;
    }
    if ("xp" in action) {
      const result = applyExperienceAndLevelUps(state, action.xp);
      this.vars.levelUp = result.message ? `\n${result.message}` : "";
      return;
    }
    if ("open" in action) {
      if (!state.openedChestIds.includes(action.open)) state.openedChestIds.push(action.open);
      host.refresh();
      return;
    }
    if ("loot" in action) {
      await host.say([rollLoot(state, action.loot)]);
      return;
    }
    if ("heal" in action) {
      state.player.hp = state.player.maxHp;
      if (action.heal === "all") state.player.dadPoints = state.player.maxDadPoints;
      return;
    }
    if ("checkIn" in action) {
      await host.say(wifeCheckIn(state));
      host.save();
      return;
    }
    if ("hud" in action) {
      host.setHud(action.hud);
      return;
    }
    if ("battle" in action) {
      const outcome = await host.battle(action.battle);
      const branch = outcome === "victory" ? action.victory
        : outcome === "defeat" ? action.defeat
        : action.escape;
      if (branch) {
        await this.exec(branch);
      } else if (outcome === "defeat") {
        this.leave(getArea(host.areaId).returnTo.scene, getArea(host.areaId).returnTo.spawn);
      }
      return;
    }
    if ("goto" in action) {
      this.leave(action.goto, action.spawn);
      return;
    }
    if ("home" in action) {
      const home = getArea(host.areaId).returnTo;
      this.leave(home.scene, home.spawn);
      return;
    }
    if ("if" in action) {
      await this.exec(matches(state, action.if) ? action.then : action.else ?? []);
      return;
    }
    if ("run" in action) {
      const rules = findRules(state, host.areaId, action.run);
      if (!rules) throw new Error(`Missing event ${host.areaId}:${action.run}`);
      await this.runRules(rules);
      return;
    }
    if ("save" in action) {
      host.save();
      return;
    }
    if ("stop" in action) {
      throw new StopScript();
    }

    throw new Error(`Unknown script action: ${JSON.stringify(action)}`);
  }

  private leave(scene: string, spawn?: string): never {
    this.host.save();
    this.host.goto(scene, spawn);
    throw new StopScript();
  }
}

/** Rolls a loot table, applies the result, and returns the line to show. */
export function rollLoot(state: GameState, table: LootEntry[]): DialogueLine {
  const total = table.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * total;
  const entry = table.find((candidate) => (roll -= candidate.weight) <= 0) ?? table[table.length - 1];

  if (entry.item) {
    state.player.inventory.push(entry.item);
    const name = items.find((item) => item.id === entry.item)?.name ?? entry.item;
    return { speaker: "SYSTEM", text: `YOU FOUND ${name.toUpperCase()}!` };
  }

  const [min, max] = entry.cash ?? [1, 1];
  const amount = randomInt(min, max);
  state.player.cash += amount;
  return { speaker: "SYSTEM", text: `YOU FOUND ${amount} LOVE POINTS.` };
}

/** Event for a chest that only holds loot, so area files need no event for it. */
export function lootChestRules(chest: NonNullable<HotspotDefinition["chest"]>): Rule[] {
  const opened = { any: [{ opened: [chest.id] }, ...(chest.flag ? [{ flags: [chest.flag] }] : [])] };
  return [
    { when: opened, do: [{ say: [["NARRATOR", "Empty. Dad checks twice anyway."]] }] },
    { do: [{ open: chest.id }, { say: [["NARRATOR", "Dad pries open the box."]] }, { loot: chest.loot ?? [] }] },
  ];
}

export function equipItem(state: GameState, itemId: string): void {
  if (!state.player.inventory.includes(itemId)) state.player.inventory.push(itemId);
  const kind = itemKind(itemId);
  if (kind === "weapon") state.player.equipment.weaponId = itemId;
  if (kind === "armor") state.player.equipment.armorId = itemId;
}

function itemKind(itemId: string): string | undefined {
  return items.find((item) => item.id === itemId)?.kind;
}

export function expandLines(specs: LineSpec[], state: GameState, vars: Record<string, string> = {}): DialogueLine[] {
  const lines: DialogueLine[] = [];
  const fill = (text: string) => text
    .replace(/\{name\}/g, state.player.name || "DAD")
    .replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);

  for (const spec of specs) {
    if (Array.isArray(spec)) {
      lines.push({ speaker: spec[0], text: fill(spec[1]) });
      continue;
    }
    if ("narrate" in spec) {
      const pool = (dialogue as unknown as Record<string, unknown>)[spec.narrate];
      if (!Array.isArray(pool)) throw new Error(`dialogue.json has no list named ${spec.narrate}`);
      pool.forEach((text) => lines.push({ speaker: spec.speaker ?? "NARRATOR", text: fill(String(text)) }));
      continue;
    }
    const text = spec.voice ? voiceLine(spec.voice) : spec.text ?? "";
    lines.push({ speaker: spec.speaker, text: fill(text) });
  }
  return lines;
}

export function voiceLine(token: string): string {
  const [kind, a = "", b = ""] = token.split(":");
  switch (kind) {
    case "brain": return getDadBrainLine(a);
    case "dad": return getDadLine(a, b);
    case "movie": return getDadMovieQuote(a);
    case "banter": return getEnemyBanter(a);
    case "combat": return getDadCombatLine(a);
    default: throw new Error(`Unknown voice token: ${token}`);
  }
}

/** The wife's XP hint and kiss. Heals HP. */
export function wifeCheckIn(state: GameState): DialogueLine[] {
  const player = state.player;
  const nextLevelXp = getNextLevelXp(player.level);
  const xpLine = nextLevelXp === undefined
    ? "You're already at peak Dad, statistically speaking. I am as surprised as you are."
    : `You need ${Math.max(0, nextLevelXp - player.xp)} XP before your next level.`;

  const wasHurt = player.hp < player.maxHp;
  player.hp = player.maxHp;

  return [
    { speaker: "WIFE", text: xpLine },
    {
      speaker: "WIFE",
      text: wasHurt
        ? "Come here. Kiss. There. Try not to lose a fight to lint."
        : "You still get a kiss. Preventative maintenance.",
    },
    { speaker: "SYSTEM", text: `HP RESTORED TO ${player.maxHp}.` },
  ];
}
