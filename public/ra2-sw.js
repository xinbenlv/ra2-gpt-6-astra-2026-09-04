/* Original resources are never fetched from the application host. */
const BASE = new URL(self.registration.scope).pathname;
const cacheName = name => BASE === '/' ? name : name + ':' + BASE;
const ORIGINALS = cacheName('ra2-originals-v2');
const APP = cacheName('ra2-app-v6');
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP);
    try {
      const response = await fetch(BASE + 'app-shell.json', {cache:'no-store'});
      if (response.ok) {
        const files = await response.json();
        await cache.addAll(files);
      }
    } catch { /* Development mode has no precache manifest. */ }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET' || !url.pathname.startsWith(BASE)) return;
  const logicalPath = '/' + url.pathname.slice(BASE.length);
  if (logicalPath.startsWith('/assets/') || logicalPath.startsWith('/maps/')) {
    event.respondWith((async () => {
      const cache = await caches.open(ORIGINALS);
      const response = await cache.match(logicalPath);
      if (!response) return new Response('Original asset is not present in this browser.', {status:404});
      // HTMLAudioElement can request byte ranges when seeking cached PCM music.
      const range = event.request.headers.get('range');
      if (!range) return response;
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) return new Response(null, {status:416});
      const bytes = await response.arrayBuffer(), start = Number(match[1]), end = Math.min(match[2] ? Number(match[2]) : bytes.byteLength - 1, bytes.byteLength - 1);
      if (start > end) return new Response(null, {status:416, headers:{'Content-Range':`bytes */${bytes.byteLength}`}});
      return new Response(bytes.slice(start,end+1), {status:206,headers:{'Content-Type':response.headers.get('Content-Type') || 'application/octet-stream','Content-Range':`bytes ${start}-${end}/${bytes.byteLength}`,'Accept-Ranges':'bytes','Content-Length':String(end-start+1)}});
    })());
    return;
  }
  if (logicalPath.startsWith('/app/') || event.request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(APP);
      if (logicalPath.startsWith('/app/')) {
        const cached = await cache.match(event.request); if (cached) return cached;
      }
      try { const response = await fetch(event.request); if (response.ok) await cache.put(event.request,response.clone()); return response; }
      catch { return await cache.match(event.request) || (event.request.mode === 'navigate' ? await cache.match(BASE) : undefined) || new Response('Offline application unavailable.',{status:503}); }
    })());
  }
});
