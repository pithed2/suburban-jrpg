import Phaser from "phaser";
import { getGameState, saveGameState } from "../game/session";
import { addPixelText, setPixelText } from "../game/uiText";

type NameEntryItem = string | "BACK" | "END";

const maxNameLength = 10;
const grid: NameEntryItem[][] = [
  ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"],
  ["K", "L", "M", "N", "O", "P", "Q", "R", "S", "T"],
  ["U", "V", "W", "X", "Y", "Z", "-", "'", ".", " "],
  ["BACK", "END"],
];

export class NameEntryScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private confirmKey!: Phaser.Input.Keyboard.Key;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private backspaceKey!: Phaser.Input.Keyboard.Key;
  private nameText!: Phaser.GameObjects.BitmapText;
  private gridText!: Phaser.GameObjects.BitmapText;
  private promptText!: Phaser.GameObjects.BitmapText;
  private selectedRow = 0;
  private selectedColumn = 0;
  private name = "";

  constructor() {
    super("NameEntryScene");
  }

  create(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.confirmKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.backspaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.BACKSPACE);

    this.add.rectangle(160, 90, 320, 180, 0x050505);
    addPixelText(this, 160, 8, "THE IN-LAWS ARE COMING", 6)
      .setOrigin(0.5, 0)
      .setTint(0xfacc15);
    addPixelText(this, 160, 22, "ENTER THE DAD'S NAME", 6)
      .setOrigin(0.5, 0)
      .setTint(0x93c5fd);

    this.add.rectangle(160, 54, 128, 36, 0x050505, 1)
      .setStrokeStyle(2, 0xf8fafc);
    addPixelText(this, 160, 37, "DAD NAME", 6)
      .setOrigin(0.5, 0)
      .setTint(0xf8fafc);
    this.nameText = addPixelText(this, 104, 50, "", 8).setTint(0xfacc15);

    this.add.rectangle(160, 122, 292, 88, 0x050505, 1)
      .setStrokeStyle(2, 0xf8fafc);
    this.gridText = addPixelText(this, 34, 85, "", 8);
    this.promptText = addPixelText(this, 58, 169, "ARROWS SELECT  SPACE/ENTER", 6)
      .setTint(0x93c5fd);

    this.input.keyboard!.on("keydown", this.handlePhysicalKey, this);
    this.render();
  }

  update(): void {
    this.promptText.setAlpha(this.time.now % 900 < 650 ? 1 : 0.35);

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
      this.selectedRow = Phaser.Math.Wrap(this.selectedRow - 1, 0, grid.length);
      this.selectedColumn = Math.min(this.selectedColumn, grid[this.selectedRow].length - 1);
      this.render();
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
      this.selectedRow = Phaser.Math.Wrap(this.selectedRow + 1, 0, grid.length);
      this.selectedColumn = Math.min(this.selectedColumn, grid[this.selectedRow].length - 1);
      this.render();
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) {
      this.selectedColumn = Phaser.Math.Wrap(this.selectedColumn - 1, 0, grid[this.selectedRow].length);
      this.render();
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) {
      this.selectedColumn = Phaser.Math.Wrap(this.selectedColumn + 1, 0, grid[this.selectedRow].length);
      this.render();
    }

    if (Phaser.Input.Keyboard.JustDown(this.backspaceKey)) {
      this.backspace();
    }

    if (Phaser.Input.Keyboard.JustDown(this.confirmKey) || Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      this.activate(grid[this.selectedRow][this.selectedColumn]);
    }
  }

  private handlePhysicalKey(event: KeyboardEvent): void {
    if (event.code === "Space" || event.code === "Enter") {
      return;
    }

    if (event.key.length !== 1 || this.name.length >= maxNameLength) {
      return;
    }

    const character = event.key.toUpperCase();

    if (!/^[A-Z'\-. ]$/.test(character)) {
      return;
    }

    this.name += character;
    this.render();
  }

  private activate(item: NameEntryItem): void {
    if (item === "BACK") {
      this.backspace();
      return;
    }

    if (item === "END") {
      this.finish();
      return;
    }

    if (this.name.length >= maxNameLength) {
      return;
    }

    this.name += item;
    this.render();
  }

  private backspace(): void {
    this.name = this.name.slice(0, -1);
    this.render();
  }

  private finish(): void {
    const trimmedName = this.name.trim() || "DAD";
    const state = getGameState();
    state.player.name = trimmedName;
    saveGameState(state);
    this.scene.start("StoryIntroScene");
  }

  private render(): void {
    const displayName = this.name.padEnd(maxNameLength, "*").slice(0, maxNameLength);
    setPixelText(this.nameText, displayName);
    setPixelText(this.gridText, this.getGridText());
  }

  private getGridText(): string {
    return grid
      .map((row, rowIndex) =>
        row
          .map((item, columnIndex) => {
            const cursor = rowIndex === this.selectedRow && columnIndex === this.selectedColumn ? ">" : " ";
            return `${cursor}${item.padEnd(item.length > 1 ? 5 : 2)}`;
          })
          .join(" "),
      )
      .join("\n");
  }
}
