'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const MazeGen = require('../engine/maze-gen');
const { Game } = require('../engine/maze-engine');

const { TILE } = MazeGen;
const HEAD = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };

function makeGame(ids, seed) {
  const players = new Map();
  ids.forEach((id) => players.set(id, {}));
  const events = [];
  let ended = null;
  const g = new Game(players, { onEvent: (e) => events.push(e), onGameEnd: (r) => { ended = r; } }, seed);
  g.init();
  return { g, events, getEnded: () => ended };
}

// First heading out of (x,y) the engine deems open, whose target is a plain
// floor tile (not a tunnel mouth) — so the move is a normal step.
function plainOpenHeading(g, x, y) {
  const W = g.maze.width;
  for (const name of Object.keys(HEAD)) {
    if (!g._open(x, y, name)) continue;
    const nx = x + HEAD[name][0], ny = y + HEAD[name][1];
    if (!g.tunnelByTile[ny * W + nx]) return name;
  }
  return null;
}

// A neighbour cell + heading to step INTO tile A from.
function entryInto(g, A) {
  const W = g.maze.width, H = g.maze.height;
  for (const name of Object.keys(HEAD)) {
    const nx = A.x - HEAD[name][0], ny = A.y - HEAD[name][1]; // come-from cell
    if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
    if (g.maze.tiles[ny * W + nx] === TILE.WALL) continue;
    if (g.tunnelByTile[ny * W + nx]) continue;
    if (g._open(nx, ny, name)) return { x: nx, y: ny, dir: name };
  }
  return null;
}

function placeAndDrive(g, id, cell, dir, steps) {
  const p = g.players[id];
  p.tx = cell.x; p.ty = cell.y; p.prog = 0; p.dir = null; p.nextDir = null; p.lastTunnelTile = -1;
  g.processInput(id, dir);
  for (let i = 0; i < steps; i++) g.update(1000 / 60);
}

test('player stays put with no input', () => {
  const { g } = makeGame(['p1'], 5);
  const s = g.players.p1, sx = s.tx, sy = s.ty;
  g.update(1000);
  assert.deepEqual([s.tx, s.ty], [sx, sy]);
  assert.equal(s.dir, null);
});

test('a heading auto-runs the player one tile down an open corridor', () => {
  const { g } = makeGame(['p1'], 5);
  const sx = g.players.p1.tx, sy = g.players.p1.ty;
  const dir = plainOpenHeading(g, sx, sy);
  assert.ok(dir, 'start has a plain open neighbour');
  g.processInput('p1', dir);
  g.update(1000 / 6);
  const p = g.getSnapshot().players[0];
  assert.deepEqual([p.tx, p.ty], [sx + HEAD[dir][0], sy + HEAD[dir][1]]);
});

test('running into a wall stops the player', () => {
  const { g } = makeGame(['p1'], 5);
  let blocked = null;
  for (const name of Object.keys(HEAD)) if (!g._open(g.players.p1.tx, g.players.p1.ty, name)) { blocked = name; break; }
  assert.ok(blocked, 'start is walled on a side');
  const sx = g.players.p1.tx, sy = g.players.p1.ty;
  g.processInput('p1', blocked);
  g.update(1000);
  assert.deepEqual([g.players.p1.tx, g.players.p1.ty], [sx, sy]);
});

test('fog: start area is revealed, the far maze is not', () => {
  const { g } = makeGame(['p1'], 7);
  const W = g.maze.width;
  assert.equal(g.revealed[g.maze.start.y * W + g.maze.start.x], 1, 'start revealed');
  // The exit is the farthest tile — its surroundings start hidden (the beacon is
  // drawn through fog by the renderer, but the tiles themselves are unrevealed).
  assert.equal(g.revealed[g.maze.exit.y * W + g.maze.exit.x], 0, 'far exit tiles hidden at start');
});

