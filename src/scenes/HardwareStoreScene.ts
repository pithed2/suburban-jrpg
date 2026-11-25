import Phaser from "phaser";
import { CharacterSprite } from "../game/CharacterSprite";
import { DAD_DEF, NPC8_DEF } from "../game/characterDefs";
import { getArea, items } from "../game/content";
import { equipItem } from "../game/engine/script";
import { FieldKit } from "../game/FieldKit";
import { GridMover } from "../game/GridMover";
import { STORE } from "../game/storeTiles";
import { addPixelText, setPixelText } from "../game/uiText";

const TILE = 16;

const FLOOR   = 0;
const WALL    = 1;
const EXIT    = 2;
const SHELF   = 3;
const COUNTER = 4;


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

/** Stock comes from src/data/areas/homedepot.json -> shop. */
const SHOP_ITEMS: string[] = getArea("homedepot").shop ?? [];

// Shelf departments by the left column of each 2-wide shelf unit.
const DEPARTMENTS: [number, keyof typeof STORE.shelf][] = [
  [1, "lumber"], [4, "pipe"], [7, "hardware"],
  [18, "paint"], [21, "tools"], [24, "electrical"],
];
const COUNTER_COL = 10; // service counter runs cols 10-15 on row 7

// Floor props that block walking: lumber pallets and a stray cart.
const PROPS: [number, number, number][] = [
  [1, 11, STORE.pallet], [2, 11, STORE.pallet], [26, 11, STORE.cart],
];


export class HardwareStoreScene extends Phaser.Scene {
  private escapeKey!: Phaser.Input.Keyboard.Key;
  private mover!: GridMover;
  private kit!: FieldKit;
  private clerkChar!: CharacterSprite;
  private shopOpen = false;

  // Shop UI elements
  private shopPanel!: Phaser.GameObjects.Rectangle;
  private shopHeaderRect!: Phaser.GameObjects.Rectangle;
  private shopTitleText!: Phaser.GameObjects.BitmapText;
  private shopItemsText!: Phaser.GameObjects.BitmapText;
  private shopDetailText!: Phaser.GameObjects.BitmapText;
  private shopHintText!: Phaser.GameObjects.BitmapText;
  private shopBalanceText!: Phaser.GameObjects.BitmapText;
  private shopSelected = 0;
  private readonly blocked = new Set<string>();

  constructor() {
    super("HardwareStoreScene");
  }

  create(): void {
    this.kit = new FieldKit(this, {
      areaId: "homedepot",
      mover: () => this.mover,
      statsPanel: true,
      onHotspot: (id) => {
        if (id !== "clerk") return false;
        this.openShop();
        return true;
      },
    });
    this.shopOpen = false;
    this.escapeKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.drawTiles();
    this.placeDecorations();
    this.placeClerk();
    this.placePlayer();
    this.kit.create();
    this.createUi();

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.mover.phaserSprite, true, 0.1, 0.1);

