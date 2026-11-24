# Quest engine

This document tells you how to add quests, areas, enemies and boss gates.
Content is in JSON. You do not change TypeScript to add a normal quest beat.

## Files

| File | Contents |
| --- | --- |
| `src/data/quests/<id>.json` | Quest title, steps, defeat lines, quest-only events (for example the wife). |
| `src/data/areas/<id>.json` | Hotspots, chests, random encounters, area events, shop stock. |
| `src/data/enemies.json` | Enemy stats, attacks, battle look, music, boss modifiers. |
| `src/data/items.json` | Weapons, armor, consumables, prices. |
| `src/data/skills.json` | Dad Skills and the level that unlocks each one. |
| `src/data/balance.json` | Level curve, defeat penalty, run chance, tuning targets per area. |
| `src/data/dialogue.json` | Random line pools (`brain:`, `dad:`, `movie:`, `banter:` voices). |

Register a new quest file in `src/game/quests.ts`. Register a new area file in `src/game/areaData.ts`.

## Code that uses the data

- `src/game/FieldKit.ts`: shared field logic. Every walkable scene uses it.
- `src/scenes/BattleScene.ts`: the one battle screen. It runs on top of the paused field scene.
- `src/game/BattleManager.ts`: turn math. It has no Phaser code.
- `src/game/engine/script.ts`: the event runner.
- `src/game/engine/conditions.ts`: the `when` checks.

A field scene only draws its map, its own sprites and its exits. Then it calls `kit.update()`, `kit.onStep()` and `kit.goto()`.

## Events

An event is a list of rules. The runner does the first rule whose `when` passes. If a rule has `"continue": true`, the runner also checks the rules after it.

```json
"breaker": [
  { "when": { "flags": ["circuitBreakerOff"] }, "do": [ { "say": [["NARRATOR", "Already off."]] } ] },
  { "do": [ { "set": { "circuitBreakerOff": true } }, { "complete": "flip-breaker" }, { "step": "defeat-heating-coil" } ] }
]
```

The runner looks for an event key in this order:

1. The active quest file, key `<areaId>:<event>`.
2. The area file, key `<event>`.

Special event keys: `enter` (Dad enters the area), `default` (Space with no hotspot near), `buy:<itemId>` (shop purchase), `exit` (scene-specific).

## Hotspots

```json
{ "id": "coil", "col": 32, "row": 19, "radius": 3 }
{ "id": "breaker", "col": 14, "row": 10, "adjacent": true }
{ "id": "chest:first-aid", "col": 17, "row": 17, "radius": 1.75, "solid": true,
  "chest": { "id": "basement:first-aid", "frame": 4, "tint": "#aaaaaa" } }
```

- `radius` is in tiles. The default is 2.
- `adjacent` triggers only from the four tiles next to the hotspot.
- `solid` blocks the tile.
- `chest` draws a chest. The chest shows open when its id is in `openedChestIds` or its `flag` is true.
- The first hotspot in the list that matches wins. Put small hotspots before large ones.

### Loot chests

A chest with a `loot` table needs no event. The field opens it and rolls the table one time.

```json
{ "id": "chest:sump", "col": 46, "row": 29, "radius": 1.75, "solid": true,
  "chest": { "id": "basement:sump", "frame": 4,
    "loot": [ { "weight": 3, "cash": [6, 14] }, { "weight": 1, "item": "leftover-pizza" } ] } }
```

- `weight` sets how often an entry wins against the other entries.
- `cash: [min, max]` gives Love Points. `item` gives one item.
- A second open shows "Empty."
- An event with the same id as the hotspot replaces the loot rule. Use an event for a chest with fixed contents (for example `chest:mallet`).
- The `{ "loot": [...] }` action rolls a table from any script.

## Actions

| Action | Effect |
| --- | --- |
| `{ "say": [lines] }` | Show dialogue. See "Lines". |
| `{ "set": { "flag": true } }` | Set or clear flags. |
| `{ "complete": "step" }` or `["a", "b"]` | Mark quest steps complete. |
| `{ "step": "step" }` | Set the active step. |
| `{ "startQuest": "id" }` | Start a quest at its first step. |
| `{ "completeQuest": "id" }` | Add the quest to the completed list. |
| `{ "give": "item" }`, `{ "take": "item" }`, `{ "equip": "item" }` | Change inventory or equipment. |
| `{ "cash": 5 }`, `{ "xp": 3 }` | Add Love Points or XP. `xp` sets `{levelUp}` for the next line. |
| `{ "open": "chestId" }` | Mark a chest open. |
| `{ "heal": "hp" }` or `"all"` | Restore HP, or HP and DP. |
| `{ "checkIn": true }` | The wife's XP hint and heal. |
| `{ "hud": "POWER OUT" }` | Change the quest bar prefix. `null` resets it. |
| `{ "battle": "enemyId", "victory": [...], "defeat": [...], "escape": [...] }` | Start a battle. With no `defeat` actions, Dad goes to the area's `returnTo`. |
| `{ "goto": "SceneKey", "spawn": "x" }`, `{ "home": true }` | Leave the scene. The script stops. |
| `{ "if": {condition}, "then": [...], "else": [...] }` | Branch. |
| `{ "run": "eventKey" }` | Run another event of the same area. |
| `{ "save": true }`, `{ "stop": true }` | Save now. End the script. |

