import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

for (const base of ['/', '/ra2-gpt-6-astra-2026-09-04/']) {
  test(`service worker isolates cache routing and offline navigation at ${base}`, async () => {
    const origin = 'https://example.test';
    const listeners: Record<string, (event: any) => void> = {};
    const stores = new Map<string, Map<string, Response>>();
    const network: string[] = [];
    let offline = false;
    const key = (request: string | { url: string }) => new URL(typeof request === 'string' ? request : request.url, origin).pathname;
    const store = (name: string) => { if (!stores.has(name)) stores.set(name, new Map()); return stores.get(name)!; };
    runInNewContext(readFileSync(new URL('../public/ra2-sw.js', import.meta.url), 'utf8'), {
      self: { registration: { scope: origin + base }, location: { origin }, addEventListener: (name: string, handler: any) => listeners[name] = handler, skipWaiting: async () => {}, clients: { claim: async () => {} } },
      URL, Response,
      caches: { open: async (name: string) => ({
        match: async (request: string | { url: string }) => store(name).get(key(request))?.clone(),
        put: async (request: string | { url: string }, response: Response) => store(name).set(key(request), response),
        addAll: async (paths: string[]) => { for (const path of paths) store(name).set(path, new Response(path.endsWith('.js') ? 'synthetic application' : 'synthetic shell')); },
      }) },
      fetch: async (request: string | { url: string }) => {
        network.push(key(request));
        if (offline) throw new Error('offline');
        return key(request) === base + 'app-shell.json' ? Response.json([base, base + 'app/main.js']) : new Response('network');
      },
    });
    let installed: Promise<void> | undefined;
    listeners.install({ waitUntil: (promise: Promise<void>) => installed = promise });
    await installed;
    assert.deepEqual(network, [base + 'app-shell.json']);
    const originalName = 'ra2-originals-v2' + (base === '/' ? '' : ':' + base);
    store(originalName).set('/assets/test.wav', new Response('0123456789', { headers: { 'Content-Type': 'audio/wav' } }));
    const request = (path: string, mode = 'cors', range?: string) => {
      let response: Promise<Response> | undefined;
      listeners.fetch({ request: { url: origin + path, method: 'GET', mode, headers: new Headers(range ? { range } : {}) }, respondWith: (promise: Promise<Response>) => response = promise });
      return response;
    };
    assert.equal(await (await request(base + 'assets/test.wav'))!.text(), '0123456789');
    const partial = (await request(base + 'assets/test.wav', 'cors', 'bytes=2-5'))!;
    assert.equal(partial.status, 206); assert.equal(await partial.text(), '2345');
    assert.equal((await request(base + 'assets/missing.png'))!.status, 404);
    assert.deepEqual(network, [base + 'app-shell.json'], 'originals never fall through to the host');
    if (base !== '/') assert.equal(request('/other-project/assets/test.wav'), undefined);
    offline = true;
    assert.equal(await (await request(base, 'navigate'))!.text(), 'synthetic shell');
    assert.equal(await (await request(base + 'app/main.js'))!.text(), 'synthetic application');
    assert.equal((await request(base + 'app/missing.js'))!.status, 503, 'missing scripts must not receive HTML');
  });
}
