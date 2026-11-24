/**
 * Balance report. Simulates thousands of fights with the real battle code and
 * prints, per area and level: win rate, turns, HP lost, and how many fights it
 * takes to reach the next level. Run: npm run balance
 *
 * Policy: Dad uses FIGHT, and SKILL when hurt and a heal skill is affordable.
 * He never runs and never uses items, so real players do a bit better.
 */
import { BattleManager } from "../src/game/BattleManager";
import { getEnemy, type EnemyDefinition } from "../src/game/content";
import { getUnlockedDadSkills } from "../src/game/dadSkills";
import { balance, levelTable } from "../src/game/dragonWarriorMath";
import { getArea } from "../src/game/content";
import { seeded, setRandomSource } from "../src/game/engine/rng";
import { createInitialGameState, type GameState } from "../src/game/state";

const RUNS = 2000;
setRandomSource(seeded(20261124));

interface AreaTuning {
  quest: string;
  targetLevel: [number, number];
  gear: { weapon: string; armor: string };
  boss?: string;
  note?: string;
}

function dadAt(level: number, gear: AreaTuning["gear"], flags: Record<string, boolean> = {}): GameState {
  const row = levelTable.find((entry) => entry.level === level) ?? levelTable[levelTable.length - 1];
  const state = createInitialGameState();
  Object.assign(state.player, {
    level: row.level, xp: row.xp, maxHp: row.maxHp, hp: row.maxHp,
    maxDadPoints: row.maxDadPoints, dadPoints: row.maxDadPoints,
    strength: row.strength, agility: row.agility,
    defense: level === 1 ? state.player.defense : Math.floor(row.agility / 2),
  });
  state.player.equipment = { weaponId: gear.weapon, armorId: gear.armor };
  state.player.inventory = [gear.weapon, gear.armor];
  Object.assign(state.flags, flags);
  return state;
}

interface FightStats { winRate: number; turns: number; hpLost: number; }

function simulate(enemy: EnemyDefinition, make: () => GameState, keepHp = false): FightStats {
  let wins = 0; let turns = 0; let hpLost = 0;
  for (let i = 0; i < RUNS; i++) {
    const state = make();
    const startHp = state.player.hp;
    const battle = new BattleManager();
    const start = battle.start(enemy, state);
    let over = Boolean(start.defeated);
    let won = false; let t = 0;
    while (!over && t < 60) {
      t += 1;
      const heal = getUnlockedDadSkills(state.player.level).find((skill) => skill.kind === "heal");
      const hurt = state.player.hp / state.player.maxHp < 0.45;
      const result = hurt && heal && state.player.dadPoints >= heal.cost
        ? battle.useDadSkill(state)
        : battle.useFight(state);
      if (result.victory) { won = true; break; }
      if (battle.useEnemyTurn(state).defeated) over = true;
    }
    if (won) wins += 1;
    turns += t;
    hpLost += startHp - state.player.hp;
    if (keepHp) void 0;
  }
  return { winRate: wins / RUNS, turns: turns / RUNS, hpLost: hpLost / RUNS };
}

const pct = (value: number) => `${Math.round(value * 100)}%`.padStart(4);
const num = (value: number, width = 5) => value.toFixed(1).padStart(width);

const tunings = balance.areas as Record<string, AreaTuning>;
for (const [areaId, tuning] of Object.entries(tunings)) {
  const area = getArea(areaId);
  const [lo, hi] = tuning.targetLevel;
  console.log(`\n=== ${area.label} (${tuning.quest}) target LV ${lo}-${hi}. ${tuning.note ?? ""}`);
  console.log(`    gear: ${tuning.gear.weapon} / ${tuning.gear.armor}`);

  const entries = area.randomEncounters?.entries ?? [];
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  for (let level = Math.max(1, lo - 1); level <= hi + 1; level++) {
    console.log(`  LV ${level}`);
    let avgXp = 0;
    for (const entry of entries) {
      const enemy = getEnemy(entry.enemyId);
      const stats = simulate(enemy, () => dadAt(level, tuning.gear));
      avgXp += (enemy.xpReward * entry.weight) / Math.max(1, totalWeight);
      console.log(`    ${enemy.name.padEnd(22)} win ${pct(stats.winRate)}  turns ${num(stats.turns)}  hp lost ${num(stats.hpLost)}`);
    }
    const next = levelTable.find((row) => row.level === level + 1);
    const current = levelTable.find((row) => row.level === level);
    if (next && current && avgXp > 0) {
      console.log(`    -> about ${Math.ceil((next.xp - current.xp) / avgXp)} random fights from LV ${level} to LV ${level + 1}`);
    }
  }

  if (tuning.boss) {
    const boss = getEnemy(tuning.boss);
    const variants: Array<{ label: string; flags: Record<string, boolean> }> = [{ label: "base", flags: {} }];
    for (const modifier of boss.modifiers ?? []) {
      const flags = Object.fromEntries((modifier.when.flags ?? []).map((flag) => [flag, true]));
      variants.push({ label: `with ${Object.keys(flags).join("+") || "modifier"}`, flags });
    }
    console.log(`  BOSS ${boss.name}`);
    for (const variant of variants) {
      const row = [];
      for (let level = 1; level <= hi + 2; level++) {
        const stats = simulate(boss, () => dadAt(level, tuning.gear, variant.flags));
        row.push(`LV${level} ${pct(stats.winRate)}`);
      }
      console.log(`    ${variant.label.padEnd(26)} ${row.join("  ")}`);
    }
  }
}
console.log(`\n${RUNS} simulated fights per cell. Seeded, so results repeat until the data changes.`);