    this.kit.enter();
  }

  update(_time: number, delta: number): void {
    if (this.shopOpen) {
      this.handleShopInput();
      return;
    }

    if (!this.kit.update(delta)) return;

    this.mover.update(
      this.kit.cursors,
      delta,
      (col, row) => this.canWalkTo(col, row),
      (col, row) => this.onPlayerLand(col, row),
    );
  }

  // ── Tiles ──────────────────────────────────────────────────────────────────

  private tile(col: number, row: number, frame: number): Phaser.GameObjects.Image {
    return this.add.image(col * TILE + TILE / 2, row * TILE + TILE / 2, "store-tiles", frame);
  }

  private drawTiles(): void {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const tileId = MAP[row][col];
        if (tileId === WALL) {
          const below = MAP[row + 1]?.[col];
          this.tile(col, row, below !== undefined && below !== WALL ? STORE.wallFace : STORE.wallTop);
        } else if (tileId === EXIT) {
          this.tile(col, row, STORE.glassDoor);
        } else if (tileId === SHELF) {
          const dept = DEPARTMENTS.find(([c]) => col === c || col === c + 1)?.[1] ?? "hardware";
          const top = MAP[row - 1]?.[col] !== SHELF;
          this.tile(col, row, STORE.shelf[dept][top ? 0 : 1]);
        } else if (tileId === COUNTER) {
          this.tile(col, row, STORE.counter[col - COUNTER_COL]);
        } else {
          this.tile(col, row, row === 10 ? STORE.stripeFloor : STORE.floor);
        }
      }
    }
  }

  // ── Decorations ────────────────────────────────────────────────────────────

  private placeDecorations(): void {
    this.tile(13, 1, STORE.mat);
    this.tile(14, 1, STORE.mat);
    this.tile(12, 7, STORE.register);
    for (const [col, row, frame] of PROPS) {
      this.tile(col, row, frame);
      this.blocked.add(`${col},${row}`);
    }
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
    if (this.blocked.has(`${col},${row}`)) return false;
    const t = MAP[row][col];
    return t === FLOOR || t === EXIT;
  }

  private onPlayerLand(col: number, row: number): void {
    if (MAP[row][col] === EXIT) {
      void this.kit.run("exit");
    }
  }

  // ── Shop ───────────────────────────────────────────────────────────────────

  private openShop(): void {
    this.shopOpen = true;
    this.shopSelected = 0;
    this.setShopVisible(true);
    this.renderShop();
  }

  private closeShop(): void {
    this.shopOpen = false;
    this.input.keyboard?.resetKeys();
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
    if (Phaser.Input.Keyboard.JustDown(this.kit.cursors.up)) {
      this.shopSelected = Phaser.Math.Wrap(this.shopSelected - 1, 0, SHOP_ITEMS.length + 1);
      this.renderShop();
    }
    if (Phaser.Input.Keyboard.JustDown(this.kit.cursors.down)) {
      this.shopSelected = Phaser.Math.Wrap(this.shopSelected + 1, 0, SHOP_ITEMS.length + 1);
      this.renderShop();
    }
    if (Phaser.Input.Keyboard.JustDown(this.kit.interactKey)) {
      if (this.shopSelected === SHOP_ITEMS.length) {
        this.closeShop();
        return;
      }
      this.buyItem(SHOP_ITEMS[this.shopSelected]);
    }
  }

  private buyItem(itemId: string): void {
    const state = this.kit.state;
    const item = items.find((i) => i.id === itemId);
    if (!item || item.price === undefined) return;

    const isConsumable = item.kind === "consumable";

    if (!isConsumable && state.player.inventory.includes(itemId)) {
      setPixelText(this.shopDetailText, `ALREADY OWNED.\nDAD DOESN'T NEED TWO.`);
      return;
    }
    if (state.player.cash < item.price) {
      setPixelText(this.shopDetailText, `NOT ENOUGH LOVE POINTS.\n\nNEED ${item.price - state.player.cash} MORE.\nGO FIGHT SOMETHING.`);
      return;
    }

    state.player.cash -= item.price;
    let resultLine = `PURCHASED.\n\n"${item.description}"`;

    if (item.kind === "weapon" || item.kind === "armor") {
      equipItem(state, itemId);
      resultLine = `PURCHASED + EQUIPPED.\n\n"${item.description}"`;
    } else {
      state.player.inventory.push(itemId);
    }

    // Quest hooks such as "buying a plunger completes the step" live in data.
    void this.kit.run(`buy:${itemId}`).then(() => this.kit.save());
    this.kit.save();
    setPixelText(this.shopDetailText, resultLine);
    this.renderShop();
  }

  private renderShop(): void {
    // Item list
    const lines = SHOP_ITEMS.map((id, i) => {
      const item = items.find((it) => it.id === id);
      const owned   = item?.kind !== "consumable" && this.kit.state.player.inventory.includes(id);
      const cursor  = i === this.shopSelected ? ">" : " ";
      const priceTag = owned ? "(OWNED)" : `${item?.price} ♥`;
      return `${cursor} ${item?.name?.padEnd(22, " ")}${priceTag}`;
    });
    const exitCursor = this.shopSelected === SHOP_ITEMS.length ? ">" : " ";
    lines.push(`${exitCursor} LEAVE`);
    // The panel fits 8 rows. Scroll the list so the cursor stays visible.
    const VISIBLE = 8;
    const first = Phaser.Math.Clamp(this.shopSelected - VISIBLE + 2, 0, Math.max(0, lines.length - VISIBLE));
    const shown = lines.slice(first, first + VISIBLE);
    if (first > 0) shown[0] = `${shown[0]}  MORE`;
    if (first + VISIBLE < lines.length) shown[VISIBLE - 1] = `${shown[VISIBLE - 1]}  MORE`;
    setPixelText(this.shopItemsText, shown.join("\n"));

    // Balance
    setPixelText(this.shopBalanceText, `BALANCE: ${this.kit.state.player.cash} ♥`);

    // Detail for selected item
    if (this.shopSelected < SHOP_ITEMS.length) {
      const item = items.find((it) => it.id === SHOP_ITEMS[this.shopSelected]);
      const owned = item?.kind !== "consumable" && this.kit.state.player.inventory.includes(SHOP_ITEMS[this.shopSelected]);
      if (!owned) {
        setPixelText(this.shopDetailText, item?.description ?? "");
      }
    } else {
      setPixelText(this.shopDetailText, "");
    }
  }

  // ── UI ─────────────────────────────────────────────────────────────────────

  private createUi(): void {

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
}