test('one-way tile: enterable along its arrow, blocked against it', () => {
  const { g } = makeGame(['p1'], 31);
  const W = g.maze.width;
  assert.ok(g.maze.oneWays.length > 0, 'at least one one-way placed');
  const ow = g.maze.oneWays[0];
  const d = ow.dir, opp = OPP[d];
  const behind = { x: ow.x - HEAD[d][0], y: ow.y - HEAD[d][1] };  // approach along arrow
  const ahead = { x: ow.x + HEAD[d][0], y: ow.y + HEAD[d][1] };   // approach against arrow
  assert.equal(g._open(behind.x, behind.y, d), true, 'enter along the arrow');
  assert.equal(g._open(ahead.x, ahead.y, opp), false, 'blocked against the arrow');
});

test('tunnel (shortcut): entering a mouth teleports to its pair and reveals the pairing', () => {
  const { g } = makeGame(['p1'], 5);
  const tun = g.maze.tunnels[0];
  assert.ok(tun, 'a tunnel exists');
  const entry = entryInto(g, tun.a);
  assert.ok(entry, 'can approach a mouth');
  assert.equal(g.discovered[tun.id], undefined, 'undiscovered before traversal');
  placeAndDrive(g, 'p1', entry, entry.dir, 40);
  assert.equal(g.discovered[tun.id], true, 'pairing learned on traversal');
  assert.notDeepEqual([g.players.p1.tx, g.players.p1.ty], [tun.a.x, tun.a.y]);
});

test('tunnel: player HALTS at the exit mouth and waits for input (no auto-flow onward)', () => {
  const { g } = makeGame(['p1'], 5);
  const tun = g.maze.tunnels[0];
  assert.ok(tun, 'a tunnel exists');
  const entry = entryInto(g, tun.a);
  assert.ok(entry, 'can approach a mouth');
  placeAndDrive(g, 'p1', entry, entry.dir, 60); // run in, teleport, then keep ticking
  const p = g.players.p1;
  // Emerged at the partner mouth (b) and stopped there with no heading — the
  // buffered input that carried them in is cleared, so they don't shoot onward.
  assert.deepEqual([p.tx, p.ty], [tun.b.x, tun.b.y], 'parked on the exit mouth');
  assert.equal(p.dir, null, 'stopped — waiting for a fresh swipe');
  assert.equal(p.nextDir, null, 'no stale buffered turn carried through the tunnel');
});

test('drop-wall: drops behind the player and blocks reversing into it', () => {
  const { g } = makeGame(['p1'], 5);
  const sx = g.players.p1.tx, sy = g.players.p1.ty;
  const dir = plainOpenHeading(g, sx, sy);
  g.processInput('p1', dir);
  g.update(1000 / 6); // advance one tile, setting lastHeading
  const p = g.players.p1, W = g.maze.width;
  assert.deepEqual([p.tx, p.ty], [sx + HEAD[dir][0], sy + HEAD[dir][1]], 'moved one tile');
  assert.equal(g._open(p.tx, p.ty, OPP[dir]), true, 'can reverse before the wall');
  assert.equal(g.dropWall('p1'), true, 'wall placed');
  assert.ok(g.walls[sy * W + sx], 'wall on the vacated tile');
  assert.equal(g._open(p.tx, p.ty, OPP[dir]), false, 'wall now blocks reversing into it');
});

test('drop-wall: respects the per-player cooldown', () => {
  const { g } = makeGame(['p1'], 5);
  const dir = plainOpenHeading(g, g.players.p1.tx, g.players.p1.ty);
  g.processInput('p1', dir); g.update(1000 / 6);
  assert.equal(g.dropWall('p1'), true);
  assert.equal(g.dropWall('p1'), false, 'second drop while on cooldown is rejected');
});

test('drop-wall: expires after its TTL', () => {
  const { g } = makeGame(['p1'], 5);
  const sx = g.players.p1.tx, sy = g.players.p1.ty, W = g.maze.width;
  const dir = plainOpenHeading(g, sx, sy);
  g.processInput('p1', dir); g.update(1000 / 6);
  assert.equal(g.dropWall('p1'), true);
  assert.ok(g.walls[sy * W + sx]);
  g.players.p1.dir = null; g.players.p1.nextDir = null; // park the player so it can't win mid-test
  const ticks = Math.ceil(g.wallTtl / 16) + 4;
  for (let i = 0; i < ticks; i++) g.update(16);
  assert.equal(g.walls[sy * W + sx], undefined, 'wall expired after TTL');
});

