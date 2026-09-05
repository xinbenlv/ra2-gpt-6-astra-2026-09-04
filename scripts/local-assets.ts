import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage } from 'node:http';
import type { Connect, Plugin } from 'vite';
import { checkAssetsReady } from './setup-assets';

const mime: Record<string, string> = {
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.map': 'text/plain',
  '.mpr': 'text/plain', '.ini': 'text/plain', '.pal': 'application/octet-stream',
};

function isLocalRequest(req: IncomingMessage): boolean {
  const remote = req.socket.remoteAddress;
  if (!remote || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)) return false;
  try {
    const host = new URL(`http://${req.headers.host}`);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(host.hostname)) return false;
    if (req.headers.origin && new URL(req.headers.origin).host !== host.host) return false;
    return req.headers['sec-fetch-site'] !== 'cross-site';
  } catch { return false; }
}

/** Expose existing originals only to this machine; builds still contain no originals. */
export function localAssetsPlugin(): Plugin {
  let publicRoot = path.resolve('public');
  const enabled = process.env.RA2_LOCAL_ASSETS !== '0';
  let checkedAt = 0;
  let readiness: Promise<boolean> | undefined;
  const available = (): Promise<boolean> => {
    if (!readiness || Date.now() - checkedAt > 5_000) {
      checkedAt = Date.now();
      readiness = checkAssetsReady(publicRoot).then(result => result.ready, () => false);
    }
    return readiness;
  };
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const rawPath = req.url?.split('?')[0] || '';
    if (rawPath !== '/api/local-assets' && !/^\/(assets|maps)\//.test(rawPath)) return next();
    if (!isLocalRequest(req)) { res.statusCode = 403; res.end('Local access only'); return; }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405; res.setHeader('Allow', 'GET, HEAD'); res.end(); return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    void (async () => {
      if (rawPath === '/api/local-assets') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ available: enabled && await available() }));
        return;
      }
      if (!enabled) { res.statusCode = 404; res.end(); return; }
      const requested = decodeURIComponent(rawPath);
      if (!/^\/(assets|maps)\//.test(requested) || requested.includes('\\') || requested.includes('\0') || requested.split('/').includes('..')) {
        res.statusCode = 400; res.end(); return;
      }
      const contentType = mime[path.extname(requested).toLowerCase()];
      if (!contentType) { res.statusCode = 404; res.end(); return; }
      const filename = await fs.realpath(path.resolve(publicRoot, requested.slice(1)));
      const root = await fs.realpath(publicRoot);
      if (!filename.startsWith(root + path.sep)) { res.statusCode = 403; res.end(); return; }
      const info = await fs.stat(filename);
      if (!info.isFile()) { res.statusCode = 404; res.end(); return; }
      res.setHeader('X-RA2-Local-Asset', '1');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', info.size);
      if (req.method === 'HEAD') { res.end(); return; }
      const stream = createReadStream(filename);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    })().catch(() => { if (!res.headersSent) res.statusCode = 404; res.end(); });
  };
  return {
    name: 'existing-local-originals',
    configResolved(config) { publicRoot = path.resolve(config.root, process.env.RA2_PUBLIC_DIR || 'public'); },
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}
