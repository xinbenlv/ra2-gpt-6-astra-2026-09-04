/* Hosted sites use browser-only originals; loopback previews may reuse local files. */
const ORIGINALS = 'ra2-originals-v2';
const APP = 'ra2-app-v4';
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP);
    try {
      const response = await fetch('/app-shell.json', {cache:'no-store'});
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
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/maps/')) {
    event.respondWith((async () => {
      if (['localhost','127.0.0.1','[::1]'].includes(url.hostname)) {
        try {
          const local = await fetch(event.request);
          if (local.ok && local.headers.get('X-RA2-Local-Asset') === '1') return local;
        } catch { /* An offline visit can still use previously prepared browser data. */ }
      }
      const cache = await caches.open(ORIGINALS);
      const response = await cache.match(url.pathname);
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
  if (url.pathname.startsWith('/app/') || event.request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(APP);
      if (url.pathname.startsWith('/app/')) {
        const cached = await cache.match(event.request); if (cached) return cached;
      }
      try { const response = await fetch(event.request); if (response.ok) await cache.put(event.request,response.clone()); return response; }
      catch { return await cache.match(event.request) || await cache.match('/') || new Response('Offline application unavailable.',{status:503}); }
    })());
  }
});
