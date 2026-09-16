# Local acceptance — 2026-09-16

Six source-identified environment candidates are available as self-contained runtime GLBs, with local masters and fixed-view Canvas samples. No push, PR, main-engine migration or public deployment was performed.

| Asset | Original identity | Triangles | Runtime bytes |
| --- | --- | ---: | ---: |
| Grass | clear01.tem / temperate:0:0 | 2 | 489,432 |
| Open ocean | water01.tem / temperate:314:0 | 2 | 53,328 |
| Palm-like tree | TREE22 / tree22.tem | 29,894 | 5,727,360 |
| Open broadleaf tree | TREE10 / tree10.tem | 29,708 | 6,418,264 |
| Plateau | cliff01.tem / Cliff Set, adapted one-step module | 2,056 | 1,010,276 |
| Ramp | slope01.tem / Ramps | 2,052 | 1,009,196 |

Total GLB bytes: **14,707,856**. Tree masters contain 1,213,306 and 1,072,682 triangles. The default simplifier stalled at 60,644 and 686,792 respectively. Selected foliage mode uses `Prune`/`Permissive`, 3% error, and regenerated MikkTSpace tangents; original masters and failed candidates remain available. Fine leaf density is reduced, noticeably at close range, while four-view silhouettes remain volumetric. Tree22's three zero source normals were repaired from incident triangle normals.

Passed checks:

- All six runtime GLBs loaded in real Chrome via GLTFLoader, including embedded WebP PBR textures.
- Actual mesh coordinates verify ramp north at ground zero and ramp south equal to plateau north; all referenced normals are nonzero, all positions/UVs/tangents finite, and texture bytes embedded.
- Repeated grass/water instances inspected from four directions and high pitch. Decoded horizontal albedo edge difference: grass 22.75 versus adjacent interior difference 18.22 (8-bit channel units); water 0.021. This supports no abrupt border band, not mathematical equality of generated grass edges. Visual screenshots show no conspicuous tile seams.
- Real Canvas `Assets`, `GameEngine`, `BattlefieldRenderer`, original valley patch, original trees and Tanya scale reference; no GLB or Three.js requests from the Canvas page. Original/HD toggle exercised with Playwright and agent-browser.
- Actual master/runtime models loaded under the same camera and lighting. Screenshots and rotation GIF are under `.cache/environment/verification/`.
- `npm run build -- --configLoader runner` passed, followed by source-only production build checks and `git diff --check`. The runner option avoids writing Vite temporary configuration into read-only shared dependencies.
- Original 4179/4183/4184 listeners retain PIDs 32886/39585/57337 and each returned HTTP 200. They were not restarted or replaced.

Limits and deliberate scope:

- Open sea only: no automatic coast, foam, seafloor depth solver or shore blending. Flow is inspector material behavior; generic GLB viewers receive the static PBR material.
- Height module is a compatible one-step plateau/ramp, not exact four-step native cliff reconstruction or a full terrain topology set. It has straight modular edges.
- No wind animations, extra low-distance LOD, dynamic tree shadow atlas or team-color remapping. Shared meshes/textures support repeated instances; a large forest still needs distance LOD or culling in its eventual consumer.
- Source anchors include empty margins. The candidate calibrates opaque root contacts separately; original converter and main game are untouched. Back geometry and natural species labels are inferred, not recovered original 3D data.
- Reference and material generation used the built-in ImageGen tool; its hidden service version/seed are unknown. Actual prompts and full selected outputs are retained. Meshy requests and task IDs are recorded in `trees.json`.
