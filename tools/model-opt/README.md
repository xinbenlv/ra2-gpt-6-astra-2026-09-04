# Static GLB optimization

Reproducible static mesh simplification and separate texture compression. Copied explicitly from the source worktree's `tools/model-opt` after inspection; no source files were overwritten.

Run `npm ci --prefix tools/model-opt`, then `node tools/model-opt/optimize.mjs INPUT.glb OUTPUT.glb 30000`. The report records actual triangles; the error threshold may stop above the target. Geometry-only output remains in ignored cache for comparisons. This recipe rejects animated/skinned assets.

The optional fourth argument `foliage` enables Meshopt `Prune` and `Permissive` with a 3% error cap. It can remove small disconnected leaf components. The selected tree candidates were compared against their masters at the same scale; fine leaflet density is reduced. Default behavior remains the original 1% recipe.
