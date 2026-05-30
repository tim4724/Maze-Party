'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const MazeGen = require('../engine/maze-gen');

const { TILE } = MazeGen;
const isFloor = (m, x, y) => m.tiles[y * m.width + x] !== TILE.WALL;

function countConnections(m) {
  let n = 0;
  for (let cy = 0; cy < m.cellH; cy++) {
    for (let cx = 0; cx < m.cellW; cx++) {
      const rx = cx * 2 + 1, ry = cy * 2 + 1;
      if (cx + 1 < m.cellW && m.tiles[ry * m.width + (rx + 1)] !== TILE.WALL) n++;
      if (cy + 1 < m.cellH && m.tiles[(ry + 1) * m.width + rx] !== TILE.WALL) n++;
    }
  }
  return n;
}

test('dimensions: 10x10 rooms -> 21x21 odd tile grid', () => {
  const m = MazeGen.generate(1, { cellW: 10, cellH: 10 });
  assert.equal(m.width, 21);
  assert.equal(m.height, 21);
  assert.equal(m.tiles.length, 21 * 21);
});

test('deterministic: same seed -> identical tiles, tunnels, one-ways', () => {
  const a = MazeGen.generate(12345);
  const b = MazeGen.generate(12345);
  assert.deepEqual(Array.from(a.tiles), Array.from(b.tiles));
  assert.deepEqual(a.tunnels, b.tunnels);
  assert.deepEqual(a.oneWays, b.oneWays);
});

test('outer border is solid wall', () => {
  const m = MazeGen.generate(7);
  for (let x = 0; x < m.width; x++) {
    assert.equal(m.tiles[x], TILE.WALL);
    assert.equal(m.tiles[(m.height - 1) * m.width + x], TILE.WALL);
  }
  for (let y = 0; y < m.height; y++) {
    assert.equal(m.tiles[y * m.width], TILE.WALL);
    assert.equal(m.tiles[y * m.width + (m.width - 1)], TILE.WALL);
  }
});

test('every room is carved (fully connected lattice)', () => {
  const m = MazeGen.generate(99);
  for (let cy = 0; cy < m.cellH; cy++) {
    for (let cx = 0; cx < m.cellW; cx++) {
      assert.ok(isFloor(m, cx * 2 + 1, cy * 2 + 1), `room (${cx},${cy})`);
    }
  }
});

test('braid=0 perfect maze; braid>0 adds loops', () => {
  const rooms = 100;
  assert.equal(countConnections(MazeGen.generate(42, { braid: 0 })), rooms - 1);
  assert.ok(countConnections(MazeGen.generate(42, { braid: 0.5 })) > rooms - 1);
});

test('tunnels: shortcut pairs (no real-exit role), distinct mouths on floor away from start/exit', () => {
  for (const seed of [1, 2, 99, 2024]) {
    const m = MazeGen.generate(seed, { tunnelPairs: 3 });
    assert.ok(m.tunnels.length <= 3, `seed ${seed} pair count capped`);
    const seen = new Set();
    const exitKey = m.exit.x + ',' + m.exit.y, startKey = m.start.x + ',' + m.start.y;
    for (const t of m.tunnels) {
      assert.equal(t.real, undefined, `seed ${seed} tunnels carry no real-exit flag`);
      for (const mouth of [t.a, t.b]) {
        assert.ok(isFloor(m, mouth.x, mouth.y), `mouth on floor seed ${seed}`);
        const key = mouth.x + ',' + mouth.y;
        assert.ok(!seen.has(key), `distinct mouths seed ${seed}`);
        assert.notEqual(key, exitKey, `mouth not on exit seed ${seed}`);
        assert.notEqual(key, startKey, `mouth not on start seed ${seed}`);
        seen.add(key);
      }
    }
  }
});

test('one-ways: placed on floor with a valid arrow; capped at request', () => {
  const m = MazeGen.generate(31, { oneWays: 8 });
  assert.ok(m.oneWays.length <= 8);
  for (const ow of m.oneWays) {
    assert.ok(isFloor(m, ow.x, ow.y), 'one-way on floor');
    assert.ok(['up', 'down', 'left', 'right'].includes(ow.dir));
  }
});

test('exit is a distinct far goal, not on start or a tunnel mouth', () => {
  for (const seed of [1, 2, 99, 2024, 31]) {
    const m = MazeGen.generate(seed);
    assert.ok(isFloor(m, m.exit.x, m.exit.y), `exit on floor, seed ${seed}`);
    assert.notDeepEqual(m.exit, m.start, `exit differs from start, seed ${seed}`);
    for (const t of m.tunnels) {
      assert.notDeepEqual(m.exit, t.a, `exit not a tunnel mouth, seed ${seed}`);
      assert.notDeepEqual(m.exit, t.b, `exit not a tunnel mouth, seed ${seed}`);
    }
  }
});

test('every maze is solvable: the exit is walk-reachable with tunnels as walls (one-way aware)', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const m = MazeGen.generate(seed);
    assert.ok(MazeGen.solvable(m), `seed ${seed} exit reachable without tunnels`);
  }
});

test('no one-way traps: every tile reachable from start can still reach the exit (all seeds)', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const m = MazeGen.generate(seed);
    const W = m.width, oneWayDir = {}, blocked = {};
    for (const o of m.oneWays) oneWayDir[o.y * W + o.x] = o.dir;
    for (const t of m.tunnels) { blocked[t.a.y * W + t.a.x] = 1; blocked[t.b.y * W + t.b.x] = 1; }
    const fwd = MazeGen.directedReachable(W, m.height, m.tiles, oneWayDir, m.start, blocked);
    const rev = MazeGen.reverseDirectedReachable(W, m.height, m.tiles, oneWayDir, m.exit, blocked);
    for (let i = 0; i < fwd.length; i++) {
      if (fwd[i] && !rev[i]) {
        assert.fail(`seed ${seed}: tile (${i % W},${Math.floor(i / W)}) is a one-way trap (reachable from start, cannot reach exit)`);
      }
    }
  }
});

test('no tunnel traps: under the FULL model (tunnels as teleports), every reachable tile can still reach the exit', () => {
  // Stronger than the walk-only check above: a player who TAKES a tunnel must
  // never land in a one-way pocket they cannot escape. (Regression: the gen used
  // to validate one-ways with mouths treated as walls, missing teleport-in traps.)
  for (let seed = 1; seed <= 120; seed++) {
    const m = MazeGen.generate(seed);
    const W = m.width, oneWayDir = {}, partner = {};
    for (const o of m.oneWays) oneWayDir[o.y * W + o.x] = o.dir;
    for (const t of m.tunnels) {
      const a = t.a.y * W + t.a.x, b = t.b.y * W + t.b.x;
      partner[a] = b; partner[b] = a;
    }
    const fwd = MazeGen.tunnelReachable(W, m.height, m.tiles, oneWayDir, partner, m.start);
    const can = MazeGen.tunnelCanReach(W, m.height, m.tiles, oneWayDir, partner, m.exit);
    for (let i = 0; i < fwd.length; i++) {
      if (fwd[i] && !can[i]) {
        assert.fail(`seed ${seed}: tile (${i % W},${Math.floor(i / W)}) is a tunnel trap (reachable, cannot reach exit)`);
      }
    }
  }
});
