import type { Point, Terrain } from './game/types';
import type { Assets, Sprite } from './assets';
import type { ResolvedTerrainCell } from './custom-terrain';

export const ISO_TILE_WIDTH = 60;
export const ISO_TILE_HEIGHT = 30;

/** Tile coordinates identify diamond centers in both the editor and battlefield. */
export function projectTile(x: number, y: number): Point {
  return { x: (x - y) * ISO_TILE_WIDTH / 2, y: (x + y) * ISO_TILE_HEIGHT / 2 };
}

export function unprojectPoint(x: number, y: number): Point {
  return { x: x / ISO_TILE_WIDTH + y / ISO_TILE_HEIGHT, y: y / ISO_TILE_HEIGHT - x / ISO_TILE_WIDTH };
}

export interface NativeTerrainTile { tileId: number; subTile: number; theater?: string }
export interface TerrainDrawBounds { left: number; right: number; top: number; bottom: number }

/** Shared original artwork and explicit procedural fallbacks, independent of simulation. */
export class TerrainPainter {
  private textures = new Map<string, HTMLCanvasElement>();
  private nativeBounds?: TerrainDrawBounds;

  constructor(private assets?: Assets) {}

  clear(): void { this.textures.clear(); this.nativeBounds = undefined; }

  /** Keep TMP extra pixels and their anchors intact, including elevated cliff artwork. */
  drawNativeTile(ctx: CanvasRenderingContext2D, tile: NativeTerrainTile | undefined, theater: string | undefined, x: number, y: number): boolean {
    if (!tile || !this.assets) return false;
    const tileTheater = (tile.theater ?? theater)?.toLowerCase() || 'snow';
    const sprite = this.assets.terrain[`${tileTheater}:${tile.tileId === 65535 ? 0 : tile.tileId}:${tile.subTile}`];
    if (!sprite) return false;
    const image = this.assets.images.get(sprite.src);
    if (!image) return false;
    ctx.drawImage(image, sprite.x, sprite.y, sprite.width, sprite.height, x - sprite.anchorX, y - sprite.anchorY, sprite.width, sprite.height);
    return true;
  }

  /** Draw original overlay/atlas frames with the same frame bounds and anchors as battle. */
  drawOverlay(ctx: CanvasRenderingContext2D, sprite: Sprite, x: number, y: number, frame = 0): boolean {
    const image = this.assets?.images.get(sprite.src);
    if (!image) return false;
    frame = Math.min(Math.max(0, frame), sprite.frames - 1);
    ctx.drawImage(image, frame % sprite.columns * sprite.frameWidth, Math.floor(frame / sprite.columns) * sprite.frameHeight,
      sprite.frameWidth, sprite.frameHeight, x - sprite.anchorX, y - sprite.anchorY, sprite.frameWidth, sprite.frameHeight);
    return true;
  }

  /** Render compiled artwork only; callers decide how to report unavailable original art. */
  drawResolvedGround(ctx: CanvasRenderingContext2D, cell: ResolvedTerrainCell, x: number, y: number): boolean {
    let complete = cell.layers.length > 0;
    for (const layer of cell.layers) {
      if (layer.quarter === undefined) {
        complete = this.drawNativeTile(ctx, layer, layer.theater, x, y) && complete;
        continue;
      }
      // Four tile-local square quarters meet at the center and cover the full diamond.
      // A compiler-supplied full base remains beneath antialiased transition edges.
      const u = layer.quarter === 0 || layer.quarter === 3 ? -.5 : 0;
      const v = layer.quarter === 0 || layer.quarter === 1 ? -.5 : 0;
      const corners = [projectTile(u, v), projectTile(u + .5, v), projectTile(u + .5, v + .5), projectTile(u, v + .5)];
      ctx.save();
      try {
        ctx.beginPath();
        ctx.moveTo(x + corners[0].x, y + corners[0].y);
        for (const corner of corners.slice(1)) ctx.lineTo(x + corner.x, y + corner.y);
        ctx.closePath(); ctx.clip();
        complete = this.drawNativeTile(ctx, layer, layer.theater, x, y) && complete;
      } finally { ctx.restore(); }
    }
    return complete;
  }

  drawResolvedResources(ctx: CanvasRenderingContext2D, cell: ResolvedTerrainCell, x: number, y: number): boolean {
    const sprite = cell.overlayKey ? this.assets?.manifest.overlays?.[cell.overlayKey] : undefined;
    return sprite ? this.drawOverlay(ctx, sprite, x, y, cell.overlayFrame ?? 0) : false;
  }

