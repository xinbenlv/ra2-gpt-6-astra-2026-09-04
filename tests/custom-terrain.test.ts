import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { compileCustomTerrain, type NativeTerrainLayer } from '../src/custom-terrain.ts';
import type { TileDefinition } from '../src/maps.ts';

const filenames = [
  'clear01', 'green01', 'pvclr01', 'cliff02',
  ...Array.from({ length: 5 }, (_, i) => `water${String(i + 9).padStart(2, '0')}`),
  ...Array.from({ length: 16 }, (_, i) => `plat${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 16 }, (_, i) => `glat${String(i + 1).padStart(2, '0')}`),
  'shore04', 'shore28', 'shore20', 'shore12', 'shore33', 'shore39', 'shore37', 'shore35', 'shore08', 'shore32', 'shore24', 'shore16',
].reverse();
function tiles(extension: string): TileDefinition[] {
  return filenames.map(file => ({ file: `SOURCE/${file.toUpperCase()}.${extension}`, set: 123, name: 'Synthetic fixture',
    subtiles: Array.from({ length: 4 }, (): NonNullable<TileDefinition['subtiles'][number]> => [0, 0, 0, [1, 2, 3], [4, 5, 6]]) }));
}
const catalog = { temperate: tiles('TEM'), snow: tiles('SNO'), urban: tiles('URB') };
const name = (layer: NativeTerrainLayer): string => catalog[layer.theater as keyof typeof catalog][layer.tileId].file.split('/').at(-1)!.split('.')[0].toLowerCase();
function map(width = 5, height = 5, fill = 'land', theater = 'temperate') {
  return { width, height, theater, cells: Array<string>(width * height).fill(fill) };
}
const reference = (layer: NativeTerrainLayer) => `${name(layer)}:${layer.subTile}`;

test('uses original filenames despite shuffled global IDs and preserves semantic terrain and input data', () => {
  const doc = map(7, 1);
  doc.cells = ['land', 'water', 'ore', 'gem', 'road', 'cliff', 'snow'];
  const before = JSON.stringify(doc), nativeBefore = JSON.stringify(catalog);
  const first = compileCustomTerrain(doc, catalog), second = compileCustomTerrain(doc, catalog);
  assert.deepEqual(first, second);
  assert.deepEqual(first.map(cell => cell.kind), doc.cells);
  assert.equal(JSON.stringify(doc), before);
  assert.equal(JSON.stringify(catalog), nativeBefore);
  assert.match(name(first[1].layers[0]), /^water(?:09|1[0-3])$/);
  assert.equal(first[2].overlayKey, 'temperate-tib01');
  assert.equal(first[3].overlayKey, 'temperate-gem01');
  assert.equal(first[2].overlayFrame, 11);
  assert.equal(first[3].overlayFrame, 11);
  assert.equal(reference(first[5].layers.at(-1)!), 'cliff02:1');
  assert.equal(first[6].layers[0].theater, 'snow');
  assert.equal(name(first[6].layers[0]), 'clear01');
});

test('plain water varies deterministically using native single-cell water and treats outside bounds as continuation', () => {
  const doc = map(12, 7, 'water'), result = compileCustomTerrain(doc, catalog);
  assert.ok(result.every(cell => cell.kind === 'water' && cell.layers.length === 1 && cell.layers[0].quarter === undefined));
  assert.ok(result.every(cell => /^water(?:09|1[0-3])$/.test(name(cell.layers[0]))));
  assert.ok(new Set(result.map(cell => name(cell.layers[0]))).size > 1);
  assert.deepEqual(result, compileCustomTerrain(doc, catalog));
});

test('each cardinal dry neighbor uses the native straight shore on exactly its two adjoining quarters', () => {
  const cases = [
    { x: 2, y: 1, quarters: [0, 1], source: 'shore04:1' },
    { x: 3, y: 2, quarters: [1, 2], source: 'shore28:0' },
    { x: 2, y: 3, quarters: [2, 3], source: 'shore20:0' },
    { x: 1, y: 2, quarters: [0, 3], source: 'shore12:1' },
  ];
  for (const scenario of cases) {
    const doc = map(5, 5, 'water'); doc.cells[scenario.y * 5 + scenario.x] = 'land';
    const cell = compileCustomTerrain(doc, catalog)[12], shores = cell.layers.slice(1);
    assert.deepEqual(shores.map(layer => layer.quarter), scenario.quarters);
    assert.ok(shores.every(layer => reference(layer) === scenario.source));
    assert.equal(cell.kind, 'water');
  }
});

test('diagonal-only shores select water subtiles facing the correct land corner', () => {
  const cases = [
    { x: 1, y: 1, quarter: 0, source: 'shore08:3' },
    { x: 3, y: 1, quarter: 1, source: 'shore32:2' },
    { x: 3, y: 3, quarter: 2, source: 'shore24:0' },
    { x: 1, y: 3, quarter: 3, source: 'shore16:1' },
  ];
  for (const scenario of cases) {
    const doc = map(5, 5, 'water'); doc.cells[scenario.y * 5 + scenario.x] = 'land';
    const cell = compileCustomTerrain(doc, catalog)[12];
    assert.equal(cell.layers.length, 2);
    assert.equal(cell.layers[1].quarter, scenario.quarter);
    assert.equal(reference(cell.layers[1]), scenario.source);
  }
});

test('isolated water and narrow channels keep a full base and native water-facing corner layers', () => {
  const isolated = map(); isolated.cells[12] = 'water';
  const result = compileCustomTerrain(isolated, catalog)[12];
  assert.deepEqual(result.layers.slice(1).map(reference), ['shore33:3', 'shore39:2', 'shore37:0', 'shore35:1']);
  assert.deepEqual(result.layers.slice(1).map(layer => layer.quarter), [0, 1, 2, 3]);
  const channel = map(); for (let y = 0; y < 5; y++) channel.cells[y * 5 + 2] = 'water';
  const center = compileCustomTerrain(channel, catalog)[12];
  assert.deepEqual(center.layers.slice(1).map(reference), ['shore12:1', 'shore28:0', 'shore28:0', 'shore12:1']);
  assert.equal(center.kind, 'water');
});

test('all 256 eight-neighbor configurations produce bounded, deterministic native shoreline layers', () => {
  const neighbors = [6, 7, 8, 11, 13, 16, 17, 18];
  for (let mask = 0; mask < 256; mask++) {
    const doc = map(5, 5, 'water'); neighbors.forEach((index, bit) => { if (mask & 1 << bit) doc.cells[index] = 'land'; });
    const cell = compileCustomTerrain(doc, catalog)[12];
    assert.equal(cell.kind, 'water');
    assert.equal(cell.layers[0].quarter, undefined);
    assert.ok(cell.layers.length >= 1 && cell.layers.length <= 5);
    assert.equal(new Set(cell.layers.slice(1).map(layer => layer.quarter)).size, cell.layers.length - 1);
    assert.ok(cell.layers.every(layer => layer.tileId >= 0 && catalog.temperate[layer.tileId].subtiles[layer.subTile]));
    assert.deepEqual(cell, compileCustomTerrain(doc, catalog)[12]);
  }
});

test('coastal ground uses original beach-to-clear LAT edges while snow coast stays native snow', () => {
  const doc = map(7, 7); doc.cells[3 * 7 + 3] = 'water';
  const result = compileCustomTerrain(doc, catalog);
  assert.equal(name(result[2 * 7 + 3].layers[0]), 'glat02', 'north coast borders ordinary clear to the north');
  assert.equal(name(result[2 * 7 + 2].layers[0]), 'glat10', 'northwest coast has native N+W edge mask 9');
  assert.equal(name(result[1 * 7 + 3].layers[0]), 'clear01', 'ordinary clear ground outside the beach ring');
  assert.equal(result[2 * 7 + 3].kind, 'land');
  const island = map(3, 3, 'water'); island.cells[4] = 'ore';
  const ore = compileCustomTerrain(island, catalog)[4];
  assert.equal(name(ore.layers[0]), 'green01', 'beach interior has no unnecessary clear edges');
  assert.equal(ore.overlayKey, 'temperate-tib01');
  doc.theater = 'snow';
  const snowy = compileCustomTerrain(doc, catalog);
  assert.equal(name(snowy[2 * 7 + 3].layers[0]), 'clear01');
  assert.equal(snowy[2 * 7 + 3].layers[0].theater, 'snow');
});

test('pavement uses all sixteen native LAT edge combinations, resolved by basename', () => {
  const neighborIndices = [7, 13, 17, 11];
  for (let mask = 0; mask < 16; mask++) {
    const doc = map(5, 5, 'road');
    neighborIndices.forEach((index, bit) => { if (mask & 1 << bit) doc.cells[index] = 'land'; });
    const cell = compileCustomTerrain(doc, catalog)[12];
    assert.equal(name(cell.layers[0]), mask ? `plat${String(mask + 1).padStart(2, '0')}` : 'pvclr01');
    assert.equal(cell.kind, 'road');
  }
});

test('missing families and unsupported cells remain explicit without fabricated tile IDs', () => {
  const doc = map(3, 1); doc.cells = ['void', 'unexpected', 'land'];
  assert.deepEqual(compileCustomTerrain(doc, {}), doc.cells.map(kind => ({ kind, layers: [] })));
  doc.cells = ['road', 'land', 'water'];
  const clearOnly = { temperate: [tiles('TEM').find(tile => /CLEAR01/.test(tile.file))!] };
  const result = compileCustomTerrain(doc, clearOnly);
  assert.equal(result[0].layers[0].tileId, 0, 'missing pavement falls back to actual clear tile');
  assert.equal(result[1].layers[0].tileId, 0, 'missing beach falls back to actual clear tile');
  assert.deepEqual(result[2].layers, []);
  assert.throws(() => compileCustomTerrain({ ...doc, width: 4 }, catalog), /地形数据/);
});

const realPath = new URL('../public/maps/terrain.json', import.meta.url);
test('prepared native catalogs contain every selected source and shoreline samples are native wet-side art', { skip: !fs.existsSync(realPath) }, () => {
  const actual: Record<string, TileDefinition[]> = JSON.parse(fs.readFileSync(realPath, 'utf8'));
  for (const theater of ['temperate', 'urban', 'snow']) {
    const doc = map(9, 9, 'land', theater);
    doc.cells[40] = 'water';
    for (let x = 2; x < 7; x++) doc.cells[2 * 9 + x] = 'road';
    doc.cells[60] = 'ore'; doc.cells[61] = 'gem'; doc.cells[62] = 'cliff'; doc.cells[63] = 'snow';
    const result = compileCustomTerrain(doc, actual);
    assert.ok(result.every(cell => cell.layers.length > 0));
    for (const cell of result) for (const layer of cell.layers)
      assert.ok(actual[layer.theater][layer.tileId].subtiles[layer.subTile]);
    const shoreNames = new Set<string>();
    for (let mask = 0; mask < 256; mask++) {
      const water = map(3, 3, 'water', theater);
      [0, 1, 2, 3, 5, 6, 7, 8].forEach((index, bit) => { if (mask & 1 << bit) water.cells[index] = 'land'; });
      const center = compileCustomTerrain(water, actual)[4];
      for (const layer of center.layers.slice(1)) {
        const tile = actual[theater][layer.tileId]; shoreNames.add(tile.file);
        assert.ok([9, 10].includes(tile.subtiles[layer.subTile]![0]), `${theater} ${tile.file}:${layer.subTile} must be the wet-side subtile`);
      }
    }
    assert.equal(shoreNames.size, 12, 'four straight, four convex and four diagonal shore templates');
  }
});
