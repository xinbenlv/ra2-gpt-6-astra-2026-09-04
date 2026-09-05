import assert from 'node:assert/strict';
import test from 'node:test';
import { cacheLocalArchive, OriginalArchiveError, verifyOriginalArchive } from '../src/archive-input';
import { SOURCE_BYTES } from '../src/browser-storage';

test('an incomplete local installer is rejected before opening or changing browser storage', async t => {
  let opened = false;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'caches');
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: { open: async () => { opened = true; throw new Error('must not modify existing cache'); } } });
  t.after(() => { if (descriptor) Object.defineProperty(globalThis, 'caches', descriptor); else Reflect.deleteProperty(globalThis, 'caches'); });
  await assert.rejects(cacheLocalArchive(new Blob(['incomplete installer'])), error => error instanceof OriginalArchiveError && error.code === 'archive-size');
  assert.equal(opened, false);
});

test('reported size alone cannot pass validation; a different digest is rejected', async () => {
  // Keep the synthetic fixture tiny while exercising the real SHA-256 check.
  const file = new Blob(['synthetic content, not the installer']);
  Object.defineProperty(file, 'size', { value: SOURCE_BYTES });
  await assert.rejects(verifyOriginalArchive(file), error => error instanceof OriginalArchiveError && error.code === 'archive-hash');
});