  /** All theaters are included because resolved cells can override the map's theater. */
  getDrawBounds(): Readonly<TerrainDrawBounds> {
    if (this.nativeBounds) return this.nativeBounds;
    const bounds = { left: ISO_TILE_WIDTH / 2, right: ISO_TILE_WIDTH / 2, top: ISO_TILE_HEIGHT / 2, bottom: ISO_TILE_HEIGHT / 2 };
    const include = (width: number, height: number, anchorX: number, anchorY: number) => {
      bounds.left = Math.max(bounds.left, anchorX); bounds.right = Math.max(bounds.right, width - anchorX);
      bounds.top = Math.max(bounds.top, anchorY); bounds.bottom = Math.max(bounds.bottom, height - anchorY);
    };
    for (const sprite of Object.values(this.assets?.terrain ?? {})) include(sprite.width, sprite.height, sprite.anchorX, sprite.anchorY);
    for (const sprite of Object.values(this.assets?.manifest.overlays ?? {})) include(sprite.frameWidth, sprite.frameHeight, sprite.anchorX, sprite.anchorY);
    this.nativeBounds = bounds;
    return bounds;
  }

  /** Explicit fallback for cells whose original art is unavailable. */
  drawGround(ctx: CanvasRenderingContext2D, terrain: Terrain, theater: string, tileX: number, tileY: number, projectedX: number, projectedY: number): void {
    ctx.drawImage(this.texture(terrain, theater, tileX, tileY), projectedX - ISO_TILE_WIDTH / 2, projectedY - ISO_TILE_HEIGHT / 2);
  }

  /** Draw after the ground pass so adjacent diamonds do not cover resource artwork. */
  drawResources(ctx: CanvasRenderingContext2D, projectedX: number, projectedY: number, tileX: number, tileY: number, gem: boolean): void {
    for (let i = 0; i < 8; i++) {
      const angle = ((tileX * 13 + tileY * 37 + i * 19) % 43) / 43 * Math.PI * 2;
      const radius = 7 + (i % 4) * 4;
      const x = projectedX + Math.cos(angle) * radius, y = projectedY + Math.sin(angle) * radius * .45;
      ctx.fillStyle = gem ? ['#af456a', '#598aa6', '#b889b5'][i % 3] : ['#c99c24', '#eac553', '#aa7119'][i % 3];
      ctx.fillRect(x, y, 3 + (i % 2), 2);
      ctx.fillStyle = gem ? '#dfa6c5' : '#ffe796';
      ctx.fillRect(x, y, 1, 1);
    }
  }

  private texture(terrain: Terrain, theater: string, x: number, y: number): HTMLCanvasElement {
    const seed = (x * 17 + y * 31) & 15, key = terrain + seed + theater;
    const cached = this.textures.get(key);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = ISO_TILE_WIDTH; canvas.height = ISO_TILE_HEIGHT;
    const ctx = canvas.getContext('2d')!, snow = theater.toLowerCase() === 'snow';
    const base: Record<string, string> = {
      water: '#244b64', snow: '#cbd7d7', land: snow ? '#c7d3d4' : '#8c8860',
      ore: snow ? '#c8cec1' : '#847b4c', gem: snow ? '#c5cfc9' : '#8b805f',
      cliff: snow ? '#889b9e' : '#6e7054', road: '#839091', bridge: '#817968',
    };
    ctx.beginPath();
    ctx.moveTo(30, 0); ctx.lineTo(60, 15); ctx.lineTo(30, 30); ctx.lineTo(0, 15);
    ctx.closePath(); ctx.clip();
    ctx.fillStyle = base[terrain] || base.land;
    ctx.fillRect(0, 0, 60, 30);
    let random = seed + 534;
    const nextRandom = () => { random = (random * 1664525 + 1013904223) >>> 0; return random / 4294967296; };
    for (let i = 0; i < 85; i++) {
      const shade = nextRandom(), pixelX = nextRandom() * 60, pixelY = nextRandom() * 30;
      ctx.fillStyle = shade > .5 ? '#ffffff18' : '#213b381c';
      ctx.fillRect(pixelX, pixelY, terrain === 'water' ? 7 : 2, 1);
    }
    if (terrain === 'water') {
      ctx.strokeStyle = '#6b98a84a'; ctx.beginPath();
      ctx.moveTo(seed, 8 + seed * .5); ctx.lineTo(seed + 14, 9 + seed * .5); ctx.stroke();
    }
    if (terrain === 'road' || terrain === 'bridge') {
      ctx.strokeStyle = '#d2c7a24a'; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(0, 15); ctx.lineTo(60, 15); ctx.stroke();
    }
    this.textures.set(key, canvas);
    return canvas;
  }
}
