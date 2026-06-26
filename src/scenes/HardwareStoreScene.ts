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

const FLOOR   = 0;
const WALL    = 1;
const EXIT    = 2;
const SHELF   = 3;
const COUNTER = 4;

const WALL_FRAME  = 134;
const FLOOR_FRAME = 7;

const W = WALL;
const _ = FLOOR;
const X = EXIT;
const S = SHELF;
const C = COUNTER;

/* prettier-ignore */
const MAP: number[][] = [
  [W,W,W,W,W,W,W,W,W,W,W,W,W,X,X,W,W,W,W,W,W,W,W,W,W,W,W,W], //  0  entrance wall
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W], //  1  entry row
  [W,S,S,_,S,S,_,S,S,_,_,_,_,_,_,_,_,_,S,S,_,S,S,_,S,S,_,W], //  2  back shelves
  [W,S,S,_,S,S,_,S,S,_,_,_,_,_,_,_,_,_,S,S,_,S,S,_,S,S,_,W], //  3
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W], //  4  aisle 1
  [W,S,S,_,S,S,_,S,S,_,_,_,_,_,_,_,_,_,S,S,_,S,S,_,S,S,_,W], //  5  mid shelves
  [W,S,S,_,S,S,_,S,S,_,_,_,_,_,_,_,_,_,S,S,_,S,S,_,S,S,_,W], //  6
  [W,_,_,_,_,_,_,_,_,_,C,C,C,C,C,C,_,_,_,_,_,_,_,_,_,_,_,W], //  7  service counter row
  [W,S,S,_,S,S,_,_,_,_,_,_,_,_,_,_,_,_,S,S,_,S,S,_,S,S,_,W], //  8  front shelves
  [W,S,S,_,S,S,_,_,_,_,_,_,_,_,_,_,_,_,S,S,_,S,S,_,S,S,_,W], //  9
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W], // 10  main floor
  [W,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,W], // 11
  [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W], // 12  bottom wall
];

const ROWS    = MAP.length;
const COLS    = MAP[0].length;
const WORLD_W = COLS * TILE;
const WORLD_H = ROWS * TILE;

// Clerk stands just above the service counter in the open middle corridor
const CLERK_COL = 13;
const CLERK_ROW =  6;
const SPAWN_COL = 13;
const SPAWN_ROW =  1;

const SHOP_ITEMS = [
  "plumbing-snake",
  "plunger-of-the-gods",
  "tool-belt",
  "steel-toe-boots",
  "cold-coffee",
  "energy-drink",
] as const;

// Dept sign data: [centerCol, label, rowY]
const DEPT_SIGNS: [number, string][] = [
  [1.5,  "LUMBER"],
  [4.5,  "PIPE"],
  [7.5,  "HARDWARE"],
  [18.5, "PAINT"],
  [21.5, "TOOLS"],
  [24.5, "ELECT."],
];

type SceneMode = "explore" | "dialogue" | "shop";

