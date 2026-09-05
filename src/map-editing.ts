import { TERRAIN_COLORS, type CustomMapDocument } from './custom-maps.ts';
import type { Terrain } from './maps.ts';

/** Bounds are expressed in the current document's tile coordinates, including negative origins. */
export interface MapBounds { x: number; y: number; width: number; height: number }
export interface MapPoint { x: number; y: number }
export interface ResizeResult {
  document: CustomMapDocument;
  /** Add this translation to old local coordinates after applying the resize. */
  offset: MapPoint;
  /** Zero-based player slots newly removed by the crop; those slots remain available for placement. */
  removedSpawns: number[];
}
export interface BrushExpansionResult extends ResizeResult { point: MapPoint }

function checkGrid(doc: CustomMapDocument): void {
  if (!Number.isInteger(doc.width) || !Number.isInteger(doc.height) || doc.width < 24 || doc.height < 24 || doc.width > 96 || doc.height > 96 || !Array.isArray(doc.cells) || doc.cells.length !== doc.width * doc.height)
    throw new Error('地图尺寸和地形数量无效，请重新打开地图草稿。');
}

function checkPoint(point: MapPoint): void {
  if (!Number.isSafeInteger(point.x) || !Number.isSafeInteger(point.y)) throw new Error('地图坐标必须是有效的整数格。');
}

function brushRadius(size: number): number {
  if (![1, 3, 5, 7, 9].includes(size)) throw new Error('画笔大小必须为 1、3、5、7 或 9 格。');
  return (size - 1) / 2;
}

/** Copy the overlapping region exactly; never synthesize starts or discard player slots. */
export function resizeCustomMap(doc: CustomMapDocument, bounds: MapBounds): ResizeResult {
  checkGrid(doc);
  checkPoint(bounds);
  if (!Number.isInteger(bounds.width) || !Number.isInteger(bounds.height) || bounds.width < 24 || bounds.height < 24 || bounds.width > 96 || bounds.height > 96)
    throw new Error('地图宽度和高度必须是 24–96 之间的整数。');
  if (!Number.isSafeInteger(bounds.x + bounds.width) || !Number.isSafeInteger(bounds.y + bounds.height))
    throw new Error('地图边界坐标过大，请使用地图附近的范围。');
  const cells: Terrain[] = Array(bounds.width * bounds.height).fill(doc.theater === 'snow' ? 'snow' : 'land');
  const offset = { x: -bounds.x || 0, y: -bounds.y || 0 };
  const left = Math.max(0, bounds.x), top = Math.max(0, bounds.y);
  const right = Math.min(doc.width, bounds.x + bounds.width), bottom = Math.min(doc.height, bounds.y + bounds.height);
  for (let oldY = top; oldY < bottom; oldY++) for (let oldX = left; oldX < right; oldX++)
    cells[(oldY + offset.y) * bounds.width + oldX + offset.x] = doc.cells[oldY * doc.width + oldX];
  const removedSpawns: number[] = [];
  const spawns = doc.spawns.map((spawn, index) => {
    if (spawn.x === -1 && spawn.y === -1) return { x: -1, y: -1 };
    const x = spawn.x + offset.x, y = spawn.y + offset.y;
    if (x < 0 || y < 0 || x >= bounds.width || y >= bounds.height) {
      removedSpawns.push(index);
      return { x: -1, y: -1 };
    }
    return { x, y };
  });
  return { document: { ...doc, width: bounds.width, height: bounds.height, cells, spawns }, offset, removedSpawns };
}

/** Extend only the edges touched by the full brush; an oversized request changes nothing. */
export function expandMapForBrush(doc: CustomMapDocument, point: MapPoint, size: number): BrushExpansionResult {
  checkGrid(doc);
  checkPoint(point);
  const radius = brushRadius(size);
  const x = Math.min(0, point.x - radius), y = Math.min(0, point.y - radius);
  const right = Math.max(doc.width, point.x + radius + 1), bottom = Math.max(doc.height, point.y + radius + 1);
  const width = right - x, height = bottom - y;
  if (width > 96 || height > 96) throw new Error('地图最大为 96×96 格，请缩小画笔或先裁剪空白边缘。');
  if (x === 0 && y === 0 && width === doc.width && height === doc.height)
    return { document: doc, offset: { x: 0, y: 0 }, removedSpawns: [], point: { ...point } };
  const result = resizeCustomMap(doc, { x, y, width, height });
  return { ...result, point: { x: point.x + result.offset.x, y: point.y + result.offset.y } };
}

/** Paint a square brush into existing cells. Call expandMapForBrush first for painting beyond an edge. */
export function paintCustomMap(doc: CustomMapDocument, point: MapPoint, terrain: Terrain, size: number): void {
  checkGrid(doc);
  checkPoint(point);
  const radius = brushRadius(size);
  if (!Object.hasOwn(TERRAIN_COLORS, terrain)) throw new Error('请选择有效的地图地形。');
  const left = Math.max(0, point.x - radius), top = Math.max(0, point.y - radius);
  const right = Math.min(doc.width - 1, point.x + radius), bottom = Math.min(doc.height - 1, point.y + radius);
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) doc.cells[y * doc.width + x] = terrain;
}
