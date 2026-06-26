import Phaser from "phaser";
import { addPixelText, setPixelText } from "./uiText";

type AdvanceResult = "revealed" | "page" | "done";

const charsPerLineLabelMode = 45;
const charsPerLinePortraitMode = 37;
const linesPerPage = 3;
const msPerCharacter = 48;
const defaultTextTint = 0xf8fafc;
const itemGainTextTint = 0xef4444;

const PORTRAIT_KEYS: Record<string, string> = {
  "DAD": "portrait-dad",
  "WIFE": "portrait-wife",
  "NARRATOR": "portrait-narrator",
  "DAD'S BRAIN": "portrait-dads-brain",
};

export class DialogueBox {
  private readonly box: Phaser.GameObjects.Rectangle;
  private readonly speakerBreak: Phaser.GameObjects.Rectangle;
  private readonly speakerLabel: Phaser.GameObjects.BitmapText;
  private readonly portraitFrame: Phaser.GameObjects.Rectangle;
  private readonly portraitDivider: Phaser.GameObjects.Rectangle;
  private readonly portraitImage: Phaser.GameObjects.Image;
  private readonly text: Phaser.GameObjects.BitmapText;
  private readonly moreMarker: Phaser.GameObjects.BitmapText;
  private pages: string[] = [];
  private pageIndex = 0;
  private visibleCharacters = 0;
  private elapsedMs = 0;
  private isTyping = false;
  private charsPerLine = charsPerLineLabelMode;

  constructor(scene: Phaser.Scene) {
    this.box = scene.add.rectangle(160, 150, 304, 50, 0x111827, 0.94)
      .setStrokeStyle(2, 0xf8fafc)
      .setScrollFactor(0)
      .setVisible(false);

    this.speakerBreak = scene.add.rectangle(53, 125, 76, 8, 0x111827, 1)
      .setDepth(71)
      .setScrollFactor(0)
      .setVisible(false);

    this.speakerLabel = addPixelText(scene, 18, 121, "-- DAD --", 6)
      .setTint(0xfb923c)
      .setDepth(72)
      .setScrollFactor(0)
      .setVisible(false);

    this.portraitImage = scene.add.image(30, 150, "portrait-dad")
      .setDisplaySize(34, 34)
      .setDepth(70)
      .setScrollFactor(0)
      .setVisible(false);

    this.portraitFrame = scene.add.rectangle(30, 150, 38, 38)
      .setStrokeStyle(1, 0xf8fafc, 0.6)
      .setDepth(71)
      .setScrollFactor(0)
      .setVisible(false);

    this.portraitDivider = scene.add.rectangle(52, 150, 1, 42, 0xf8fafc, 0.4)
      .setDepth(71)
      .setScrollFactor(0)
      .setVisible(false);

    this.text = addPixelText(scene, 16, 132, "", 7)
      .setDepth(71)
      .setScrollFactor(0)
      .setMaxWidth(288)
      .setVisible(false);

    this.moreMarker = addPixelText(scene, 292, 164, "▼", 6)
      .setTint(0xfacc15)
      .setDepth(72)
      .setScrollFactor(0)
      .setVisible(false);
  }

  show(message: string, speaker = "DAD", portraitRole: string = speaker): void {
    const portraitKey = PORTRAIT_KEYS[portraitRole];
    this.charsPerLine = portraitKey ? charsPerLinePortraitMode : charsPerLineLabelMode;

    this.pages = paginate(message, this.charsPerLine);
    this.pageIndex = 0;
    this.visibleCharacters = 0;
    this.elapsedMs = 0;
    this.isTyping = true;

    this.box.setVisible(true);

    if (portraitKey) {
      this.portraitImage.setTexture(portraitKey).setVisible(true);
      this.portraitFrame.setVisible(true);
      this.portraitDivider.setVisible(true);
      this.speakerBreak.setVisible(false);
      this.speakerLabel.setVisible(false);
      this.text.setPosition(58, 132).setMaxWidth(246);
    } else {
      this.portraitImage.setVisible(false);
      this.portraitFrame.setVisible(false);
      this.portraitDivider.setVisible(false);

      const speakerText = `-- ${speaker} --`;
      const speakerBreakWidth = Math.max(44, speakerText.length * 6 + 8);
      this.speakerBreak
        .setPosition(18 + speakerBreakWidth / 2, 125)
        .setDisplaySize(speakerBreakWidth, 8);
      this.speakerBreak.setVisible(true);
      setPixelText(this.speakerLabel, speakerText);
      this.speakerLabel.setVisible(true);
      this.text.setPosition(16, 132).setMaxWidth(288);
    }

    this.text.setTint(isItemGainMessage(speaker, message) ? itemGainTextTint : defaultTextTint);
    this.text.setVisible(true);
    this.render();
  }

