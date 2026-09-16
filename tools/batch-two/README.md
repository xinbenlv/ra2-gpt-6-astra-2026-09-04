# Second HD asset batch

Prepare six new source-referenced assets without replacing game rules or source worktrees.

```text
source/ (ignored original evidence) -> ImageGen references (authored)
meshy.py -> ignored masters -> model-opt -> rig/parts -> runtime GLBs
runtime GLBs -> environment/canvas3d -> behavioral verification
```

All paid requests use a persisted submission marker and task ID. Meshy credentials
are injected by GuestSafe; signed result URLs are consumed in memory only.

`team-mask.mjs` freezes the selected Rhino's red paint selection into an embedded
1024² grayscale PNG in `htnk-v4-team.glb`. Material extras `ra2TeamColor` identify
the mask image, UV set, channel and source color. Original geometry and PBR bytes
are preserved. `../environment/team-color.js` consumes the metadata per instance;
`verify-team-color.mjs` checks real controls and four-view pixel isolation.
