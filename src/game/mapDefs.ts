/**
 * mapDefs.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * All room/map definitions live here — analogous to characterDefs.ts.
 *
 * Adding a new room
 * ─────────────────
 * 1. Design the map in Tiled, export to public/assets/maps/<name>.json.
 * 2. Run:  node scripts/process-maps.mjs
 *    → produces public/assets-active/maps/<name>.json with tilesets inlined.
 * 3. In BootScene.preload(), add:
 *      this.load.tilemapTiledJSON("my-map", "/assets-active/maps/<name>.json");
 *    And any new tileset images not already loaded.
 * 4. Add a RoomDef export here.
 * 5. Use it in a scene:  const room = new TiledRoom(this, MY_MAP_DEF);
 *
 * Tilesets already loaded in BootScene
 * ─────────────────────────────────────
 *   "house-core-16"  →  house_core_16x16.png       (64 cols × 96 rows = 6144 tiles)
 *   "ts-garage"      →  garage_basement_16x16.png   (6144 tiles)
 *   "ts-props"       →  props_interactables_16x16.png (6144 tiles)
 *   "ts-exterior"    →  suburb_exterior_16x16.png   (6144 tiles)
 *
 * Tileset → image path (public/assets/tilesets/Interiors_free/16x16/)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { RoomDef } from "./TiledRoom";

// ── Shared tileset set for Interiors_free maps ────────────────────────────────
//
// All four sheets are loaded in BootScene so any room can reference all of them.
// Unused tilesets in a given map cost nothing at render time.

const INTERIORS_TILESETS: RoomDef["tilesets"] = [
  { name: "house_core_16x16",          imageKey: "house-core-16"  },
  { name: "garage_basement_16x16",     imageKey: "ts-garage"      },
  { name: "props_interactables_16x16", imageKey: "ts-props"       },
  { name: "suburb_exterior_16x16",     imageKey: "ts-exterior"    },
];

// ── Room definitions ──────────────────────────────────────────────────────────

/**
 * NEW_HOUSE_DEF
 * The main house interior — 36 × 24 tiles (576 × 384 world pixels).
 *
 * Objects defined in Tiled (used by NeighborhoodScene):
 *   "player-spawn"    type: spawn
 *   "wife"            type: npc
 *   "dryer"           type: interactable
 *   "garage"          type: sceneExit
 *   "basement-stairs" type: sceneExit
 *   "living-room"     type: room   (zone rectangle)
 *   "kitchen"         type: room   (zone rectangle)
 *
 * Painting guide (Tiled layer names):
 *   Floor                  — base floor tiles (no collision)
 *   Walls                  — wall tiles; non-zero = solid (drives canWalkTo)
 *   DoorsWindowsFixtures   — doors, windows, built-ins (no collision)
 *   Furniture              — furniture props (no collision — visual only)
 *   Collision              — reserved for future explicit collision overrides
 *   Triggers               — reserved for scripted trigger zones
 */
export const NEW_HOUSE_DEF: RoomDef = {
  mapKey: "new-house-map",
  tileSize: 16,
  tilesets: INTERIORS_TILESETS,
  visualLayers: ["Floor", "Walls", "DoorsWindowsFixtures", "Furniture"],
  collisionLayer: "Walls",
  objectLayer: "Objects",
};
