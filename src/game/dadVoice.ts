import Phaser from "phaser";
import { dialogue } from "./content";

type DadDialogue = Record<string, Record<string, string[]>>;
type DadBrainDialogue = Record<string, string[]>;
type MovieQuotes = Record<string, string[]>;

const dadDialogue = dialogue.dad as DadDialogue | undefined;
const dadBrainDialogue = dialogue.dadBrain as DadBrainDialogue | undefined;
const movieQuotes = dialogue.movieQuotes as MovieQuotes | undefined;

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

/**
 * Returns a movie quote appropriate for the given context.
 *
 * Contexts match keys in dialogue.json → movieQuotes:
 *   "findItem"   — Dad opens a chest / picks up an item
 *   "deadEnd"    — Dad explores a dead-end corridor
 *   "ambush"     — Dad gets hit before he can act
 *   "longSpeech" — Dad launches into an extended Princess Bride monologue
 *
 * Dad quotes movies the way dads do: confidently, slightly wrong, always
 * at the wrong moment, never expecting the other person to get the reference.
 */
export function getDadMovieQuote(context: string): string {
  const pool = movieQuotes?.[context];
  if (!pool || pool.length === 0) {
    // Fall back to a random general quote from any pool
    const allQuotes = Object.values(movieQuotes ?? {}).flat();
    if (allQuotes.length === 0) return "";
    return Phaser.Utils.Array.GetRandom(allQuotes);
  }
  return Phaser.Utils.Array.GetRandom(pool);
}
