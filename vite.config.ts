import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const base = '/' + (process.env.RA2_BASE_PATH ?? '').replace(/^\/+|\/+$/g, '') + '/';
const deployBase = base === '//' ? '/' : base;
// Embed the checkout used for this bundle, so an older cached page reports its own version.
let buildInfo: { hash: string; committedAt: string | null } = { hash: 'unknown', committedAt: null };
try {
  const [hash, committedAt] = execFileSync('git', ['show', '-s', '--format=%H%n%cI', 'HEAD'], {
    cwd: path.dirname(fileURLToPath(import.meta.url)), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  }).trim().split('\n');
  if (/^[a-f0-9]{40}$/.test(hash) && Number.isFinite(Date.parse(committedAt))) buildInfo = { hash, committedAt };
} catch { /* Source archives without Git still run, with an explicit unknown version. */ }

// Deliberately disable Vite's public directory copying: it may contain originals
// from offline development, and those must never become hosted build artifacts.
export default defineConfig({
  base: deployBase,
  define: { __BUILD_INFO__: JSON.stringify(buildInfo) },
  publicDir: false,
  build: { assetsDir:'app' },
  worker: { format:'es' },
  plugins:[{
    name:'browser-only-originals',
    configureServer(server) {
      server.middlewares.use((req,res,next) => {
        if (req.url?.split('?')[0] === '/ra2-sw.js') {
          res.setHeader('Content-Type','application/javascript');
          res.setHeader('Cache-Control','no-cache');
          res.end(fs.readFileSync(path.resolve('public/ra2-sw.js')));return;
        }
        next();
      });
    },
    generateBundle(_options,bundle) {
      for(const [source,target] of [['License.txt','7z-wasm-LICENSE.txt'],['unRarLicense.txt','7z-wasm-unRAR.txt']])
        this.emitFile({type:'asset',fileName:target!,source:fs.readFileSync('node_modules/7z-wasm/'+source,'utf8')});
      this.emitFile({type:'asset',fileName:'ra2-sw.js',source:fs.readFileSync('public/ra2-sw.js','utf8')});
      this.emitFile({type:'asset',fileName:'app-shell.json',source:JSON.stringify([deployBase,...Object.keys(bundle).map(file=>deployBase+file)])});
    },
  }],
});
