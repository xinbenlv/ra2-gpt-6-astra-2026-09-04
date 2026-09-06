/** Mobile touch acceptance against an already prepared, isolated original-asset profile.
 * RA2_BROWSER_URL and RA2_EDITOR_PROFILE override the origin/profile. Original caches
 * remain intact, and the profile's previous editor draft is restored after the run.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { chromium } from '@playwright/test';

const url = process.env.RA2_BROWSER_URL || 'http://127.0.0.1:4174/';
const draftKey = 'ra2-map-editor-draft-v1';
const fixture = {
  format: 'ra2-web-map', version: 1, name: 'Mobile touch acceptance',
  width: 48, height: 48, theater: 'temperate', cells: Array(48 * 48).fill('land'),
  spawns: [{ x: 6, y: 6 }, { x: 41, y: 41 }],
};
for (let y = 11; y <= 15; y++) for (let x = 11; x <= 15; x++) fixture.cells[y * 48 + x] = 'water';
await fs.mkdir('.cache', { recursive: true });
const context = await chromium.launchPersistentContext(process.env.RA2_EDITOR_PROFILE || '.cache/map-recipient-browser', {
  headless: true, acceptDownloads: true, viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1, hasTouch: true, isMobile: true, reducedMotion: 'reduce',
});
const page = context.pages()[0] || await context.newPage();
page.setDefaultTimeout(12000);
const cdp = await context.newCDPSession(page);
const errors = [], archiveRequests = [];
page.on('pageerror', error => errors.push(String(error)));
page.on('request', request => { if (request.url().includes('archive.org')) archiveRequests.push(request.url()); });
const canvas = page.locator('[data-editor-canvas]');
const action = name => page.locator(`[data-action="${name}"]`);
let previousDraft, draftCaptured = false;

async function surface() {
  await canvas.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  return canvas.boundingBox();
}
async function view() {
  return canvas.evaluate(el => {
    const d = el.dataset;
    return Object.fromEntries(['zoom', 'cameraX', 'cameraY', 'originX', 'originY', 'mapWidth', 'mapHeight']
      .map(key => [key, Number(d[key])]));
  });
}
async function point(x, y) {
  await surface();
  return canvas.evaluate((el, { x, y }) => {
    const r = el.getBoundingClientRect(), d = el.dataset, z = Number(d.zoom);
    const wx = x + Number(d.originX), wy = y + Number(d.originY);
    return { x: r.left + Number(d.cameraX) + (wx - wy) * 30 * z,
      y: r.top + Number(d.cameraY) + (wx + wy) * 15 * z };
  }, { x, y });
}
const touchPoint = (id, p) => ({ id, x: p.x, y: p.y, radiusX: 2, radiusY: 2, force: 1 });
async function touch(type, points) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([id, p]) => touchPoint(id, p)) });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
}
async function tap(p) {
  await touch('touchStart', [[1, p]]);
  await touch('touchEnd', []);
}
async function movePair(from, to) {
  for (let step = 1; step <= 4; step++) {
    await touch('touchMove', to.map((p, i) => [i + 1, {
      x: from[i].x + (p.x - from[i].x) * step / 4,
      y: from[i].y + (p.y - from[i].y) * step / 4,
    }]));
  }
}
async function saved(expected) {
  await page.waitForFunction(({ key, expected }) => localStorage.getItem(key) === JSON.stringify(expected),
    { key: draftKey, expected });
}
async function historyState() {
  return { undo: await action('undo').isEnabled(), redo: await action('redo').isEnabled() };
}
async function download() {
  await setTimeout(1100); // Chromium throttles consecutive file downloads.
  const [file] = await Promise.all([page.waitForEvent('download'), action('download').click()]);
  assert.ok(file.suggestedFilename().endsWith('.ra2map'));
  return JSON.parse(await fs.readFile(await file.path(), 'utf8'));
}
async function unchanged(expectedHistory, label) {
  assert.deepEqual(await download(), fixture, `${label}: exported terrain, dimensions and starts`);
  await saved(fixture);
  assert.deepEqual(await historyState(), expectedHistory, `${label}: undo and redo history`);
  const state = await view();
  assert.deepEqual([state.originX, state.originY, state.mapWidth, state.mapHeight], [0, 0, 48, 48], `${label}: map bounds`);
}
function near(actual, expected, label, tolerance = 1.5) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}
async function fit() { await action('fit').click(); await surface(); }

try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('#open-map-editor').waitFor({ timeout: 90000 });
  previousDraft = await page.evaluate(key => localStorage.getItem(key), draftKey);
  draftCaptured = true;
  await page.evaluate(({ key, fixture }) => localStorage.setItem(key, JSON.stringify(fixture)), { key: draftKey, fixture });
  await page.locator('#open-map-editor').click();
  await canvas.waitFor();
  await page.evaluate(() => {
    window.touchAcceptanceEvents = [];
    const el = document.querySelector('[data-editor-canvas]');
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
      el.addEventListener(type, event => window.touchAcceptanceEvents.push({
        type, trusted: event.isTrusted, pointerType: event.pointerType, id: event.pointerId,
      }));
    }
  });
  assert.deepEqual(await download(), fixture);
  await page.locator('[data-terrain="water"]').click();
  await page.locator('[data-brush="1"]').click();
  await page.locator('[data-auto-expand]').check();
  await fit();

  // Leave a real redo entry: navigation must preserve history, including the redo branch.
  await tap(await point(20, 20));
  const painted = structuredClone(fixture); painted.cells[20 * 48 + 20] = 'water';
  await saved(painted);
  await action('undo').click(); await saved(fixture);
  const baselineHistory = { undo: false, redo: true };
  assert.deepEqual(await historyState(), baselineHistory);

  await fit();
  const initial = await view(), center = await point(24, 24);
  const pair = [{ x: center.x - 60, y: center.y }, { x: center.x + 60, y: center.y }];
  await touch('touchStart', [[1, { ...pair[0], y: pair[0].y - 8 }]]);
  await touch('touchMove', [[1, pair[0]]]); // A real tentative paint precedes the second finger.
  await touch('touchStart', [[1, pair[0]], [2, pair[1]]]);
  const inward = pair.map((p, i) => ({ x: center.x + (i ? 34 : -34), y: p.y }));
  await movePair(pair, inward);
  const small = await view();
  assert.ok(small.zoom < initial.zoom * .85, 'bringing fingers together zooms out');
  const outward = pair.map((p, i) => ({ x: center.x + (i ? 88 : -88), y: p.y }));
  await movePair(inward, outward);
  const large = await view();
  assert.ok(large.zoom > initial.zoom * 1.35, 'spreading fingers zooms in');
  const rect = await canvas.boundingBox();
  near((center.x - rect.x - large.cameraX) / large.zoom,
    (center.x - rect.x - initial.cameraX) / initial.zoom, 'pinch anchors world x');
  near((center.y - rect.y - large.cameraY) / large.zoom,
    (center.y - rect.y - initial.cameraY) / initial.zoom, 'pinch anchors world y');
  const panned = outward.map(p => ({ x: p.x + 16, y: p.y + 24 }));
  await movePair(outward, panned);
  const pan = await view();
  near(pan.zoom, large.zoom, 'two-finger pan retains zoom', .0001);
  near(pan.cameraX, large.cameraX + 16, 'two-finger horizontal pan');
  near(pan.cameraY, large.cameraY + 24, 'two-finger vertical pan');
  await touch('touchEnd', [[1, panned[0]]]);
  await touch('touchMove', [[1, { x: panned[0].x + 25, y: panned[0].y - 17 }]]);
  const remaining = await view();
  near(remaining.cameraX, pan.cameraX, 'remaining finger does not pan');
  near(remaining.cameraY, pan.cameraY, 'remaining finger does not pan');
  await touch('touchEnd', []);
  await unchanged(baselineHistory, 'pinch, pan and remaining finger');
  console.log('PINCH_PAN_PASS', { initial: initial.zoom, zoomOut: small.zoom, zoomIn: large.zoom });

  // A second finger must roll back an already-visible automatic map expansion.
  await fit();
  // Queue the real debounced autosave without changing the final name or history.
  await page.locator('[data-name]').fill(fixture.name + ' ');
  await page.locator('[data-name]').fill(fixture.name);
  const edge = await point(-2, 24), other = { x: edge.x + 85, y: edge.y + 10 };
  await touch('touchStart', [[1, edge]]);
  assert.equal((await view()).mapWidth, 50, 'first finger genuinely expands the map before pinch begins');
  await setTimeout(350);
  assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), draftKey), fixture,
    'tentative touch expansion must not replace the durable draft');
  await touch('touchStart', [[1, edge], [2, other]]);
  assert.equal((await view()).mapWidth, 48, 'second finger restores pre-touch bounds immediately');
  const shifted = [edge, other].map(p => ({ x: p.x + 12, y: p.y + 9 }));
  await movePair([edge, other], shifted);
  await touch('touchEnd', [[1, shifted[0]]]);
  await touch('touchMove', [[1, { x: shifted[0].x - 14, y: shifted[0].y - 8 }]]);
  await touch('touchEnd', []);
  await unchanged(baselineHistory, 'expansion rollback');
  console.log('EXPANSION_ROLLBACK_PASS');

  // A crop preview is also provisional when a second finger turns it into navigation.
  await fit(); await action('crop').click(); await surface();
  const handle = await canvas.evaluate(el => {
    const r = el.getBoundingClientRect(), p = JSON.parse(el.dataset.cropHandles).find(p => p.name === 'e');
    return { x: r.x + p.x, y: r.y + p.y };
  });
  const cropTarget = await point(39.5, 23.5);
  await touch('touchStart', [[1, handle]]);
  await touch('touchMove', [[1, cropTarget]]);
  const preview = await canvas.evaluate(el => JSON.parse(el.dataset.cropHandles).find(p => p.name === 'e'));
  assert.ok(Math.abs(preview.x + (await canvas.boundingBox()).x - handle.x) > 10, 'real touch moves the crop handle');
  await touch('touchStart', [[1, cropTarget], [2, { x: cropTarget.x - 70, y: cropTarget.y }]]);
  await touch('touchEnd', []);
  await unchanged(baselineHistory, 'crop preview interrupted by pinch');
  await action('crop').click();

  await fit();
  await touch('touchStart', [[1, await point(-2, 24)]]);
  assert.equal((await view()).mapWidth, 50);
  await touch('touchCancel', []);
  await unchanged(baselineHistory, 'canceled touch');
  console.log('CROP_CANCEL_PASS');

  // All fingers have lifted: a fresh single touch paints normally and is one undo step.
  await fit(); await tap(await point(20, 20)); await saved(painted);
  assert.deepEqual(await download(), painted, 'normal painting resumes after canceled navigation');
  assert.deepEqual(await historyState(), { undo: true, redo: false });
  await action('undo').click(); await unchanged(baselineHistory, 'one undo restores the fresh stroke');
  await action('redo').click(); await saved(painted);
  const events = await page.evaluate(() => window.touchAcceptanceEvents);
  assert.ok(events.filter(event => event.type === 'pointerdown').length >= 9, 'CDP delivers real multi-touch pointer streams');
  assert.ok(events.every(event => event.trusted && event.pointerType === 'touch'), 'gesture events are trusted browser touch input');
  assert.ok(events.some(event => event.type === 'pointercancel'), 'browser dispatches actual touch cancellation');
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#open-map-editor').waitFor({ timeout: 90000 });
  await page.locator('#open-map-editor').click(); await canvas.waitFor();
  assert.deepEqual(await download(), painted, 'reload restores only committed edits');

  await fit();
  const beforeButton = await view();
  await action('zoom-in').click();
  assert.ok((await view()).zoom > beforeButton.zoom, 'mobile zoom-in button works');
  await action('zoom-out').click();
  near((await view()).zoom, beforeButton.zoom, 'mobile zoom-out reverses zoom-in', .0001);
  for (const name of ['zoom-out', 'fit', 'zoom-in']) {
    const box = await action(name).boundingBox();
    assert.ok(box.width >= 44 && box.height >= 44, `${name} has a 44px touch target`);
  }
  assert.equal((await page.locator('[data-zoom-level]').innerText()).trim(), `${Math.round((await view()).zoom * 100)}%`);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 390), '390px editor has no horizontal page overflow');
  await surface();
  await page.screenshot({ animations: 'disabled', path: '.cache/editor-touch-zoom-mobile.png' });
  assert.deepEqual(errors, [], 'no browser runtime errors');
  assert.deepEqual(archiveRequests, [], 'prepared originals never need a new archive download');
  console.log('PASS mobile touch zoom, pan, rollback, crop, cancel, history, persistence and 44px controls', { trustedTouchEvents: events.length });
} catch (error) {
  console.error('PAGE_ERRORS', errors);
  await page.screenshot({ animations: 'disabled', path: '.cache/editor-touch-zoom-failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await touch('touchCancel', []).catch(() => {});
  if (draftCaptured) {
    if (await action('back').count()) await action('back').click().catch(() => {});
    await page.evaluate(({ key, value }) => {
      if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
    }, { key: draftKey, value: previousDraft }).catch(() => {});
  }
  await context.close();
}
