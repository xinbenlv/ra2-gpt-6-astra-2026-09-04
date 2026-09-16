# Six environment candidates

Authored cell-scale GLBs for a future rotating camera. The local inspector is separate from the current Canvas 2D main engine. This directory is a local candidate, not a published release.

```text
source-record.json -> original identities (images in ignored cache)
references/ -> selected ImageGen inputs + actual prompts
grass/ocean/plateau/ramp.glb <- modules.json + build.mjs
tree22/tree10.glb <- trees.json + archived Meshy masters
sprites/ -> fixed-view offline renders for Canvas comparison
```

## Coordinates and interface

One unit is one original map cell, not one physical meter. GLBs use Y-up and +Z forward; X/Z are map grid axes. Cell footprints are 1×1, centered at root pivot `[0,0,0]`; tree crowns may overhang the cell. Standard orthographic projection uses 30° elevation, 45° azimuth and `30*sqrt(2)` logical pixels per unit, producing the original 60×30 diamond. One elevation step is `1/sqrt(6)` cell units (15 logical screen pixels). Ground and tree root height are zero.

`modules.json` supplies per-edge endpoint heights in cells, footprint, PBR and water parameters. Ramp north edge joins ground, south joins the plateau. The plateau adapts cliff-set material to a one-step modular height; it is not a reconstruction of the original four-step cliff tile. Rotate modules by exact quarter-turns, rotating edge descriptors with them. The current interface describes geometry, not new pathfinding rules.

Water is a flat open surface with independent alpha, roughness and periodic normal flow. No coastline, foam, bathymetry or arbitrary coast transition solver is supplied. PBR maps contain no shore shapes or fixed sun highlights. Grass and rock use ImageGen source-guided albedo; water uses deterministic periodic normal detail and constant base color. Grass PBR factor `[.65,.70,.50,1]` calibrates the candidate lighting against the original. Each GLB is self-contained; consumers can deduplicate identical textures by hash and instance shared meshes.

## Source and inference

TREE22 (palm-like) and TREE10 (open broadleaf) appear 1,523 and 1,121 times respectively in the local temperate catalog, including variants. These are shape labels, not botanical species claims. Tree backside and branch depth are generated from one view. No animation, wind rig, remap mask or team-color substitution is added.

Original conversion anchors are retained in `source-record.json`. The candidate comparison corrects the original trees' empty lower margin using measured opaque root coordinates: TREE22 `(62.75,60)`, TREE10 `(61,50)`, versus stored `(52.5,82)` / `(61.5,86)`. This is local comparison calibration; the main converter is unchanged. GLB dimensions are separately normalized to original sprite scale; exact shape recovery is not claimed.

## Recovery and verification

Original/generated masters and intermediate geometry candidates live under `.cache/environment/<id>/`; keep this directory to re-export the same geometry. Task IDs or 30k candidates cannot restore discarded high-resolution detail. `trees.json` records actual counts, request parameters, hashes and the optimization recipe; a target count is not an achieved count.

Run [the tooling](../../../tools/environment/README.md). Browser evidence and reports remain in `.cache/environment/verification/` because Canvas screenshots contain original art. No originals are stored here. Current runtime files require ordinary glTF plus `EXT_texture_webp` for trees; tested with Three.js GLTFLoader. Future consumers must support that extension or re-export PNG/JPEG from the retained master.