test('drop-wall: refuses to wall the exit or before the player has moved', () => {
  const { g } = makeGame(['p1'], 5);
  // Fresh player has never moved -> no previous tile -> cannot drop.
  assert.equal(g.dropWall('p1'), false, 'no previous tile yet');
  // Make the previously-vacated tile the exit; must be rejected.
  const ex = g.maze.exit, p = g.players.p1;
  p.prevX = ex.x; p.prevY = ex.y; p.lastDropAt = -Infinity;
  assert.equal(g.dropWall('p1'), false, 'cannot wall the exit');
});

test('drop-wall: works when stopped at a junction but never seals a dead-end', () => {
  const { g } = makeGame(['p1'], 5);
  const W = g.maze.width, H = g.maze.height;
  const opensOf = (x, y) => Object.keys(HEAD).filter((n) => {
    const nx = x + HEAD[n][0], ny = y + HEAD[n][1];
    return nx >= 0 && nx < W && ny >= 0 && ny < H && g.maze.tiles[ny * W + nx] !== TILE.WALL;
  }).map((n) => ({ x: x + HEAD[n][0], y: y + HEAD[n][1] }));
  // A dead-end (one open neighbour): walling that neighbour would trap -> rejected.
  let dead = null, entrance = null;
  for (let y = 1; y < H - 1 && !dead; y++) for (let x = 1; x < W - 1; x++) {
    if (g.maze.tiles[y * W + x] === TILE.WALL || (y * W + x) === g.exitIdx) continue;
    const o = opensOf(x, y);
    if (o.length === 1 && !g.tunnelByTile[o[0].y * W + o[0].x]) { dead = { x, y }; entrance = o[0]; break; }
  }
  assert.ok(dead, 'found a dead-end');
  const p = g.players.p1;
  p.tx = dead.x; p.ty = dead.y; p.prevX = entrance.x; p.prevY = entrance.y; p.lastDropAt = -Infinity;
  assert.equal(g.dropWall('p1'), false, 'cannot seal the only exit of a dead-end player');

  // A junction tile (>=2 open neighbours): stopped there, walling behind is fine.
  let junc = null, came = null;
  for (let y = 1; y < H - 1 && !junc; y++) for (let x = 1; x < W - 1; x++) {
    if (g.maze.tiles[y * W + x] === TILE.WALL || (y * W + x) === g.exitIdx || g.tunnelByTile[y * W + x]) continue;
    const o = opensOf(x, y).filter((t) => !g.tunnelByTile[t.y * W + t.x] && (t.y * W + t.x) !== g.exitIdx);
    if (o.length >= 2) { junc = { x, y }; came = o[0]; break; }
  }
  assert.ok(junc, 'found a junction');
  const p2 = g.players.p1;
  p2.tx = junc.x; p2.ty = junc.y; p2.dir = null; p2.prevX = came.x; p2.prevY = came.y; p2.lastDropAt = -Infinity;
  assert.equal(g.dropWall('p1'), true, 'can drop while stopped at a junction (blocks a chokepoint)');
});

