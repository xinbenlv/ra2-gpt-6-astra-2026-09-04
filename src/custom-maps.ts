import type { MapData, MapTile, Terrain } from './maps.ts';

/** Portable editor data only: no executable code, original game assets, or local URLs. */
export interface CustomMapDocument {
  format: 'ra2-web-map';
  version: 1;
  name: string;
  width: number;
  height: number;
  theater: 'temperate' | 'snow' | 'urban';
  cells: Terrain[];
  spawns: { x: number; y: number }[];
}

export const CUSTOM_MAP_EXTENSION = '.ra2map';
export const MAX_CUSTOM_MAP_BYTES = 2 * 1024 * 1024;
export const TERRAIN_COLORS: Record<Terrain, string> = {
  land: '#73804d', water: '#315a79', ore: '#c8a94e', gem: '#ad72ba',
  cliff: '#655f53', road: '#929080', snow: '#c2d2d6',
};

const FIELDS = ['format', 'version', 'name', 'width', 'height', 'theater', 'cells', 'spawns'];
const CLEAR_TERRAIN = new Set<Terrain>(['land', 'snow', 'road']);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const validDimension = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 24 && value <= 96;
const isTerrain = (value: unknown): value is Terrain =>
  typeof value === 'string' && Object.hasOwn(TERRAIN_COLORS, value);

/** Returns bounded, actionable messages for both editor drafts and untrusted JSON. */
export function validateCustomMap(value: unknown): string[] {
  return validationErrors(value, true);
}

function validationErrors(value: unknown, publishing: boolean): string[] {
  if (!isRecord(value)) return ['地图内容必须是一个 JSON 对象。'];
  const errors: string[] = [];
  if (Object.keys(value).some(key => !FIELDS.includes(key))) errors.push('地图包含不支持的字段，请使用本编辑器导出的 .ra2map 文件。');
  if (value.format !== 'ra2-web-map') errors.push('地图格式不正确，应为 ra2-web-map；请上传 .ra2map 文件。');
  if (value.version !== 1) errors.push('不支持此地图版本，目前只支持版本 1。');
  if (typeof value.name !== 'string' || (publishing && !value.name.trim()) || value.name.length > 60 || /[\u0000-\u001f\u007f]/.test(value.name))
    errors.push('地图名称需要 1–60 个字符，且不能包含换行或控制字符。');
  if (!validDimension(value.width)) errors.push('地图宽度必须是 24–96 之间的整数。');
  if (!validDimension(value.height)) errors.push('地图高度必须是 24–96 之间的整数。');
  if (!['temperate', 'snow', 'urban'].includes(value.theater as string)) errors.push('战区必须为 temperate（温带）、snow（雪地）或 urban（城市）。');

  const dimensionsValid = validDimension(value.width) && validDimension(value.height);
  const width = value.width as number, height = value.height as number;
  const cells = value.cells;
  let cellsValid = false;
  if (!Array.isArray(cells)) errors.push('地形 cells 必须是数组。');
  else if (dimensionsValid) {
    if (cells.length !== width * height) errors.push(`地形数量必须为 ${width * height}，与地图宽度 × 高度一致。`);
    else {
      // Array.from also exposes holes in an in-memory editor draft instead of skipping them.
      const badIndex = Array.from(cells).findIndex(cell => !isTerrain(cell));
      if (badIndex >= 0) errors.push(`第 ${badIndex + 1} 个地块无效，只支持陆地、水域、矿石、宝石、悬崖、道路和雪地。`);
      else cellsValid = true;
    }
  }
  if (!Array.isArray(value.spawns) || value.spawns.length < 2 || value.spawns.length > 8) {
    errors.push('地图需要 2–8 个玩家起点。');
    return errors;
  }
  const seen: { x: number; y: number; index: number }[] = [];
  for (let index = 0; index < value.spawns.length; index++) {
    const spawn = value.spawns[index];
    if (!isRecord(spawn) || Object.keys(spawn).some(key => key !== 'x' && key !== 'y') || !Number.isInteger(spawn.x) || !Number.isInteger(spawn.y)) {
      errors.push(`起点 ${index + 1} 必须只包含整数坐标 x 和 y。`);
      continue;
    }
    const x = spawn.x as number, y = spawn.y as number;
    if (!dimensionsValid) continue;
    if (x < 0 || y < 0 || x >= width || y >= height) {
      errors.push(`起点 ${index + 1} 的坐标必须位于地图内。`);
      continue;
    }
    if (!publishing) continue;
    if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2) {
      errors.push(`起点 ${index + 1} 必须在地图内，并距边缘至少 2 格，为基地预留空间。`);
      continue;
    }
    const tooClose = seen.find(other => Math.hypot(other.x - x, other.y - y) < 8);
    if (tooClose) errors.push(`起点 ${index + 1} 与起点 ${tooClose.index + 1} 太近，两者至少需要相距 8 格。`);
    seen.push({ x, y, index });
    if (cellsValid) {
      let clear = true;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
        if (!CLEAR_TERRAIN.has((cells as Terrain[])[(y + dy) * width + x + dx])) clear = false;
      if (!clear) errors.push(`起点 ${index + 1} 周围的 5×5 区域必须为陆地、雪地或道路，请移除水域、悬崖和矿产以部署基地。`);
    }
  }
  return errors;
}

function requireValid(value: unknown): asserts value is CustomMapDocument {
  const errors = validateCustomMap(value);
  if (errors.length) throw new Error(errors.join('\n'));
}

