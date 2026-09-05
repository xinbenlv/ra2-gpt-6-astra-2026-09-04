import assert from 'node:assert/strict';
import test from 'node:test';
import { appUrl, resolveOriginalUrls, scopedCache } from '../src/urls';

test('project Pages paths cover nested graphics, audio, maps and mask references', () => {
  const base = '/ra2-gpt-6-astra-2026-09-04/';
  assert.equal(appUrl('ra2-sw.js', base), base + 'ra2-sw.js');
  const source = { sprites: { tank: { src: '/assets/tank.png', remapMaskSrc: '/assets/mask.png' } }, sounds: ['/assets/sound.wav'], preview: '/maps/preview.png', source: 'https://archive.org/file', id: 'tank', count: 2 };
  assert.deepEqual(resolveOriginalUrls(source, base), { sprites: { tank: { src: base + 'assets/tank.png', remapMaskSrc: base + 'assets/mask.png' } }, sounds: [base + 'assets/sound.wav'], preview: base + 'maps/preview.png', source: source.source, id: 'tank', count: 2 });
  assert.deepEqual(resolveOriginalUrls(source, '/'), source);
  assert.equal(source.preview, '/maps/preview.png', 'portable metadata stays unchanged');
  assert.equal(scopedCache('originals', '/'), 'originals');
  assert.notEqual(scopedCache('originals', base), scopedCache('originals', '/another-project/'));
});
