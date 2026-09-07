import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const repo = fileURLToPath(new URL('..', import.meta.url));
process.env.RA2_REPO ||= repo;
process.env.PORT ||= '4175';
process.env.HOST ||= '127.0.0.1';
const directory = resolve(process.env.GLB_VIEWER_DIR || fileURLToPath(new URL('../tools/glb-compare/', import.meta.url)));
if (process.argv.includes('--help')) {
  console.log(`npm run viewer:glb
3D: http://127.0.0.1:${process.env.PORT}/
Canvas 2D: http://127.0.0.1:${process.env.PORT}/canvas/
PORT, HOST, GLB_VIEWER_DIR, GLB_CANVAS_DIR and RA2_ORIGINAL_ASSETS override local defaults.
Authored samples are in assets/hd; extracted original art is optional and stays in .cache.`);
} else {
  await import(pathToFileURL(resolve(directory, 'server.mjs')).href);
}
