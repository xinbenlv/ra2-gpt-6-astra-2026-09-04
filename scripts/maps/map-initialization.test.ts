import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { configureMapData, initializeMaps, importMap, listMaps } from '../../src/maps.ts';
import { syntheticMapMetadata } from './test-map-data.ts';

test('map module imports in a standalone checkout with no original asset directory', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ra2-map-import-'));
  try {
    fs.writeFileSync(path.join(directory, 'package.json'), '{"type":"module"}');
    for (const filename of ['maps.ts', 'map-codecs.ts'])
      fs.copyFileSync(new URL(`../../src/${filename}`, import.meta.url), path.join(directory, filename));
    const moduleUrl = pathToFileURL(path.join(directory, 'maps.ts')).href;
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      const maps = await import(${JSON.stringify(moduleUrl)});
      assert.throws(() => maps.listMaps(), /原版地图素材尚未加载/);
      assert.equal(maps.terrainAt({width:1,height:1,cells:['land']},0,0),'land');
    `], { cwd: new URL('../..', import.meta.url), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.ok(!fs.existsSync(path.join(directory, 'public')));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('missing and corrupt runtime metadata fail clearly, remain uninitialized, and can be retried', async t => {
  assert.throws(() => listMaps(), /原版地图素材尚未加载/);
  const metadata = syntheticMapMetadata();
  let phase: 'missing' | 'html' | 'invalid' | 'ready' = 'missing';
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    requests++;
    if (phase === 'missing') return new Response('', { status: 404 });
    if (phase === 'html') return new Response('<html>Vite fallback</html>');
    if (phase === 'invalid') return Response.json({});
    const key = String(input).match(/\/maps\/(catalog|terrain|overlays)\.json$/)?.[1] as keyof typeof metadata;
    assert.ok(key, `unexpected fetch ${String(input)}`);
    return Response.json(metadata[key]);
  });
  await assert.rejects(initializeMaps(), /catalog\.json.*HTTP 404/);
  assert.throws(() => listMaps(), /原版地图素材尚未加载/);
  phase = 'html';
  await assert.rejects(initializeMaps(), /无法加载原版地图素材.*catalog\.json/);
  phase = 'invalid';
  await assert.rejects(initializeMaps(), /catalog\.json 无效/);
  assert.throws(() => listMaps(), /原版地图素材尚未加载/);
  phase = 'ready'; requests = 0;
  await Promise.all([initializeMaps(), initializeMaps()]);
  assert.equal(requests, 3, 'concurrent initialization shares one metadata download');
  assert.equal(listMaps()[0]?.id, 'synthetic');
  await initializeMaps();
  assert.equal(requests, 3, 'initialized metadata is reused');
  assert.throws(() => configureMapData({ ...metadata, terrain: {} }), /terrain\.json 无效/);
  assert.throws(() => configureMapData({ ...metadata, overlays: [] }), /overlays\.json 无效/);
  assert.equal(listMaps()[0]?.id, 'synthetic', 'rejected updates preserve complete metadata');
  const map = importMap('[Map]\nSize=0,0,4,4\nTheater=TEMPERATE\n[Waypoints]\n0=1004\n1=7004');
  assert.equal(map.spawns.length, 2, 'custom map parsing works with externally supplied metadata');
});
