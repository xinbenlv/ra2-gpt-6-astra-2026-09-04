# Batch two reference candidates

These six ImageGen images are candidates, not approved fidelity baselines.
`prompts.json` records the actual generation prompts. Meshy tasks for five
candidates had already completed before the downsample gate was introduced;
their existence does not imply that these references passed review.

Before further modeling, compare each candidate at its original sprite size,
with matching facing, pose, scale and anchor. Use uniform scaling and inspect
silhouette, component placement, negative spaces and team-color coverage.
Retain full-resolution inputs and the actual reduced comparison in the cache.

For existing GLBs, capture front, rear, both sides, top and oblique views before
generating the reference. For Rhino and Destroyer, original VXL/HVA geometry was
converted to inspection GLBs in `.cache/batch-two/source/original-*.glb`;
their six-view screenshots are in `.cache/batch-two/inspection/`. Generated
candidate meshes must not be substituted for original geometry evidence.

## Preliminary visual review, 2026-09-16

The comparison in `.cache/batch-two/reference-check/comparison.png` uses uniform
height matching and approximate foreground cropping. It is a screening check,
not a pixel-registered acceptance test.

| Candidate | Status | Observation |
| --- | --- | --- |
| htnk.png | Revise | Turret shape and barrel proportions differ from the original; use original multiview geometry. |
| cons.png | Revise | Red shoulder/torso coverage is substantially reduced; body proportions and stance differ. |
| dest.png | Revise | Added tall mast changes the upper silhouette; reconcile deck structures and aircraft against original multiview geometry. |
| gapile.png | Pending | Main roofs and tower are recognizable; foundation, added props and exact alignment still need checking. |
| tree26.png | Pending | Broad conical silhouette is recognizable; branch gaps and foliage density still need checking. |
| dirt-road.png | Pending | Requires original tile-scale comparison plus repeated tiles and grass adjacency. |

No candidate is accepted by this preliminary review. Repairing a generated GLB
does not retrospectively approve the reference that produced it.

## Rhino reference revision

`htnk-v2.png` was rejected by the user for rigid, voxel-derived construction.
Its earlier downsample acceptance is withdrawn. Fidelity requires both readable
original proportions at game scale and coherent manufactured forms at full size:
pixel stairs and palette boundaries are not evidence of separate armor blocks.
The next candidate must remove those artifacts without losing the original tank's
silhouette or team-color layout. Reference revisions do not update the runtime GLB.

`htnk-v3.png` removes the block artifacts but was rejected for inconsistent hull
and cannon orientation: the visible glacis/headlights imply a lower-left front,
while the cannon points upper-right. The direction correction must align the
barrel with the hull longitudinal centerline. A corrected lower-left-facing view
requires a matching original view for fidelity review; it cannot reuse the old
upper-right-facing sprite comparison as proof of acceptance.
