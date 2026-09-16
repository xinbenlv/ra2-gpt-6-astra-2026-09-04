# Fixed-view environment sprites

Offline orthographic GLB renders at four pixels per logical pixel. `manifest.json` stores source rectangles and anchors. Rebuild with `tools/environment/bake.mjs` while the candidate server runs. The original scenery painter lacks `pixelRatio`; only the candidate page supplies the explicit adapter. These are static samples, not a rotating-camera replacement.
