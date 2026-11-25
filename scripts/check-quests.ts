/**
 * Headless quest walkthrough. Drives the real event scripts from src/data with
 * a fake host and checks each beat of quests 1 to 3. Run: npm run check
 *
 * It does not draw anything. Battles resolve to the outcome the test picks.
 */
import { areas } from "../src/game/areaData";
import { enemies, items } from "../src/game/content";
import type { Condition } from "../src/game/engine/conditions";
import { ScriptRunner, type Action, type BattleOutcome, type DialogueLine, type Rule, type ScriptHost } from "../src/game/engine/script";
import { quests, repairQuestProgress } from "../src/game/quests";
import { createInitialGameState, type GameState } from "../src/game/state";
import { checkMaps } from "./check-maps";
import { validateContent } from "./validate-data";

let failures = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label} ${detail}`);
  }
}

class FakeHost implements ScriptHost {
  areaId = "house";
  lines: DialogueLine[] = [];
  battles: string[] = [];
  gotos: string[] = [];
  hud: string | null = null;
  nextOutcome: BattleOutcome = "victory";
  constructor(readonly state: GameState) {}
  async say(lines: DialogueLine[]): Promise<void> { this.lines.push(...lines); }
  async battle(enemyId: string): Promise<BattleOutcome> { this.battles.push(enemyId); return this.nextOutcome; }
  goto(scene: string, spawn?: string): void { this.gotos.push(spawn ? `${scene}:${spawn}` : scene); }
  setHud(prefix: string | null): void { this.hud = prefix; }
  refresh(): void {}
  save(): void {}
}

const state = createInitialGameState();
state.player.name = "DAD";
const host = new FakeHost(state);
const runner = new ScriptRunner(host);

async function at(areaId: string, key: string): Promise<FakeHost> {
  host.areaId = areaId;
  host.lines = [];
  host.battles = [];
  host.gotos = [];
  const found = await runner.runEvent(key);
  if (!found) check(`${areaId}:${key} exists`, false);
  return host;
}

const said = (text: string) => host.lines.some((line) => line.text.includes(text));
const step = () => state.quest.activeStepId;

async function main(): Promise<void> {
  console.log("Data references");
  const problems = validateContent();
  problems.forEach((problem) => check(problem, false));
  check(`${quests.length} quests, ${areas.length} areas, ${enemies.length} enemies, ${items.length} items load`, problems.length === 0);

  console.log("Maps");
  const mapProblems = checkMaps();
  mapProblems.forEach((problem) => check(problem, false));
  check("dungeon maps: every hotspot reachable, solids on floor", mapProblems.length === 0);

  console.log("Save repair");
  {
    const bad = createInitialGameState();
    bad.quest = { questId: "fix-bathroom", activeStepId: "inspect-dryer", completedStepIds: ["talk-to-wife-bathroom", "talk-to-wife", "visit-home-depot"] };
    repairQuestProgress(bad);
    check("quest 2 save with a quest 1 step repairs to the next open step", bad.quest.activeStepId === "find-plunger" && !bad.quest.completedStepIds.includes("talk-to-wife"), JSON.stringify(bad.quest));
    const good = createInitialGameState();
    good.quest = { questId: "fix-dryer", activeStepId: "flip-breaker", completedStepIds: ["talk-to-wife", "inspect-dryer", "find-wrench"] };
    check("valid save is left alone", !repairQuestProgress(good) && good.quest.activeStepId === "flip-breaker");
  }

  console.log("Quest 1: Fix the Dryer");
  // StoryIntroScene completes talk-to-wife and sets inspect-dryer.
  state.flags.talkedToWife = true;
  state.quest.completedStepIds.push("talk-to-wife");
  state.quest.activeStepId = "inspect-dryer";

  await at("house", "dryer");
  check("dryer inspect sets step defeat-heating-coil", step() === "defeat-heating-coil" && state.flags.inspectedDryer);

  await at("basement", "coil");
  check("coil without wrench sends Dad home", host.gotos[0] === "NeighborhoodScene:basement" && step() === "find-wrench");
  check("coil without wrench: no battle", host.battles.length === 0);

  await at("garage", "enter");
  check("garage intro plays before wrench", said("quiet hostility"));
  await at("garage", "toolbox");
  check("toolbox gives and equips wrench", state.flags.foundWrench && state.player.equipment.weaponId === "adjustable-wrench");
  check("toolbox sets step flip-breaker", step() === "flip-breaker");
  await at("garage", "toolbox");
  check("toolbox second time is empty", said("toolbox is empty"));
  await at("garage", "enter");
  check("garage intro silent after wrench", host.lines.length === 0);

  await at("basement", "chest:first-aid");
  check("first-aid gives ibuprofen once", state.player.inventory.filter((id) => id === "ibuprofen").length === 1);
  await at("basement", "chest:first-aid");
  check("first-aid second time is empty", said("echo of Dad's previous curiosity"));

  const cashBefore = state.player.cash;
  const bagBefore = state.player.inventory.length;
  await at("garage", "chest:workshop");
  check("loot chest pays cash or an item", said("YOU FOUND") && (state.player.cash > cashBefore || state.player.inventory.length > bagBefore));
  await at("garage", "chest:workshop");
  check("loot chest second time is empty", said("Empty."));
  await at("garage", "chest:gloves");
  check("gloves chest gives and equips over the cardigan", said("YOU FOUND GARDEN GLOVES!") && state.player.equipment.armorId === "garden-gloves");

  host.nextOutcome = "defeat";
  await at("basement", "coil");
  check("coil with breaker on warns about the zap", said("Certified Zap"));
  check("coil defeat sends Dad home", host.gotos[0] === "NeighborhoodScene:basement" && !state.flags.bossDefeated);

  await at("basement", "breaker");
  check("breaker flips off, step defeat-heating-coil", state.flags.circuitBreakerOff && step() === "defeat-heating-coil");

  host.nextOutcome = "victory";
  await at("basement", "coil");
  check("coil fight starts with breaker off, no zap warning", host.battles[0] === "evil-heating-coil" && !said("Certified Zap"));
  check("coil victory: bossDefeated, step restore-power", state.flags.bossDefeated && step() === "restore-power");
  check("coil victory reminds about breaker and goes home", said("still off") && host.gotos[0] === "NeighborhoodScene:basement");

  await at("house", "wife");
  check("wife says power is out", said("nothing works") && host.hud === "POWER OUT");
  check("wife check-in heals and hints XP", said("XP before your next level") || said("peak Dad"));

  await at("basement", "breaker");
  check("breaker back on, step return-to-wife", !state.flags.circuitBreakerOff && step() === "return-to-wife");

  await at("house", "wife");
  check("wife finishes quest 1", state.flags.dryerFixed && state.completedQuestIds.includes("fix-dryer"));
  check("quest 2 starts at visit-home-depot", state.quest.questId === "fix-bathroom" && step() === "visit-home-depot");
  check("talk-to-wife-bathroom is complete", state.quest.completedStepIds.includes("talk-to-wife-bathroom"));

  console.log("Quest 2: Unclog the Bathroom");
  await at("house", "wife");
  check("wife asks about the toilet", said("looked at the toilet"));

  await at("bathroom", "toilet");
  check("toilet inspect without plunger", state.flags.toiletInspected && step() === "defeat-clogged-toilet" && said("bare hands"));
  check("no toilet battle without plunger", host.battles.length === 0);

  await at("bathroom", "linen");
  const cashAfterLinen = state.player.cash;
  await at("bathroom", "linen");
  check("linen closet pays once", state.flags.toiletPaperFound && state.player.cash === cashAfterLinen);

  const xpBefore = state.player.xp;
  await at("bathroom", "shower");
  check("rubber duck gives 3 XP", state.flags.rubberDuckFound && state.player.xp === xpBefore + 3);

  await at("homedepot", "enter");
  check("store visit does not move step past defeat-clogged-toilet", step() === "defeat-clogged-toilet" && state.flags.visitedHomeDepot);

  await at("homedepot", "buy:plunger-of-the-gods");
  check("buying plunger sets ownsPlunger", state.flags.ownsPlunger === true);

  await at("bathroom", "toilet");
  check("toilet fight starts", host.battles[0] === "clogged-toilet");
  check("toilet victory: step mop-up, goes home", state.flags.clogBossDefeated && step() === "mop-up" && host.gotos[0] === "NeighborhoodScene:bathroom");

  await at("house", "wife");
  check("wife finishes quest 2", state.flags.bathroomFixed && state.completedQuestIds.includes("fix-bathroom"));
  check("quest 3 starts at inspect-lawn after quest 2", state.quest.questId === "reclaim-lawn" && step() === "inspect-lawn" && said("walk around the property"));

  console.log("Quest 3: Reclaim the Lawn");
  await at("house", "backdoor");
  check("back door goes to the backyard", host.gotos[0] === "BackyardScene:house");
  await at("backyard", "enter");
  check("backyard intro sets step find-spade without a spade", step() === "find-spade" && said("mole FOYER"));
  await at("backyard", "enter");
  check("backyard intro plays once", !said("mole FOYER"));

  await at("tunnels", "enter");
  check("tunnel intro sets enteredTunnels", state.flags.enteredTunnels === true);
  await at("tunnels", "burrow:1");
  check("burrow needs a spade", !state.flags.burrowPlugged1 && said("real shovel"));
  await at("tunnels", "moleking");
  check("Mole King escapes while burrows are open", host.battles.length === 0 && said("drops into a burrow"));

  await at("homedepot", "buy:flat-edge-spade");
  check("buying the spade sets step plug-burrows", state.flags.ownsSpade && step() === "plug-burrows");

  await at("tunnels", "burrow:1");
  await at("tunnels", "burrow:2");
  check("two burrows plugged, step still plug-burrows", state.flags.burrowPlugged2 && step() === "plug-burrows");
  await at("tunnels", "burrow:2");
  check("plugged burrow says so", said("Plugged. Packed."));
  await at("tunnels", "burrow:3");
  check("third burrow sets step defeat-mole-king", step() === "defeat-mole-king" && said("All 3"));

  await at("backyard", "okafor");
  check("Mrs. Okafor asks about her cat", state.flags.okaforAsked && said("Biscuit"));
  host.nextOutcome = "escape";
  await at("tunnels", "biscuit");
  check("running from the vole leaves the cat", host.battles[0] === "vole-lieutenant" && !state.flags.foundBiscuit);
  host.nextOutcome = "victory";
  await at("tunnels", "biscuit");
  check("beating the vole frees Biscuit", state.flags.foundBiscuit === true);
  await at("backyard", "okafor");
  check("Okafor gives the castor oil pellets", state.flags.hasCastorOil && state.player.inventory.includes("castor-oil-pellets"));
  await at("backyard", "okafor");
  check("Okafor reward is given once", state.player.inventory.filter((id) => id === "castor-oil-pellets").length === 1);

  const hpBefore = state.player.hp;
  state.player.hp = 1;
  await at("backyard", "shed");
  check("shed restores HP", state.player.hp === state.player.maxHp && hpBefore > 0);

  await at("tunnels", "moleking");
  check("Mole King fight starts with castor oil line", host.battles[0] === "mole-king" && said("castor oil pellets"));
  check("Mole King victory: step return-to-wife-lawn, back to the backyard", state.flags.moleKingDefeated && step() === "return-to-wife-lawn" && host.gotos[0] === "BackyardScene:tunnels");

  await at("house", "wife");
  check("wife finishes quest 3", state.flags.lawnFixed && state.completedQuestIds.includes("reclaim-lawn"));
  await at("house", "wife");
  check("wife after quest 3 just checks in", said("socks"));

  console.log("Quest 3 from an old save that finished quest 2");
  {
    Object.assign(state, createInitialGameState());
    state.flags.bathroomFixed = true;
    state.completedQuestIds = ["fix-dryer", "fix-bathroom"];
    state.quest = { questId: "fix-bathroom", activeStepId: "return-to-wife-bathroom", completedStepIds: ["mop-up", "return-to-wife-bathroom"] };
    await at("house", "backdoor");
    check("back door opens once quest 2 is done", host.gotos[0] === "BackyardScene:house");
    await at("house", "wife");
    check("wife starts quest 3 on an old save", state.quest.questId === "reclaim-lawn" && step() === "inspect-lawn");
    state.flags.ownsSpade = true;
    await at("backyard", "enter");
    check("spade bought early skips find-spade", step() === "plug-burrows");
  }

  console.log("Back door before quest 3");
  {
    Object.assign(state, createInitialGameState());
    await at("house", "backdoor");
    check("back door is shut during quest 1", host.gotos.length === 0 && said("future Dad"));
  }

  console.log("Quest 2 alternate order: store before toilet");
  const fresh = createInitialGameState();
  Object.assign(state, fresh);
  state.quest = { questId: "fix-bathroom", activeStepId: "visit-home-depot", completedStepIds: ["talk-to-wife-bathroom"] };
  await at("homedepot", "enter");
  check("store sets step find-plunger", step() === "find-plunger");
  await at("homedepot", "buy:plumbing-snake");
  check("snake also counts as a plunger (original behavior)", state.flags.ownsPlunger && step() === "inspect-toilet");

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

// Keep the type imports honest.
export type { Action, Condition, Rule };

void main();
