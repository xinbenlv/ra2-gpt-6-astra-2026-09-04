# Second HD asset batch

Work in progress: dirt road, TREE26 conifer-shaped tree, Conscript, Rhino,
Destroyer and Allied Barracks. No completed-model or behavioral claims yet.

`dependency-snapshot.json` records reviewed dependencies copied from c490 before
work began. `references/` retains selected authored ImageGen inputs. Original
images, INI excerpts and high-resolution masters remain in `.cache/batch-two/`.

The independent Canvas 3D preview uses existing engine movement; this work does
not migrate the main renderer or publish assets.

The selected Rhino revision uses `references/htnk-v4.png`; generation records
remain beside the reference and in the archived task directory. Its static model
is inspected separately at `/rhino.html` before any animation integration.

`htnk-v4.glb` is the generated static revision: 29,982 triangles, 4,141,560 bytes,
with embedded 1K base-color, normal and metallic/roughness WebP textures.
The 878,456-triangle master remains in `.cache/batch-two/htnk-v4/master.glb`.
Generation and optimization JSON records include actual hashes and task ID.
Browser loading and rotate/reset controls passed; top-view inspection shows
the barrel centered along the hull axis toward its front (-X). This revision
is retained as the approved static baseline.

`htnk-v4-team.glb` adds an embedded 1024² player-color mask, with unchanged
geometry and PBR buffers. It is 4,211,484 bytes; `htnk-v4-team.json` records its
hash and custom material metadata. `/rhino.html` consumes this version and offers
player-color presets, arbitrary colors and a mask preview. Other GLB viewers
retain the original red unless they support the `ra2TeamColor` convention.
No SHP or PNG animation atlas was rebaked in this preview change.
Four-view browser pixel comparison passed: each view changed over 14,000 pixels,
with zero changed pixels outside the rendered mask (difference tolerance 2/255).
Local evidence is in `.cache/batch-two/team-color/verification.json` and screenshots.

`htnk-v4-actions.glb` partitions that same approved mesh into hull, turret and
barrel, preserves its embedded mask, and adds four mechanical clips. It replaces
the old Rhino in `/canvas3d/`; `htnk-v4-parts.json` records pivots and counts.
Run `node tools/batch-two/mechanical.mjs htnk-v4` to rebuild it from the team GLB.
