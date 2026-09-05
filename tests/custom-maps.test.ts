import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameEngine } from '../src/game/engine.ts';
import { isWithinPlayableArea } from '../src/maps.ts';
import {
  createCustomMap, customMapToMapData, MAX_CUSTOM_MAP_BYTES, parseCustomMap,
  parseCustomMapDraft, serializeCustomMap, TERRAIN_COLORS, validateCustomMap,
} from '../src/custom-maps.ts';

test('custom maps round-trip all supported terrain, Unicode names, and rectangular dimensions', () => {
  const doc = createCustomMap(32, 48, 'snow', 4);
  doc.name = '雪原 · 四方会战';
  Object.keys(TERRAIN_COLORS).forEach((terrain, index) => { doc.cells[index] = terrain as keyof typeof TERRAIN_COLORS; });
  const text = serializeCustomMap(doc), restored = parseCustomMap(text);
  assert.deepEqual(restored, doc);
  assert.deepEqual(parseCustomMap(`\uFEFF${text}`), doc);
  assert.deepEqual(Object.keys(JSON.parse(text)), ['format', 'version', 'name', 'width', 'height', 'theater', 'cells', 'spawns']);
  assert.equal(serializeCustomMap(restored), text);
  assert.ok(!text.includes('tileIds') && !text.includes('preview') && !text.includes('ini'));
  restored.cells[0] = 'snow';
  assert.equal(doc.cells[0], 'land', 'returned documents own their cell arrays');
});

test('rejects malformed, unsupported, and untrusted map input before conversion', () => {
  const valid = createCustomMap();
  const invalidValues: unknown[] = [null, [], true, 'text', {},
    { ...valid, format: 'ra2-script' }, { ...valid, version: 2 }, { ...valid, version: '1' },
    { ...valid, name: '' }, { ...valid, name: '   ' }, { ...valid, name: 'x'.repeat(61) }, { ...valid, name: '地图\n标题' },
    { ...valid, width: 23 }, { ...valid, height: 97 }, { ...valid, width: 24.5 }, { ...valid, width: '48' },
    { ...valid, theater: 'moon' }, { ...valid, cells: [] }, { ...valid, cells: 'land' },
    { ...valid, cells: valid.cells.map((cell, index) => index === 0 ? 'void' : cell) },
    { ...valid, cells: valid.cells.map((cell, index) => index === 0 ? '__proto__' : cell) },
    { ...valid, cells: valid.cells.map((cell, index) => index === 0 ? { terrain: 'land' } : cell) },
    { ...valid, spawns: null }, { ...valid, spawns: [valid.spawns[0]] }, { ...valid, spawns: Array(9).fill(valid.spawns[0]) },
    { ...valid, spawns: [null, valid.spawns[1]] },
    { ...valid, spawns: [{ x: '5', y: 5 }, valid.spawns[1]] },
    { ...valid, spawns: [{ x: 6.5, y: 6 }, valid.spawns[1]] },
    { ...valid, spawns: [{ x: 6, y: -1 }, valid.spawns[1]] },
    { ...valid, spawns: [{ x: 48, y: 5 }, valid.spawns[1]] },
    { ...valid, spawns: [{ x: 6, y: 6, script: 'alert(1)' }, valid.spawns[1]] },
    { ...valid, preview: 'https://example.invalid/tracker.png' },
    { ...valid, script: 'alert(1)' },
    JSON.parse(JSON.stringify(valid).replace('"format":', '"__proto__":{"polluted":true},"format":')),
  ];
  for (const value of invalidValues) {
    assert.ok(validateCustomMap(value).length > 0, JSON.stringify(value)?.slice(0, 100));
    assert.throws(() => parseCustomMap(JSON.stringify(value)));
  }
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
  assert.throws(() => parseCustomMap('not JSON'), /JSON/);
  assert.throws(() => parseCustomMap('{"version":1,'), /JSON/);
  assert.ok(validateCustomMap({ ...valid, cells: Array(valid.width * valid.height) }).some(error => error.includes('地块')));
  assert.throws(() => customMapToMapData({ ...valid, width: 1 }), /宽度/);
});

test('checks the UTF-8 byte limit before parsing', () => {
  assert.throws(() => parseCustomMap(' '.repeat(MAX_CUSTOM_MAP_BYTES + 1)), /2 MB/);
  const unicode = '雪'.repeat(Math.ceil(MAX_CUSTOM_MAP_BYTES / 3));
  assert.ok(unicode.length < MAX_CUSTOM_MAP_BYTES);
  assert.throws(() => parseCustomMap(unicode), /2 MB/);
});

test('validates clear, spaced deployment positions and safely restores unfinished drafts', () => {
  const doc = createCustomMap();
  doc.spawns[1] = { ...doc.spawns[0] };
  assert.ok(validateCustomMap(doc).some(error => error.includes('8 格')));
  doc.spawns[1].x += 7;
  assert.ok(validateCustomMap(doc).some(error => error.includes('8 格')));
  doc.spawns[1] = { x: 1, y: 6 };
  assert.ok(validateCustomMap(doc).some(error => error.includes('边缘')));
  const blocked = createCustomMap();
  const spawn = blocked.spawns[0];
  for (const terrain of ['water', 'cliff', 'ore', 'gem'] as const) {
    blocked.cells[(spawn.y + 2) * blocked.width + spawn.x] = terrain;
    assert.ok(validateCustomMap(blocked).some(error => error.includes('5×5')));
    assert.throws(() => serializeCustomMap(blocked), /5×5/);
    assert.throws(() => parseCustomMap(JSON.stringify(blocked)), /5×5/);
    assert.deepEqual(parseCustomMapDraft(JSON.stringify(blocked)), blocked);
  }
  assert.throws(() => parseCustomMapDraft(JSON.stringify({ ...blocked, cells: [] })), /地形数量/);
  assert.throws(() => parseCustomMapDraft(JSON.stringify({ ...blocked, spawns: [{ x: -1, y: 4 }, blocked.spawns[1]] })), /地图内/);
});

