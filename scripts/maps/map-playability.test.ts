import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { importMap, isWithinPlayableArea, listMaps, type MapData, type MapDefinition } from '../../src/maps.ts';
import { GameEngine } from '../../src/game/engine.ts';
import { findPath } from '../../src/game/pathfinding.ts';
import type { GameMap, GameOptions, Point, Terrain } from '../../src/game/types.ts';
import { configureLocalMapData } from './test-map-data.ts';

const nativeSkip = configureLocalMapData(true);
const scenery = (nativeSkip ? {} : JSON.parse(fs.readFileSync(new URL('../../public/assets/scenery/manifest-scenery.json', import.meta.url), 'utf8'))) as Record<string, { foundation: [number, number] }>;

function startOriginalGame(map: MapData, masked: GameMap): GameEngine {
  const neutralStructures: GameOptions['neutralStructures'] = map.structures.filter(s => isWithinPlayableArea(map, s.x, s.y)).map(s => {
    const foundation: [number, number] = scenery[`${map.theater}:${s.type.toLowerCase()}`]?.foundation ?? [1, 1];
    return { nativeType: s.type, x: s.x + foundation[0] / 2, y: s.y + foundation[1] / 2, health: s.health, foundation };
  });
  return new GameEngine({ map: masked, neutralStructures, players: map.spawns.map((_, index) => ({ id: index, name: `Spawn ${index + 1}`, country: index % 2 ? 'russia' : 'america', team: index + 1 })), startingUnits: 5, fogOfWar: true, seed: 1941 });
}

/** Four-neighbor components have the same connectivity as A* without diagonal corner cutting. */
function analyzeGround(map: GameMap) {
  const count = map.width * map.height, labels = new Int32Array(count).fill(-1);
  const queue = new Int32Array(count), components: { cells: number; resources: number }[] = [];
  const canWalk = (index: number) => index >= 0 && index < count && !['water', 'cliff', 'void'].includes(map.cells[index]!);
  const neighbors = (index: number): number[] => {
    const x = index % map.width, y = Math.floor(index / map.width);
    return [x > 0 ? index - 1 : -1, x < map.width - 1 ? index + 1 : -1, y > 0 ? index - map.width : -1, y < map.height - 1 ? index + map.width : -1];
  };
  for (let start = 0; start < count; start++) {
    if (!canWalk(start) || labels[start] !== -1) continue;
    const component = { cells: 0, resources: 0 }; let head = 0, tail = 1;
    queue[0] = start; labels[start] = components.length;
    while (head < tail) {
      const index = queue[head++]!; component.cells++;
      if (map.cells[index] === 'ore' || map.cells[index] === 'gem') component.resources++;
      for (const neighbor of neighbors(index)) {
        if (!canWalk(neighbor) || labels[neighbor] !== -1) continue;
        labels[neighbor] = components.length; queue[tail++] = neighbor;
      }
    }
    components.push(component);
  }
  // One flood from every actual resource cell finds the closest reachable ore for every spawn.
  const resourceDistance = new Int32Array(count).fill(-1), resourceTarget = new Int32Array(count).fill(-1);
  let head = 0, tail = 0;
  for (let i = 0; i < count; i++) if (map.cells[i] === 'ore' || map.cells[i] === 'gem') {
    queue[tail++] = i; resourceDistance[i] = 0; resourceTarget[i] = i;
  }
  while (head < tail) {
    const index = queue[head++]!;
    for (const neighbor of neighbors(index)) {
      if (!canWalk(neighbor) || resourceDistance[neighbor] !== -1) continue;
      resourceDistance[neighbor] = resourceDistance[index]! + 1;
      resourceTarget[neighbor] = resourceTarget[index]!; queue[tail++] = neighbor;
    }
  }
  return { labels, components, resourceDistance, resourceTarget, canWalk };
}

