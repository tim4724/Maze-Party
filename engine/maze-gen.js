'use strict';

// =====================================================================
// Maze generation — pure, seeded, isomorphic (Node + browser).
// Navigation-race model: a single fixed EXIT (always shown as a beacon),
// loops via braiding, and a few TUNNEL pairs that act as optional learnable
// shortcuts (teleport to pair; never required to reach the exit).
//
// Solvability guarantee: the exit is always reachable from start by WALKING
// with every tunnel mouth treated as impassable and one-ways respected — so
// tunnels are a bonus, never a gate, and no layout is unwinnable.
// =====================================================================

(function (exports) {

  var TILE = { WALL: 0, FLOOR: 1 };

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var DIRS = [
    { name: 'up', dx: 0, dy: -1 }, { name: 'right', dx: 1, dy: 0 },
    { name: 'down', dx: 0, dy: 1 }, { name: 'left', dx: -1, dy: 0 }
  ];
  var OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

  function bfsDistances(width, height, tiles, sources) {
    var dist = new Int32Array(width * height).fill(-1);
    var queue = [], head = 0;
    for (var s = 0; s < sources.length; s++) {
      var si = sources[s].y * width + sources[s].x;
      if (dist[si] === -1) { dist[si] = 0; queue.push(si); }
    }
    while (head < queue.length) {
      var idx = queue[head++], x = idx % width, y = (idx - x) / width, d = dist[idx];
      for (var k = 0; k < DIRS.length; k++) {
        var nx = x + DIRS[k].dx, ny = y + DIRS[k].dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        var ni = ny * width + nx;
        if (tiles[ni] === TILE.WALL || dist[ni] !== -1) continue;
        dist[ni] = d + 1; queue.push(ni);
      }
    }
    return dist;
  }

  // Directed reachability honouring one-ways; `blocked` (index->truthy) marks
  // extra impassable tiles (used to treat tunnel mouths as walls).
  function directedReachable(width, height, tiles, oneWayDir, start, blocked) {
    var seen = new Uint8Array(width * height);
    var q = [start.y * width + start.x], head = 0;
    seen[q[0]] = 1;
    while (head < q.length) {
      var idx = q[head++], x = idx % width, y = (idx - x) / width;
      for (var k = 0; k < DIRS.length; k++) {
        var nx = x + DIRS[k].dx, ny = y + DIRS[k].dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        var ni = ny * width + nx;
        if (tiles[ni] === TILE.WALL || seen[ni]) continue;
        if (blocked && blocked[ni]) continue;
        var ow = oneWayDir[ni];
        if (ow && ow !== DIRS[k].name) continue;
        seen[ni] = 1; q.push(ni);
      }
    }
    return seen;
  }

  // Reverse of directedReachable: the set of tiles that can REACH `goal` under
  // one-way-aware movement (BFS over reversed edges). A forward move A->B (B =
  // A + d) is legal iff B's one-way, if any, permits direction d; so from B we
  // can step back to predecessor A. Used to detect one-way "roach-motel" traps.
  function reverseDirectedReachable(width, height, tiles, oneWayDir, goal, blocked) {
    var seen = new Uint8Array(width * height);
    var gi = goal.y * width + goal.x;
    if (tiles[gi] === TILE.WALL || (blocked && blocked[gi])) return seen;
    seen[gi] = 1; var q = [gi], head = 0;
    while (head < q.length) {
      var idx = q[head++], x = idx % width, y = (idx - x) / width;
      for (var k = 0; k < DIRS.length; k++) {
        var ax = x - DIRS[k].dx, ay = y - DIRS[k].dy; // predecessor A of B=idx via dir k
        if (ax < 0 || ax >= width || ay < 0 || ay >= height) continue;
        var ai = ay * width + ax;
        if (tiles[ai] === TILE.WALL || seen[ai]) continue;
        if (blocked && blocked[ai]) continue;
        var ow = oneWayDir[idx]; // the one-way (if any) is on the entered tile B
        if (ow && ow !== DIRS[k].name) continue;
        seen[ai] = 1; q.push(ai);
      }
    }
    return seen;
  }

  // Forward reachability honouring one-ways AND tunnel teleports: stepping onto
  // a mouth lands you on its partner (you never rest on the mouth you entered).
  // `partner` maps a mouth tile index to its pair's index. Returns the set of
  // tiles a player can actually come to stand on from `start`.
  function tunnelReachable(width, height, tiles, oneWayDir, partner, start) {
    var seen = new Uint8Array(width * height);
    var resolve = function (i) { return partner[i] != null ? partner[i] : i; };
    var s = resolve(start.y * width + start.x);
    var q = [s], head = 0; seen[s] = 1;
    while (head < q.length) {
      var idx = q[head++], x = idx % width, y = (idx - x) / width;
      for (var k = 0; k < DIRS.length; k++) {
        var nx = x + DIRS[k].dx, ny = y + DIRS[k].dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        var ni = ny * width + nx;
        if (tiles[ni] === TILE.WALL) continue;
        var ow = oneWayDir[ni];
        if (ow && ow !== DIRS[k].name) continue;
        var r = resolve(ni); // entering a mouth teleports you to its partner
        if (seen[r]) continue;
        seen[r] = 1; q.push(r);
      }
    }
    return seen;
  }

  // Companion to tunnelReachable: the set of tiles from which `goal` is reachable
  // under one-way + tunnel movement. Built by reversing every legal transition
  // u -> resolve(v) (v = u + dir), then BFS backwards from the goal.
  function tunnelCanReach(width, height, tiles, oneWayDir, partner, goal) {
    var N = width * height;
    var resolve = function (i) { return partner[i] != null ? partner[i] : i; };
    var preds = {};
    for (var u = 0; u < N; u++) {
      if (tiles[u] === TILE.WALL) continue;
      var x = u % width, y = (u - x) / width;
      for (var k = 0; k < DIRS.length; k++) {
        var nx = x + DIRS[k].dx, ny = y + DIRS[k].dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        var ni = ny * width + nx;
        if (tiles[ni] === TILE.WALL) continue;
        var ow = oneWayDir[ni];
        if (ow && ow !== DIRS[k].name) continue;
        var w = resolve(ni);
        (preds[w] || (preds[w] = [])).push(u);
      }
    }
    var can = new Uint8Array(N), gi = goal.y * width + goal.x;
    can[gi] = 1; var q = [gi], head = 0;
    while (head < q.length) {
      var ps = preds[q[head++]];
      if (!ps) continue;
      for (var i = 0; i < ps.length; i++) if (!can[ps[i]]) { can[ps[i]] = 1; q.push(ps[i]); }
    }
    return can;
  }

  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function openDirs(width, height, tiles, x, y) {
    var out = [];
    for (var k = 0; k < DIRS.length; k++) {
      var nx = x + DIRS[k].dx, ny = y + DIRS[k].dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      if (tiles[ny * width + nx] !== TILE.WALL) out.push(DIRS[k].name);
    }
    return out;
  }

  function generate(seed, opts) {
    opts = opts || {};
    var cellW = opts.cellW || 10;
    var cellH = opts.cellH || 10;
    var braid = opts.braid != null ? opts.braid : 0.3;
    var tunnelPairs = opts.tunnelPairs != null ? opts.tunnelPairs : 3;
    var oneWayCount = opts.oneWays != null ? opts.oneWays : 8;
    var rng = mulberry32((seed >>> 0) || 1);

    var width = cellW * 2 + 1, height = cellH * 2 + 1;
    var tiles = new Uint8Array(width * height);
    var tIdx = function (x, y) { return y * width + x; };
    var roomX = function (cx) { return cx * 2 + 1; };
    var roomY = function (cy) { return cy * 2 + 1; };

    // --- Randomized DFS ---
    var visited = new Uint8Array(cellW * cellH);
    var cIdx = function (cx, cy) { return cy * cellW + cx; };
    var startCx = Math.floor(rng() * cellW), startCy = Math.floor(rng() * cellH);
    visited[cIdx(startCx, startCy)] = 1;
    tiles[tIdx(roomX(startCx), roomY(startCy))] = TILE.FLOOR;
    var stack = [[startCx, startCy]];
    while (stack.length) {
      var top = stack[stack.length - 1], cx = top[0], cy = top[1];
      var nbrs = [];
      for (var d = 0; d < DIRS.length; d++) {
        var nx = cx + DIRS[d].dx, ny = cy + DIRS[d].dy;
        if (nx >= 0 && nx < cellW && ny >= 0 && ny < cellH && !visited[cIdx(nx, ny)]) nbrs.push(d);
      }
      if (!nbrs.length) { stack.pop(); continue; }
      var dir = DIRS[nbrs[Math.floor(rng() * nbrs.length)]];
      var ncx = cx + dir.dx, ncy = cy + dir.dy;
      tiles[tIdx(roomX(cx) + dir.dx, roomY(cy) + dir.dy)] = TILE.FLOOR;
      tiles[tIdx(roomX(ncx), roomY(ncy))] = TILE.FLOOR;
      visited[cIdx(ncx, ncy)] = 1;
      stack.push([ncx, ncy]);
    }

    // --- Braid ---
    for (var by = 0; by < cellH; by++) {
      for (var bx = 0; bx < cellW; bx++) {
        var openD = [], closedD = [];
        for (var dd = 0; dd < DIRS.length; dd++) {
          var tnx = bx + DIRS[dd].dx, tny = by + DIRS[dd].dy;
          if (tnx < 0 || tnx >= cellW || tny < 0 || tny >= cellH) continue;
          var wx = roomX(bx) + DIRS[dd].dx, wy = roomY(by) + DIRS[dd].dy;
          if (tiles[tIdx(wx, wy)] === TILE.FLOOR) openD.push(dd); else closedD.push(dd);
        }
        if (openD.length === 1 && closedD.length && rng() < braid) {
          var pick = closedD[Math.floor(rng() * closedD.length)];
          tiles[tIdx(roomX(bx) + DIRS[pick].dx, roomY(by) + DIRS[pick].dy)] = TILE.FLOOR;
        }
      }
    }

    var start = { x: roomX(startCx), y: roomY(startCy) };
    var toPt = function (idx) { return { x: idx % width, y: Math.floor(idx / width) }; };

    // --- Exit: the farthest floor tile from start (a real goal to race to) ---
    var dist = bfsDistances(width, height, tiles, [start]);
    var best = -1, exitIdx = start.y * width + start.x;
    for (var i = 0; i < dist.length; i++) if (dist[i] > best) { best = dist[i]; exitIdx = i; }
    var exit = toPt(exitIdx);

    // Reserve start/exit (+neighbours) so nothing special spawns on them.
    var reserved = {};
    var reserve = function (pt) {
      reserved[pt.y * width + pt.x] = 1;
      for (var k = 0; k < DIRS.length; k++) reserved[(pt.y + DIRS[k].dy) * width + (pt.x + DIRS[k].dx)] = 1;
    };
    reserve(start); reserve(exit);

    var oneWayDir = {};
    var mouthBlocked = {}; // tunnel mouths treated as walls for the walk-only solvability check
    var exitReachable = function () {
      return !!directedReachable(width, height, tiles, oneWayDir, start, mouthBlocked)[exitIdx];
    };

    // --- Tunnel pairs (optional shortcuts) ---
    // Placed incrementally: a pair is kept only if blocking both mouths still
    // leaves the exit walk-reachable — guaranteeing tunnels are never required.
    var floors = [];
    for (var fi = 0; fi < tiles.length; fi++) if (tiles[fi] !== TILE.WALL && !reserved[fi]) floors.push(fi);
    var pool = shuffle(floors.slice(), rng);
    var usedMouth = {};
    var nearUsed = function (idx) {
      if (usedMouth[idx] || reserved[idx]) return true;
      var x = idx % width, y = (idx - x) / width;
      for (var k = 0; k < DIRS.length; k++) if (usedMouth[(y + DIRS[k].dy) * width + (x + DIRS[k].dx)]) return true;
      return false;
    };
    var tunnels = [];
    var pid = 0, pi = 0;
    while (tunnels.length < tunnelPairs && pi < pool.length) {
      var ma = null, mb = null;
      for (; pi < pool.length && (ma == null || mb == null); pi++) {
        if (pool[pi] == null || nearUsed(pool[pi])) continue;
        if (ma == null) ma = pool[pi]; else mb = pool[pi];
      }
      if (ma == null || mb == null) break;
      mouthBlocked[ma] = 1; mouthBlocked[mb] = 1;
      if (exitReachable()) {
        usedMouth[ma] = usedMouth[mb] = 1;
        tunnels.push({ id: pid++, a: toPt(ma), b: toPt(mb) });
      } else {
        delete mouthBlocked[ma]; delete mouthBlocked[mb]; // would gate the exit — skip
      }
    }

    // Mouth -> partner map: lets the trap check below model tunnels as the
    // teleports they actually are (not walls), so one-ways can't strand a
    // player who arrived somewhere via a tunnel.
    var partner = {};
    for (var tp = 0; tp < tunnels.length; tp++) {
      var pai = tunnels[tp].a.y * width + tunnels[tp].a.x;
      var pbi = tunnels[tp].b.y * width + tunnels[tp].b.x;
      partner[pai] = pbi; partner[pbi] = pai;
    }

    // --- One-ways: straight corridors only, kept only if the exit stays
    // walk-reachable (mouths still treated as walls). ---
    var owCandidates = [];
    for (var oy = 1; oy < height - 1; oy++) {
      for (var ox = 1; ox < width - 1; ox++) {
        var oi = tIdx(ox, oy);
        if (tiles[oi] === TILE.WALL || usedMouth[oi] || reserved[oi]) continue;
        var od = openDirs(width, height, tiles, ox, oy);
        if (od.length === 2 && OPPOSITE[od[0]] === od[1]) owCandidates.push(oi);
      }
    }
    // A one-way is kept only if it creates NO trap: every tile reachable from
    // start (walking; tunnel mouths as walls) must still be able to reach the
    // exit. Strictly stronger than exit-reachable-from-start — this is what
    // prevents one-way "roach motels" (drive in, arrow won't let you back out).
    var noTrap = function () {
      // (a) Walking world (tunnel mouths as walls): a pure walker is never trapped.
      var fwd = directedReachable(width, height, tiles, oneWayDir, start, mouthBlocked);
      var rev = reverseDirectedReachable(width, height, tiles, oneWayDir, exit, mouthBlocked);
      for (var i = 0; i < fwd.length; i++) if (fwd[i] && !rev[i]) return false;
      // (b) Full movement model (tunnels usable as teleports): a player who takes
      // a tunnel must never land somewhere they can no longer reach the exit from.
      var fwdT = tunnelReachable(width, height, tiles, oneWayDir, partner, start);
      var canT = tunnelCanReach(width, height, tiles, oneWayDir, partner, exit);
      for (var j = 0; j < fwdT.length; j++) if (fwdT[j] && !canT[j]) return false;
      return true;
    };
    shuffle(owCandidates, rng);
    var oneWays = [];
    for (var oc = 0; oc < owCandidates.length && oneWays.length < oneWayCount; oc++) {
      var ci = owCandidates[oc], cx2 = ci % width, cy2 = (ci - cx2) / width;
      var dirsHere = openDirs(width, height, tiles, cx2, cy2);
      oneWayDir[ci] = dirsHere[Math.floor(rng() * 2)];
      if (noTrap()) oneWays.push({ x: cx2, y: cy2, dir: oneWayDir[ci] });
      else delete oneWayDir[ci];
    }

    return {
      width: width, height: height, tiles: tiles,
      start: start, exit: exit, cellW: cellW, cellH: cellH,
      tunnels: tunnels, oneWays: oneWays
    };
  }

  // Is the exit reachable by walking (tunnel mouths as walls, one-ways honoured)?
  // The generator guarantees this; exported for tests.
  function solvable(maze) {
    var W = maze.width, oneWayDir = {}, blocked = {};
    for (var o = 0; o < maze.oneWays.length; o++) oneWayDir[maze.oneWays[o].y * W + maze.oneWays[o].x] = maze.oneWays[o].dir;
    for (var t = 0; t < maze.tunnels.length; t++) {
      blocked[maze.tunnels[t].a.y * W + maze.tunnels[t].a.x] = 1;
      blocked[maze.tunnels[t].b.y * W + maze.tunnels[t].b.x] = 1;
    }
    return !!directedReachable(W, maze.height, maze.tiles, oneWayDir, maze.start, blocked)[maze.exit.y * W + maze.exit.x];
  }

  exports.TILE = TILE;
  exports.DIRS = DIRS;
  exports.OPPOSITE = OPPOSITE;
  exports.mulberry32 = mulberry32;
  exports.bfsDistances = bfsDistances;
  exports.directedReachable = directedReachable;
  exports.reverseDirectedReachable = reverseDirectedReachable;
  exports.tunnelReachable = tunnelReachable;
  exports.tunnelCanReach = tunnelCanReach;
  exports.solvable = solvable;
  exports.generate = generate;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.MazeGen = {}));