test('auto-turn: the character follows a forced corner with no input', () => {
  const { g } = makeGame(['p1'], 7);
  const W = g.maze.width, H = g.maze.height, DIRS = Object.keys(HEAD);
  // An L-corner: exactly two open neighbours, perpendicular.
  let T = null, blockedDir = null, expect = null;
  for (let y = 1; y < H - 1 && !T; y++) for (let x = 1; x < W - 1; x++) {
    if (g.maze.tiles[y * W + x] === TILE.WALL || g.tunnelByTile[y * W + x]) continue;
    const opens = DIRS.filter((d) => g._open(x, y, d));
    if (opens.length === 2 && OPP[opens[0]] !== opens[1]) {
      T = { x, y }; blockedDir = OPP[opens[0]]; expect = opens[1]; // came from opens[0]; straight (blockedDir) is a wall
      break;
    }
  }
  assert.ok(T, 'found an L-corner');
  const p = g.players.p1;
  p.tx = T.x; p.ty = T.y; p.dir = blockedDir; p.nextDir = null; p.prog = 0; p.lastTunnelTile = -1;
  g.update(1000 / 600); // no input
  assert.equal(g.players.p1.dir, expect, 'auto-turned into the only non-reverse opening');
});

test('stops at a crossing with no buffered input (forces a deliberate choice)', () => {
  const { g } = makeGame(['p1'], 7);
  const W = g.maze.width, H = g.maze.height, DIRS = Object.keys(HEAD);
  // A real crossing: 3+ open neighbours (so any approach leaves >=2 ways on).
  let J = null;
  for (let y = 1; y < H - 1 && !J; y++) for (let x = 1; x < W - 1; x++) {
    if (g.maze.tiles[y * W + x] === TILE.WALL || g.tunnelByTile[y * W + x]) continue;
    if (DIRS.filter((d) => g._open(x, y, d)).length >= 3) J = { x, y };
  }
  assert.ok(J, 'found a 3+ way crossing');
  const into = DIRS.find((d) => g._open(J.x, J.y, d));
  const p = g.players.p1;
  p.tx = J.x; p.ty = J.y; p.dir = into; p.nextDir = null; p.prog = 0; p.lastTunnelTile = -1;
  g.update(1000 / 600); // arrive at the crossing centre, no input
  assert.equal(g.players.p1.dir, null, 'character halts at the crossing until the player chooses');

  // And a buffered swipe lets it flow straight through without stopping.
  const turn = DIRS.find((d) => d !== into && g._open(J.x, J.y, d));
  p.dir = into; p.nextDir = null; p.prog = 0;
  g.processInput('p1', turn);
  g.update(1000 / 600);
  assert.equal(g.players.p1.dir, turn, 'a pre-committed swipe flows through the crossing');
});

test('auto-turn does NOT auto-reverse at a dead-end (it stops)', () => {
  const { g } = makeGame(['p1'], 7);
  const W = g.maze.width, H = g.maze.height, DIRS = Object.keys(HEAD);
  let T = null, into = null;
  for (let y = 1; y < H - 1 && !T; y++) for (let x = 1; x < W - 1; x++) {
    if (g.maze.tiles[y * W + x] === TILE.WALL || g.tunnelByTile[y * W + x]) continue;
    const opens = DIRS.filter((d) => g._open(x, y, d));
    if (opens.length === 1) { T = { x, y }; into = OPP[opens[0]]; break; } // only exit is the way we came
  }
  assert.ok(T, 'found a dead-end');
  const p = g.players.p1;
  p.tx = T.x; p.ty = T.y; p.dir = into; p.nextDir = null; p.prog = 0; p.lastTunnelTile = -1;
  g.update(1000 / 600);
  assert.equal(g.players.p1.dir, null, 'stops instead of bouncing back');
});

test('cornering grace: a turn buffered just past a junction still applies', () => {
  const { g } = makeGame(['p1'], 7);
  const W = g.maze.width, H = g.maze.height;
  let J = null;
  for (let y = 1; y < H - 1 && !J; y++) for (let x = 1; x < W - 1; x++) {
    if (g.maze.tiles[y * W + x] === TILE.WALL || g.tunnelByTile[y * W + x]) continue;
    if (g._open(x, y, 'right') && g._open(x, y, 'up')) { J = { x, y }; break; }
  }
  assert.ok(J, 'found a junction with right + up exits');
  const p = g.players.p1;
  p.tx = J.x; p.ty = J.y; p.dir = 'right'; p.nextDir = null; p.prog = 0.2; p.lastTunnelTile = -1;
  g.processInput('p1', 'up');   // swipe lands 0.2 tile PAST the centre
  g.update(1000 / 600);
  assert.equal(g.getSnapshot().players[0].dir, 'up', 'snapped back and took the late turn');
});

