/**
 * Phaser-free random helpers. Game code and the balance simulator share them,
 * so the simulator can swap in a seeded source with setRandomSource().
 */
let source: () => number = Math.random;

export function setRandomSource(next: () => number): void {
  source = next;
}

export function random(): number {
  return source();
}

/** Inclusive integer in [min, max]. */
export function randomInt(min: number, max: number): number {
  return Math.floor(source() * (max - min + 1)) + min;
}

export function pick<T>(values: readonly T[]): T {
  return values[Math.floor(source() * values.length)];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Small deterministic PRNG (mulberry32) for repeatable simulations. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