function legalBuildSite(engine: GameEngine, player: number, type: string, origin: Point): Point | undefined {
  for (let radius = 2; radius <= 12; radius++) for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
    const point = { x: origin.x + dx, y: origin.y + dy };
    if (engine.canPlace(player, type, point.x, point.y)) return point;
  }
  return undefined;
}

function loadOriginal(definition: MapDefinition) {
  const bytes = fs.readFileSync(new URL('../../public/maps/' + definition.filename, import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), definition.sha256, `${definition.id}: original map bytes must remain unchanged`);
  const map = importMap(bytes.toString('utf8'), definition.filename, definition);
  const cells: Terrain[] = map.cells.map((terrain, index) => map.valid[index] && isWithinPlayableArea(map, index % map.width, Math.floor(index / map.width)) ? terrain : 'void');
  const masked: GameMap = { ...map, cells };
  return { map, masked };
}

test('every ordinary original skirmish spawn can deploy and build using real LocalSize bounds', { skip: nativeSkip }, t => {
  const definitions = listMaps().filter(map => !map.specialMode);
  assert.equal(definitions.length, 79, 'all ordinary originals and official map packs are checked');
  let spawns = 0, maximumOffset = 0;
  for (const definition of definitions) {
    const { map, masked } = loadOriginal(definition);
    const engine = startOriginalGame(map, masked);
    for (const player of engine.players) {
      const label = `${definition.id} spawn ${player.id + 1}`;
      const mcv = engine.entities.find(entity => entity.owner === player.id && entity.type.includes('mcv'))!;
      assert.ok(mcv, `${label}: MCV exists`);
      maximumOffset = Math.max(maximumOffset, Math.hypot(mcv.x - map.spawns[player.id]!.x, mcv.y - map.spawns[player.id]!.y));
      assert.ok(isWithinPlayableArea(map, mcv.x, mcv.y), `${label}: MCV inside LocalSize`);
      assert.equal(engine.deploy([mcv.id]), 1, `${label}: ${engine.lastMessage}`);
      const power = player.faction === 'allied' ? 'power_plant' : 'tesla_reactor';
      const refinery = player.faction === 'allied' ? 'refinery' : 'soviet_refinery';
      assert.ok(legalBuildSite(engine, player.id, power, mcv), `${label}: power-plant footprint`);
      assert.ok(legalBuildSite(engine, player.id, refinery, mcv), `${label}: refinery footprint`);
      spawns++;
    }
  }
  assert.equal(spawns, 321);
  assert.ok(maximumOffset < 8, 'starting MCVs remain close to the actual native spawn coordinates');
  t.diagnostic(`${definitions.length} original maps, ${spawns} native starts deploy and have power/refinery build sites. Maximum start adjustment ${maximumOffset.toFixed(2)} cells.`);
});

test('all ordinary native starting islands have real reachable ore and a working A* route', { skip: nativeSkip }, t => {
  let starts = 0, farthest = 0, farthestLabel = '';
  for (const definition of listMaps().filter(map => !map.specialMode)) {
    const { map, masked } = loadOriginal(definition), ground = analyzeGround(masked);
    for (let spawn = 0; spawn < map.spawns.length; spawn++) {
      const point = map.spawns[spawn]!, index = Math.floor(point.y) * map.width + Math.floor(point.x);
      const label = `${definition.id} spawn ${spawn + 1}`;
      const component = ground.components[ground.labels[index]!];
      assert.ok(component && component.resources > 0, `${label}: actual starting land must reach native ore/gems`);
      const target = ground.resourceTarget[index]!, distance = ground.resourceDistance[index]!;
      assert.ok(target >= 0, `${label}: no reachable native resource`);
      const goal = { x: target % map.width + .5, y: Math.floor(target / map.width) + .5 };
      const path = findPath(map.width, map.height, point, goal, (x, y) => ground.canWalk(y * map.width + x));
      assert.ok(path.length || target === index, `${label}: A* could not reach the resource in its connected component`);
      if (path.length) assert.deepEqual(path.at(-1), goal, `${label}: path must finish on the original resource tile`);
      if (distance > farthest) { farthest = distance; farthestLabel = label; }
      starts++;
    }
  }
  assert.equal(starts, 321);
  assert.ok(farthest <= 50, 'each normal starting position has native resources within 50 cardinal cells');
  t.diagnostic(`All ${starts} starting land components reach native resources; farthest resource is ${farthest} cardinal cells from ${farthestLabel}. No resource cells were synthesized.`);
});

