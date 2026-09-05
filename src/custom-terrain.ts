import type { TileDefinition } from './maps.ts';

export interface NativeTerrainLayer {
  tileId: number;
  subTile: number;
  theater: string;
  /** Local tile quarters: (-x,-y), (+x,-y), (+x,+y), (-x,+y). */
  quarter?: 0 | 1 | 2 | 3;
}
export interface ResolvedTerrainCell {
  layers: NativeTerrainLayer[];
  overlayKey?: string;
  overlayFrame?: number;
  /** Retain semantic terrain; choosing shoreline artwork never changes movement rules. */
  kind: string;
}

type TerrainInput = { width: number; height: number; theater: string; cells: readonly string[] };
type TileReference = { tileId: number; definition: TileDefinition };
type Direction = 0 | 1 | 2 | 3;
const DIRECTIONS = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }] as const;
const QUARTERS: { adjacent: [Direction, Direction]; diagonal: { x: number; y: number }; convex: [string, number]; diagonalShore: [string, number] }[] = [
  { adjacent: [0, 3], diagonal: { x: -1, y: -1 }, convex: ['shore33', 3], diagonalShore: ['shore08', 3] },
  { adjacent: [0, 1], diagonal: { x: 1, y: -1 }, convex: ['shore39', 2], diagonalShore: ['shore32', 2] },
  { adjacent: [1, 2], diagonal: { x: 1, y: 1 }, convex: ['shore37', 0], diagonalShore: ['shore24', 0] },
  { adjacent: [2, 3], diagonal: { x: -1, y: 1 }, convex: ['shore35', 1], diagonalShore: ['shore16', 1] },
];
const STRAIGHT: [string, number][] = [['shore04', 1], ['shore28', 0], ['shore20', 0], ['shore12', 1]];
const isGround = (terrain: string | undefined) => terrain === 'land' || terrain === 'ore' || terrain === 'gem';
const isDry = (terrain: string | undefined) => terrain !== undefined && ['land', 'ore', 'gem', 'snow', 'road', 'cliff'].includes(terrain);

/** Resolve native artwork by original filenames, independently of theater-specific global tile IDs. */
export function compileCustomTerrain(map: TerrainInput, catalog: Record<string, TileDefinition[]>): ResolvedTerrainCell[] {
  const { width, height, cells } = map;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 96 || height > 96 || cells.length !== width * height)
    throw new Error('地图地形数据不完整，宽度和高度需要与地块数量一致。');
  const theater = map.theater.toLowerCase();
  const byTheater = new Map<string, Map<string, TileReference[]>>();
  function lookup(file: string, subTile = 0, selectedTheater = theater): NativeTerrainLayer | undefined {
    let files = byTheater.get(selectedTheater);
    if (!files) {
      files = new Map();
      (catalog[selectedTheater] ?? []).forEach((definition, tileId) => {
        const basename = definition.file.toLowerCase().replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
        const entries = files!.get(basename) ?? [];
        entries.push({ tileId, definition }); files!.set(basename, entries);
      });
      byTheater.set(selectedTheater, files);
    }
    const found = files.get(file)?.find(entry => entry.definition.subtiles[subTile]);
    return found ? { tileId: found.tileId, subTile, theater: selectedTheater } : undefined;
  }
  const at = (x: number, y: number): string | undefined => x >= 0 && y >= 0 && x < width && y < height ? cells[y * width + x] : undefined;
  const beach = cells.map((kind, index) => {
    if (!isGround(kind) || theater === 'snow') return false;
    const x = index % width, y = Math.floor(index / width);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy) === 'water') return true;
    return false;
  });
  const clear = lookup('clear01');
  const water = [9, 10, 11, 12, 13].map(number => lookup(`water${String(number).padStart(2, '0')}`)).filter((layer): layer is NativeTerrainLayer => !!layer);
  // Four edge bits follow native LAT numbering: N (y-1), E (x+1), S (y+1), W (x-1).
  function edgeMask(x: number, y: number, ordinaryClearOnly: boolean): number {
    let mask = 0;
    DIRECTIONS.forEach((direction, bit) => {
      const nx = x + direction.x, ny = y + direction.y, kind = at(nx, ny);
      const clearNeighbor = ordinaryClearOnly ? isGround(kind) && !beach[ny * width + nx] : kind !== undefined && kind !== 'road' && kind !== 'void';
      if (clearNeighbor) mask |= 1 << bit;
    });
    return mask;
  }
  return cells.map((kind, index) => {
    const x = index % width, y = Math.floor(index / width), layers: NativeTerrainLayer[] = [];
    const add = (layer: NativeTerrainLayer | undefined) => { if (layer) layers.push({ ...layer }); };
    const result: ResolvedTerrainCell = { kind, layers };
    if (kind === 'water') {
      add(water[((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0) % water.length]);
      QUARTERS.forEach((quarter, quarterIndex) => {
        const [first, second] = quarter.adjacent;
        const firstDry = isDry(at(x + DIRECTIONS[first].x, y + DIRECTIONS[first].y));
        const secondDry = isDry(at(x + DIRECTIONS[second].x, y + DIRECTIONS[second].y));
        let source: [string, number] | undefined;
        if (firstDry && secondDry) source = quarter.convex;
        else if (firstDry || secondDry) source = STRAIGHT[firstDry ? first : second];
        else if (isDry(at(x + quarter.diagonal.x, y + quarter.diagonal.y))) source = quarter.diagonalShore;
        const layer = source && lookup(source[0], source[1]);
        if (layer) layers.push({ ...layer, quarter: quarterIndex as 0 | 1 | 2 | 3 });
      });
      return result;
    }
    if (kind === 'snow') add(lookup('clear01', 0, 'snow'));
    else if (kind === 'road') {
      const mask = edgeMask(x, y, false);
      add((mask ? lookup(`plat${String(mask + 1).padStart(2, '0')}`) : undefined) ?? lookup('pvclr01') ?? clear);
    } else if (kind === 'cliff') {
      add(clear);
      // A ground-level subtile preserves original cliff stone pixels without inventing elevation.
      add(lookup('cliff02', 1) ?? lookup('cliff01', 2));
    } else if (isGround(kind)) {
      if (beach[index]) {
        const mask = edgeMask(x, y, true);
        add((mask ? lookup(`glat${String(mask + 1).padStart(2, '0')}`) : undefined) ?? lookup('green01') ?? clear);
      } else add(clear);
      if (kind === 'ore' || kind === 'gem') {
        result.overlayKey = `${theater}-${kind === 'ore' ? 'tib01' : 'gem01'}`;
        result.overlayFrame = 11;
      }
    }
    return result;
  });
}
