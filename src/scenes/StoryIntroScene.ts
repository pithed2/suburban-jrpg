/**
 * StoryIntroScene — Opening Sequence
 * ─────────────────────────────────────────────────────────────────────────────
 * Two phases:
 *
 *  Phase 1 — Title card
 *    Static title screen.  Press Space to begin.
 *
 *  Phase 2 — Recliner Dialogue
 *    The full opening monologue: Dad wakes from his "not-nap", Wife drops the
 *    dryer quest AND the two-week in-law bomb.  Uses the same DialogueBox the
 *    rest of the game uses so the typewriter / speaker-label feel is consistent.
 *
 *    At the end the scene sets the first quest step active and hands off to
 *    NeighborhoodScene.  No double-play of the wife dialogue in-game.
 */

import Phaser from "phaser";
import { installDevShortcuts } from "../game/devShortcuts";
import { DialogueBox } from "../game/DialogueBox";
import { DialogueRunner, type DialogueInput } from "../game/DialogueRunner";
import { getGameState, saveGameState } from "../game/session";
import { completeQuestStep, setActiveQuestStep } from "../game/state";
import { addPixelText } from "../game/uiText";

// ── Phase ─────────────────────────────────────────────────────────────────
type Phase = "title" | "dialogue" | "done";

export class StoryIntroScene extends Phaser.Scene {
  private advanceKey!: Phaser.Input.Keyboard.Key;
  private dialogueBox!: DialogueBox;
  private readonly runner = new DialogueRunner();
  private phase: Phase = "title";

  constructor() {
    super("StoryIntroScene");
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  create(): void {
    installDevShortcuts(this);

    this.advanceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.drawBackground();
    this.drawTitleCard();

    // DialogueBox is created once and stays hidden until phase 2
    this.dialogueBox = new DialogueBox(this);
  }

  update(_time: number, delta: number): void {
    if (this.phase === "dialogue") {
      this.dialogueBox.update(delta);
    }

    if (!Phaser.Input.Keyboard.JustDown(this.advanceKey)) return;

    if (this.phase === "title") {
      this.beginDialogue();
      return;
    }

    if (this.phase === "dialogue") {
      this.advanceDialogue();
    }
  }

  // ── Title card ────────────────────────────────────────────────────────────

  private drawBackground(): void {
    this.add.rectangle(160, 90, 320, 180, 0x050a0f);
    // Subtle scanline feel
    for (let y = 0; y < 180; y += 4) {
      this.add.rectangle(160, y + 1, 320, 1, 0x000000, 0.15);
    }
  }

  private drawTitleCard(): void {
    // Outer decorative border
    this.add.rectangle(160, 90, 308, 164, 0x0f1f2e)
      .setStrokeStyle(2, 0x1e3a5f);

    // Game title block
    this.add.rectangle(160, 44, 260, 44, 0x050a0f, 0.97)
      .setStrokeStyle(2, 0xfacc15);
    addPixelText(this, 160, 24, "THE IN-LAWS", 10)
      .setOrigin(0.5, 0)
      .setTint(0xfacc15);
    addPixelText(this, 160, 40, "ARE COMING", 10)
      .setOrigin(0.5, 0)
      .setTint(0xfacc15);

    // Subtitle
    addPixelText(this, 160, 68, "A SUBURBAN RPG", 6)
      .setOrigin(0.5, 0)
      .setTint(0x60a5fa);

    // Flavour line
    this.add.rectangle(160, 100, 260, 30, 0x0a1525, 0.9)
      .setStrokeStyle(1, 0x1e3a5f);
    addPixelText(this, 160, 92, "THE DRYER IS BROKEN.", 6)
      .setOrigin(0.5, 0)
      .setTint(0xe2e8f0);
    addPixelText(this, 160, 104, "THE IN-LAWS ARE COMING.", 6)
      .setOrigin(0.5, 0)
      .setTint(0xe2e8f0);

    // Copyright-style footer
    addPixelText(this, 160, 128, "ONE DAD. FOURTEEN DAYS.", 6)
      .setOrigin(0.5, 0)
      .setTint(0x64748b);
    addPixelText(this, 160, 140, "NO REFUNDS.", 6)
      .setOrigin(0.5, 0)
      .setTint(0x64748b);

    // Blinking prompt
    const prompt = addPixelText(this, 160, 162, "- PRESS SPACE TO BEGIN -", 6)
      .setOrigin(0.5, 0)
      .setTint(0x93c5fd);
    this.tweens.add({
      targets: prompt,
      alpha: { from: 1, to: 0.25 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  // ── Dialogue phase ────────────────────────────────────────────────────────

  private beginDialogue(): void {
    this.phase = "dialogue";

    const bgMusic = this.sound.add("home-bg", { loop: true, volume: 0.4 });
    bgMusic.play();
    this.events.once("shutdown", () => bgMusic.stop());

    // Clear title visuals by drawing over them with the dark background
    this.add.rectangle(160, 90, 320, 180, 0x050a0f);

    // Atmospheric header stays visible during dialogue
    addPixelText(this, 160, 8, "THE IN-LAWS ARE COMING", 6)
      .setOrigin(0.5, 0)
      .setTint(0xfacc15);

    // Scene illustration — centered in the gap between header (y≈14) and dialogue box (y≈121)
    this.add.image(160, 67, "intro-scene").setOrigin(0.5, 0.5);

    const name = getGameState().player.name || "DAD";
    const lines = this.buildLines(name);

    const first = this.runner.start(lines, () => this.finishDialogue());
    if (first) this.dialogueBox.show(first.text, first.speaker);
  }

  private advanceDialogue(): void {
    if (this.dialogueBox.advance() !== "done") return;
    const next = this.runner.advance();
    if (next) {
      this.dialogueBox.show(next.text, next.speaker);
    }
  }

  private finishDialogue(): void {
    if (this.phase === "done") return;
    this.phase = "done";

    // Mark the opening quest beat as complete so NeighborhoodScene
    // starts in the correct state without replaying the wife's intro.
    const state = getGameState();
    state.flags.talkedToWife = true;
    completeQuestStep(state, "talk-to-wife");
    setActiveQuestStep(state, "inspect-dryer");
    saveGameState(state);

    this.cameras.main.fadeOut(800, 5, 10, 15);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start("NeighborhoodScene");
    });
  }

  // ── Dialogue lines ────────────────────────────────────────────────────────

  private buildLines(name: string): DialogueInput[] {
    return [
      {
        speaker: "NARRATOR",
        text: "Saturday afternoon. A man of considerable dad energy inspects the backs of his eyelids. This is a medical necessity.",
      },
      { speaker: "WIFE", text: `${name}.` },
      { speaker: "DAD", text: "[snort] — I was watching that." },
      { speaker: "WIFE", text: "The dryer isn't drying clothes. Since Tuesday." },
      {
        speaker: "DAD'S BRAIN",
        text: "Four days. She waited four days to mention it. This is a political move.",
      },
      { speaker: "WIFE", text: "Also... I invited my parents to stay with us." },
      { speaker: "DAD", text: "..." },
      { speaker: "WIFE", text: "They'll be here in two weeks. The dryer, the basement, the garage. You know how my mother gets." },
      { speaker: "WIFE", text: "I'll make the good lasagna when they're here." },
      { speaker: "DAD'S BRAIN", text: "We fight for the lasagna." },
      {
        speaker: "NARRATOR",
        text: "Fourteen days. One dad. One impossible standard set by someone who does not live here.",
      },
    ];
  }
}
