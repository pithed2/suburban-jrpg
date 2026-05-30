/**
 * scripts/process-maps.mjs
 *
 * Tiled exports maps that reference external tileset .json files.
 * Phaser can't resolve those references at runtime, so this script
 * inlines the tileset metadata before the map is deployed.
 *
 * Run:  node scripts/process-maps.mjs
 *
 * Input:   public/assets/maps/*.json
 * Output:  public/assets-active/maps/*.json  (tilesets embedded)
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { resolve, dirname, basename } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC  = resolve(ROOT, "public/assets/maps");
const OUT  = resolve(ROOT, "public/assets-active/maps");

// All tileset PNGs live in public/assets/tilesets/Interiors_free/16x16/
// The image path stored in the output JSON is only used by the Tiled editor;
// Phaser ignores it and uses the imageKey supplied to addTilesetImage() instead.
const KNOWN_TILESETS = {
  house_core_16x16:          { columns: 64, imagewidth: 1024, imageheight: 1536, tilecount: 6144, tilewidth: 16, tileheight: 16, margin: 0, spacing: 0 },
  garage_basement_16x16:     { columns: 64, imagewidth: 1024, imageheight: 1536, tilecount: 6144, tilewidth: 16, tileheight: 16, margin: 0, spacing: 0 },
  props_interactables_16x16: { columns: 64, imagewidth: 1024, imageheight: 1536, tilecount: 6144, tilewidth: 16, tileheight: 16, margin: 0, spacing: 0 },
  suburb_exterior_16x16:     { columns: 64, imagewidth: 1024, imageheight: 1536, tilecount: 6144, tilewidth: 16, tileheight: 16, margin: 0, spacing: 0 },
};

mkdirSync(OUT, { recursive: true });

for (const file of readdirSync(SRC).filter(f => f.endsWith(".json"))) {
  const map = JSON.parse(readFileSync(resolve(SRC, file), "utf8"));

  // Replace { source: "..." } tileset references with inline data
  if (Array.isArray(map.tilesets)) {
    map.tilesets = map.tilesets.map(ts => {
      if (!ts.source) return ts; // already inline

      const name = basename(ts.source, ".json");
      const meta = KNOWN_TILESETS[name];

      if (!meta) {
        console.warn(`  ⚠  Unknown tileset "${name}" in ${file} — kept as-is`);
        return ts;
      }

      return {
        ...meta,
        firstgid: ts.firstgid,
        name,
        image: `${name}.png`,
      };
    });
  }

  const outPath = resolve(OUT, file);
  writeFileSync(outPath, JSON.stringify(map), "utf8"); // minified — Phaser doesn't need pretty-print
  console.log(`✓  ${file}  →  ${outPath}`);
}

console.log("Done.");
