/**
 * TiledRoom
 * ─────────────────────────────────────────────────────────────────────────────
 * Loads a Tiled JSON map, renders its visual layers, and provides tile-aligned
 * collision and named-object lookup for scenes.
 *
 * Analogous to CharacterSprite — takes a RoomDef, wraps Phaser's tilemap API,
 * and exposes a clean interface the scene can use without caring about Tiled
 * internals.
 *
 * Collision
 * ─────────
 * canWalkTo(col, row) checks:
 *   1. Map bounds          — out-of-bounds → blocked
 *   2. Perimeter wall      — edge tiles always solid (fallback until walls painted)
 *   3. Collision layer     — any non-zero tile → blocked
 *
 * When the designer paints the Walls layer in Tiled and re-exports, the painted
 * wall tiles automatically take effect — nothing else needs to change.
 *
 * Objects
 * ───────
 * Each named object in the Tiled Objects layer becomes a TiledObject with both
 * pixel-space (x/y/width/height/centerX/centerY) and tile-space (tileCol/tileRow)
 * coordinates.
 *
 * getSpawnTile(name)   → { col, row }  safe to pass to GridMover constructor
 * getObject(name)      → TiledObject | undefined
 * getObjectsByType(t)  → TiledObject[]
 */

import Phaser from "phaser";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TilesetDef {
  /** Must exactly match the tileset name inside the Tiled JSON */
  name: string;
  /** Phaser texture key — loaded in BootScene with load.image() */
  imageKey: string;
}

export interface RoomDef {
  /** Phaser tilemap key — loaded in BootScene with load.tilemapTiledJSON() */
  mapKey: string;
  /** World pixels per tile.  Must match the Tiled JSON's tilewidth/tileheight. */
  tileSize: number;
  /** All tilesets the map references, in any order */
  tilesets: TilesetDef[];
  /** Layer names to render (bottom → top).  Missing layers are silently skipped. */
  visualLayers: string[];
  /**
   * Layer whose non-zero tiles block movement.
   * Usually "Walls" — same layer used for rendering.
   * If the layer has no painted tiles yet, only the map perimeter is blocked.
   */
  collisionLayer: string;
  /** Object layer name (Tiled objectgroup) */
  objectLayer: string;
}

export interface TiledObject {
  id: number;
  name: string;
  type: string;
  /** Pixel coordinates of the object's top-left corner (from Tiled) */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Centre of the object in world pixels */
  centerX: number;
  centerY: number;
  /** Tile column of the object centre (for GridMover) */
  tileCol: number;
  /** Tile row of the object centre (for GridMover) */
  tileRow: number;
}

// ── TiledRoom class ───────────────────────────────────────────────────────────

export class TiledRoom {
  /** Total world width in pixels (map.width × tileSize) */
  readonly worldWidth: number;
  /** Total world height in pixels (map.height × tileSize) */
  readonly worldHeight: number;
  /** Tile size in world pixels */
  readonly tileSize: number;
  /** Number of tile columns */
  readonly cols: number;
  /** Number of tile rows */
  readonly rows: number;

  private readonly tilemap: Phaser.Tilemaps.Tilemap;
  private readonly def: RoomDef;
  private readonly layerMap = new Map<string, Phaser.Tilemaps.TilemapLayer>();
  private readonly objects = new Map<string, TiledObject>();
  private readonly objectsByType = new Map<string, TiledObject[]>();

  constructor(scene: Phaser.Scene, def: RoomDef) {
    this.def = def;
    this.tileSize = def.tileSize;

    // ── Tilemap ───────────────────────────────────────────────────────────────
    const map = scene.make.tilemap({ key: def.mapKey });
    this.tilemap = map;
    this.cols       = map.width;
    this.rows       = map.height;
    this.worldWidth  = map.width  * def.tileSize;
    this.worldHeight = map.height * def.tileSize;

    // ── Tilesets ──────────────────────────────────────────────────────────────
    const tilesets: Phaser.Tilemaps.Tileset[] = [];
    for (const ts of def.tilesets) {
      const t = map.addTilesetImage(ts.name, ts.imageKey);
      if (t) {
        tilesets.push(t);
      } else {
        console.warn(`[TiledRoom] Could not add tileset "${ts.name}" (key "${ts.imageKey}")`);
      }
    }

    // ── Visual layers (bottom → top) ──────────────────────────────────────────
    for (const name of def.visualLayers) {
      const layer = map.createLayer(name, tilesets, 0, 0);
      if (layer) {
        this.layerMap.set(name, layer);
      }
      // Missing layers are silently skipped — safe while the designer is still
      // building the map in Tiled.
    }

    // ── Objects ───────────────────────────────────────────────────────────────
    const objLayer = map.getObjectLayer(def.objectLayer);
    if (objLayer) {
      for (const raw of objLayer.objects) {
        const w  = raw.width  ?? 0;
        const h  = raw.height ?? 0;
        const rx = raw.x ?? 0;
        const ry = raw.y ?? 0;
        const cx = rx + w / 2;
        const cy = ry + h / 2;

        const obj: TiledObject = {
          id:       raw.id,
          name:     raw.name,
          type:     raw.type ?? "",
          x:        rx,
          y:        ry,
          width:    w,
          height:   h,
          centerX:  cx,
          centerY:  cy,
          tileCol:  Math.round(cx / def.tileSize),
          tileRow:  Math.round(cy / def.tileSize),
        };

        this.objects.set(raw.name, obj);
        const bucket = this.objectsByType.get(obj.type) ?? [];
        bucket.push(obj);
        this.objectsByType.set(obj.type, bucket);
      }
    }
  }

  // ── Collision ─────────────────────────────────────────────────────────────

  /**
   * Returns true when the tile at (col, row) can be walked onto.
   * Pass this as the `canWalkTo` callback to GridMover.update().
   */
  canWalkTo(col: number, row: number): boolean {
    // Map boundary
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return false;
    }

    // Perimeter — always solid until the designer paints interior walls.
    // This keeps the player from walking off the edge when no tiles exist yet.
    if (col === 0 || col === this.cols - 1 || row === 0 || row === this.rows - 1) {
      return false;
    }

    // Collision layer — non-zero tile ID = solid wall
    const wallLayer = this.layerMap.get(this.def.collisionLayer);
    if (wallLayer) {
      const tile = wallLayer.getTileAt(col, row, true);
      if (tile && tile.index > 0) {
        return false;
      }
    }

    return true;
  }

  // ── Object access ─────────────────────────────────────────────────────────

  /** Look up a named Tiled object.  Returns undefined if not found. */
  getObject(name: string): TiledObject | undefined {
    return this.objects.get(name);
  }

  /** All objects of a given type (e.g. "sceneExit", "npc", "interactable"). */
  getObjectsByType(type: string): TiledObject[] {
    return this.objectsByType.get(type) ?? [];
  }

  /**
   * Tile coordinates of a named spawn/object — safe for GridMover.
   * Throws if the object is not found so misconfigured maps fail loudly.
   */
  getSpawnTile(name: string): { col: number; row: number } {
    const obj = this.objects.get(name);
    if (!obj) {
      throw new Error(`[TiledRoom] Spawn object "${name}" not found in map "${this.def.mapKey}"`);
    }
    return { col: obj.tileCol, row: obj.tileRow };
  }

  /** World-pixel centre of a named object — for proximity checks in scenes. */
  getObjectCenter(name: string): { x: number; y: number } | undefined {
    const obj = this.objects.get(name);
    return obj ? { x: obj.centerX, y: obj.centerY } : undefined;
  }
}
