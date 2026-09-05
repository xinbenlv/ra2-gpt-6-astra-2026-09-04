import { importMap, type MapData } from './maps';
import { customMapToMapData, MAX_CUSTOM_MAP_BYTES, parseCustomMap } from './custom-maps';

/** Both lobby upload entries share the same bounded file-reading and validation path. */
export async function readSkirmishMap(file: Pick<File, 'name' | 'size' | 'text'>): Promise<MapData> {
  const custom = /\.ra2map$/i.test(file.name);
  const limit = custom ? MAX_CUSTOM_MAP_BYTES : 16 * 1024 * 1024;
  if (file.size > limit) throw new Error(custom ? '自定义地图文件超过 2 MB。' : '地图文件超过 16 MB。');
  const text = await file.text();
  // Recognize the document itself as well as its extension, including renamed JSON files.
  return custom || text.replace(/^\uFEFF/, '').trimStart().startsWith('{')
    ? customMapToMapData(parseCustomMap(text))
    : importMap(text, file.name);
}
