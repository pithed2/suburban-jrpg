/**
 * characterDefs.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * All character sheet configs and character-to-slot mappings live here.
 *
 * SHEET FORMAT  (RPG Maker VX / route1rodent style)
 * ──────────────────────────────────────────────────
 * Each sheet packs multiple characters side-by-side.
 * Every character occupies a 48 × 64 px block:
 *
 *   ┌──────────────────────────────────┐
 *   │ [L-step][neutral][R-step]  ← down  row 0
 *   │ [L-step][neutral][R-step]  ← left  row 1
 *   │ [L-step][neutral][R-step]  ← right row 2
 *   │ [L-step][neutral][R-step]  ← up    row 3
 *   └──────────────────────────────────┘
 *     16px    16px    16px
 *
 * Sheet files in public/assets/characters/:
 *
 *   File               Size      charsPerRow  total chars
 *   ─────────────────  ────────  ───────────  ───────────
 *   01-generic.png     240×128       5            10
 *   02-bard.png        192×128       4             8
 *   03-soldier.png     192×128       4             8
 *   04-scout.png       192×128       4             8
 *   05-devout.png      192×128       4             8
 *   06-conjurer.png    192×128       4             8
 *
 * ADDING A CHARACTER
 * ──────────────────
 * 1. Pick a sheet and slot (0-based column index within the sheet).
 * 2. Add a new CharacterDef entry below.
 * 3. Give it a unique `id` — that becomes the animation key prefix.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import Phaser from "phaser";
import type { CharacterDef, Direction, SheetConfig } from "./CharacterSprite";

// ── Sheet config factory ──────────────────────────────────────────────────────

function sheet(key: string, charsPerRow: number, framesPerDir = 3): SheetConfig {
  return {
    key,
    frameW: 16,
    frameH: 16,
    framesPerDir,
    rows: { down: 0, left: 1, right: 2, up: 3 },
    fps: 8,
    charsPerRow,
  };
}

// ── Sheet definitions ─────────────────────────────────────────────────────────

const GENERIC  = sheet("chars-generic",  5); // 01-generic.png  — 10 everyday characters
const BARD     = sheet("chars-bard",     4); // 02-bard.png     —  8 performer types
const SOLDIER  = sheet("chars-soldier",  4); // 03-soldier.png  —  8 armored types
const SCOUT    = sheet("chars-scout",    4); // 04-scout.png    —  8 ranger/scout types
const DEVOUT   = sheet("chars-devout",   4); // 05-devout.png   —  8 cleric types
const CONJURER = sheet("chars-conjurer", 4); // 06-conjurer.png —  8 mage types

// ── Character definitions ─────────────────────────────────────────────────────
//
// charSlot = 0-based index left-to-right, top-to-bottom across the sheet.
// Rows are filled left → right before wrapping to the next row.
//
//   Slot indices for a 5-wide sheet (01-generic):
//     row 0: [0] [1] [2] [3] [4]
//     row 1: [5] [6] [7] [8] [9]
//
//   Slot indices for a 4-wide sheet (02-06):
//     row 0: [0] [1] [2] [3]
//     row 1: [4] [5] [6] [7]

// Main cast
export const DAD_DEF:  CharacterDef = { id: "dad",  sheet: GENERIC,  charSlot: 0 };
export const WIFE_DEF: CharacterDef = { id: "wife", sheet: GENERIC,  charSlot: 1 };

// Generic NPCs — neighbors, bystanders
export const NPC1_DEF: CharacterDef = { id: "npc1", sheet: GENERIC,  charSlot: 2 };
export const NPC2_DEF: CharacterDef = { id: "npc2", sheet: GENERIC,  charSlot: 5 }; // 2nd row
export const NPC3_DEF: CharacterDef = { id: "npc3", sheet: BARD,     charSlot: 0 };

// Available for future use — swap in as scenes grow
export const NPC4_DEF:  CharacterDef = { id: "npc4",  sheet: GENERIC,   charSlot: 3 };
export const NPC5_DEF:  CharacterDef = { id: "npc5",  sheet: GENERIC,   charSlot: 4 };
export const NPC6_DEF:  CharacterDef = { id: "npc6",  sheet: BARD,      charSlot: 1 };
export const NPC7_DEF:  CharacterDef = { id: "npc7",  sheet: SCOUT,     charSlot: 0 };
export const NPC8_DEF:  CharacterDef = { id: "npc8",  sheet: SOLDIER,   charSlot: 0 };
export const NPC9_DEF:  CharacterDef = { id: "npc9",  sheet: DEVOUT,    charSlot: 0 };
export const NPC10_DEF: CharacterDef = { id: "npc10", sheet: CONJURER,  charSlot: 0 };

// ── Placeholder generator (fallback when a sheet hasn't loaded) ───────────────
//
// Generates simple 2-frame 16×16 sprite sheets in memory so any CharacterDef
// that references a key not yet loaded will still render something visible.
// Safe to call multiple times — skips keys that already exist.

interface PlaceholderOpts {
  body: number;
  skin: number;
  hair: number;
  legs: number;
}

// Placeholder textures are only created if their key isn't already registered
// (i.e. the real sheet failed to load). In normal operation the real sheets
// loaded in BootScene take precedence and these are never built.
const PLACEHOLDER_FALLBACKS: Array<{ key: string; opts: PlaceholderOpts }> = [
  { key: "chars-generic",  opts: { body: 0x2563eb, skin: 0xfde68a, hair: 0x92400e, legs: 0x1e3a8a } },
  { key: "chars-bard",     opts: { body: 0xdb2777, skin: 0xfde68a, hair: 0x78350f, legs: 0x831843 } },
  { key: "chars-soldier",  opts: { body: 0x374151, skin: 0xfde68a, hair: 0x1f2937, legs: 0x111827 } },
  { key: "chars-scout",    opts: { body: 0x059669, skin: 0xfde68a, hair: 0x064e3b, legs: 0x065f46 } },
  { key: "chars-devout",   opts: { body: 0xd97706, skin: 0xfde68a, hair: 0x78350f, legs: 0x92400e } },
  { key: "chars-conjurer", opts: { body: 0x7c3aed, skin: 0xfde68a, hair: 0x4c1d95, legs: 0x5b21b6 } },
];

export function generatePlaceholders(scene: Phaser.Scene): void {
  for (const { key, opts } of PLACEHOLDER_FALLBACKS) {
    if (scene.textures.exists(key)) continue;
    buildPlaceholderSheet(scene, key, opts);
  }
}

// ── Placeholder drawing ───────────────────────────────────────────────────────

const DIRS: Direction[] = ["down", "left", "right", "up"];

/**
 * Builds a minimal 32×64 spritesheet (2 frames × 4 directions) with a
 * coloured blob character showing head-position direction cues.
 * The sheet uses the same RPG Maker row layout as the real packs, but only
 * has 1 character and 2 frames per direction instead of 3.
 */
