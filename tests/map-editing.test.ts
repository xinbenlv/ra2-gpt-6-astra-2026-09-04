import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCustomMap, customMapToMapData, parseCustomMap, parseCustomMapDraft, serializeCustomMap, type CustomMapDocument } from '../src/custom-maps.ts';
import { expandMapForBrush, paintCustomMap, resizeCustomMap, type MapBounds } from '../src/map-editing.ts';
import type { Terrain } from '../src/maps.ts';

function frozenTemplate(width = 24, height = 32): CustomMapDocument {
  const doc = createCustomMap(width, height);
  Object.freeze(doc.cells);
  doc.spawns.forEach(Object.freeze);
  Object.freeze(doc.spawns);
  return Object.freeze(doc);
}

test('resizing expands each edge without moving old terrain relative to its player starts', () => {
  const source = frozenTemplate();
  const boundsList: MapBounds[] = [
    { x: -4, y: 0, width: 28, height: 32 }, { x: 0, y: 0, width: 28, height: 32 },
    { x: 0, y: -6, width: 24, height: 38 }, { x: 0, y: 0, width: 24, height: 38 },
  ];
  for (const bounds of boundsList) {
    const result = resizeCustomMap(source, bounds), doc = result.document;
    assert.equal(doc.width, bounds.width);
    assert.equal(doc.height, bounds.height);
    assert.notEqual(doc, source);
    assert.notEqual(doc.cells, source.cells);
    assert.notEqual(doc.spawns[0], source.spawns[0]);
    assert.deepEqual(result.removedSpawns, []);
    for (let y = 0; y < doc.height; y++) for (let x = 0; x < doc.width; x++) {
      const oldX = x + bounds.x, oldY = y + bounds.y;
      const expected = oldX >= 0 && oldY >= 0 && oldX < source.width && oldY < source.height ? source.cells[oldY * source.width + oldX] : 'land';
      assert.equal(doc.cells[y * doc.width + x], expected, `(${x}, ${y}) in ${JSON.stringify(bounds)}`);
    }
    source.spawns.forEach((spawn, index) => assert.deepEqual(doc.spawns[index], { x: spawn.x + result.offset.x, y: spawn.y + result.offset.y }));
  }
});

test('newly exposed cells use the selected theater base and leave overlapping ore and gems intact', () => {
  for (const theater of ['temperate', 'urban', 'snow'] as const) {
    const source = createCustomMap(24, 32, theater);
    source.cells[0] = 'gem';
    source.cells[31 * 24 + 23] = 'ore';
    const { document } = resizeCustomMap(source, { x: -3, y: -5, width: 30, height: 42 });
    assert.equal(document.cells[5 * 30 + 3], 'gem');
    assert.equal(document.cells[36 * 30 + 26], 'ore');
    assert.equal(document.cells[0], theater === 'snow' ? 'snow' : 'land');
    assert.equal(document.cells.at(-1), theater === 'snow' ? 'snow' : 'land');
    assert.equal(document.theater, theater);
  }
});

test('crop remaps resources and retained player slots, marks lost starts, and survives draft reload', () => {
  const source = createCustomMap(48, 48, 'temperate', 4), before = JSON.stringify(source);
  source.cells[12 * 48 + 11] = 'gem';
  const sourceAfterEdit = JSON.stringify(source);
  const result = resizeCustomMap(source, { x: 4, y: 4, width: 36, height: 36 });
  assert.deepEqual(result.offset, { x: -4, y: -4 });
  assert.deepEqual(result.removedSpawns, [1, 2, 3]);
  assert.equal(result.document.cells[8 * 36 + 7], 'gem');
  assert.equal(result.document.spawns.length, 4);
  assert.deepEqual(result.document.spawns[0], { x: 2, y: 2 });
  assert.deepEqual(result.document.spawns.slice(1), Array.from({ length: 3 }, () => ({ x: -1, y: -1 })));
  assert.deepEqual(parseCustomMapDraft(JSON.stringify(result.document)), result.document);
  assert.throws(() => serializeCustomMap(result.document), /尚未放置/);
  assert.throws(() => customMapToMapData(result.document), /尚未放置/);
  const expanded = resizeCustomMap(result.document, { x: -5, y: -5, width: 46, height: 46 });
  assert.deepEqual(expanded.removedSpawns, [], 'previously unplaced slots are not reported again');
  assert.deepEqual(expanded.document.spawns.slice(1), result.document.spawns.slice(1), 'expansion never places a missing start');
  assert.deepEqual(expanded.document.spawns[0], { x: 7, y: 7 });
  assert.equal(JSON.stringify(source), sourceAfterEdit, 'both resizes leave the source unchanged');
  assert.notEqual(sourceAfterEdit, before, 'resource fixture changed before resizing');
});

test('fully disjoint bounds preserve every slot as unplaced and create a fresh blank region', () => {
  const source = frozenTemplate();
  const result = resizeCustomMap(source, { x: 30, y: 40, width: 24, height: 24 });
  assert.deepEqual(result.removedSpawns, [0, 1]);
  assert.ok(result.document.cells.every(terrain => terrain === 'land'));
  assert.deepEqual(result.document.spawns, [{ x: -1, y: -1 }, { x: -1, y: -1 }]);
});

