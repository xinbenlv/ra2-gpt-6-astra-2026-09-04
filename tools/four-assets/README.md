# Recovered four-model motion tools

Restore the four authored models needed by the Canvas 3D training field after the
uncommitted source worktree was removed. Source task:
`01a0a965-90a2-7c83-b65d-3d3f2f7103f4`, former worktree `9e22`.

```text
recover.py (GET only) -> verified cached master.glb
../model-opt/optimize.mjs -> cached 30k.glb
motion-catalog.mjs + rigs.mjs + squid-rig.mjs -> motion-build.mjs -> actions.glb
```

`recover.py` consumes `MESHY_API_KEY` injected by GuestSafe. It downloads only the
four recorded tasks and checks the master hashes printed in the source task.
It never submits generation. Masters remain in ignored `.cache/four-assets`.
Install model processing dependencies with `npm ci --prefix tools/model-opt`.

The five motion modules were reconstructed from the source task's reviewed file
creation commands, including the final topology-based Squid rig and curl gain.
`glb.mjs` appends buffers without re-encoding PBR textures. The Rocketeer has 16
joints and nine clips; Squid has 81 joints and three clips. Run
`node tools/four-assets/motion-build.mjs` after optimizing the four inputs.

These are source-referenced approximations: hidden depth is inferred. Rocketeer
covers air actions, not ground walk/crawl. Hover aliases flight; death subranges
share tumble keys. Squid's ten connected appendages each receive eight joints.
Timing uses a 12 Hz preview convention. Refinery and War Miner remain static,
without independent mechanical animation. Canvas 3D consumes GLBs directly;
this recovery does not rebuild or overwrite the previous 2D sprite atlases.