The field saves the game after each event.

## Lines

```json
["NARRATOR", "Plain line. {name} is the player name."]
{ "speaker": "DAD'S BRAIN", "voice": "brain:battle" }
{ "narrate": "basementIntro" }
```

Voice tokens: `brain:<context>`, `dad:<context>:<mood>`, `movie:<context>`, `banter:<enemyKey>`, `combat:<mood>`.

## Conditions

All listed checks must pass:

`flags`, `notFlags`, `items`, `notItems`, `equipped`, `quest`, `step`, `stepsDone`, `questsDone`, `opened`, `notOpened`, `minLevel`, `maxLevel`, `any` (one of the nested blocks), `not` (the nested block fails).

`items` counts the inventory and the equipped weapon and armor.

## Item gates and boss modifiers

Use two tools to make a side quest matter for a boss:

1. **Hard gate.** The boss event checks a condition before the battle. Example: the toilet needs `ownsPlunger`.
2. **Soft gate.** The enemy has `modifiers`. Each modifier with a passing `when` changes the fight.

```json
"modifiers": [
  {
    "when": { "items": ["gutter-scoop"] },
    "startMessage": "The scoop finds the weak spot.",
    "defenseScale": 0.5,
    "heroDamageScale": 1.5,
    "attackScale": 0.8,
    "attackPattern": [ { "message": "sloshes", "damage": 6, "damageMin": 4, "damageMax": 8 } ],
    "runChance": 0.6,
    "runMessages": { "success": "...", "fail": "..." },
    "banter": "gutterBoss"
  }
]
```

## Drops and tint

```json
"drops": [ { "item": "leftover-pizza", "chance": 0.12 } ],
"battleView": { "tint": "#7cb342" }
```

- Each drop rolls one time after a win. The battle text shows "IT DROPPED X!".
- `tint` colors the enemy art. Use it to make a new enemy from old art.

The Evil Heating Coil uses modifiers. With `circuitBreakerOff` its attacks drop from 10-15 to 6-8 and RUN gets easier.

## Random encounters

```json
"randomEncounters": {
  "enabled": true,
  "stepDistance": 80,
  "baseChance": 0.22,
  "cooldownRolls": 3,
  "disabledWhen": { "flags": ["clogBossDefeated"] },
  "introMessages": ["Something shifts."],
  "entries": [
    { "enemyId": "mold-patch", "weight": 2, "minPlayerLevel": 3, "when": { "notFlags": ["moldCleaned"] } }
  ]
}
```

`stepDistance` is in pixels. One tile is 16 pixels.

An entry with `regions` rolls only when Dad stands in one of the boxes. A box is `[col0, row0, col1, row1]`, inclusive. Use regions to put harder enemies in the far rooms.

```json
{ "enemyId": "black-mold", "weight": 3, "regions": [[21, 2, 35, 25]] }
```

## Maps

Dungeon maps are in `src/game/maps/<area>.ts`. Each file uses `growMap()` from `src/game/mapBuild.ts`. It puts the old map in the top-left corner and carves new rooms (`room`), horizontal halls (`h`) and vertical halls (`v`).

`npm run check` does a walk test on each map from the spawn tile. It fails when a hotspot cannot be reached or a solid hotspot is not on a floor tile.

## Checks and tuning

- `npm run check`: validates every id in the data (also loot tables, drops and textures), checks the maps, then plays quests 1 and 2 headless through the real scripts. Run it after each content change.
- `npm run balance`: simulates fights per area and level. It prints win rates, HP lost, and the number of random fights to the next level. It uses `balance.json` → `areas` for the target levels and gear. Add an entry for each new area.

## Dev shortcuts

- Shift+D: start quest 1 fresh. Shift+C: clear the save. Shift+E: toggle random encounters.
- In `npm run dev`, `window.__game` is the Phaser game.
