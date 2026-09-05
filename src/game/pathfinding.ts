import type { Point } from './types';

class MinHeap {
  values: { index: number; f: number }[] = [];
  push(index: number, f: number) {
    const value = { index, f };
    let n = this.values.length;
    this.values.push(value);
    while (n > 0) {
      const parent = (n - 1) >> 1;
      if (this.values[parent].f <= f) break;
      this.values[n] = this.values[parent]; n = parent;
    }
    this.values[n] = value;
  }
  pop(): number {
    const first = this.values[0].index;
    const last = this.values.pop()!;
    if (!this.values.length) return first;
    let n = 0;
    while (n * 2 + 1 < this.values.length) {
      let child = n * 2 + 1;
      if (child + 1 < this.values.length && this.values[child + 1].f < this.values[child].f) child++;
      if (last.f <= this.values[child].f) break;
      this.values[n] = this.values[child]; n = child;
    }
    this.values[n] = last;
    return first;
  }
}

/** A* over the map grid. Diagonal movement cannot cut through blocked corners. */
export function findPath(width: number, height: number, start: Point, goal: Point, passable: (x: number, y: number) => boolean, maxVisited = 16000): Point[] {
  const sx = Math.floor(start.x), sy = Math.floor(start.y);
  let gx = Math.floor(goal.x), gy = Math.floor(goal.y);
  gx = Math.max(0, Math.min(width - 1, gx)); gy = Math.max(0, Math.min(height - 1, gy));
  if (sx === gx && sy === gy) return [];
  // Orders on buildings or blocked tiles terminate at the closest walkable tile.
  if (!passable(gx, gy)) {
    let found = false;
    for (let r = 1; r <= 8 && !found; r++) {
      let best = Infinity; let p: Point | undefined;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = gx + dx, y = gy + dy;
        if (x < 0 || x >= width || y < 0 || y >= height || !passable(x, y)) continue;
        const score = Math.hypot(x - sx, y - sy);
        if (score < best) { best = score; p = { x, y }; }
      }
      if (p) { gx = p.x; gy = p.y; found = true; }
    }
    if (!found) return [];
  }
  const total = width * height;
  const costs = new Float32Array(total).fill(Infinity);
  const parents = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const startIndex = sy * width + sx, endIndex = gy * width + gx;
  if (startIndex < 0 || startIndex >= total) return [];
  const heap = new MinHeap();
  costs[startIndex] = 0; heap.push(startIndex, 0);
  const offsets = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  let visited = 0, reached = -1;
  while (heap.values.length && visited++ < maxVisited) {
    const index = heap.pop();
    if (closed[index]) continue;
    closed[index] = 1;
    if (index === endIndex) { reached = index; break; }
    const x = index % width, y = Math.floor(index / width);
    for (const [dx, dy] of offsets) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || !passable(nx, ny)) continue;
      if (dx && dy && (!passable(x + dx, y) || !passable(x, y + dy))) continue;
      const ni = ny * width + nx;
      if (closed[ni]) continue;
      const score = costs[index] + (dx && dy ? 1.414214 : 1);
      if (score >= costs[ni]) continue;
      parents[ni] = index; costs[ni] = score;
      const ax = Math.abs(nx - gx), ay = Math.abs(ny - gy);
      heap.push(ni, score + Math.max(ax, ay) + .414214 * Math.min(ax, ay));
    }
  }
  if (reached < 0) return [];
  const path: Point[] = [];
  for (let index = reached; index !== startIndex && index !== -1; index = parents[index]) path.push({ x: index % width + .5, y: Math.floor(index / width) + .5 });
  return path.reverse();
}
