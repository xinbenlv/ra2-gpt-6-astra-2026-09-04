import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { localAssetsPlugin } from './scripts/local-assets';

// Deliberately disable Vite's public directory copying: it may contain originals
// from offline development, and those must never become hosted build artifacts.
export default defineConfig({
  publicDir: false,
  build: { assetsDir:'app' },
  worker: { format:'es' },
  plugins:[localAssetsPlugin(), {
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
      this.emitFile({type:'asset',fileName:'app-shell.json',source:JSON.stringify(['/',...Object.keys(bundle).map(file=>'/'+file)])});
    },
  }],
});
