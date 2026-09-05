import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BattlefieldRenderer } from '../src/renderer';
import { projectTile, unprojectPoint } from '../src/terrain-painter';

test('editor projection keeps the battlefield diamond size, orientation, and tile centers', () => {
  const samples = [
    { tile: [0, 0], world: { x: 0, y: 0 } },
    { tile: [1, 0], world: { x: 30, y: 15 } },
    { tile: [0, 1], world: { x: -30, y: 15 } },
    { tile: [1, 1], world: { x: 0, y: 30 } },
    { tile: [47, 31], world: { x: 480, y: 1170 } },
  ];
  for (const { tile: [x, y], world } of samples) {
    assert.deepEqual(projectTile(x, y), world);
    assert.deepEqual(BattlefieldRenderer.prototype.project(x, y), world);
    assert.deepEqual(unprojectPoint(world.x, world.y), { x, y });
    assert.deepEqual(BattlefieldRenderer.prototype.unproject(world.x, world.y), { x, y });
  }
});

test('inverse picking distinguishes diamond edges and empty margins under camera pan and zoom', () => {
  // Points immediately inside/outside the first diamond must not paint its neighbor.
  const picks = [
    { world: { x: 29.4, y: 0 }, tile: { x: 0, y: 0 } },
    { world: { x: 30.6, y: 0 }, tile: { x: 1, y: -1 } },
    { world: { x: -29.4, y: 0 }, tile: { x: 0, y: 0 } },
    { world: { x: -30.6, y: 0 }, tile: { x: -1, y: 1 } },
    { world: { x: 0, y: 14.7 }, tile: { x: 0, y: 0 } },
    { world: { x: 0, y: 15.3 }, tile: { x: 1, y: 1 } },
    { world: { x: 480, y: 1170 }, tile: { x: 47, y: 31 } },
  ];
  for (const zoom of [.2, .45, 1, 1.7, 3]) for (const camera of [{ x: 0, y: 0 }, { x: -357.25, y: 184.5 }]) {
    for (const { world, tile } of picks) {
      const screen = { x: camera.x + world.x * zoom, y: camera.y + world.y * zoom };
      const point = unprojectPoint((screen.x - camera.x) / zoom, (screen.y - camera.y) / zoom);
      // Normalize -0: it is the same map cell as 0 in JavaScript array indexing.
      assert.deepEqual({ x: Math.round(point.x) || 0, y: Math.round(point.y) || 0 }, tile);
    }
  }
});
