/**
 * Map checks: every hotspot of a dungeon sits on (or next to) floor that Dad
 * can reach from the entrance. Also prints the maps when run with --print.
 */
import { getArea } from "../src/game/content";
import * as backyard from "../src/game/maps/backyard";
import * as basement from "../src/game/maps/basement";
import * as bathroom from "../src/game/maps/bathroom";
import * as garage from "../src/game/maps/garage";
import * as tunnels from "../src/game/maps/tunnels";

interface MapModule { MAP: number[][]; F: number; X: number }

const DUNGEONS: Array<{ id: string; map: MapModule; spawn: [number, number]; blocked?: string[] }> = [
  { id: "garage", map: garage, spawn: [13, 1] },
  { id: "basement", map: basement, spawn: [17, 1], blocked: ["32,19", "33,19", "32,20", "33,20"] },
  { id: "bathroom", map: bathroom, spawn: [11, 2] },
  { id: "backyard", map: backyard, spawn: [17, 2], blocked: ["33,11"] },
  { id: "tunnels", map: tunnels, spawn: [4, 2], blocked: tunnels.ORNAMENTS.map(([c, r]) => `${c},${r}`) },
];

export function checkMaps(print = false): string[] {
  const problems: string[] = [];
  for (const dungeon of DUNGEONS) {
    const { MAP, F, X } = dungeon.map;
    const area = getArea(dungeon.id);
    const solid = new Set([...(dungeon.blocked ?? []), ...(area.hotspots ?? []).filter((s) => s.solid).map((s) => `${s.col},${s.row}`)]);
    const walkable = (c: number, r: number) => (MAP[r]?.[c] === F || MAP[r]?.[c] === X) && !solid.has(`${c},${r}`);

    const seen = new Set<string>();
    const queue: Array<[number, number]> = [dungeon.spawn];
    while (queue.length) {
      const [c, r] = queue.shift()!;
      const key = `${c},${r}`;
      if (seen.has(key) || !walkable(c, r)) continue;
      seen.add(key);
      queue.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
    }

    for (const spot of area.hotspots ?? []) {
      const onFloor = MAP[spot.row]?.[spot.col] === F;
      if (spot.solid && !onFloor) problems.push(`${dungeon.id}: solid hotspot ${spot.id} is not on a floor tile`);
      const near = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => seen.has(`${spot.col + dc},${spot.row + dr}`));
      if (!near) problems.push(`${dungeon.id}: hotspot ${spot.id} at ${spot.col},${spot.row} cannot be reached`);
    }

    const floor = MAP.flat().filter((t) => t === F).length;
    if (seen.size < floor - solid.size - 2) problems.push(`${dungeon.id}: ${floor - seen.size} floor tiles are unreachable`);

    if (print) {
      console.log(`\n${dungeon.id} ${MAP[0].length}x${MAP.length}, ${seen.size} reachable tiles`);
      const marks = new Map((area.hotspots ?? []).map((s) => [`${s.col},${s.row}`, s.chest ? "C" : "*"]));
      MAP.forEach((row, r) => console.log(row.map((t, c) => marks.get(`${c},${r}`) ?? (t === F ? (seen.has(`${c},${r}`) ? "." : "?") : t === X ? "X" : "#")).join("")));
    }
  }
  return problems;
}
