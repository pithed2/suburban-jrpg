/**
 * HardwareStoreScene — THEE Home Depot
 * ─────────────────────────────────────────────────────────────────────────
 * Single shop room. No combat. Dad talks to the clerk to buy a plunger-tier
 * weapon needed for the Clogged Toilet boss fight.
 */
import Phaser from "phaser";
import { CharacterSprite } from "../game/CharacterSprite";
import { DAD_DEF, NPC8_DEF } from "../game/characterDefs";
import { items } from "../game/content";
import { installDevShortcuts } from "../game/devShortcuts";
import { DialogueBox } from "../game/DialogueBox";
import { DialogueRunner, type DialogueInput, type DialogueLine } from "../game/DialogueRunner";
import { GameMenu } from "../game/GameMenu";
import { GridMover } from "../game/GridMover";
import { PlayerStatsPanel } from "../game/PlayerStatsPanel";
import { getGameState, saveGameState } from "../game/session";
import { completeQuestStep, setActiveQuestStep, type GameState } from "../game/state";
import { addPixelText, setPixelText } from "../game/uiText";

const TILE = 16;

const FLOOR = 0;
const WALL  = 1;
const EXIT  = 2;

const WALL_FRAME  = 134; // gray concrete block, matches the garage
const FLOOR_FRAME = 7;

const W = WALL;
const _ = FLOOR;
const X = EXIT;

