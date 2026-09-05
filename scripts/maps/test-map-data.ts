import fs from 'node:fs';
import { configureMapData, type MapDefinition, type MapMetadata } from '../../src/maps.ts';

/** Handwritten fixture: codec and import validation tests run without proprietary files. */
export function syntheticMapMetadata(): MapMetadata {
  const clear = { file: 'synthetic', set: 0, name: 'Synthetic clear ground', subtiles: [[0, 0, 0, [100, 100, 100], [100, 100, 100]]] };
  return {
    catalog: [{ id: 'synthetic', name: 'Synthetic', nameEn: 'Synthetic', width: 4, height: 4, players: 2, theater: 'temperate', filename: 'synthetic.map', preview: '', previewWidth: 0, previewHeight: 0, modes: ['standard'], official: false, source: 'Handwritten test fixture' }],
    terrain: { temperate: [clear], snow: [clear], urban: [clear] },
    overlays: [{ id: 255, name: 'NONE', wall: false, ore: false, land: '' }],
  };
}

/** Missing local originals skip only native integration; corrupt installed metadata still fails. */
export function configureLocalMapData(requireScenery = false): false | string {
  const mapRoot = new URL('../../public/maps/', import.meta.url);
  const files = ['catalog.json', 'terrain.json', 'overlays.json'];
  const missing = files.filter(filename => !fs.existsSync(new URL(filename, mapRoot)));
  if (missing.length) return `Original map assets are not installed (${missing.join(', ')}); run npm run assets:setup to enable native map integration tests.`;
  const [catalog, terrain, overlays] = files.map(filename => JSON.parse(fs.readFileSync(new URL(filename, mapRoot), 'utf8')));
  configureMapData({ catalog, terrain, overlays });
  const missingMap = (catalog as MapDefinition[]).find(map => !fs.existsSync(new URL(map.filename, mapRoot)));
  if (missingMap) return `Original map file ${missingMap.filename} is absent; run npm run assets:setup to enable native map integration tests.`;
  if (requireScenery && !fs.existsSync(new URL('../../public/assets/scenery/manifest-scenery.json', import.meta.url)))
    return 'Original scenery assets are not installed; run npm run assets:setup to enable native map playability tests.';
  return false;
}
