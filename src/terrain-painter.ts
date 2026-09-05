import type { Point, Terrain } from './game/types';

export const ISO_TILE_WIDTH = 60;
export const ISO_TILE_HEIGHT = 30;

/** Tile coordinates identify diamond centers in both the editor and battlefield. */
export function projectTile(x: number, y: number): Point {
  return { x: (x - y) * ISO_TILE_WIDTH / 2, y: (x + y) * ISO_TILE_HEIGHT / 2 };
}

export function unprojectPoint(x: number, y: number): Point {
  return { x: x / ISO_TILE_WIDTH + y / ISO_TILE_HEIGHT, y: y / ISO_TILE_HEIGHT - x / ISO_TILE_WIDTH };
}

/** Shared procedural terrain artwork, independent of simulation and original assets. */
export class TerrainPainter {
  private textures = new Map<string, HTMLCanvasElement>();

  clear(): void { this.textures.clear(); }

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
