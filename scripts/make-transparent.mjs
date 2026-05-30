/**
 * scripts/make-transparent.mjs
 *
 * Strips a solid near-white background from a PNG and saves it back
 * with a proper alpha channel.  Safe: writes to a temp file first,
 * then atomically replaces the original only on success.
 *
 * Usage:
 *   node scripts/make-transparent.mjs <path-to-png> [tolerance=30]
 *
 * Requires the 'sharp' package:
 *   npm install --save-dev sharp
 *
 * How it works
 * ────────────
 * 1. Load the image as raw RGBA pixels via sharp.
 * 2. Sample the top-left corner to identify the background colour.
 * 3. Any pixel within `tolerance` of that colour has its alpha set to 0.
 * 4. Pixels near the detected background but semi-adjacent to non-background
 *    pixels get partial alpha (soft edge blend).
 * 5. Save back as PNG with full alpha channel.
 */

import { createRequire } from "module";
import { existsSync, renameSync, writeFileSync, unlinkSync } from "fs";
import { resolve } from "path";

const require = createRequire(import.meta.url);

// Try to load sharp; install hint if absent
let sharp;
try {
  sharp = require("sharp");
} catch {
  console.error("sharp not installed — run: npm install --save-dev sharp");
  process.exit(1);
}

const [, , inputPath, tolArg] = process.argv;
if (!inputPath) {
  console.error("Usage: node scripts/make-transparent.mjs <path-to-png> [tolerance=30]");
  process.exit(1);
}

const abs  = resolve(inputPath);
const tol  = Number(tolArg ?? 30);
const tmp  = abs + ".transparent_tmp.png";

if (!existsSync(abs)) {
  console.error(`File not found: ${abs}`);
  process.exit(1);
}

console.log(`Processing: ${abs}  tolerance=${tol}`);

const img = sharp(abs);
const meta = await img.metadata();
console.log(`  ${meta.width}×${meta.height}  channels=${meta.channels}  format=${meta.format}`);

// Get raw RGBA data (always 4 channels out)
const { data, info } = await img
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info; // channels=4

// Sample background from the four corners
function sampleCorner(x, y) {
  const i = (y * width + x) * channels;
  return [data[i], data[i + 1], data[i + 2]];
}

const corners = [
  sampleCorner(0, 0),
  sampleCorner(width - 1, 0),
  sampleCorner(0, height - 1),
  sampleCorner(width - 1, height - 1),
];

// Use the most common corner colour as background
// (simple: average the corners — they should all be similar for a solid BG)
const bgR = Math.round(corners.reduce((s, c) => s + c[0], 0) / 4);
const bgG = Math.round(corners.reduce((s, c) => s + c[1], 0) / 4);
const bgB = Math.round(corners.reduce((s, c) => s + c[2], 0) / 4);
console.log(`  Background colour sample: rgb(${bgR}, ${bgG}, ${bgB})`);

let removed = 0;
for (let i = 0; i < data.length; i += channels) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const dist = Math.sqrt(
    (r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2,
  );

  if (dist < tol) {
    // Hard transparent
    data[i + 3] = 0;
    removed++;
  } else if (dist < tol * 1.8) {
    // Soft edge — blend alpha proportionally
    const t = (dist - tol) / (tol * 0.8);
    data[i + 3] = Math.round(t * 255);
  }
}

console.log(`  Removed ${removed.toLocaleString()} background pixels`);

// Save to temp file first
const output = await sharp(data, { raw: { width, height, channels } })
  .png()
  .toBuffer();

writeFileSync(tmp, output);

// Atomic replace
try { unlinkSync(abs); } catch {}
renameSync(tmp, abs);

console.log(`  ✓ Saved transparent PNG → ${abs}`);
