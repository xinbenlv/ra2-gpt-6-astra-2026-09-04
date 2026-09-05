/** Isometric editing acceptance. Uses an already prepared, isolated browser profile. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { chromium } from '@playwright/test';

const url = process.env.RA2_BROWSER_URL || 'http://127.0.0.1:4174/';
const context = await chromium.launchPersistentContext(process.env.RA2_EDITOR_PROFILE || '.cache/map-editor-browser', {
  headless: true, acceptDownloads: true, viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce',
});
const page = context.pages()[0] || await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
const canvas = page.locator('[data-editor-canvas]');
const action = name => page.locator(`[data-action="${name}"]`);
const draftKey = 'ra2-map-editor-draft-v1';

async function point(x, y) {
  return canvas.evaluate((el, { x, y }) => {
    const rect = el.getBoundingClientRect(), d = el.dataset, z = Number(d.zoom);
    const wx = x + Number(d.originX), wy = y + Number(d.originY);
    return { x: rect.left + Number(d.cameraX) + (wx - wy) * 30 * z,
      y: rect.top + Number(d.cameraY) + (wx + wy) * 15 * z };
  }, { x, y });
}
async function click(x, y) {
  const p = await point(x, y); await page.mouse.click(p.x, p.y);
}
async function download() {
  // Chromium suppresses bursts of repeated downloads; pace real file exports.
  await setTimeout(1100);
  const [file] = await Promise.all([page.waitForEvent('download'), action('download').click()]);
  return JSON.parse(await fs.readFile(await file.path(), 'utf8'));
}
async function stroke(from, to, button = 'left') {
  await page.mouse.move(from.x, from.y); await page.mouse.down({ button });
  await page.mouse.move(to.x, to.y, { steps: 5 }); await page.mouse.up({ button });
}
async function cropHandle(name) {
  return canvas.evaluate((el, name) => {
    const rect = el.getBoundingClientRect(), handle = JSON.parse(el.dataset.cropHandles).find(h => h.name === name);
    if (!handle) throw new Error(`Missing crop handle ${name}`);
    return { x: rect.left + handle.x, y: rect.top + handle.y };
  }, name);
}
async function savedWidth(width) {
  await page.waitForFunction(({ key, width }) => JSON.parse(localStorage.getItem(key) || '{}').width === width, { key: draftKey, width });
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), draftKey);
}
function samePoint(actual, expected, message) {
  assert.ok(Math.abs(actual.x - expected.x) < 1 && Math.abs(actual.y - expected.y) < 1, message);
}

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('#open-map-editor').waitFor({ timeout: 90000 });
  await page.locator('[data-language-select]').selectOption('zh-CN');
  await page.evaluate(key => localStorage.removeItem(key), draftKey);
  await page.locator('#open-map-editor').click();
  await canvas.waitFor();
  await page.locator('[data-name]').fill('等角扩缩验收');
  await page.locator('[data-auto-expand]').check();
  const original = await download();
  await page.locator('[data-terrain="water"]').click();
  await page.locator('[data-brush="9"]').click();
  await click(24, 24);
  const wideBrush = await download();
  assert.equal(wideBrush.cells.filter(c => c === 'water').length, 81, '9x9 brush paints 81 cells');
  for (let y = 20; y <= 28; y++) for (let x = 20; x <= 28; x++) assert.equal(wideBrush.cells[y * 48 + x], 'water');
  await page.locator('[data-grid]').uncheck(); await page.locator('[data-markers]').uncheck();
  await page.mouse.move(5, 5);
  const waterPoint = await point(24, 24);
  const colors = await canvas.evaluate((el, p) => {
    const r = el.getBoundingClientRect(), ratio = el.width / r.width;
    const z = Number(el.dataset.zoom), ctx = el.getContext('2d'), found = new Set();
    // Strictly inside a water tile: no grid, shoreline or hover overlay can supply variation.
    const halfW = Math.max(1, Math.floor(8 * z * ratio)), halfH = Math.max(1, Math.floor(4 * z * ratio));
    const data = ctx.getImageData(Math.floor((p.x - r.left) * ratio) - halfW,
      Math.floor((p.y - r.top) * ratio) - halfH, 2 * halfW, 2 * halfH).data;
    for (let i = 0; i < data.length; i += 4) found.add(`${data[i]},${data[i+1]},${data[i+2]}`);
    return found.size;
  }, waterPoint);
  assert.ok(colors > 1, 'water uses the textured battle painter instead of a solid blue fill');
  await page.screenshot({ animations: 'disabled', path: '.cache/editor-isometric-water.png' });
  await action('undo').click(); assert.deepEqual(await download(), original);
  await page.locator('[data-brush="1"]').click();

  // All four directions preserve existing world positions, and the complete stroke is reversible.
  for (const scenario of [
    { x: 52, y: 24, width: 53, height: 48, dx: 0, dy: 0 },
    { x: -3, y: 24, width: 51, height: 48, dx: 3, dy: 0 },
    { x: 24, y: -3, width: 48, height: 51, dx: 0, dy: 3 },
    { x: 24, y: 52, width: 48, height: 53, dx: 0, dy: 0 },
  ]) {
    const before = await point(6, 6);
    await click(scenario.x, scenario.y);
    const expanded = await download();
    assert.equal(expanded.width, scenario.width); assert.equal(expanded.height, scenario.height);
    assert.equal(expanded.cells[(scenario.y + scenario.dy) * expanded.width + scenario.x + scenario.dx], 'water');
    assert.deepEqual(expanded.spawns, original.spawns.map(p => ({ x: p.x + scenario.dx, y: p.y + scenario.dy })));
    samePoint(await point(6 + scenario.dx, 6 + scenario.dy), before, 'expansion must not move existing content');
    await action('undo').click(); assert.deepEqual(await download(), original);
    samePoint(await point(6, 6), before, 'undo also restores world origin');
    await action('redo').click(); assert.deepEqual(await download(), expanded);
    await action('undo').click();
  }
  // A wide brush crossing the edge expands to include the entire footprint.
  await page.locator('[data-brush="9"]').click();
  await click(-3, 24);
  const fullBrush = await download();
  assert.equal(fullBrush.width, 55); assert.equal(fullBrush.cells.filter(c => c === 'water').length, 81);
  await action('undo').click();
  await page.locator('[data-auto-expand]').uncheck();
  await click(0, 24);
  const clipped = await download();
  assert.equal(clipped.width, 48); assert.equal(clipped.cells.filter(c => c === 'water').length, 45);
  await action('undo').click(); await page.locator('[data-auto-expand]').check();
  console.log('BRUSH_EXPAND_PASS 9x9, four directions, stable world position, reversible strokes and expansion toggle');

  const p0 = await point(6, 6), panStart = await point(24, 24);
  await stroke(panStart, { x: panStart.x + 70, y: panStart.y - 40 }, 'middle');
  samePoint(await point(6, 6), { x: p0.x + 70, y: p0.y - 40 }, 'middle drag pans the camera');
  assert.deepEqual(await download(), original);
  await canvas.focus();
  await page.keyboard.down('Space');
  const spaceStart = await point(24, 24);
  await stroke(spaceStart, { x: spaceStart.x - 35, y: spaceStart.y + 20 });
  await page.keyboard.up('Space');
  assert.deepEqual(await download(), original, 'space drag does not paint');
  await action('zoom-in').click(); assert.deepEqual(await download(), original, 'zoom does not resize the map');
  await action('fit').click();

  // Keyboard input cannot split a pointer stroke or resurrect a canceled expansion from autosave.
  await page.locator('[data-brush="1"]').click();
  const strokeStart = await point(20, 20), strokeMid = await point(24, 20), strokeEnd = await point(28, 20);
  await page.mouse.move(strokeStart.x, strokeStart.y); await page.mouse.down();
  await page.mouse.move(strokeMid.x, strokeMid.y, { steps: 2 });
  await page.keyboard.press('Enter');
  await page.mouse.move(strokeEnd.x, strokeEnd.y, { steps: 2 }); await page.mouse.up();
  const withKeyboard = await download();
  for (let x = 20; x <= 28; x++) assert.equal(withKeyboard.cells[20 * 48 + x], 'water');
  await action('undo').click(); assert.deepEqual(await download(), original, 'Enter cannot split a held-pointer stroke');
  await page.locator('[data-name]').fill(original.name + ' ');
  await page.locator('[data-name]').fill(original.name);
  const canceledPoint = await point(-3, 24);
  await page.mouse.move(canceledPoint.x, canceledPoint.y); await page.mouse.down();
  assert.equal(await canvas.getAttribute('data-map-width'), '51');
  await setTimeout(400); // Let the earlier name edit's autosave fire during the open stroke.
  await page.keyboard.press('Escape'); await page.mouse.up();
  assert.equal(await canvas.getAttribute('data-map-width'), '48');
  await page.waitForFunction(({ key, expected }) => localStorage.getItem(key) === expected,
    { key: draftKey, expected: JSON.stringify(original) });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#open-map-editor').waitFor({ timeout: 90000 });
  await page.locator('#open-map-editor').click(); await canvas.waitFor();
  assert.deepEqual(await download(), original, 'Escape restores both visible map and persisted draft');
  console.log('KEYBOARD_PASS Enter preserves stroke history; Escape rolls back expansion and autosave');

  // Crop previews do not change the map until release. The removed start remains a recoverable slot.
  await action('crop').click();
  const right = await cropHandle('e'), edge40 = await point(39.5, 23.5);
  await page.mouse.move(right.x, right.y); await page.mouse.down();
  await page.mouse.move(edge40.x, edge40.y, { steps: 5 });
  assert.equal(await canvas.getAttribute('data-map-width'), '48');
  await page.screenshot({ animations: 'disabled', path: '.cache/editor-crop-preview.png' });
  await page.mouse.up();
  const cropped = await savedWidth(40);
  assert.equal(cropped.height, 48); assert.deepEqual(cropped.spawns[1], { x: -1, y: -1 });
  assert.ok(await action('download').isDisabled());
  for (let y = 0; y < 48; y++) assert.deepEqual(cropped.cells.slice(y * 40, (y + 1) * 40), original.cells.slice(y * 48, y * 48 + 40));
  await action('undo').click(); assert.deepEqual(await download(), original);
  await action('redo').click(); assert.equal((await savedWidth(40)).width, 40);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#open-map-editor').waitFor({ timeout: 90000 });
  await page.locator('#open-map-editor').click();
  assert.equal(await canvas.getAttribute('data-map-width'), '40');
  assert.ok(await action('use').isDisabled(), 'a cropped unplaced start survives draft reload');
  await page.locator('[data-spawn="1"]').click(); await click(30, 40);
  const repaired = await download(); assert.equal(repaired.width, 40);
  assert.deepEqual(repaired.spawns[1], { x: 30, y: 40 });
  await fs.writeFile('.cache/resized-battlefield.ra2map', JSON.stringify(repaired));
  console.log('CROP_PASS drag preview, exact cropped cells, missing-start validation, undo/redo, draft recovery and re-placement');

  // Hitting the cap rejects the whole expansion without damaging the existing draft.
  const maxMap = { ...original, width: 96, height: 96, cells: Array(96 * 96).fill('land'), spawns: [{ x: 6, y: 6 }, { x: 89, y: 89 }] };
  await page.locator('[data-file]').setInputFiles({ name: 'max.ra2map', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(maxMap)) });
  await action('confirm').click();
  await page.locator('[data-terrain="water"]').click(); await page.locator('[data-brush="1"]').click();
  await click(97, 48);
  assert.deepEqual(await download(), maxMap, 'over-limit expansion leaves the map unchanged');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 390));
  await page.screenshot({ animations: 'disabled', path: '.cache/editor-isometric-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await action('back').click();
  await page.locator('#lobby-map-file').setInputFiles('.cache/resized-battlefield.ra2map');
  await page.waitForFunction(() => window.ra2.map.width === 40);
  await page.locator('#start').click(); await page.locator('#battlefield-canvas').waitFor();
  await page.keyboard.press('d');
  await page.waitForFunction(() => window.ra2.game.entities.some(e => e.owner === 0 && e.type.endsWith('construction_yard')));
  assert.deepEqual(await page.evaluate(() => [window.ra2.game.map.width, window.ra2.game.map.height]), [40, 48]);
  assert.deepEqual(errors, []);
  console.log('PASS isometric map editing, resize limits, mobile canvas and resized-file skirmish deployment');
} catch (error) {
  console.error('PAGE_ERRORS', errors, 'VALIDATION', await page.locator('[data-errors]').textContent().catch(() => 'none'));
  await page.screenshot({ animations: 'disabled', path: '.cache/editor-resize-failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally { await context.close(); }
