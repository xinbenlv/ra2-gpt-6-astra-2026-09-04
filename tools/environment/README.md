# Environment asset candidate

Local tools for six rotatable environment assets, plus offline samples consumed by the existing Canvas 2D engine. No main-engine replacement or public deployment.

```text
source.py -> ignored original references + source-record.json
ImageGen references -> cached meshy.py -> master GLB
../model-opt/optimize.mjs -> normalize.mjs -> tree GLBs
build.mjs -> periodic PBR + surface/height GLBs
server.mjs -> viewer.js (3D inspector) + canvas3d/ (eight-actor field)
bake.mjs -> sprites -> canvas.ts (BattlefieldRenderer)
verify.mjs -> ignored browser evidence
```

Run `node tools/environment/server.mjs` and open port 4186. Original data defaults to the local extraction described in `source.py`; set `RA2_ORIGINAL_ASSETS` to change it. The server binds only localhost and fails if the port is occupied. Vite cache is isolated from other previews.

Build regular modules with `node tools/environment/build.mjs`. Generated trees require archived Meshy masters, optimization, then `node tools/environment/normalize.mjs`. Run `node tools/environment/bake.mjs` and `node tools/environment/verify.mjs` while the server is running. Browser tools use installed Chrome.

The root dependencies follow the project lockfile. Model processing uses `tools/model-opt/package-lock.json`. Development reads root dependencies from the main checkout and model-processing dependencies from the existing model-opt tool installation; install with `npm ci` in a fresh checkout and `npm ci --prefix tools/model-opt` for portable use.

Grass and rock albedo use actual source-guided ImageGen inputs; water color/normal maps are deterministic periodic analytic textures. These surface modules do not use Meshy. Water is open sea; arbitrary shore matching is not implemented. The tree backs are inferred from one image. See the runtime directory for measured metrics and remaining limitations.

`source-bytes.py` hashes the actual MIX entries after `source.py`; `inventory.py`
freezes authored files and master hashes. Both use the extraction venv with Pillow.
Use `geometry.test.mjs`, `texture-check.mjs`, `verify.mjs`, and `compare.mjs` for
attribute, texture-border, browser, and master/runtime checks. The Meshy wrapper
uses GuestSafe process injection and refuses duplicate submissions after its marker.

Local evidence (contains original art; intentionally ignored):

![Four directions and pitch](../../.cache/environment/verification/rotation.gif)
![Canvas comparison](../../.cache/environment/verification/canvas.png)
![Runtime comparison](../../.cache/environment/verification/runtime-comparison.png)

The [Canvas 3D training field](canvas3d/README.md) is available at `/canvas3d/`.
It combines eight authored unit/building types and six environment assets, with
real skeletal playback, camera controls and existing-engine movement. `/canvas`
and `/canvas/` remain aliases for the environment Canvas 2D comparison.

`/rhino.html` inspects the user-selected revised Rhino static model at
`assets/hd/batch-two/htnk-v4-team.glb`, with orbit, zoom and download controls.
It is separate from the older animated Rhino in the training field.
`team-color.js` reads the embedded player-color mask and changes only selected
paint regions. The preview includes color presets, a custom color picker and a
mask display. Material uniforms are local to each instance. Ordinary GLB viewers
show the original red unless they implement this custom metadata convention.
