/** Real atlas usage and editor/battle pixel parity, using an already prepared local asset profile. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';

const context = await chromium.launchPersistentContext(process.env.RA2_EDITOR_PROFILE || '.cache/map-editor-browser', {
  headless: true, acceptDownloads: true, viewport: { width: 1600, height: 1050 }, deviceScaleFactor: 1,
});
const page = context.pages()[0] || await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
const url = process.env.RA2_BROWSER_URL || 'http://127.0.0.1:4174/';
const canvas = page.locator('[data-editor-canvas]');
const action = name => page.locator(`[data-action="${name}"]`);
const fixture = { format: 'ra2-web-map', version: 1, name: 'Native terrain comparison', width: 48, height: 48,
  theater: 'temperate', cells: Array(48 * 48).fill('land'), spawns: [{ x: 6, y: 6 }, { x: 41, y: 41 }] };
function paint(x0, y0, x1, y1, terrain) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) fixture.cells[y * 48 + x] = terrain;
}
paint(11, 10, 23, 37, 'water'); paint(26, 11, 26, 36, 'road');
paint(29, 17, 30, 20, 'cliff'); paint(29, 26, 32, 29, 'ore'); paint(30, 31, 32, 33, 'gem');

async function point(x, y) {
  return canvas.evaluate((el, { x, y }) => {
    const r = el.getBoundingClientRect(), d = el.dataset, z = Number(d.zoom);
    return { x: r.left + Number(d.cameraX) + (x - y + Number(d.originX) - Number(d.originY)) * 30 * z,
      y: r.top + Number(d.cameraY) + (x + y + Number(d.originX) + Number(d.originY)) * 15 * z };
  }, { x, y });
}
async function importEditor(doc) {
  await page.locator('[data-file]').setInputFiles({ name: 'native.ra2map', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await action('confirm').click();
}
async function nativeView() {
  await canvas.scrollIntoViewIfNeeded();
  for (let i = 0; i < 12; i++) {
    const z = Number(await canvas.getAttribute('data-zoom'));
    if (Math.abs(z - 1) < 1e-8) break;
    const r = await canvas.boundingBox(); await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await page.mouse.wheel(0, Math.max(-200, Math.min(200, Math.log(z) / .002)));
    await page.waitForFunction(before => Number(document.querySelector('[data-editor-canvas]').dataset.zoom) !== before, z);
  }
  const p = await point(24, 24), r = await canvas.boundingBox();
  await page.mouse.move(p.x, p.y); await page.mouse.down({ button: 'middle' });
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.up({ button: 'middle' });
  await page.locator('[data-grid]').uncheck(); await page.locator('[data-markers]').uncheck();
  await page.mouse.move(5, 5);
}

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('#open-map-editor').waitFor({ timeout: 90000 });
  await page.locator('[data-language-select]').selectOption('zh-CN');
  // Trace actual painter calls, not merely the number of colors in a screenshot.
  await page.evaluate(async () => {
    const definitions = await (await fetch('/maps/terrain.json')).json();
    const tileIndex = new Map(Object.entries(window.ra2.assets.terrain).map(([key, sprite]) =>
      [[new URL(sprite.src, location.href).href, sprite.x, sprite.y, sprite.width, sprite.height].join('|'), key]));
    window.nativeTrace = { tiles: [], overlays: [], fallbacks: 0 };
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function(source, ...args) {
      if (this.canvas.matches?.('[data-editor-canvas],#battlefield-canvas')) {
        const src = source instanceof HTMLImageElement ? source.src : '';
        const key = tileIndex.get([src, ...args.slice(0, 4)].join('|'));
        if (key) {
          const [theater, tileId] = key.split(':');
          window.nativeTrace.tiles.push({ key, file: definitions[theater][Number(tileId)].file });
          if (window.nativeTrace.tiles.length > 30000) window.nativeTrace.tiles.splice(0, 10000);
        } else if (src.includes('/assets/overlays/')) window.nativeTrace.overlays.push(src);
        else if (source instanceof HTMLCanvasElement && source.width === 60 && source.height === 30) window.nativeTrace.fallbacks++;
      }
      return drawImage.call(this, source, ...args);
    };
  });
  await page.locator('#open-map-editor').click(); await canvas.waitFor();
  for (const theater of ['snow', 'urban', 'temperate']) {
    await importEditor({ ...fixture, theater }); await nativeView();
    const proof = await page.evaluate(() => {
      const { tiles, overlays, fallbacks } = window.nativeTrace;
      return { fallbacks, shores: tiles.filter(t => t.file.startsWith('shore')).length,
        nativeTiles: tiles.length, overlays: overlays.length };
    });
    assert.equal(proof.fallbacks, 0); assert.ok(proof.nativeTiles > 0);
    assert.ok(proof.shores > 0); assert.ok(proof.overlays > 0);
    console.log('NATIVE_ATLAS_PASS', theater, proof);
    await page.screenshot({ animations: 'disabled', path: `.cache/editor-native-${theater}.png` });
    await page.evaluate(() => { window.nativeTrace = { tiles: [], overlays: [], fallbacks: 0 }; });
  }
  // Save actual pixels from the editor around shoreline, water, pavement, cliffs and ore.
  await canvas.evaluate(el => {
    const d = el.dataset, z = Number(d.zoom), cx = Number(d.cameraX), cy = Number(d.cameraY);
    const patches = [[22, 21], [24, 25], [26, 22], [29, 18], [30, 28], [31, 32]].map(([x, y]) => {
      const left = Math.round(cx + (x - y) * 30 * z) - 45, top = Math.round(cy + (x + y) * 15 * z) - 30;
      return { x: left, y: top, width: 90, height: 60, data: el.getContext('2d').getImageData(left, top, 90, 60).data };
    });
    window.editorPixels = { patches, zoom: z, cameraX: cx, cameraY: cy };
  });
  const [file] = await Promise.all([page.waitForEvent('download'), action('download').click()]);
  await file.saveAs('.cache/native-battlefield.ra2map');
  assert.deepEqual(JSON.parse(await fs.readFile('.cache/native-battlefield.ra2map', 'utf8')), fixture);
  await action('back').click(); await page.locator('#lobby-map-file').setInputFiles('.cache/native-battlefield.ra2map');
  await page.locator('#fog').uncheck(); await page.locator('#start').click();
  await page.locator('#battlefield-canvas').waitFor();
  const parity = await page.evaluate(() => {
    const { game, renderer } = window.ra2, before = window.editorPixels;
    game.paused = true; renderer.edgeScroll = false; renderer.mouse.inside = false; renderer.selection.clear();
    renderer.zoom = before.zoom;
    renderer.camera.x = (renderer.width / 2 - before.cameraX) / renderer.zoom;
    renderer.camera.y = (renderer.height / 2 - before.cameraY) / renderer.zoom;
    renderer.draw();
    const ctx = renderer.canvas.getContext('2d');
    return before.patches.map(p => {
      const now = ctx.getImageData(p.x, p.y, p.width, p.height).data;
      let mismatches = 0, maxDelta = 0;
      for (let i = 0; i < now.length; i++) { const delta = Math.abs(now[i] - p.data[i]); if (delta > 1) mismatches++; maxDelta = Math.max(maxDelta, delta); }
      return { x: p.x, y: p.y, mismatches, maxDelta };
    });
  });
  await page.screenshot({ animations: 'disabled', path: '.cache/battle-native-matched.png' });
  assert.ok(parity.every(p => p.mismatches === 0), `actual editor/battle pixels differ: ${JSON.stringify(parity)}`);
  assert.equal(await page.evaluate(() => window.nativeTrace.fallbacks), 0);
  assert.deepEqual(errors, []);
  console.log('PIXEL_PARITY_PASS', parity);
} catch (error) {
  console.error('PAGE_ERRORS', errors);
  await page.screenshot({ animations: 'disabled', path: '.cache/native-terrain-failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally { await context.close(); }
