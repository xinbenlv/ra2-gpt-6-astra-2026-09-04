import { ARCHIVE_CACHE, SOURCE_BYTES, SOURCE_SHA256, SOURCE_URL, type ArchiveErrorCode } from './browser-storage';

export class OriginalArchiveError extends Error {
  constructor(public code: ArchiveErrorCode) {
    super(code === 'archive-size'
      ? 'Choose the complete Red-Alert-2-Multiplayer.exe from the linked Internet Archive item (206,530,229 bytes).'
      : 'This file does not match the expected installer. Download Red-Alert-2-Multiplayer.exe from the linked Internet Archive item and try again.');
    this.name = 'OriginalArchiveError';
  }
}

export async function verifyOriginalArchive(archive: Blob): Promise<void> {
  if (archive.size !== SOURCE_BYTES) throw new OriginalArchiveError('archive-size');
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await archive.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('');
  if (digest !== SOURCE_SHA256) throw new OriginalArchiveError('archive-hash');
}

/** A user-selected file never leaves this browser. Verify before replacing a saved installer. */
export async function cacheLocalArchive(file: Blob, onVerified?: () => void): Promise<Blob> {
  await verifyOriginalArchive(file);
  onVerified?.();
  const cache = await caches.open(ARCHIVE_CACHE);
  await cache.put(SOURCE_URL, new Response(file, { headers: { 'Content-Type': 'application/octet-stream' } }));
  return file;
}
