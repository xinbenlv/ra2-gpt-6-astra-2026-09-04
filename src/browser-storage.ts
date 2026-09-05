/** Original data is only ever written to this browser's origin-private storage. */
export const ORIGINAL_CACHE = 'ra2-originals-v2';
export const ARCHIVE_CACHE = 'ra2-download-v1';
export const ORIGINAL_VERSION = 2;
export const SOURCE_URL = 'https://archive.org/download/red-alert-2-multiplayer/Red-Alert-2-Multiplayer.exe';
export const SOURCE_SHA256 = '5388c54d7d7b73060083563ff1926bca0d2663a76678b807e23e9a8d491441ce';
export const READY_URL = '/assets/ready.json';
export interface BrowserReady { version:number; sourceSha256:string; files:string[]; installedAt:string }
export interface SetupProgress { type:'progress'|'complete'|'error'; stage:string; percent?:number; message?:string }

export async function originalsReady(): Promise<boolean> {
  if (!('caches' in globalThis)) return false;
  const cache = await caches.open(ORIGINAL_CACHE);
  try {
    const marker = await cache.match(READY_URL);
    if (!marker) return false;
    const ready = await marker.json() as BrowserReady;
    if (ready.version !== ORIGINAL_VERSION || ready.sourceSha256 !== SOURCE_SHA256 || !Array.isArray(ready.files) || ready.files.length < 3000) return false;
    const paths = new Set((await cache.keys()).map(request => new URL(request.url).pathname));
    return ready.files.every(file => paths.has(file));
  } catch { return false; }
}

export async function connectAssetStorage(): Promise<void> {
  if (!isSecureContext || !('serviceWorker' in navigator) || !('caches' in window))
    throw new Error('Browser storage requires HTTPS or localhost and a browser with Service Worker support.');
  await navigator.serviceWorker.register('/ra2-sw.js', { scope:'/' });
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Browser storage could not start. Please reload.')), 15000);
    navigator.serviceWorker.addEventListener('controllerchange', () => { clearTimeout(timeout); resolve(); }, {once:true});
  });
}
