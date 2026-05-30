# Tiled Layer Plan for New House

This plan covers `public/assets/maps/new-house.json` and the four 16x16 sheets in `public/assets/tilesets/Interiors_free/16x16`. The map is 36x24 tiles, orthogonal, 16 px tiles, and uses external Tiled tileset JSON files so the sheets can be reused by later rooms.

## Tilesets

| First GID | Tileset | Use |
| --- | --- | --- |
| 1 | `house_core_16x16` | Walls, floors, doors, windows, stairs, hall details, collision/trigger marker tiles. |
| 6145 | `garage_basement_16x16` | Utility-room and garage/basement props. |
| 12289 | `props_interactables_16x16` | Furniture, interactables, decorative room props. |
| 18433 | `suburb_exterior_16x16` | Exterior approach, porch/driveway, outdoor transitions. |

## Layer Contract

| Order | Layer | Type | Purpose |
| --- | --- | --- | --- |
| 1 | `Floor` | tile layer | Base room floors, hall transitions, porch/garage threshold. |
| 2 | `Walls` | tile layer | Architectural walls, room partitions, wall caps, fixed wall trim. |
| 3 | `DoorsWindowsFixtures` | tile layer | Doors, windows, stairs, appliances built into the room shell. |
| 4 | `Furniture` | tile layer | Sofas, tables, counters, washer/dryer, storage, loose decoration. |
| 5 | `Collision` | tile layer | Editor-visible collision markers. Runtime can derive blockers from nonzero tiles. |
| 6 | `Triggers` | tile layer | Editor-visible hotspots such as exits and major interactables. |
| 7 | `Objects` | object group | Named gameplay objects used by Phaser scene code. |

## Object Names

`player-spawn`, `wife`, `dryer`, `garage`, and `basement-stairs` mirror the existing vertical-slice interactions. `living-room` and `kitchen` are room marker objects for later scripting, camera cues, or encounter-free zones.

## Layout Notes

The first pass keeps the existing playable beats: living room, kitchen/laundry, garage exit, basement stairs, wife NPC, and dryer interaction. The house is larger than the current placeholder map so later rooms can be added without renumbering the core interaction objects.