export class HardwareStoreScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private escapeKey!: Phaser.Input.Keyboard.Key;
  private mover!: GridMover;
  private clerkChar!: CharacterSprite;
  private dialogueBox!: DialogueBox;
  private statsPanel!: PlayerStatsPanel;
  private menu!: GameMenu;
  private mode: SceneMode = "explore";
  private state!: GameState;
  private readonly dialogueRunner = new DialogueRunner();

  // Shop UI elements
  private shopPanel!: Phaser.GameObjects.Rectangle;
  private shopHeaderRect!: Phaser.GameObjects.Rectangle;
  private shopTitleText!: Phaser.GameObjects.BitmapText;
  private shopItemsText!: Phaser.GameObjects.BitmapText;
  private shopDetailText!: Phaser.GameObjects.BitmapText;
  private shopHintText!: Phaser.GameObjects.BitmapText;
  private shopBalanceText!: Phaser.GameObjects.BitmapText;
  private shopSelected = 0;

  constructor() {
    super("HardwareStoreScene");
  }

  create(): void {
    installDevShortcuts(this);

    this.state = getGameState();
    this.mode  = "explore";
    this.cursors    = this.input.keyboard!.createCursorKeys();
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.escapeKey   = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.drawTiles();
    this.placeDecorations();
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
      { speaker: "NARRATOR",    text: "The automatic doors part. Fluorescent lights hum. Somewhere, a forklift beeps authoritatively." },
      { speaker: "NARRATOR",    text: "This is Dad's cathedral. He could walk this place blind. He basically already does." },
      { speaker: "DAD'S BRAIN", text: "Talk to the clerk. Aisle 7. He has seen things. All of them." },
    ]);
  }

  update(_time: number, delta: number): void {
    this.dialogueBox.update(delta);
    this.menu.update();

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

  // ── Tiles ──────────────────────────────────────────────────────────────────

  private drawTiles(): void {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const tileId = MAP[row][col];
        const cx = col * TILE + TILE / 2;
        const cy = row * TILE + TILE / 2;

        if (tileId === WALL) {
          const spr = this.add.image(cx, cy, "full-set-int-a4")
            .setFrame(WALL_FRAME)
            .setDisplaySize(TILE, TILE);
          // HD orange band across top wall
          if (row === 0) spr.setTint(0x994400);
        } else if (tileId === SHELF) {
          this.add.image(cx, cy, "full-set-int-a2")
            .setFrame(FLOOR_FRAME)
            .setDisplaySize(TILE, TILE);
          this.drawShelfAt(cx, cy, col);
        } else if (tileId === COUNTER) {
          this.add.image(cx, cy, "full-set-int-a2")
            .setFrame(FLOOR_FRAME)
            .setDisplaySize(TILE, TILE);
          // Counter surface — dark base + orange top edge
          this.add.rectangle(cx, cy, TILE, TILE, 0x1A1A2E).setOrigin(0.5, 0.5);
          this.add.rectangle(cx, cy - TILE / 2 + 2, TILE, 3, 0xF96302).setOrigin(0.5, 0.5);
        } else {
          this.add.image(cx, cy, "full-set-int-a2")
            .setFrame(FLOOR_FRAME)
            .setDisplaySize(TILE, TILE);
          if (tileId === EXIT) {
            // Orange door frame on wall exit
            this.add.rectangle(cx, cy, TILE, TILE, 0xF96302, 0.6);
            addPixelText(this, cx - 8, cy - 3, "OUT", 6).setTint(0xFFFFFF);
          }
        }
      }
    }

    // Orange stripe along bottom of each wall row (HD brand stripe)
    this.add.rectangle(TILE, 0, (COLS - 2) * TILE, TILE, 0xF96302)
      .setOrigin(0, 0)
      .setAlpha(0.15);

    // Aisle floor stripes — thin orange lines at aisle rows
    for (const aisleRow of [4, 7, 10]) {
      this.add.rectangle(
        TILE,
        aisleRow * TILE + TILE - 2,
        (COLS - 2) * TILE,
        2,
        0xF96302,
        0.5,
      ).setOrigin(0, 0);
    }

    // Aisle number text at the main corridor gap (cols 9-17)
    this.addAisleMarker(9, 4,  "AISLE 6");
    this.addAisleMarker(9, 7,  "AISLE 7 — SERVICE");
    this.addAisleMarker(9, 10, "AISLE 8");
  }

  private drawShelfAt(cx: number, cy: number, col: number): void {
    const leftSide  = col <= 8;
    const rightSide = col >= 18;
    const tint = leftSide  ? 0x6B5D3F   // warm wood — lumber/hardware left
               : rightSide ? 0x3A5068   // steel blue — metal/electrical right
               : 0x555555;              // fallback
    this.add.image(cx, cy, "full-set-int-b")
      .setFrame(40)
      .setDisplaySize(TILE, TILE)
      .setTint(tint);
    // Shelf edge highlight
    this.add.rectangle(cx, cy + TILE / 2 - 1, TILE, 1, 0xFFFFFF, 0.2).setOrigin(0.5, 0.5);
  }

  // ── Decorations ────────────────────────────────────────────────────────────

  private placeDecorations(): void {
    // Dept signs hanging at row 1 level
    for (const [centerCol, label] of DEPT_SIGNS) {
      this.addDeptSign(centerCol, label);
    }

    // "SERVICE DESK" sign above counter area
    const deskX = 12.5 * TILE;
    const deskY = TILE * 6 + 2;
    this.add.rectangle(deskX, deskY, TILE * 6, 9, 0x000000).setOrigin(0.5, 0);
    this.add.rectangle(deskX, deskY, TILE * 6, 9, 0xF96302, 0.9).setOrigin(0.5, 0)
      .setStrokeStyle(1, 0xCC4400, 1);
    addPixelText(this, deskX - TILE * 2.6, deskY + 1, "SERVICE DESK", 6).setTint(0xFFFFFF);

    // Small product boxes drawn on shelf top tiles (rows 2, 5, 8)
    const productColors = [0xCC3300, 0x2255AA, 0xEEAA00, 0x227722, 0x882299];
    for (const shelfRow of [2, 5, 8]) {
      for (let col = 1; col <= 26; col++) {
        if (MAP[shelfRow][col] === SHELF) {
          const cx = col * TILE + TILE / 2;
          const cy = shelfRow * TILE + TILE / 2;
          // 2-3 small product boxes per shelf tile
          const color = productColors[(col * 3 + shelfRow) % productColors.length];
          this.add.rectangle(cx - 4, cy - 2, 5, 8, color).setOrigin(0.5, 0.5);
          this.add.rectangle(cx + 3, cy - 2, 4, 7, productColors[(col + 2) % productColors.length]).setOrigin(0.5, 0.5);
        }
      }
    }

    // Entrance mat below exit tiles
    this.add.rectangle(13.5 * TILE + TILE / 2, TILE + TILE - 3, TILE * 2, 4, 0xF96302, 0.7)
      .setOrigin(0.5, 0);

    // Forklift silhouette in far-left back corner (decorative)
    const fkX = 1.5 * TILE;
    const fkY = 10 * TILE;
    this.add.rectangle(fkX + 2, fkY,     12, 28, 0xF96302, 0.55).setOrigin(0.5, 0);
    this.add.rectangle(fkX - 2, fkY,      8, 20, 0xCC4400, 0.5).setOrigin(0.5, 0);
    this.add.rectangle(fkX - 6, fkY + 20, 3, 10, 0x888888, 0.7).setOrigin(0.5, 0);
    this.add.rectangle(fkX,     fkY + 20, 3, 10, 0x888888, 0.7).setOrigin(0.5, 0);
  }

  private addDeptSign(centerCol: number, label: string): void {
    const x = centerCol * TILE;
    const y = TILE + 3;
    this.add.rectangle(x, y, TILE * 2 - 2, 8, 0xF96302).setOrigin(0.5, 0);
    this.add.rectangle(x, y, TILE * 2 - 2, 8, 0x000000, 0).setOrigin(0.5, 0)
      .setStrokeStyle(0.5, 0xCC4400, 0.8);
    addPixelText(this, x - TILE + 2, y + 1, label, 5).setTint(0xFFFFFF);
  }

  private addAisleMarker(startCol: number, aisleRow: number, label: string): void {
    const x = startCol * TILE + 2;
    const y = aisleRow * TILE + 4;
    addPixelText(this, x, y, label, 5).setTint(0xF96302).setAlpha(0.6);
  }

  // ── Clerk ──────────────────────────────────────────────────────────────────

  private placeClerk(): void {
    this.clerkChar = new CharacterSprite(
      this,
      CLERK_COL * TILE + TILE / 2,
      CLERK_ROW * TILE + TILE / 2,
      NPC8_DEF,
    );
    this.clerkChar.face("down");
  }

  private placePlayer(): void {
    const char = new CharacterSprite(this, 0, 0, DAD_DEF);
    this.mover = new GridMover(this, char, TILE, SPAWN_COL, SPAWN_ROW);
  }

  // ── Collision ──────────────────────────────────────────────────────────────

  private canWalkTo(col: number, row: number): boolean {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    if (col === CLERK_COL && row === CLERK_ROW) return false;
    const t = MAP[row][col];
    return t === FLOOR || t === EXIT;
  }

  private onPlayerLand(col: number, row: number): void {
    if (MAP[row][col] === EXIT && this.mode === "explore") {
      this.startDialogue(
        [{ speaker: "NARRATOR", text: "Dad drives home, plunder secured. The cruiser smells like possibility. And lumber." }],
        () => this.scene.start("NeighborhoodScene", { spawn: "homedepot" }),
      );
    }
  }

  // ── Interaction ────────────────────────────────────────────────────────────

  private handleInteract(): void {
    if (this.mode === "dialogue") {
      this.advanceDialogue();
      return;
    }

    const px = this.mover.x;
    const py = this.mover.y;
    const clerkX = CLERK_COL * TILE + TILE / 2;
    const clerkY = CLERK_ROW * TILE + TILE / 2;
    const dist = Math.hypot(px - clerkX, py - clerkY);

    if (dist < TILE * 1.8) {
      this.openShop();
      return;
    }

    this.startDialogue([
      { speaker: "NARRATOR", text: "Aisle after aisle of solutions to problems Dad doesn't have yet. And a few he does." },
    ]);
  }

  // ── Shop ───────────────────────────────────────────────────────────────────

  private openShop(): void {
    this.mode = "shop";
    this.shopSelected = 0;
    this.setShopVisible(true);
    this.renderShop();
  }

  private closeShop(): void {
    this.mode = "explore";
    this.setShopVisible(false);
  }

  private setShopVisible(v: boolean): void {
    this.shopPanel.setVisible(v);
    this.shopHeaderRect.setVisible(v);
    this.shopTitleText.setVisible(v);
    this.shopItemsText.setVisible(v);
    this.shopDetailText.setVisible(v);
    this.shopHintText.setVisible(v);
    this.shopBalanceText.setVisible(v);
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
    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      if (this.shopSelected === SHOP_ITEMS.length) {
        this.closeShop();
        return;
      }
      this.buyItem(SHOP_ITEMS[this.shopSelected]);
    }
  }

  private buyItem(itemId: string): void {
    const item = items.find((i) => i.id === itemId);
    if (!item || item.price === undefined) return;

    const isConsumable = item.kind === "consumable";

    if (!isConsumable && this.state.player.inventory.includes(itemId)) {
      setPixelText(this.shopDetailText, `ALREADY OWNED.\nDAD DOESN'T NEED TWO.`);
      return;
    }
    if (this.state.player.cash < item.price) {
      setPixelText(this.shopDetailText, `NOT ENOUGH LOVE POINTS.\n\nNEED ${item.price - this.state.player.cash} MORE.\nGO FIGHT SOMETHING.`);
      return;
    }

    this.state.player.cash -= item.price;
    this.state.player.inventory.push(itemId);

    let resultLine = `PURCHASED.\n\n"${item.description}"`;

    if (item.kind === "weapon") {
      this.state.player.equipment.weaponId = itemId;
      this.state.flags.ownsPlunger = true;
      if (this.state.quest.activeStepId === "find-plunger") {
        completeQuestStep(this.state, "find-plunger");
        setActiveQuestStep(this.state, "inspect-toilet");
      }
      resultLine = `PURCHASED + EQUIPPED.\n\n"${item.description}"`;
    } else if (item.kind === "armor") {
      this.state.player.equipment.armorId = itemId;
      resultLine = `PURCHASED + EQUIPPED.\n\n"${item.description}"`;
    }

    saveGameState(this.state);
    setPixelText(this.shopDetailText, resultLine);
    this.renderShop();
  }

  private renderShop(): void {
    // Item list
    const lines = SHOP_ITEMS.map((id, i) => {
      const item = items.find((it) => it.id === id);
      const owned   = item?.kind !== "consumable" && this.state.player.inventory.includes(id);
      const cursor  = i === this.shopSelected ? ">" : " ";
      const priceTag = owned ? "(OWNED)" : `${item?.price} ♥`;
      return `${cursor} ${item?.name?.padEnd(22, " ")}${priceTag}`;
    });
    const exitCursor = this.shopSelected === SHOP_ITEMS.length ? ">" : " ";
    lines.push(`${exitCursor} LEAVE`);
    setPixelText(this.shopItemsText, lines.join("\n"));

    // Balance
    setPixelText(this.shopBalanceText, `BALANCE: ${this.state.player.cash} ♥`);

    // Detail for selected item
    if (this.shopSelected < SHOP_ITEMS.length) {
      const item = items.find((it) => it.id === SHOP_ITEMS[this.shopSelected]);
      const owned = item?.kind !== "consumable" && this.state.player.inventory.includes(SHOP_ITEMS[this.shopSelected]);
      if (!owned) {
        setPixelText(this.shopDetailText, item?.description ?? "");
      }
    } else {
      setPixelText(this.shopDetailText, "");
    }
  }

  // ── Dialogue ───────────────────────────────────────────────────────────────

  private startDialogue(lines: DialogueInput[], onComplete?: () => void): void {
    this.mode = "dialogue";
    this.showMessage(this.dialogueRunner.start(lines, onComplete));
  }

  private advanceDialogue(): void {
    if (this.dialogueBox.advance() !== "done") return;
    const next = this.dialogueRunner.advance();
    if (next) { this.showMessage(next); return; }
    this.mode = "explore";
    this.dialogueRunner.clear();
    this.dialogueBox.hide();
  }

  // ── UI ─────────────────────────────────────────────────────────────────────

  private createUi(): void {
    this.dialogueBox = new DialogueBox(this);
    this.statsPanel  = new PlayerStatsPanel(this);

    // Panel: 244 wide × 156 tall, screen-centered at (160, 90)
    // → left=38, top=12, right=282, bottom=168
    const PX = 160, PY = 90, PW = 244, PH = 156;
    const LEFT = PX - PW / 2;
    const TOP  = PY - PH / 2;

    this.shopPanel = this.add.rectangle(PX, PY, PW, PH, 0x06090F, 0.97)
      .setStrokeStyle(1.5, 0xF96302, 1)
      .setScrollFactor(0)
      .setVisible(false)
      .setDepth(100);

    // Orange header bar
    this.shopHeaderRect = this.add.rectangle(PX, TOP + 10, PW, 20, 0xF96302)
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setVisible(false)
      .setDepth(101);

    // "THE HOME DEPOT" title in header
    this.shopTitleText = addPixelText(this, LEFT + 8, TOP + 4, "THEE DOME HEPOT", 8)
      .setTint(0xFFFFFF)
      .setScrollFactor(0)
      .setVisible(false)
      .setDepth(102);

    // Thin divider under header
    // Item list
    this.shopItemsText = addPixelText(this, LEFT + 8, TOP + 26, "", 6)
      .setTint(0xF9C74F)
      .setScrollFactor(0)
      .setVisible(false)
      .setDepth(102);

    // Detail / feedback
    this.shopDetailText = addPixelText(this, LEFT + 8, TOP + 102, "", 6)
      .setMaxWidth(PW - 16)
      .setTint(0xAAAAAA)
      .setScrollFactor(0)
      .setVisible(false)
      .setDepth(102);

    // Balance
    this.shopBalanceText = addPixelText(this, LEFT + 8, TOP + 138, "", 7)
      .setTint(0xF96302)
      .setScrollFactor(0)
      .setVisible(false)
      .setDepth(102);

    // Controls hint
    this.shopHintText = addPixelText(this, LEFT + 8, TOP + 148, "↑↓ SELECT  ␣ BUY  ESC CLOSE", 5)
      .setTint(0x556677)
      .setScrollFactor(0)
      .setVisible(false)
      .setDepth(102);
  }

  private showMessage(message: DialogueLine | string): void {
    const line = typeof message === "string" ? { speaker: "NARRATOR", text: message } : message;
    this.dialogueBox.show(line.text, this.getSpeakerLabel(line.speaker));
  }

  private getSpeakerLabel(speaker: string): string {
    return speaker === "DAD" ? this.state.player.name || "DAD" : speaker;
  }
}
