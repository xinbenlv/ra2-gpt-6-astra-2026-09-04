# Canvas 3D training field

Open `/canvas3d/` on `node tools/environment/server.mjs` (port 4186).
This independent Three.js renderer consumes authored GLBs directly and uses the
existing GameEngine for entity movement. It does not replace the main Canvas 2D
game, require original art, or load 2D comparison sprites.

```text
catalog.js -> eight asset identities and model normalization
world.js -> six instanced/placed environment types and orbit camera
main.ts -> GameEngine, AnimationMixer, selection, action and time controls
index.html + style.css -> training-field controls
verify.mjs -> local Chrome screenshots and action/movement assertions
```

Tanya, Rocketeer and Squid expose their existing skeletal clips. Aliases and
unimplemented Tanya placeholder deaths are excluded from the Tanya selector.
Static tanks and buildings expose explicit rigid-body hit/fire/repair feedback;
they do not have independently animated turrets, tracks or building machinery.
Action preview may move Tanya into the water and restore her land position.
Right-click moves selected mobile actors through actual GameEngine pathfinding.
Manual action inspection, pause, 1/30-second stepping, seek, speed, action tour,
model heading, four camera directions, pitch and skeleton inspection are available.

World coordinates use X/Z ground, Y up and one unit per original map cell. Models
are uniformly fitted to recorded target height or width without altering their
rest-pose transforms. The scene is an open-water test field; arbitrary shore
meshing and terrain-aware height pathfinding are not implemented here.

Run `node tools/environment/canvas3d/verify.mjs` with the local service running.
It checks all eight asset loads, all offered skeleton poses for finite vertices,
actual vertex deformation, pause/step/seek, water placement, engine movement and
four camera angles. Evidence stays in ignored `.cache/environment/canvas3d`.
Missing model files are reported explicitly and do not silently substitute art.

Four models were recovered after worktree `9e22` was removed during this task.
See `tools/four-assets/README.md` for source task identity, GET-only Meshy recovery,
checksums and reconstructed motion recipes. No new generation was submitted.

## Heading regression

`forwardAxis` is the observed asset-space travel axis before scene yaw:
vehicles −X, Tanya/Rocketeer +Z, Squid −Z (mantle first, matching source swim
frame 60). Scene yaw maps that axis onto the engine displacement angle. Rigid
vehicle recoil follows the same axis. Moving clears inspection-only turns.
`node tools/environment/canvas3d/verify-heading.mjs` checks all five mobile types
in eight directions against actual engine displacement, plus inspection turns.
The pre-fix vehicle test failed with nose/movement dot product approximately 0.
Neutral-axis inspection images stay under `.cache/environment/canvas3d/axis-*`.

## Approved Rhino revision

The Rhino now loads `htnk-v4-actions.glb`, derived from the approved v4 geometry
and embedded team mask. Hull, turret and barrel retain 29,982 total triangles;
four clips provide ready, recoil and left/right turret inspection. The player
color picker updates player 0 and all adapted instances (currently Rhino only).
`?actor=htnk` selects and focuses it on entry. Runtime movement remains owned by
GameEngine. Eight-direction travel, actual attack alignment and move-resume passed
the 64-case batch regression. Local screenshots include the rotated turret and
blue paint in `.cache/batch-two/review/htnk-aim_left.png` and
`.cache/batch-two/review/htnk-v4-canvas-blue.png`.