test('both original MegaWealth maps deploy and use reachable native oil derricks', { skip: nativeSkip }, t => {
  const definitions = listMaps().filter(map => map.specialMode === 'megawealth');
  assert.deepEqual(definitions.map(map => map.id).sort(), ['mp20mw', 'tn03mw']);
  let starts = 0;
  for (const definition of definitions) {
    assert.ok(definition.notes?.includes('油井'));
    const { map, masked } = loadOriginal(definition), ground = analyzeGround(masked);
    const expected = definition.id === 'tn03mw' ? { ore: 0, oil: 32 } : { ore: 7, oil: 36 };
    assert.equal(masked.cells.filter(terrain => terrain === 'ore' || terrain === 'gem').length, expected.ore);
    const oil = map.structures.filter(structure => structure.type === 'CAOILD');
    assert.equal(oil.length, expected.oil, `${definition.id}: exact original oil-derrick count`);
    const engine = startOriginalGame(map, masked);
    for (let i = 0; i < map.spawns.length; i++) {
      const spawn = map.spawns[i]!, component = ground.labels[spawn.y * map.width + spawn.x]!;
      const label = `${definition.id} spawn ${i + 1}`;
      assert.ok(oil.some(structure => {
        for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) {
          const x = structure.x + dx, y = structure.y + dy;
          if (x >= 0 && y >= 0 && x < map.width && y < map.height && ground.labels[y * map.width + x] === component) return true;
        }
        return false;
      }), `${label}: can reach an original oil-derrick footprint`);
      const player = engine.players[i]!, mcv = engine.entities.find(entity => entity.owner === i && entity.type.includes('mcv'))!;
      assert.ok(mcv, `${label}: MCV exists`);
      assert.equal(engine.deploy([mcv.id]), 1, `${label}: ${engine.lastMessage}`);
      assert.ok(legalBuildSite(engine, i, player.faction === 'allied' ? 'power_plant' : 'tesla_reactor', mcv), `${label}: power-plant footprint`);
      assert.ok(legalBuildSite(engine, i, player.faction === 'allied' ? 'barracks' : 'soviet_barracks', mcv), `${label}: barracks footprint for engineers`);
      starts++;
    }
  }
  assert.equal(starts, 14);
  t.diagnostic('Both MegaWealth maps deploy at all 14 starts, with 68 original oil derricks and no fabricated resources.');
});

test('unfinished archive variants remain preserved and explicitly annotated', { skip: nativeSkip }, () => {
  const prototypes = listMaps().filter(map => map.specialMode === 'unfinished');
  assert.deepEqual(prototypes.map(map => map.id).sort(), ['mp13s4mw', 'mp30s8']);
  for (const definition of prototypes) {
    const { map, masked } = loadOriginal(definition);
    assert.ok(definition.notes?.includes('不能直接开始遭遇战'));
    if (map.id === 'mp30s8') {
      assert.equal(masked.cells.filter(terrain => terrain === 'ore' || terrain === 'gem').length, 0);
      assert.equal(map.structures.filter(structure => structure.type === 'CAOILD').length, 0);
    } else {
      // This is genuinely how Westwood's unused file is stored: four starts in a four-cell cluster.
      assert.equal(Math.max(...map.spawns.map(p => p.x)) - Math.min(...map.spawns.map(p => p.x)), 4);
      assert.equal(Math.max(...map.spawns.map(p => p.y)) - Math.min(...map.spawns.map(p => p.y)), 4);
    }
  }
});
