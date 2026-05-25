import Phaser from "phaser";
import { dialogue } from "./content";

type DadDialogue = Record<string, Record<string, string[]>>;
type DadBrainDialogue = Record<string, string[]>;

const dadDialogue = dialogue.dad as DadDialogue | undefined;
const dadBrainDialogue = dialogue.dadBrain as DadBrainDialogue | undefined;

export function getDadLine(context: string, mood: string): string {
  const pool = dadDialogue?.[context]?.[mood];

  if (!pool || pool.length === 0) {
    return "";
  }

  return Phaser.Utils.Array.GetRandom(pool);
}

export function getDadBrainLine(context: string): string {
  const pool = dadBrainDialogue?.[context];

  if (!pool || pool.length === 0) {
    return "";
  }

  return Phaser.Utils.Array.GetRandom(pool);
}
