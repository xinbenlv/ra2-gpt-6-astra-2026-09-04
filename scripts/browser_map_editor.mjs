/** Real editor → download → another browser → skirmish acceptance.
 * Reuses an already prepared original-asset profile without changing that profile.
 * Run against the same origin used to prepare the source browser profile.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';

const sourceProfile = process.env.RA2_BROWSER_PROFILE || '.cache/browser-acceptance';
const authorProfile = '.cache/map-editor-browser';
const recipientProfile = '.cache/map-recipient-browser';
const url = process.env.RA2_BROWSER_URL || 'http://127.0.0.1:4174/';
for (const profile of [authorProfile, recipientProfile]) {
  try { await fs.access(profile); }
  catch { await fs.cp(sourceProfile, profile, { recursive: true }); }
}
const errors = [], archiveRequests = [];
async function open(profile) {
  const context = await chromium.launchPersistentContext(profile, {
    headless: true, acceptDownloads: true, viewport: { width: 1440, height: 1000 },
  });
  const page = context.pages()[0] || await context.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  page.on('request', request => { if (request.url().includes('archive.org')) archiveRequests.push(request.url()); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('#open-map-editor').waitFor({ timeout: 90000 });
  await page.locator('[data-language-select]').selectOption('zh-CN');
  return { context, page };
}

async function download(page) {
  const event = page.waitForEvent('download');
  await page.locator('[data-action="download"]').click();
  const file = await event;
  assert.ok(file.suggestedFilename().endsWith('.ra2map'));
  return JSON.parse(await fs.readFile(await file.path(), 'utf8'));
}

async function point(page, x, y, width = 48, height = 48) {
  const canvas = page.locator('[data-editor-canvas]');
  await canvas.scrollIntoViewIfNeeded();
  const rect = await canvas.boundingBox();
  return { x: rect.x + (x + .5) * rect.width / width, y: rect.y + (y + .5) * rect.height / height };
}
async function clickCell(page, x, y) {
  const position = await point(page, x, y);
  await page.mouse.click(position.x, position.y);
}

let author, recipient;
try {
  author = await open(authorProfile);
  await author.page.evaluate(() => localStorage.removeItem('ra2-map-editor-draft-v1'));
  await author.page.locator('#open-map-editor').click();
  await author.page.locator('[data-editor-canvas]').waitFor();
  await author.page.screenshot({ animations: 'disabled', path: '.cache/map-editor-desktop.png' });
  const page = author.page;
  await page.locator('[data-name]').fill('共享战场 A');
  const baseline = await download(page);
  await page.locator('[data-terrain="water"]').click();
  await page.locator('[data-brush="3"]').click();
  const start = await point(page, 20, 20), end = await point(page, 28, 20);
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 2 }); await page.mouse.up();
  const painted = await download(page);
  for (let y = 19; y <= 21; y++) for (let x = 19; x <= 29; x++)
    assert.equal(painted.cells[y * 48 + x], 'water', 'drag painting fills every intermediate cell');
  await page.locator('[data-action="undo"]').click();
  assert.deepEqual((await download(page)).cells, baseline.cells, 'one undo removes the entire stroke');
  await page.locator('[data-action="redo"]').click();
  assert.deepEqual((await download(page)).cells, painted.cells);
  await page.locator('[data-brush="1"]').click();
  await page.locator('[data-terrain="gem"]').click();
  await clickCell(page, 10, 24);
  await page.locator('[data-spawn="0"]').click();
  await clickCell(page, 8, 6);
  let shared = await download(page);
  assert.deepEqual(shared.spawns[0], { x: 8, y: 6 });
  assert.equal(shared.cells[24 * 48 + 10], 'gem');
  await clickCell(page, 20, 20);
  assert.ok(await page.locator('[data-action="download"]').isDisabled());
  assert.ok((await page.locator('[data-errors]').innerText()).includes('5×5'));
  await page.locator('[data-action="undo"]').click();
  assert.deepEqual(await download(page), shared);

  // Name edits can be incomplete while a draft still preserves every painted cell.
  await page.locator('[data-name]').fill('');
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#open-map-editor').waitFor({ timeout: 90000 });
  await page.locator('#open-map-editor').click();
  assert.equal(await page.locator('[data-name]').inputValue(), '');
  assert.ok(await page.locator('[data-action="use"]').isDisabled());
  await page.locator('[data-name]').fill('共享战场 A');
  assert.deepEqual(await download(page), shared, 'reload retains the map even with an incomplete name');

  await page.locator('.editor-template summary').click();
  await page.locator('[data-new-size]').selectOption('32');
  await page.locator('[data-new-theater]').selectOption('urban');
  await page.locator('[data-new-players]').selectOption('4');
  await page.locator('[data-action="new"]').click();
  await page.locator('[data-action="confirm"]').click();
  const fresh = await download(page);
  assert.equal(fresh.width, 32); assert.equal(fresh.theater, 'urban'); assert.equal(fresh.spawns.length, 4);
  await page.locator('[data-action="undo"]').click();
  assert.deepEqual(await download(page), shared, 'replacing a template remains reversible');

  const imported = { ...shared, name: '再次编辑的分享地图' };
  await page.locator('[data-file]').setInputFiles({ name: 'revision.ra2map', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
  await page.locator('[data-action="confirm"]').click();
  assert.deepEqual(await download(page), imported, 'editor opens a shared map for further editing');
  await page.locator('[data-action="undo"]').click();
  shared = await download(page);
  await fs.writeFile('.cache/shared-battlefield.ra2map', JSON.stringify(shared));
  await page.locator('[data-language-select]').selectOption('en');
  const untranslated = await page.locator('.map-editor').evaluate(root => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), values = []; let node;
    while ((node = walker.nextNode())) if (!node.parentElement.closest('[hidden],[data-language-control],[data-replacement]') && /[\u3400-\u9fff]/.test(node.nodeValue || '')) values.push(node.nodeValue);
    return values;
  });
  assert.deepEqual(untranslated, [], 'English editor controls are localized');
  await page.screenshot({ animations: 'disabled', path: '.cache/map-editor-en.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 390), 'mobile screen has no horizontal overflow');
  await page.screenshot({ animations: 'disabled', path: '.cache/map-editor-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('[data-action="use"]').click();
  assert.equal(await page.evaluate(() => window.ra2.map.name), shared.name);
  await page.evaluate(() => localStorage.setItem('ra2-map-editor-draft-v1', '{broken draft'));
  await page.locator('#open-map-editor').click();
  assert.ok((await page.locator('[data-draft-status]').innerText()).includes('could not be read'));
  assert.equal(await page.evaluate(() => localStorage.getItem('ra2-map-editor-draft-v1')), '{broken draft', 'opening does not overwrite an unreadable draft');
  await page.locator('[data-file]').setInputFiles('.cache/shared-battlefield.ra2map');
  await page.locator('[data-action="confirm"]').click();
  await page.locator('[data-action="back"]').click();
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('ra2-map-editor-draft-v1'))), shared, 'confirmed backup import restores working draft storage');
  await author.context.close(); author = undefined;
  console.log('AUTHOR_PASS painting, stroke undo/redo, spawn validation, draft reload, templates, editor import, mobile and English');

  recipient = await open(recipientProfile);
  const receiver = recipient.page;
  assert.notEqual(await receiver.evaluate(() => window.ra2.map.name), shared.name, 'recipient starts without the shared map');
  await receiver.locator('#lobby-map-file').setInputFiles('.cache/shared-battlefield.ra2map');
  await receiver.waitForFunction(name => window.ra2.map.name === name, shared.name);
  assert.deepEqual(await receiver.evaluate(() => window.ra2.map.cells), shared.cells);
  assert.deepEqual(await receiver.evaluate(() => window.ra2.map.spawns), shared.spawns);
  const selectedId = await receiver.evaluate(() => window.ra2.map.id);
  await receiver.locator('#lobby-map-file').setInputFiles({ name: 'broken.ra2map', mimeType: 'application/json', buffer: Buffer.from('{"version":999}') });
  await receiver.locator('.error-toast').filter({ hasText: '导入失败' }).waitFor();
  assert.equal(await receiver.evaluate(() => window.ra2.map.id), selectedId, 'invalid upload leaves selected map intact');
  await receiver.locator('#choose-map').click();
  await receiver.locator('#map-file').setInputFiles('.cache/shared-battlefield.ra2map');
  await receiver.locator('.modal-shade').waitFor({ state: 'detached' });
  assert.notEqual(await receiver.evaluate(() => window.ra2.map.id), selectedId, 'chooser upload also works and avoids overwrites');
  await receiver.locator('#fog').uncheck();
  await receiver.locator('#start').click();
  await receiver.locator('#battlefield-canvas').waitFor();
  await receiver.keyboard.press('d');
  await receiver.waitForFunction(() => window.ra2.game.entities.some(entity => entity.owner === 0 && entity.type.endsWith('construction_yard')));
  const battle = await receiver.evaluate(() => ({
    width: window.ra2.game.map.width, height: window.ra2.game.map.height,
    gem: window.ra2.game.ore[24 * 48 + 10], status: window.ra2.game.status,
    water: window.ra2.game.map.cells[20 * 48 + 24], voidCells: window.ra2.game.map.cells.filter(cell => cell === 'void').length,
  }));
  assert.deepEqual(battle, { width: 48, height: 48, gem: 8000, status: 'playing', water: 'water', voidCells: 0 });
  await receiver.screenshot({ animations: 'disabled', path: '.cache/map-editor-recipient-game.png' });
  console.log('RECIPIENT_PASS isolated browser imports both upload entries and deploys a base on the downloaded map');
  assert.deepEqual(errors, [], 'no browser runtime errors');
  assert.deepEqual(archiveRequests, [], 'cached originals need no new download');
  console.log('PASS map editor sharing acceptance');
} catch (error) {
  const failedPage = recipient?.page || author?.page;
  await failedPage?.screenshot({ animations: 'disabled', path: '.cache/map-editor-failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await author?.context.close();
  await recipient?.context.close();
}