function buildPlaceholderSheet(
  scene: Phaser.Scene,
  key: string,
  opts: PlaceholderOpts,
): void {
  const g = scene.add.graphics();
  g.setVisible(false);

  for (let rowIdx = 0; rowIdx < 4; rowIdx++) {
    const dir = DIRS[rowIdx];
    for (let frame = 0; frame < 2; frame++) {
      drawChar16(g, frame * 16, rowIdx * 16, dir, frame, opts);
    }
  }

  g.generateTexture(key, 32, 64);
  g.destroy();

  // Manually register frame data so Phaser treats it as a spritesheet
  const tex = scene.textures.get(key);
  tex.add("__BASE", 0, 0, 0, 32, 64);
  for (let i = 0; i < 8; i++) {
    tex.add(i, 0, (i % 2) * 16, Math.floor(i / 2) * 16, 16, 16);
  }
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

function drawChar16(
  g: Phaser.GameObjects.Graphics,
  fx: number,
  fy: number,
  dir: Direction,
  walkFrame: number,
  opts: PlaceholderOpts,
): void {
  const { body, skin, hair, legs } = opts;
  const bob = walkFrame;

  g.fillStyle(body, 1);
  g.fillRect(fx + 4, fy + 5 + bob, 8, 6);

  switch (dir) {
    case "down":
      g.fillStyle(skin, 1);
      g.fillRect(fx + 5, fy + 1 + bob, 6, 4);
      g.fillStyle(0x1a1a1a, 1);
      g.fillRect(fx + 6, fy + 4 + bob, 1, 1);
      g.fillRect(fx + 9, fy + 4 + bob, 1, 1);
      break;
    case "up":
      g.fillStyle(hair, 1);
      g.fillRect(fx + 5, fy + 1 + bob, 6, 4);
      break;
    case "left":
      g.fillStyle(skin, 1);
      g.fillRect(fx + 1, fy + 4 + bob, 4, 5);
      g.fillStyle(0x1a1a1a, 1);
      g.fillRect(fx + 3, fy + 5 + bob, 1, 1);
      break;
    case "right":
      g.fillStyle(skin, 1);
      g.fillRect(fx + 11, fy + 4 + bob, 4, 5);
      g.fillStyle(0x1a1a1a, 1);
      g.fillRect(fx + 12, fy + 5 + bob, 1, 1);
      break;
  }

  g.fillStyle(legs, 1);
  if (walkFrame === 0) {
    g.fillRect(fx + 5, fy + 11, 2, 3);
    g.fillRect(fx + 9, fy + 12, 2, 2);
  } else {
    g.fillRect(fx + 5, fy + 13, 2, 2);
    g.fillRect(fx + 9, fy + 12, 2, 3);
  }
}
