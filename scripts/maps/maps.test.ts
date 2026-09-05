import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decodeLzo1x, decodeLcw, parseIni, decodeMapPack } from '../../src/map-codecs.ts';
import { configureMapData, importMap, listMaps, terrainAt, isWithinPlayableArea } from '../../src/maps.ts';
import { configureLocalMapData, syntheticMapMetadata } from './test-map-data.ts';

const nativeSkip = configureLocalMapData();
if (nativeSkip) configureMapData(syntheticMapMetadata());

test('LZO decodes literal and overlapping dictionary instructions', () => {
  assert.deepEqual([...decodeLzo1x(Uint8Array.from([21,65,66,67,68,76,0,17,0,0]),7)], [...Buffer.from('ABCDABC')]);
  assert.deepEqual([...decodeLzo1x(Uint8Array.from([18,65,224,0,17,0,0]),9)], [...Buffer.from('AAAAAAAAA')]);
  assert.throws(()=>decodeLzo1x(Uint8Array.from([21,65]),4),/越界/);
  assert.throws(()=>decodeLzo1x(Uint8Array.from([18,65,64,255,17,0,0]),4),/回引用/);
});
test('LCW decodes literals, relative copies, and fills', () => {
  assert.deepEqual([...decodeLcw(Uint8Array.from([0x83,65,66,67,0x00,0x03,0xfe,4,0,90,0x80]),10)], [...Buffer.from('ABCABCZZZZ')]);
  assert.throws(()=>decodeLcw(Uint8Array.from([0xfe,255,255,1,0x80]),10),/越界/);
});
test('Every bundled original map has a complete terrain, overlays, and native preview', { skip: nativeSkip }, () => {
  const maps = listMaps(); assert.ok(maps.length >= 70);
  for(const definition of maps) {
    const map=importMap(fs.readFileSync(new URL('../../public/maps/'+definition.filename,import.meta.url),'utf8'),definition.filename,definition);
    assert.equal(map.tiles.length,(definition.width*2-1)*definition.height,definition.id);
    assert.ok(map.spawns.length>=2,definition.id);
    assert.equal(map.previewData?.rgb.length,definition.previewWidth*definition.previewHeight*3,definition.id);
    assert.equal(map.warnings.length,0,definition.id);
    for(const spawn of map.spawns) assert.ok(isWithinPlayableArea(map,spawn.x,spawn.y),definition.id+' spawn inside LocalSize');
  }
});
test('Actual Arctic Circle preserves 25,647 cells, eight spawns, water, bridges and original ore', { skip: nativeSkip }, () => {
  const definition=listMaps().find(map=>map.id==='mp22s8')!;
  const map=importMap(fs.readFileSync(new URL('../../public/maps/mp22s8.map',import.meta.url),'utf8'),definition.filename,definition);
  assert.equal(map.nameEn,'Arctic Circle'); assert.equal(map.tiles.length,25647); assert.equal(map.spawns.length,8);
  const count=(terrain:string)=>map.tiles.filter(tile=>tile.terrain===terrain).length;
  assert.equal(count('water'),7009); assert.equal(count('ore'),969); assert.equal(count('gem'),171); assert.ok(count('road')>100);
  for(const spawn of map.spawns) assert.ok(['snow','land','road','ore','gem'].includes(terrainAt(map,spawn.x,spawn.y)));
  assert.equal(terrainAt(map,-1,-1),'cliff');
  assert.equal(isWithinPlayableArea(map,154,0),false,'original buffer north of LocalSize is not playable');
  assert.equal(isWithinPlayableArea(map,118,118),true);
});
test('Malformed compressed blocks and unsupported expansion theaters fail clearly', () => {
  assert.throws(()=>decodeMapPack({'1':'AQAAIA=='},'lzo'),/大小/);
  assert.throws(()=>importMap('[Map]\nSize=0,0,80,80\nTheater=DESERT'),/不支持/);
  const ini=parseIni('[Map]\nSize=0,0,80,80 ; test\n[Waypoints]\n0=10010');assert.equal(ini.Map!.Size,'0,0,80,80');
});
