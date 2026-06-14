import Phaser from "phaser";
import { dialogue } from "./content";

type DadDialogue = Record<string, Record<string, string[]>>;
type DadBrainDialogue = Record<string, string[]>;
type MovieQuotes = Record<string, string[]>;
type EnemyBanter = Record<string, string[]>;

const dadDialogue = dialogue.dad as DadDialogue | undefined;
const dadBrainDialogue = dialogue.dadBrain as DadBrainDialogue | undefined;
const movieQuotes = dialogue.movieQuotes as MovieQuotes | undefined;
const enemyBanter = dialogue.enemyBanter as EnemyBanter | undefined;

export function getDadLine(context: string, mood: string): string {
  const pool = dadDialogue?.[context]?.[mood];
  if (!pool || pool.length === 0) return "";
  return Phaser.Utils.Array.GetRandom(pool);
}

export function getDadBrainLine(context: string): string {
  const pool = dadBrainDialogue?.[context];
  if (!pool || pool.length === 0) return "";
  return Phaser.Utils.Array.GetRandom(pool);
}

/** Returns a dryer boss / enemy taunt line for the given enemy id key. */
export function getEnemyBanter(enemyKey: string): string {
  const pool = enemyBanter?.[enemyKey];
  if (!pool || pool.length === 0) return "";
  return Phaser.Utils.Array.GetRandom(pool);
}

/**
 * Returns a Dad combat reaction line for the given mood.
 * 30% of the time pulls a movie quote from any context instead,
 * keeping the battle banter fresh across longer fights.
 */
export function getDadCombatLine(mood: string): string {
  if (Math.random() < 0.3) {
    const allQuotes = Object.values(movieQuotes ?? {}).flat();
    if (allQuotes.length > 0) return Phaser.Utils.Array.GetRandom(allQuotes);
  }
  return getDadLine("toEnemy", mood);
}

/**
 * Returns a movie quote appropriate for the given context.
 *
 * Contexts match keys in dialogue.json → movieQuotes:
 *   "findItem"   — Dad opens a chest / picks up an item
 *   "deadEnd"    — Dad explores a dead-end corridor
 *   "ambush"     — Dad gets hit before he can act
 *   "longSpeech" — Dad launches into an extended Princess Bride monologue
 */
export function getDadMovieQuote(context: string): string {
  const pool = movieQuotes?.[context];
  if (!pool || pool.length === 0) {
    const allQuotes = Object.values(movieQuotes ?? {}).flat();
    if (allQuotes.length === 0) return "";
    return Phaser.Utils.Array.GetRandom(allQuotes);
  }
  return Phaser.Utils.Array.GetRandom(pool);
}