test('brush expansion includes the whole square footprint with only necessary edge growth', () => {
  const source = frozenTemplate();
  const cases = [
    { point: { x: -2, y: 10 }, size: 3, width: 27, height: 32, offset: { x: 3, y: 0 } },
    { point: { x: 24, y: 10 }, size: 5, width: 27, height: 32, offset: { x: 0, y: 0 } },
    { point: { x: 10, y: -3 }, size: 7, width: 24, height: 38, offset: { x: 0, y: 6 } },
    { point: { x: 10, y: 32 }, size: 9, width: 24, height: 37, offset: { x: 0, y: 0 } },
    { point: { x: -1, y: -1 }, size: 1, width: 25, height: 33, offset: { x: 1, y: 1 } },
  ];
  for (const expected of cases) {
    const result = expandMapForBrush(source, expected.point, expected.size);
    assert.equal(result.document.width, expected.width);
    assert.equal(result.document.height, expected.height);
    assert.deepEqual(result.offset, expected.offset);
    assert.deepEqual(result.point, { x: expected.point.x + expected.offset.x, y: expected.point.y + expected.offset.y });
    const radius = (expected.size - 1) / 2;
    assert.ok(result.point.x - radius >= 0 && result.point.y - radius >= 0);
    assert.ok(result.point.x + radius < result.document.width && result.point.y + radius < result.document.height);
    paintCustomMap(result.document, result.point, 'water', expected.size);
    assert.equal(result.document.cells.filter(terrain => terrain === 'water').length, expected.size ** 2);
  }
});

test('a fitting brush reuses the document and leaves it untouched', () => {
  const source = frozenTemplate(), point = { x: 12, y: 15 };
  const result = expandMapForBrush(source, point, 9);
  assert.equal(result.document, source);
  assert.deepEqual(result.offset, { x: 0, y: 0 });
  assert.deepEqual(result.removedSpawns, []);
  assert.deepEqual(result.point, point);
  assert.notEqual(result.point, point);
});

test('oversized expansion and invalid bounds or brushes fail atomically', () => {
  const source = frozenTemplate(96, 96);
  for (const point of [{ x: -1, y: 30 }, { x: 96, y: 30 }, { x: 30, y: -1 }, { x: 30, y: 96 }, { x: 0, y: 0 }, { x: Number.MAX_SAFE_INTEGER, y: 0 }])
    assert.throws(() => expandMapForBrush(source, point, 3), /96×96/);
  const invalidBounds = [
    { x: 0, y: 0, width: 23, height: 24 }, { x: 0, y: 0, width: 24, height: 97 },
    { x: 0, y: 0, width: 24.5, height: 24 }, { x: .5, y: 0, width: 24, height: 24 },
    { x: 0, y: NaN, width: 24, height: 24 }, { x: Number.MAX_SAFE_INTEGER, y: 0, width: 24, height: 24 },
  ];
  for (const bounds of invalidBounds) assert.throws(() => resizeCustomMap(source, bounds));
  for (const size of [0, 2, 11, NaN]) {
    assert.throws(() => expandMapForBrush(source, { x: 20, y: 20 }, size), /画笔大小/);
    assert.throws(() => paintCustomMap(source, { x: 20, y: 20 }, 'land', size), /画笔大小/);
  }
  assert.throws(() => paintCustomMap(source, { x: 2, y: 2 }, 'void' as Terrain, 1), /有效的地图地形/);
  assert.throws(() => paintCustomMap(source, { x: Infinity, y: 2 }, 'land', 1), /整数格/);
  assert.throws(() => expandMapForBrush(source, { x: .5, y: 2 }, 1), /整数格/);
});

test('painting clips to the map without extending arrays or changing map metadata', () => {
  const source = createCustomMap(24, 32), spawns = JSON.stringify(source.spawns);
  paintCustomMap(source, { x: 0, y: 0 }, 'water', 5);
  assert.equal(source.cells.filter(terrain => terrain === 'water').length, 9);
  assert.equal(source.cells.length, 24 * 32);
  assert.equal(source.width, 24);
  assert.equal(source.height, 32);
  assert.equal(JSON.stringify(source.spawns), spawns);
  const before = JSON.stringify(source);
  paintCustomMap(source, { x: -1000, y: -1000 }, 'cliff', 9);
  assert.equal(JSON.stringify(source), before);
});

test('expanded rectangular maps round-trip and remain usable by the existing renderer and game adapter', () => {
  const source = createCustomMap(24, 32, 'snow');
  const result = expandMapForBrush(source, { x: -2, y: 34 }, 3);
  paintCustomMap(result.document, result.point, 'gem', 3);
  const imported = parseCustomMap(serializeCustomMap(result.document));
  assert.deepEqual(imported, result.document);
  assert.equal(imported.width, 27);
  assert.equal(imported.height, 36);
  const map = customMapToMapData(imported);
  assert.equal(map.layout, 'rectangular');
  assert.equal(map.valid.length, 27 * 36);
  assert.equal(map.cells.filter(terrain => terrain === 'gem').length, 9);
});