function copyDocument(doc: CustomMapDocument, trimName = true): CustomMapDocument {
  return { format: 'ra2-web-map', version: 1, name: trimName ? doc.name.trim() : doc.name, width: doc.width, height: doc.height,
    theater: doc.theater, cells: [...doc.cells], spawns: doc.spawns.map(({ x, y }) => ({ x, y })) };
}

function parseDocument(text: string, publishing: boolean): CustomMapDocument {
  if (typeof text !== 'string') throw new Error('请读取并上传 .ra2map 文本文件。');
  if (text.length > MAX_CUSTOM_MAP_BYTES || new TextEncoder().encode(text).byteLength > MAX_CUSTOM_MAP_BYTES)
    throw new Error('地图文件不能超过 2 MB。');
  let value: unknown;
  try { value = JSON.parse(text.replace(/^\uFEFF/, '')); }
  catch { throw new Error('地图文件不是有效的 JSON，请重新下载 .ra2map 文件后上传。'); }
  const errors = validationErrors(value, publishing);
  if (errors.length) throw new Error(errors.join('\n'));
  return copyDocument(value as CustomMapDocument, publishing);
}

export function parseCustomMap(text: string): CustomMapDocument {
  return parseDocument(text, true);
}

/** Restore a local work in progress; publishing/playing still requires strict validation. */
export function parseCustomMapDraft(text: string): CustomMapDocument {
  return parseDocument(text, false);
}

export function serializeCustomMap(doc: CustomMapDocument): string {
  requireValid(doc);
  return `${JSON.stringify(copyDocument(doc), null, 2)}\n`;
}

/** A clear, resource-bearing starting template supports every editor size/player count. */
export function createCustomMap(width = 48, height = 48, theater: CustomMapDocument['theater'] = 'temperate', players = 2): CustomMapDocument {
  if (!validDimension(width) || !validDimension(height)) throw new Error('地图宽度和高度必须是 24–96 之间的整数。');
  if (!Number.isInteger(players) || players < 2 || players > 8) throw new Error('请选择 2–8 个玩家起点。');
  if (!['temperate', 'snow', 'urban'].includes(theater)) throw new Error('请选择温带、雪地或城市战区。');
  const left = Math.max(3, Math.floor(width * .14)), right = width - 1 - left;
  const top = Math.max(3, Math.floor(height * .14)), bottom = height - 1 - top;
  const centerX = Math.floor(width / 2), centerY = Math.floor(height / 2);
  const spawns = [
    { x: left, y: top }, { x: right, y: bottom }, { x: right, y: top }, { x: left, y: bottom },
    { x: centerX, y: top }, { x: centerX, y: bottom }, { x: left, y: centerY }, { x: right, y: centerY },
  ].slice(0, players);
  const cells: Terrain[] = Array(width * height).fill(theater === 'snow' ? 'snow' : 'land');
  for (const spawn of spawns) {
    const direction = Math.atan2(centerY - spawn.y, centerX - spawn.x);
    const oreX = Math.round(spawn.x + Math.cos(direction) * 7), oreY = Math.round(spawn.y + Math.sin(direction) * 7);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = oreX + dx, y = oreY + dy;
      if (x < 0 || y < 0 || x >= width || y >= height || dx * dx + dy * dy > 5) continue;
      if (!spawns.some(p => Math.abs(p.x - x) <= 2 && Math.abs(p.y - y) <= 2)) cells[y * width + x] = 'ore';
    }
  }
  const doc: CustomMapDocument = { format: 'ra2-web-map', version: 1, name: '未命名地图', width, height, theater, cells, spawns };
  requireValid(doc);
  return doc;
}

/** Adapt portable terrain to the existing renderer and simulation without loading native tiles. */
export function customMapToMapData(doc: CustomMapDocument): MapData {
  requireValid(doc);
  const clean = copyDocument(doc), count = clean.width * clean.height;
  const tileIds = new Int32Array(count).fill(-1), subTiles = new Uint8Array(count), elevations = new Uint8Array(count);
  const overlays = new Uint8Array(count).fill(255), overlayFrames = new Uint8Array(count), valid = new Uint8Array(count).fill(1);
  const radarColors = Uint32Array.from(clean.cells, terrain => parseInt(TERRAIN_COLORS[terrain].slice(1), 16));
  const tiles: MapTile[] = clean.cells.map((terrain, index) => {
    const x = index % clean.width, y = Math.floor(index / clean.width);
    return { x, y, originalX: x + 1, originalY: y + 1, tileId: -1, subTile: 0, elevation: 0, terrain, overlay: 255, overlayFrame: 0, slope: 0 };
  });
  let hash = 2166136261;
  for (const char of JSON.stringify(clean)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return { id: `custom-${(hash >>> 0).toString(16)}`, name: clean.name, nameEn: clean.name,
    width: clean.width, height: clean.height, players: clean.spawns.length, theater: clean.theater,
    cells: clean.cells, spawns: clean.spawns, tileIds, subTiles, elevations, overlays, overlayFrames, valid, radarColors, tiles,
    layout: 'rectangular', origin: { x: 1, y: 1 }, originalSize: [0, 0, clean.width, clean.height], localSize: [0, 0, clean.width, clean.height],
    scenery: [], structures: [], ini: {}, official: false, source: '地图编辑器 · 自定义地图', warnings: [],
  };
}