// BFS to the exit avoiding tunnel mouths (a walk-only solution is guaranteed);
// returns tileIndex -> heading-to-leave. A player who buffers the turn one tile
// early (as a human pre-swipes) follows it cleanly with no oscillation.
function routeToExit(g, p) {
  const W = g.maze.width, H = g.maze.height;
  const oneWay = {}; for (const o of g.maze.oneWays) oneWay[o.y * W + o.x] = o.dir;
  const blocked = {}; g.maze.tunnels.forEach((t) => { blocked[t.a.y * W + t.a.x] = 1; blocked[t.b.y * W + t.b.x] = 1; });
  const DIRS = [['up', 0, -1], ['right', 1, 0], ['down', 0, 1], ['left', -1, 0]];
  const goal = g.maze.exit.y * W + g.maze.exit.x, s = p.ty * W + p.tx;
  const prev = new Int32Array(W * H).fill(-2); prev[s] = -1; const q = [s]; let h = 0;
  while (h < q.length) {
    const idx = q[h++]; if (idx === goal) break;
    const x = idx % W, y = (idx - x) / W;
    for (const [nm, dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const ni = ny * W + nx;
      if (g.maze.tiles[ni] === TILE.WALL || prev[ni] !== -2 || blocked[ni]) continue;
      if (oneWay[ni] && oneWay[ni] !== nm) continue;
      prev[ni] = idx; q.push(ni);
    }
  }
  if (prev[goal] === -2) return null;
  const route = {}; let c = goal;
  while (prev[c] !== -1) {
    const pr = prev[c], cx = c % W, cy = (c - cx) / W, px = pr % W, py = (pr - px) / W;
    route[pr] = cx > px ? 'right' : cx < px ? 'left' : cy > py ? 'down' : 'up';
    c = pr;
  }
  return route;
}

test('navigation race is solvable by playing: a player reaches the visible exit across seeds', () => {
  const HD = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
  for (let seed = 1; seed <= 25; seed++) {
    const { g, getEnded } = makeGame(['solo'], seed);
    const W = g.maze.width, dt = 1000 / 60;
    let route = routeToExit(g, g.players.solo);
    assert.ok(route, `seed ${seed} has a walk route to the exit`);
    let guard = 8000;
    while (!getEnded() && guard-- > 0) {
      const p = g.players.solo;
      // Buffer the turn for the tile we're approaching (one ahead while moving).
      const ax = p.dir && p.prog > 0 ? p.tx + HD[p.dir][0] : p.tx;
      const ay = p.dir && p.prog > 0 ? p.ty + HD[p.dir][1] : p.ty;
      let dir = route[ay * W + ax];
      if (dir === undefined) dir = route[p.ty * W + p.tx];
      if (dir === undefined) { route = routeToExit(g, p) || route; dir = route[p.ty * W + p.tx]; }
      if (dir) g.processInput('solo', dir);
      g.update(dt);
    }
    assert.ok(getEnded(), `seed ${seed} solved`);
    assert.equal(g.players.solo.finished, true, `seed ${seed} player reached the exit`);
  }
});

test('reaching the exit tile wins the round (first finisher ends the game)', () => {
  const { g, events, getEnded } = makeGame(['p1', 'idler'], 5);
  const entry = entryInto(g, g.maze.exit);
  assert.ok(entry, 'can approach the exit');
  placeAndDrive(g, 'p1', entry, entry.dir, 40);
  assert.equal(g.players.p1.finished, true, 'reached the exit');
  assert.ok(getEnded(), 'game ended on first finisher');
  const win = events.find((e) => e.type === 'player_win');
  assert.ok(win && win.playerId === 'p1' && win.rank === 1);
  assert.equal(getEnded().results[0].playerId, 'p1');
  assert.equal(getEnded().results[0].finished, true);
});
