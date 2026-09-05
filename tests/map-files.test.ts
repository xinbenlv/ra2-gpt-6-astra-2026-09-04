import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createCustomMap, MAX_CUSTOM_MAP_BYTES, serializeCustomMap } from '../src/custom-maps';
import { GameEngine } from '../src/game/engine';
import { readSkirmishMap } from '../src/map-files';
import { configureMapData, isWithinPlayableArea, listMaps, loadMap, registerImportedMap } from '../src/maps';
import { syntheticMapMetadata } from '../scripts/maps/test-map-data';

function file(name: string, content: string): Pick<File, 'name' | 'size' | 'text'> {
  return { name, size: Buffer.byteLength(content), text: async () => content };
}

beforeEach(() => configureMapData(syntheticMapMetadata()));

test('a shared editor download imports into a skirmish with deployable bases and harvestable resources', async () => {
  const document = createCustomMap(48, 32, 'snow', 2);
  document.name = '雪原分享战场';
  document.cells[24 * document.width + 24] = 'gem';
  const downloaded = serializeCustomMap(document);
  const map = await readSkirmishMap(file('雪原分享战场.ra2map', downloaded));

  assert.equal(map.name, document.name);
  assert.equal(map.theater, 'snow');
  assert.deepEqual(map.spawns, document.spawns);
  assert.deepEqual(map.cells, document.cells);
  assert.equal(listMaps().length, 1, 'reading a file does not publish it to the lobby');
  const entry = registerImportedMap(map);
  const loaded = await loadMap(entry.id);
  assert.equal(entry.width, 48);
  assert.equal(entry.height, 32);
  assert.equal(entry.players, 2);
  assert.equal(entry.official, false);

  // Starting a battle clips native maps; every corner of an editor map must survive that step.
  for (const [x, y] of [[0, 0], [47, 0], [0, 31], [47, 31]])
    assert.equal(isWithinPlayableArea(loaded, x, y), true);
  const game = new GameEngine({ map: loaded, startingUnits: 0, fogOfWar: false, players: [
    { id: 0, name: 'Author', country: 'america', team: 1 },
    { id: 1, name: 'Recipient', country: 'russia', team: 2 },
  ] });
  assert.equal(game.entities.filter(entity => entity.type.endsWith('_mcv')).length, 2);
  assert.equal(game.deploy(game.entities.map(entity => entity.id)), 2, 'both uploaded start positions allow base deployment');
  assert.ok(game.canBuild(0, 'power_plant'));
  assert.ok(game.canBuild(1, 'tesla_reactor'));
  assert.ok(game.ore.some((quantity, index) => quantity > 0 && loaded.cells[index] === 'ore'));
  assert.equal(game.ore[24 * loaded.width + 24], 8000);
  game.step(.1);
  assert.equal(game.status, 'playing');
});

test('separate uploads retain distinct lobby entries and never replace the original catalog map', async t => {
  const original = structuredClone(listMaps()[0]);
  const content = serializeCustomMap(createCustomMap());
  const first = await readSkirmishMap(file('synthetic.ra2map', content));
  const second = await readSkirmishMap(file('synthetic.ra2map', content));
  const firstEntry = registerImportedMap(first);
  const secondEntry = registerImportedMap(second);

  assert.notEqual(firstEntry.id, secondEntry.id);
  assert.equal(listMaps().length, 3);
  assert.deepEqual(listMaps()[0], original);
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('uploaded maps must load from this session'); });
  assert.equal(await loadMap(firstEntry.id), first);
  assert.equal(await loadMap(secondEntry.id), second);
  second.cells[0] = 'water';
  second.spawns[0].x++;
  assert.equal((await loadMap(firstEntry.id)).cells[0], 'land');
  assert.notDeepEqual(first.spawns[0], second.spawns[0]);
});

test('renamed JSON downloads and UTF-8 BOMs are detected independently of the filename', async () => {
  const document = createCustomMap(32, 40, 'urban', 3);
  const content = serializeCustomMap(document);
  for (const name of ['shared.json', 'renamed.map', 'renamed.mpr', 'no-extension', 'SHARED.RA2MAP']) {
    const map = await readSkirmishMap(file(name, `\uFEFF \n${content}`));
    assert.equal(map.layout, 'rectangular', name);
    assert.deepEqual(map.cells, document.cells, name);
    assert.deepEqual(map.spawns, document.spawns, name);
  }
  assert.equal(listMaps().length, 1);
});

test('oversized custom and original files are rejected before file contents are read', async () => {
  for (const [name, size, message] of [
    ['shared.ra2map', MAX_CUSTOM_MAP_BYTES + 1, /2 MB/],
    ['SHARED.RA2MAP', MAX_CUSTOM_MAP_BYTES + 1, /2 MB/],
    ['native.map', 16 * 1024 * 1024 + 1, /16 MB/],
  ] as const) {
    let reads = 0;
    await assert.rejects(readSkirmishMap({ name, size, text: async () => { reads++; return ''; } }), message);
    assert.equal(reads, 0, name);
  }
  assert.equal(listMaps().length, 1);
});

test('failed uploads preserve the existing catalog and previously shared maps', async () => {
  const document = createCustomMap();
  const existing = await readSkirmishMap(file('existing.ra2map', serializeCustomMap(document)));
  const entry = registerImportedMap(existing);
  const catalog = structuredClone(listMaps());
  const inaccessible = structuredClone(document);
  const spawn = inaccessible.spawns[0];
  inaccessible.cells[spawn.y * inaccessible.width + spawn.x] = 'water';
  const invalid: [string, RegExp][] = [
    ['{"format":', /JSON/],
    [JSON.stringify({ ...document, version: 999 }), /版本/],
    [JSON.stringify(inaccessible), /起点.*5×5/],
  ];
  for (const [content, message] of invalid) {
    await assert.rejects(readSkirmishMap(file('broken.ra2map', content)), message);
    assert.deepEqual(listMaps(), catalog);
    assert.equal(await loadMap(entry.id), existing);
  }
});

test('renaming an oversized JSON map does not bypass the custom document size limit', async () => {
  const content = serializeCustomMap(createCustomMap()).padEnd(MAX_CUSTOM_MAP_BYTES + 1, ' ');
  await assert.rejects(readSkirmishMap(file('renamed.map', content)), /2 MB/);
  assert.equal(listMaps().length, 1);
});

test('original .map and .mpr uploads still use native geometry and waypoint parsing', async () => {
  const native = '[Map]\nSize=0,0,4,4\nTheater=TEMPERATE\n[Basic]\nName=Native fixture\n[Waypoints]\n0=1004\n1=7004';
  for (const name of ['native.map', 'native.mpr']) {
    const map = await readSkirmishMap(file(name, native));
    assert.equal(map.name, 'Native fixture');
    assert.deepEqual(map.originalSize, [0, 0, 4, 4]);
    assert.equal(map.width, 7);
    assert.deepEqual(map.spawns, [{ x: 3, y: 0 }, { x: 3, y: 6 }]);
    assert.equal(map.valid[0], 0, 'original maps retain their diamond-shaped bounds');
    assert.notEqual(map.layout, 'rectangular');
  }
  assert.equal(listMaps().length, 1);
});