test('restores painted drafts with an empty name while strict publishing and play reject them', () => {
  for (const name of ['', '   ']) {
    const doc = createCustomMap();
    doc.name = name;
    doc.cells[0] = 'water';
    assert.deepEqual(parseCustomMapDraft(JSON.stringify(doc)), doc);
    assert.throws(() => parseCustomMap(JSON.stringify(doc)), /地图名称/);
    assert.throws(() => serializeCustomMap(doc), /地图名称/);
    assert.throws(() => customMapToMapData(doc), /地图名称/);
  }
  for (const name of [null, 12, 'x'.repeat(61), '\n', '\u0000'])
    assert.throws(() => parseCustomMapDraft(JSON.stringify({ ...createCustomMap(), name })), /地图名称/);
});

test('new templates support all sizes and 2–8 players with accessible nearby starting ore', () => {
  for (const [width, height] of [[24, 24], [32, 48], [48, 48], [24, 96], [96, 24], [96, 96]]) {
    for (const theater of ['temperate', 'snow', 'urban'] as const) for (let players = 2; players <= 8; players++) {
      const doc = createCustomMap(width, height, theater, players);
      assert.deepEqual(validateCustomMap(doc), [], `${width}×${height}, ${theater}, ${players} players`);
      assert.equal(doc.spawns.length, players);
      for (const spawn of doc.spawns) {
        assert.ok(doc.cells.some((terrain, index) => terrain === 'ore' && Math.hypot(index % width - spawn.x, Math.floor(index / width) - spawn.y) <= 10));
      }
    }
  }
  assert.throws(() => createCustomMap(23, 48), /24–96/);
  assert.throws(() => createCustomMap(48, 48, 'temperate', 9), /2–8/);
});

test('custom conversion keeps every rectangular cell playable and uses matching procedural terrain colors', () => {
  const doc = createCustomMap(24, 48);
  const map = customMapToMapData(doc);
  assert.equal(map.layout, 'rectangular');
  assert.equal(map.tiles.length, 24 * 48);
  assert.equal(map.official, false);
  assert.deepEqual(map.structures, []);
  assert.deepEqual(map.scenery, []);
  assert.deepEqual(map.ini, {});
  for (let index = 0; index < map.cells.length; index++) {
    assert.equal(map.valid[index], 1);
    assert.equal(map.tileIds[index], -1);
    assert.equal(map.tiles[index].tileId, -1);
    assert.equal(map.overlays[index], 255);
    assert.equal(map.radarColors[index], parseInt(TERRAIN_COLORS[map.cells[index]].slice(1), 16));
    assert.equal(isWithinPlayableArea(map, index % map.width, Math.floor(index / map.width)), true);
  }
  assert.equal(isWithinPlayableArea(map, -1, 0), false);
  assert.equal(isWithinPlayableArea(map, map.width, 0), false);
  assert.equal(isWithinPlayableArea(map, 0, map.height), false);
  assert.equal(isWithinPlayableArea(map, NaN, 0), false);
  assert.equal(isWithinPlayableArea({ ...map, layout: undefined }, 0, 0), false, 'original projected map behavior is unchanged');
  map.cells[0] = 'water';
  map.spawns[0].x += 1;
  assert.equal(doc.cells[0], 'land');
  assert.equal(doc.spawns[0].x, 3);
});

test('imported editor maps initialize the real skirmish engine, deploy every MCV, and seed resources', () => {
  for (const size of [24, 48]) for (let players = 2; players <= 8; players++) {
    const doc = parseCustomMap(serializeCustomMap(createCustomMap(size, size, 'temperate', players)));
    doc.cells[0] = 'gem';
    const map = customMapToMapData(doc);
    const game = new GameEngine({ map, players: doc.spawns.map((_, index) => ({
      id: index, name: `Player ${index + 1}`, country: index % 2 ? 'russia' : 'america', team: 0,
    })), startingUnits: 4, fogOfWar: false });
    const mcvs = game.entities.filter(entity => entity.type.endsWith('_mcv'));
    assert.equal(mcvs.length, players);
    assert.equal(game.deploy(mcvs.map(entity => entity.id)), players, `${size}×${size}, ${players} players`);
    assert.equal(game.entities.filter(entity => entity.type.endsWith('construction_yard')).length, players);
    assert.equal(game.ore[0], 8000);
    assert.equal(game.ore[doc.cells.findIndex(terrain => terrain === 'ore')], 5000);
    assert.equal(game.ore[doc.cells.findIndex(terrain => terrain === 'land')], 0);
    for (const entity of game.entities) {
      assert.ok(entity.x >= 0 && entity.x < size && entity.y >= 0 && entity.y < size);
    }
  }
});