const MAP: number[][] = [
  [W,W,W,W,W,W,W,W,W,W,W,X,W,W,W,W,W,W,W,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W],
  [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
];

const ROWS = MAP.length;
const COLS = MAP[0].length;
const WORLD_W = COLS * TILE;
const WORLD_H = ROWS * TILE;

const CLERK_COL = 9;
const CLERK_ROW = 4;
const SPAWN_COL = 11;
const SPAWN_ROW = 2;

const SHOP_ITEMS = ["plumbing-snake", "plunger-of-the-gods"] as const;

type SceneMode = "explore" | "dialogue" | "shop";

export class HardwareStoreScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private confirmKey!: Phaser.Input.Keyboard.Key;
  private escapeKey!: Phaser.Input.Keyboard.Key;
  private questKey!: Phaser.Input.Keyboard.Key;
  private mover!: GridMover;
  private clerkChar!: CharacterSprite;
  private dialogueBox!: DialogueBox;
  private statsPanel!: PlayerStatsPanel;
  private menu!: GameMenu;
  private mode: SceneMode = "explore";
  private state!: GameState;
  private readonly dialogueRunner = new DialogueRunner();

  private shopBox!: Phaser.GameObjects.Rectangle;
  private shopTitle!: Phaser.GameObjects.BitmapText;
  private shopText!: Phaser.GameObjects.BitmapText;
  private shopDetail!: Phaser.GameObjects.BitmapText;
  private shopSelected = 0;

  constructor() {
    super("HardwareStoreScene");
  }

  create(): void {
    installDevShortcuts(this);

    this.state = getGameState();
    this.mode = "explore";
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.confirmKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.escapeKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.questKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

    this.drawTiles();
    this.placeClerk();
    this.placePlayer();
    this.createUi();
    this.menu = new GameMenu(this, () => this.state);

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.mover.phaserSprite, true, 0.1, 0.1);

    if (this.state.quest.activeStepId === "visit-home-depot") {
      completeQuestStep(this.state, "visit-home-depot");
      setActiveQuestStep(this.state, "find-plunger");
    }
    this.state.flags.visitedHomeDepot = true;
    saveGameState(this.state);

    this.startDialogue([
      { speaker: "NARRATOR",   text: "The automatic doors part. Fluorescent lights hum overhead. Somewhere, a forklift beeps." },
      { speaker: "NARRATOR",   text: "This is Dad's cathedral. He could walk this place blind. He basically already does." },
      { speaker: "DAD",        text: "It's a wonderland in here." },
      { speaker: "DAD'S BRAIN", text: "Talk to the clerk. He has seen things. He has seen everything." },
    ]);
  }

  update(_time: number, delta: number): void {
    this.dialogueBox.update(delta);
    this.menu.update();
    this.updateQuestPrompt();

    if (this.menu.isOpen()) {
      this.statsPanel.hide();
      return;
    }

    if (this.mode === "shop") {
      this.handleShopInput();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.handleInteract();
    }

    if (this.mode !== "explore") {
      this.statsPanel.hide();
      return;
    }

    this.mover.update(
      this.cursors,
      delta,
      (col, row) => this.canWalkTo(col, row),
      (col, row) => this.onPlayerLand(col, row),
    );

    this.statsPanel.update(delta, !this.mover.isMoving, this.state);
  }

  // ── Tiles ────────────────────────────────────────────────────────────────

  private drawTiles(): void {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const tileId = MAP[row][col];
        const cx = col * TILE + TILE / 2;
        const cy = row * TILE + TILE / 2;

        if (tileId === WALL) {
          this.add.image(cx, cy, "full-set-int-a4")
            .setFrame(WALL_FRAME)
            .setDisplaySize(TILE, TILE);
        } else {
          this.add.image(cx, cy, "full-set-int-a2")
            .setFrame(FLOOR_FRAME)
            .setDisplaySize(TILE, TILE);

          if (tileId === EXIT) {
            addPixelText(this, cx - 12, cy - 5, "EXIT", 6).setTint(0xfacc15);
          }
        }
      }
    }

    // Shelving flavor along the back wall
    for (const col of [2, 4, 6, 13, 15, 17]) {
      this.add.image(col * TILE + TILE / 2, 2 * TILE + TILE / 2, "full-set-int-b")
        .setFrame(40)
        .setDisplaySize(TILE, TILE * 2)
        .setTint(0xb45309);
    }
  }

  // ── Clerk ────────────────────────────────────────────────────────────────

  private placeClerk(): void {
    this.clerkChar = new CharacterSprite(
      this,
      CLERK_COL * TILE + TILE / 2,
      CLERK_ROW * TILE + TILE / 2,
      NPC8_DEF,
    );
    this.clerkChar.face("down");
    addPixelText(this, CLERK_COL * TILE - 6, CLERK_ROW * TILE - TILE, "CLERK", 6).setTint(0xfacc15);
  }

  private placePlayer(): void {
    const char = new CharacterSprite(this, 0, 0, DAD_DEF);
    this.mover = new GridMover(this, char, TILE, SPAWN_COL, SPAWN_ROW);
  }

  // ── Collision ────────────────────────────────────────────────────────────

  private canWalkTo(col: number, row: number): boolean {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    if (col === CLERK_COL && row === CLERK_ROW) return false;
    return MAP[row][col] !== WALL;
  }

  private onPlayerLand(col: number, row: number): void {
    if (MAP[row][col] === EXIT && this.mode === "explore") {
      this.startDialogue(
        [{ speaker: "NARRATOR", text: "Dad drives home, plunder secured." }],
        () => this.scene.start("NeighborhoodScene", { spawn: "homedepot" }),
      );
    }
  }

  // ── Interaction ──────────────────────────────────────────────────────────

  private handleInteract(): void {
    if (this.mode === "dialogue") {
      this.advanceDialogue();
      return;
    }

    const px = this.mover.x;
    const py = this.mover.y;
    const dist = Math.hypot(px - (CLERK_COL * TILE + TILE / 2), py - (CLERK_ROW * TILE + TILE / 2));

    if (MAP[this.mover.row][this.mover.col] === EXIT) {
      this.startDialogue(
        [{ speaker: "NARRATOR", text: "Dad drives home, plunder secured." }],
        () => this.scene.start("NeighborhoodScene", { spawn: "homedepot" }),
      );
      return;
    }

    if (dist < TILE * 1.6) {
      this.openShop();
      return;
    }

    this.startDialogue([
      { speaker: "NARRATOR", text: "Aisle after aisle of solutions to problems Dad doesn't have yet." },
    ]);
  }

  // ── Shop ─────────────────────────────────────────────────────────────────

  private openShop(): void {
    this.mode = "shop";
    this.shopSelected = 0;
    this.shopBox.setVisible(true);
    this.shopTitle.setVisible(true);
    this.shopText.setVisible(true);
    this.shopDetail.setVisible(true);
    this.renderShop();
  }

  private closeShop(): void {
    this.mode = "explore";
    this.shopBox.setVisible(false);
    this.shopTitle.setVisible(false);
    this.shopText.setVisible(false);
    this.shopDetail.setVisible(false);
  }

  private handleShopInput(): void {
    if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
      this.closeShop();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
      this.shopSelected = Phaser.Math.Wrap(this.shopSelected - 1, 0, SHOP_ITEMS.length + 1);
      this.renderShop();
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
      this.shopSelected = Phaser.Math.Wrap(this.shopSelected + 1, 0, SHOP_ITEMS.length + 1);
      this.renderShop();
    }

    if (Phaser.Input.Keyboard.JustDown(this.confirmKey)) {
      if (this.shopSelected === SHOP_ITEMS.length) {
        this.closeShop();
        return;
      }
      this.buyItem(SHOP_ITEMS[this.shopSelected]);
    }
  }

  private buyItem(itemId: string): void {
    const item = items.find((candidate) => candidate.id === itemId);
    if (!item || item.price === undefined) return;

    if (this.state.player.inventory.includes(itemId)) {
      this.shopDetail.setVisible(true);
      setPixelText(this.shopDetail, `${item.name}\n\nALREADY OWNED.\nDAD DOESN'T NEED TWO.`);
      return;
    }

    if (this.state.player.cash < item.price) {
      setPixelText(this.shopDetail, `${item.name}\nCOST: ${item.price}\n\nNOT ENOUGH LOVE POINTS.\nGO FIGHT SOMETHING.`);
      return;
    }

    this.state.player.cash -= item.price;
    this.state.player.inventory.push(itemId);
    this.state.player.equipment.weaponId = itemId;
    this.state.flags.ownsPlunger = true;

    if (this.state.quest.activeStepId === "find-plunger") {
      completeQuestStep(this.state, "find-plunger");
      setActiveQuestStep(this.state, "inspect-toilet");
    }
    saveGameState(this.state);

    setPixelText(this.shopDetail, `${item.name}\nPURCHASED AND EQUIPPED.\n\n"${item.description}"`);
    this.renderShop();
  }

  private renderShop(): void {
    const lines = SHOP_ITEMS.map((id, i) => {
      const item = items.find((candidate) => candidate.id === id);
      const owned = this.state.player.inventory.includes(id);
      const marker = i === this.shopSelected ? ">" : " ";
      const label = owned ? `${item?.name} (OWNED)` : `${item?.name} - ${item?.price} LOVE`;
      return `${marker}${label}`;
    });
    const exitMarker = this.shopSelected === SHOP_ITEMS.length ? ">" : " ";
    lines.push(`${exitMarker}LEAVE`);
    setPixelText(this.shopText, lines.join("\n"));

    if (this.shopSelected < SHOP_ITEMS.length) {
      const item = items.find((candidate) => candidate.id === SHOP_ITEMS[this.shopSelected]);
      setPixelText(this.shopDetail, `${item?.description ?? ""}\n\nLOVE POINTS: ${this.state.player.cash}`);
    } else {
      setPixelText(this.shopDetail, `LOVE POINTS: ${this.state.player.cash}`);
    }
  }

  // ── Dialogue ─────────────────────────────────────────────────────────────

  private startDialogue(lines: DialogueInput[], onComplete?: () => void): void {
    this.mode = "dialogue";
    this.showMessage(this.dialogueRunner.start(lines, onComplete));
  }

  private advanceDialogue(): void {
    if (this.dialogueBox.advance() !== "done") return;

    const next = this.dialogueRunner.advance();
    if (next) {
      this.showMessage(next);
      return;
    }

    this.mode = "explore";
    this.dialogueRunner.clear();
    this.dialogueBox.hide();
  }

  // ── UI ───────────────────────────────────────────────────────────────────

  private createUi(): void {
    this.dialogueBox = new DialogueBox(this);
    this.statsPanel = new PlayerStatsPanel(this);

    this.shopBox = this.add.rectangle(160, 90, 220, 110, 0x111827, 0.96)
      .setStrokeStyle(2, 0xf8fafc)
      .setScrollFactor(0)
      .setVisible(false)
      .setDepth(100);
    this.shopTitle = addPixelText(this, 60, 42, "THEE HOME DEPOT", 8)
      .setTint(0xfacc15)
      .setScrollFactor(0)
      .setVisible(false)
      .setDepth(101);
    this.shopText = addPixelText(this, 60, 58, "", 7)
      .setScrollFactor(0)
      .setVisible(false)
      .setDepth(101);
    this.shopDetail = addPixelText(this, 60, 108, "", 6)
      .setMaxWidth(190)
      .setScrollFactor(0)
      .setVisible(false)
      .setDepth(101);

    this.add.rectangle(8, 8, 236, 16, 0x1e40af)
      .setOrigin(0, 0)
      .setScrollFactor(0);
    addPixelText(this, 12, 11, "HARDWARE STORE", 8)
      .setTint(0xfacc15)
      .setScrollFactor(0);
  }

  private updateQuestPrompt(): void {
    // Quest prompt intentionally omitted here — shop has its own header.
  }

  private showMessage(message: DialogueLine | string): void {
    const line = typeof message === "string" ? { speaker: "NARRATOR", text: message } : message;
    this.dialogueBox.show(line.text, this.getSpeakerLabel(line.speaker));
  }

  private getSpeakerLabel(speaker: string): string {
    return speaker === "DAD" ? this.state.player.name || "DAD" : speaker;
  }
}
