import { decodeMapPack, iniSection, iniValue, parseIni, type IniFile } from './map-codecs.ts';
import { appUrl, resolveOriginalUrls } from './urls.ts';

export type Terrain = 'land' | 'water' | 'ore' | 'gem' | 'cliff' | 'road' | 'snow';
export interface MapDefinition {
  id: string; name: string; nameEn: string; width: number; height: number; players: number;
  theater: string; filename: string; preview: string; previewWidth: number; previewHeight: number;
  modes: string[]; official: boolean; source: string; sha256?: string;
  specialMode?: 'megawealth' | 'unfinished'; notes?: string;
}
export interface MapTile {
  x: number; y: number; originalX: number; originalY: number;
  tileId: number; subTile: number; elevation: number; terrain: Terrain;
  overlay: number; overlayFrame: number; slope: number;
}
export interface MapScenery { x: number; y: number; type: string }
export interface MapStructure extends MapScenery { owner: string; health: number; facing: number }
export interface MapData {
  id: string; name: string; nameEn: string; width: number; height: number; players: number; theater: string;
  cells: Terrain[]; tiles: MapTile[]; spawns: { x: number; y: number }[];
  tileIds: Int32Array; subTiles: Uint8Array; elevations: Uint8Array;
  overlays: Uint8Array; overlayFrames: Uint8Array; valid: Uint8Array; radarColors: Uint32Array;
  origin: { x: number; y: number }; originalSize: number[]; localSize: number[];
  scenery: MapScenery[]; structures: MapStructure[];
  preview?: string; previewData?: { width: number; height: number; rgb: Uint8Array };
  ini: IniFile; official: boolean; source: string; warnings: string[];
  specialMode?: 'megawealth' | 'unfinished'; notes?: string;
  layout?: 'rectangular';
}
export interface TileDefinition { file: string; set: number; name: string; subtiles: (null | [number, number, number, number[], number[]])[] }
export interface OverlayDefinition { id: number; name: string; wall: boolean; ore: boolean; land: string }
export interface MapMetadata { catalog: unknown; terrain: unknown; overlays: unknown }
let tileDefinitions: Record<string, TileDefinition[]> = {};
let overlayDefinitions = new Map<number, OverlayDefinition>();
let definitions: MapDefinition[] = [];
let initialized = false;
let initialization: Promise<void> | undefined;
const imported = new Map<string, MapData>();

function requireMapData(): void {
  if (!initialized) throw new Error('原版地图素材尚未加载，请先下载并安装原版素材，再初始化地图。');
}

/** Supply extracted metadata from disk in offline tools and tests; no original data is bundled into JavaScript. */
export function configureMapData({ catalog, terrain, overlays }: MapMetadata): void {
  const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
  if (!Array.isArray(catalog) || !catalog.length || !catalog.every(map => record(map) && typeof map.id === 'string' && typeof map.name === 'string' && typeof map.filename === 'string' && Number.isInteger(map.width) && Number.isInteger(map.height) && Number.isInteger(map.players)))
    throw new Error('原版地图目录 catalog.json 无效，请重新安装原版素材。');
  if (!record(terrain) || !['temperate', 'snow', 'urban'].every(theater => {
    const tiles = terrain[theater];
    return Array.isArray(tiles) && tiles.length > 0 && tiles.every(tile => record(tile) && typeof tile.file === 'string' && Array.isArray(tile.subtiles));
  })) throw new Error('原版地形数据 terrain.json 无效或缺少战区，请重新安装原版素材。');
  if (!Array.isArray(overlays) || !overlays.length || !overlays.every(overlay => record(overlay) && Number.isInteger(overlay.id) && typeof overlay.name === 'string' && typeof overlay.land === 'string' && typeof overlay.ore === 'boolean' && typeof overlay.wall === 'boolean'))
    throw new Error('原版覆盖物数据 overlays.json 无效，请重新安装原版素材。');
  // Commit together so a corrupt or interrupted download cannot leave partially loaded metadata.
  definitions = resolveOriginalUrls([...catalog]) as MapDefinition[];
  tileDefinitions = terrain as unknown as Record<string, TileDefinition[]>;
  overlayDefinitions = new Map((overlays as OverlayDefinition[]).map(overlay => [overlay.id, overlay]));
  imported.clear();
  initialized = true;
}

