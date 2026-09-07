# Authored HD runtime samples

This branch contains four optimized, self-contained GLBs and four Canvas 2D PNG
sprite atlases, authored from RA2 visual references through ImageGen/Meshy.
No extracted original SHP/VXL/TMP artwork is included.

Each `models/<asset>/30k.glb` has approximately 30,000 triangles, 1K WebP textures
and regenerated MikkTSpace tangents. Color textures use quality 85; normal and
metallic/roughness textures use lossless WebP after resizing. Geometry is ordinary
glTF; no Draco/Meshopt decoder is required. Both shipped viewers decode WebP.
`30k.json` records measured triangles, bytes, checksums and the optimization recipe.
`master-record.json` and `prompt.txt` describe the archived generation, not extra
files present in this checkout. Tank optimization starts from the previously
validated 30K candidate; the other three start from their original generated GLBs.

High-poly GLBs, FBX, packed Blender files, independent duplicate textures and
reference images are retained in the local archive, outside published history.
They are not required to view, bake or run these samples. A lightweight model
cannot reconstruct the master: recovery requires that separate archive.

## Reproduce

```sh
npm ci --prefix tools/model-opt
node tools/model-opt/optimize.mjs /path/to/master.glb .cache/model-runtime/30k.glb
npm run viewer:glb
# In another terminal:
node tools/canvas-hd-preview/bake.mjs
```

The optimizer also creates a geometry-only comparison candidate and a JSON report
next to its output. Put experimental outputs in `.cache/`, inspect them at game
scale, and only copy the chosen GLB plus its report to `assets/hd/models/`.
The lockfile under `tools/model-opt/` records the exact tool versions.

The baker now defaults to all four tracked runtime GLBs. `RA2_MODEL_DIR` optionally
selects a local directory of `<asset>/<asset>.glb` masters for comparison.
Baking uses Three.js offline; the battlefield loads PNGs and uses the actual
Canvas 2D engine. Tank: 16 headings; Tanya: 8; each building: one heading. These
are static samples, not complete walking, firing, death or construction animations.

## History and storage

The `hifi` branch was rewritten to omit the former LFS archive and redundant tank
comparison candidates. A fresh checkout needs no LFS download for these samples.
`inventory.json` lists only distributed files and their checksums.
Old GitHub LFS objects continue to count against remote storage until GitHub
purges them; rewriting Git history alone does not release that quota.