  update(deltaMs: number): void {
    if (!this.isTyping) {
      this.updateMarker();
      return;
    }

    this.elapsedMs += deltaMs;
    const targetCharacters = Math.min(
      this.currentPage().length,
      Math.floor(this.elapsedMs / msPerCharacter),
    );

    if (targetCharacters !== this.visibleCharacters) {
      this.visibleCharacters = targetCharacters;
      this.render();
    }

    if (this.visibleCharacters >= this.currentPage().length) {
      this.isTyping = false;
      this.updateMarker();
    }
  }

  advance(): AdvanceResult {
    if (this.isTyping) {
      this.revealPage();
      return "revealed";
    }

    if (this.pageIndex < this.pages.length - 1) {
      this.pageIndex += 1;
      this.visibleCharacters = 0;
      this.elapsedMs = 0;
      this.isTyping = true;
      this.render();
      return "page";
    }

    return "done";
  }

  hide(): void {
    this.pages = [];
    this.pageIndex = 0;
    this.visibleCharacters = 0;
    this.elapsedMs = 0;
    this.isTyping = false;
    this.box.setVisible(false);
    this.speakerBreak.setVisible(false);
    this.speakerLabel.setVisible(false);
    this.portraitImage.setVisible(false);
    this.portraitFrame.setVisible(false);
    this.portraitDivider.setVisible(false);
    this.text.setVisible(false);
    this.moreMarker.setVisible(false);
  }

  private revealPage(): void {
    this.visibleCharacters = this.currentPage().length;
    this.isTyping = false;
    this.render();
  }

  private render(): void {
    setPixelText(this.text, this.currentPage().slice(0, this.visibleCharacters));
    this.updateMarker();
  }

  private updateMarker(): void {
    this.moreMarker.setVisible(!this.isTyping && this.pageIndex < this.pages.length - 1);
  }

  private currentPage(): string {
    return this.pages[this.pageIndex] ?? "";
  }
}

function paginate(message: string, charsPerLine: number): string[] {
  const lines = wrapMessage(message, charsPerLine);
  const pages: string[] = [];

  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage).join("\n"));
  }

  return pages.length > 0 ? pages : [""];
}

function wrapMessage(message: string, charsPerLine: number): string[] {
  return message
    .split("\n")
    .flatMap((paragraph) => wrapParagraph(paragraph, charsPerLine));
}

function wrapParagraph(paragraph: string, charsPerLine: number): string[] {
  const words = paragraph.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (word.length > charsPerLine) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = "";
      }
      lines.push(...splitLongWord(word, charsPerLine));
      continue;
    }

    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (nextLine.length > charsPerLine) {
      lines.push(currentLine);
      currentLine = word;
      continue;
    }

    currentLine = nextLine;
  }

  if (currentLine || lines.length === 0) {
    lines.push(currentLine);
  }

  return lines;
}

function splitLongWord(word: string, charsPerLine: number): string[] {
  const chunks: string[] = [];

  for (let index = 0; index < word.length; index += charsPerLine) {
    chunks.push(word.slice(index, index + charsPerLine));
  }

  return chunks;
}

function isItemGainMessage(speaker: string, message: string): boolean {
  if (speaker !== "SYSTEM") return false;
  return /\b(YOU GAINED|FOUND|HAD FOUND)\b/i.test(message);
}