/** Runtime loading lets a clean checkout build and show the asset installer before originals exist. */
export async function initializeMaps(): Promise<void> {
  if (initialized) return;
  if (!initialization) {
    initialization = (async () => {
      const read = async (filename: string): Promise<unknown> => {
        try {
          const response = await fetch(appUrl(`/maps/${filename}`), { cache: 'no-cache' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return await response.json();
        } catch (error) {
          throw new Error(`无法加载原版地图素材 /maps/${filename}，请下载并安装原版素材。${error instanceof Error ? error.message : String(error)}`);
        }
      };
      const [catalog, terrain, overlays] = await Promise.all(['catalog.json', 'terrain.json', 'overlays.json'].map(read));
      configureMapData({ catalog, terrain, overlays });
    })();
  }
  try { await initialization; }
  catch (error) { initialization = undefined; throw error; }
}

export function listMaps(): MapDefinition[] { requireMapData(); return [...definitions]; }
export function getMapDefinition(id: string): MapDefinition | undefined { requireMapData(); return definitions.find(map => map.id === id); }
export function terrainAt(map: Pick<MapData, 'width' | 'height' | 'cells'>, x: number, y: number): Terrain {
  x = Math.floor(x); y = Math.floor(y);
  return x < 0 || y < 0 || x >= map.width || y >= map.height ? 'cliff' : map.cells[y * map.width + x]!;
}
/** Original LocalSize uses projected coordinates; editor maps use every rectangular cell. */
export function isWithinPlayableArea(map: Pick<MapData, 'width' | 'height' | 'originalSize' | 'localSize' | 'layout'>, x: number, y: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  if (map.layout === 'rectangular') return true;
  const mapWidth = map.originalSize[2]!;
  const u = (x - y + mapWidth - 1) / 2;
  const v = (x + y - mapWidth + 1) / 2;
  const [left, top, width, height] = map.localSize;
  return u >= left! && u < left! + width! && v >= top! && v < top! + height!;
}
export function nativeTileDefinition(theater: string, tileId: number): TileDefinition | undefined {
  requireMapData();
  return tileDefinitions[theater.toLowerCase()]?.[tileId === 65535 ? 0 : tileId];
}

export async function loadMap(id: string): Promise<MapData> {
  if (imported.has(id)) return imported.get(id)!;
  const definition = getMapDefinition(id);
  if (!definition) throw new Error(`地图不存在：${id}`);
  const response = await fetch(appUrl(`/maps/${definition.filename}`));
  if (!response.ok) throw new Error(`无法加载地图 ${definition.name}：HTTP ${response.status}`);
  return importMap(await response.text(), definition.filename, definition);
}

/** Loads an original RA2 .map/.mpr file, retaining all native sections for future simulation fidelity. */
export function importMap(text: string, filename = 'custom.map', metadata?: Partial<MapDefinition>): MapData {
  requireMapData();
  if (text.length > 16 * 1024 * 1024) throw new Error('地图文件超过 16 MB。');
  const ini = parseIni(text), mapSection = iniSection(ini, 'Map'), basic = iniSection(ini, 'Basic');
  const originalSize = iniValue(mapSection, 'Size').split(',').map(Number);
  const [,, mapWidth, mapHeight] = originalSize;
  if (originalSize.length !== 4 || !mapWidth || !mapHeight || mapWidth < 2 || mapHeight < 2 || mapWidth + mapHeight > 512)
    throw new Error('不是有效的 RA2 地图：缺少或不支持的 [Map] Size。');
  const theater = iniValue(mapSection, 'Theater', 'TEMPERATE').toLowerCase();
  if (!tileDefinitions[theater]) throw new Error(`不支持 ${theater} 战区；原版 RA2 支持 TEMPERATE、SNOW 和 URBAN。`);
  const width = mapWidth + mapHeight - 1, height = width, count = width * height;
  const localSizeText = iniValue(mapSection, 'LocalSize');
  const localSize = localSizeText ? localSizeText.split(',').map(Number) : [0,0,mapWidth,mapHeight];
  const id = metadata?.id ?? (filename.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '-') || 'custom-map');
  const name = metadata?.name ?? iniValue(basic, 'Name', filename.replace(/\.[^.]+$/, ''));
  const cells: Terrain[] = Array(count).fill('cliff');
  const tileIds = new Int32Array(count).fill(-1), subTiles = new Uint8Array(count), elevations = new Uint8Array(count);
  const overlays = new Uint8Array(count).fill(255), overlayFrames = new Uint8Array(count), valid = new Uint8Array(count), radarColors = new Uint32Array(count);
  const baseTerrain: Terrain = theater === 'snow' ? 'snow' : 'land';
  // Omitted clear cells are legal in optimized maps. Reconstruct the original diamond first.
  for (let oy = 1; oy <= height; oy++) for (let ox = 1; ox <= width; ox++) {
    if (ox + oy < mapWidth + 1 || ox + oy > mapWidth + 2 * mapHeight || Math.abs(ox - oy) > mapWidth - 1) continue;
    const index = (oy - 1) * width + ox - 1;
    valid[index] = 1; tileIds[index] = 0; cells[index] = baseTerrain;
  }
  const tilePack = iniSection(ini, 'IsoMapPack5');
  if (Object.keys(tilePack).length) {
    const raw = decodeMapPack(tilePack, 'lzo');
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    for (let offset = 0; offset + 11 <= raw.length; offset += 11) {
      const originalX = view.getInt16(offset, true), originalY = view.getInt16(offset + 2, true);
      if (originalX === 0 && originalY === 0) break;
      const x = originalX - 1, y = originalY - 1;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const index = y * width + x;
      tileIds[index] = view.getInt32(offset + 4, true); subTiles[index] = raw[offset + 8]!; elevations[index] = raw[offset + 9]!;
      valid[index] = 1;
    }
  }
  const overlaySection = iniSection(ini, 'OverlayPack'), overlayDataSection = iniSection(ini, 'OverlayDataPack');
  const overlayRaw = Object.keys(overlaySection).length ? decodeMapPack(overlaySection, 'lcw', 262144) : undefined;
  const overlayDataRaw = Object.keys(overlayDataSection).length ? decodeMapPack(overlayDataSection, 'lcw', 262144) : undefined;
  const tiles: MapTile[] = [], warnings: string[] = [];
  let missingTiles = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = y * width + x;
    if (!valid[index]) continue;
    const tileId = tileIds[index] === 65535 || tileIds[index]! < 0 ? 0 : tileIds[index]!;
    const info = nativeTileDefinition(theater, tileId);
    const tile = info?.subtiles[subTiles[index]!] ?? info?.subtiles.find(value => value !== null);
    if (!info) missingTiles++;
    const landType = tile?.[0] ?? 0;
    let terrain: Terrain = landType === 9 ? 'water' : [7,8,15].includes(landType) ? 'cliff' : [6,11,12].includes(landType) ? 'road' : baseTerrain;
    const overlayIndex = x + 1 + (y + 1) * 512, overlay = overlayRaw?.[overlayIndex] ?? 255, overlayFrame = overlayDataRaw?.[overlayIndex] ?? 0;
    const overlayInfo = overlayDefinitions.get(overlay);
    if (overlayInfo?.ore) terrain = overlayInfo.name.startsWith('GEM') || overlayInfo.name.startsWith('TIB2') ? 'gem' : 'ore';
    else if (overlayInfo?.wall || overlayInfo?.land === 'Rock') terrain = 'cliff';
    else if (overlayInfo?.land === 'Road' || overlayInfo?.land === 'Railroad' || overlayInfo?.name.startsWith('BRIDGE')) terrain = 'road';
    const color = tile?.[3] ?? (theater === 'snow' ? [180,195,205] : [108,126,79]);
    radarColors[index] = (color[0]! << 16) | (color[1]! << 8) | color[2]!;
    cells[index] = terrain; overlays[index] = overlay; overlayFrames[index] = overlayFrame;
    tiles.push({x,y,originalX:x+1,originalY:y+1,tileId,subTile:subTiles[index]!,elevation:elevations[index]!,terrain,overlay,overlayFrame,slope:tile?.[2] ?? 0});
  }
  if (missingTiles) warnings.push(`${missingTiles} 个地块使用原版素材包没有的地形编号。`);
  const waypointSection = iniSection(ini, 'Waypoints');
  const spawns = Object.entries(waypointSection).filter(([key]) => /^\d+$/.test(key) && Number(key) < 8).sort(([a],[b]) => Number(a)-Number(b)).map(([,value]) => {
    const coordinate = Number(value); return {x:coordinate % 1000 - 1,y:Math.floor(coordinate/1000) - 1};
  }).filter(spawn => spawn.x >= 0 && spawn.y >= 0 && spawn.x < width && spawn.y < height);
  if (spawns.length < 2) throw new Error('遭遇战地图至少需要两个有效的起始位置（Waypoints 0–7）。');
  const scenery: MapScenery[] = Object.entries(iniSection(ini, 'Terrain')).map(([key,type]) => ({x:Number(key)%1000-1,y:Math.floor(Number(key)/1000)-1,type}));
  const structures: MapStructure[] = Object.values(iniSection(ini, 'Structures')).map(value => {
    const pieces = value.split(','); return {owner:pieces[0] ?? 'Neutral',type:pieces[1] ?? '',health:Number(pieces[2])/256,x:Number(pieces[3])-1,y:Number(pieces[4])-1,facing:Number(pieces[5])};
  });
  const result: MapData = { id,name,nameEn:metadata?.nameEn ?? name,width,height,players:Math.min(metadata?.players ?? spawns.length,spawns.length),theater,
    cells,tiles,spawns,tileIds,subTiles,elevations,overlays,overlayFrames,valid,radarColors,origin:{x:1,y:1},originalSize,localSize,scenery,structures,
    ini,official:metadata?.official ?? false,source:metadata?.source ?? '导入的原版 RA2 地图',warnings,preview:metadata?.preview,
    specialMode:metadata?.specialMode,notes:metadata?.notes };
  const previewSection = iniSection(ini, 'PreviewPack');
  if (Object.keys(previewSection).length) {
    const size = iniValue(iniSection(ini, 'Preview'),'Size').split(',').map(Number), pw = size[2], ph = size[3];
    if (pw && ph && pw * ph < 1024 * 1024) {
      const rgb = decodeMapPack(previewSection,'lzo');
      if (rgb.length === pw * ph * 3) result.previewData = {width:pw,height:ph,rgb};
    }
  }
  return result;
}

/** Add a user-selected .map/.mpr to the lobby for this page session. */
export function registerImportedMap(map: MapData): MapDefinition {
  requireMapData();
  let id = map.id;
  while (definitions.some(item => item.id === id)) id += '-custom';
  map.id = id; imported.set(id,map);
  const entry: MapDefinition = {id,name:map.name,nameEn:map.nameEn,width:map.originalSize[2]!,height:map.originalSize[3]!,players:map.players,theater:map.theater,
    filename:'',preview:map.preview ?? '',previewWidth:map.previewData?.width ?? 0,previewHeight:map.previewData?.height ?? 0,modes:['standard'],official:false,source:map.source,specialMode:map.specialMode,notes:map.notes};
  definitions.push(entry); return entry;
}
