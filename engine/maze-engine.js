'use strict';

// =====================================================================
// Maze engine — authoritative sim. Pure, isomorphic (Node + browser).
// Display contract (mirrors the old HexStacker Game):
//   new Game(players, callbacks, seed)
//   .init() / .update(dt) / .getSnapshot() / .getResults()
//   .pause() / .resume() / .processInput(id, 'up'|'down'|'left'|'right')
//
// Mechanics (navigation-race model):
//  - Auto-run + buffered-turn-at-junction movement (swipe sets heading).
//  - A single fixed EXIT, shown as an always-visible beacon (known where,
//    find the path). First to reach it wins the round.
//  - Shared, permanent fog: tiles near any player reveal for everyone.
//  - Tunnels are optional learnable shortcuts: entering a mouth teleports to
//    its pair; both mouths gain a shared colour once traversed.
//  - One-way tiles: passable only along their arrow direction.
// =====================================================================

(function (exports) {

  var MazeGen = (typeof module !== 'undefined' && module.exports)
    ? require('./maze-gen') : window.MazeGen;
  var GC = (typeof module !== 'undefined' && module.exports)
    ? require('./constants') : window.GameConstants;

  var TILE = MazeGen.TILE;
  var HEADINGS = {
    up: { dx: 0, dy: -1 }, right: { dx: 1, dy: 0 },
    down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }
  };
  var REVERSE = { up: 'down', down: 'up', left: 'right', right: 'left' };
  // 4-neighbour deltas (N, E, S, W). Module-level so hot-path scans like
  // _reveal don't re-allocate the array per neighbour, per visited tile.
  var DELTAS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

  function Game(players, callbacks, seed) {
    this.callbacks = callbacks || {};
    this.seed = (seed >>> 0) || 1;
    this.playerIds = [];
    if (players && typeof players.forEach === 'function') {
      players.forEach(function (_opts, id) { this.playerIds.push(id); }, this);
    }
    this.speed = GC.MOVE_SPEED_TPS;
    this.revealRadius = GC.REVEAL_RADIUS;
    this.wallTtl = GC.WALL_TTL_MS;
    this.wallCooldown = GC.WALL_COOLDOWN_MS;
    this.elapsed = 0;
    this.paused = false;
    this.ended = false;
    this.finishOrder = [];
  }

  Game.prototype.init = function () {
    this.maze = MazeGen.generate(this.seed, {
      cellW: GC.CELL_W, cellH: GC.CELL_H, braid: GC.BRAID,
      tunnelPairs: GC.TUNNEL_PAIRS, oneWays: GC.ONE_WAY_TILES
    });
    var W = this.maze.width, H = this.maze.height;

    // Tile-indexed lookups for fast sim queries.
    this.tunnelByTile = {};      // idx -> { pairId, partner: idx } — all tunnels are shortcuts
    var t = this.maze.tunnels;
    for (var i = 0; i < t.length; i++) {
      var ai = t[i].a.y * W + t[i].a.x, bi = t[i].b.y * W + t[i].b.x;
      this.tunnelByTile[ai] = { pairId: t[i].id, partner: bi };
      this.tunnelByTile[bi] = { pairId: t[i].id, partner: ai };
    }
    this.exitIdx = this.maze.exit.y * W + this.maze.exit.x;
    this.oneWayByTile = {};      // idx -> arrow dir name
    for (var o = 0; o < this.maze.oneWays.length; o++) {
      var ow = this.maze.oneWays[o];
      this.oneWayByTile[ow.y * W + ow.x] = ow.dir;
    }

    this.revealed = new Uint8Array(W * H);   // shared fog (1 = revealed)
    this.discovered = {};                    // pairId -> true once traversed
    this.walls = {};                         // tileIdx -> { expireAt, by } temporary dropped walls

    var start = this.maze.start;
    this.players = {};
    for (var p = 0; p < this.playerIds.length; p++) {
      var id = this.playerIds[p];
      this.players[id] = {
        id: id, tx: start.x, ty: start.y,
        dir: null, nextDir: null, prog: 0,
        finished: false, lastTunnelTile: -1,
        prevX: null, prevY: null, lastDropAt: -Infinity
      };
    }
    this._reveal(start.x, start.y);
  };

  // A tile is enterable if in bounds, not a (static or dropped) wall, and — if
  // it's a one-way — only when travelling along its arrow direction.
  Game.prototype._open = function (x, y, dirName) {
    var h = HEADINGS[dirName];
    if (!h) return false;
    var nx = x + h.dx, ny = y + h.dy;
    if (nx < 0 || nx >= this.maze.width || ny < 0 || ny >= this.maze.height) return false;
    var ni = ny * this.maze.width + nx;
    if (this.maze.tiles[ni] === TILE.WALL || this.walls[ni]) return false;
    var ow = this.oneWayByTile[ni];
    if (ow && ow !== dirName) return false; // can't enter against the arrow
    return true;
  };

  Game.prototype.processInput = function (playerId, dirName) {
    var p = this.players && this.players[playerId];
    if (!p || p.finished || !HEADINGS[dirName]) return;
    p.nextDir = dirName;
  };

  // Would tile `idx` (about to become a wall) leave player `q` with no legal
  // move at all? Temporary walls may block routes and chokepoints freely — that
  // is the whole point — but must never fully immobilise someone for the TTL.
  Game.prototype._wouldTrap = function (q, idx) {
    var W = this.maze.width, H = this.maze.height;
    for (var k = 0; k < 4; k++) {
      var nx = q.tx + DELTAS[k][0], ny = q.ty + DELTAS[k][1];
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      var ni = ny * W + nx;
      if (ni === idx || this.maze.tiles[ni] === TILE.WALL || this.walls[ni]) continue;
      return false; // has at least one open neighbour
    }
    return true;
  };

  // Drop a temporary wall on the tile the player just left (their wake) — works
  // whether running or stopped at a junction. Temporary, so it may block key
  // chokepoints/bridges ("important points for 5s"). Rejected on cooldown, or
  // for an unfair target (off-map, the exit, a tunnel mouth, an existing wall,
  // an occupied tile, or one that would fully trap any player for the duration).
  Game.prototype.dropWall = function (playerId) {
    var p = this.players && this.players[playerId];
    if (!p || p.finished || p.prevX == null) return false; // hasn't moved yet
    if (this.elapsed - p.lastDropAt < this.wallCooldown) return false;

    var W = this.maze.width, tx = p.prevX, ty = p.prevY;
    var idx = ty * W + tx;
    if (this.maze.tiles[idx] === TILE.WALL || this.walls[idx]) return false;
    if (idx === this.exitIdx || this.tunnelByTile[idx]) return false;
    for (var i = 0; i < this.playerIds.length; i++) {
      var q = this.players[this.playerIds[i]];
      if (q.tx === tx && q.ty === ty) return false;          // never wall a tile someone is on
      if (!q.finished && this._wouldTrap(q, idx)) return false; // never fully immobilise anyone
    }

    this.walls[idx] = { expireAt: this.elapsed + this.wallTtl, by: playerId };
    p.lastDropAt = this.elapsed;
    if (this.callbacks.onEvent) this.callbacks.onEvent({ type: 'wall_dropped', playerId: playerId, x: tx, y: ty });
    return true;
  };

  Game.prototype._chooseDir = function (p) {
    // 1. A buffered swipe always wins — pre-commit your turn before a crossing
    //    and you flow straight through without stopping.
    if (p.nextDir && this._open(p.tx, p.ty, p.nextDir)) {
      p.dir = p.nextDir; p.nextDir = null; return;
    }
    // 2. Auto-flow ONLY while moving and ONLY when there's exactly one way
    //    forward (a corridor or a forced corner — not a decision). The character
    //    follows bends itself, so corridors need no input.
    if (p.dir) {
      var back = REVERSE[p.dir], only = null, count = 0;
      for (var d in HEADINGS) {
        if (d === back || !this._open(p.tx, p.ty, d)) continue;
        only = d; count++;
      }
      if (count === 1) { p.dir = only; return; }
    }
    // 3. A real crossing (2+ ways) or a dead-end: stop and wait for the player
    //    to choose. This forces a deliberate input at every junction.
    p.dir = null;
  };

  // Permanent shared reveal: depth-limited flood over non-wall tiles from
  // (sx,sy), plus the walls bounding each revealed corridor tile (so you can
  // see what hems you in). Corridor line-of-sight = BFS through floor only.
  Game.prototype._reveal = function (sx, sy) {
    var W = this.maze.width, H = this.maze.height, R = this.revealRadius;
    var q = [[sx, sy, 0]], head = 0;
    var localSeen = {};
    localSeen[sy * W + sx] = true;
    this.revealed[sy * W + sx] = 1;
    while (head < q.length) {
      var cur = q[head++], x = cur[0], y = cur[1], d = cur[2];
      for (var k = 0; k < 4; k++) {
        var dir = DELTAS[k];
        var nx = x + dir[0], ny = y + dir[1];
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        var ni = ny * W + nx;
        this.revealed[ni] = 1; // reveal the neighbour (floor or bounding wall)
        if (this.maze.tiles[ni] !== TILE.WALL && d + 1 <= R && !localSeen[ni]) {
          localSeen[ni] = true;
          q.push([nx, ny, d + 1]);
        }
      }
    }
  };

  Game.prototype._discover = function (pairId) {
    if (this.discovered[pairId]) return;
    this.discovered[pairId] = true;
    if (this.callbacks.onEvent) this.callbacks.onEvent({ type: 'tunnel_discovered', pairId: pairId });
  };

  var AT_CENTRE = 1e-6;
  // Cornering grace (tile units): a turn buffered shortly AFTER crossing a
  // junction centre still takes — snap back and apply it. Makes turn timing
  // forgiving (and absorbs a little input latency). ~0.3 tile ≈ 50ms at 6 t/s.
  var TURN_GRACE = 0.3;

  Game.prototype.update = function (deltaMs) {
    if (this.paused || this.ended) return;
    this.elapsed += deltaMs;
    var W = this.maze.width;
    var step = this.speed * (deltaMs / 1000);

    // Expire dropped walls whose lifetime has elapsed.
    for (var wk in this.walls) {
      if (this.walls[wk].expireAt <= this.elapsed) delete this.walls[wk];
    }

    for (var i = 0; i < this.playerIds.length; i++) {
      var p = this.players[this.playerIds[i]];
      if (p.finished) continue;
      var remaining = step;

      while (remaining > 0 && !p.finished) {
        if (p.prog < AT_CENTRE) {
          p.prog = 0; this._chooseDir(p);
        } else if (p.prog <= TURN_GRACE && p.nextDir && p.nextDir !== p.dir &&
                   this._open(p.tx, p.ty, p.nextDir)) {
          // Late turn within the grace window: snap back to the centre just
          // crossed and take the buffered turn.
          p.prog = 0; p.dir = p.nextDir; p.nextDir = null;
        }
        if (!p.dir) break;

        var toCentre = 1 - p.prog;
        if (remaining < toCentre) { p.prog += remaining; remaining = 0; break; }

        var h = HEADINGS[p.dir];
        p.prevX = p.tx; p.prevY = p.ty; // the tile we're leaving — drop-wall's target
        p.tx += h.dx; p.ty += h.dy; p.prog = 0;
        remaining -= toCentre;

        var idx = p.ty * W + p.tx;
        this._reveal(p.tx, p.ty);

        if (idx === this.exitIdx) { this._finish(p); break; } // reached the goal

        var tun = this.tunnelByTile[idx];
        if (tun && p.lastTunnelTile !== idx) {
          // Shortcut tunnel: teleport to the paired mouth, learn the pairing.
          this._discover(tun.pairId);
          p.tx = tun.partner % W;
          p.ty = (tun.partner - (tun.partner % W)) / W;
          p.prog = 0;
          p.lastTunnelTile = tun.partner; // don't bounce straight back
          this._reveal(p.tx, p.ty);
          // Halt at the exit mouth and wait for input: emerging mid-corridor and
          // auto-flowing onward feels like being shoved somewhere random. Stop so
          // the player can register where they came out and choose deliberately.
          p.dir = null; p.nextDir = null;
          break;
        } else if (!tun) {
          p.lastTunnelTile = -1; // left the tunnel network — clear the guard
        }
      }
    }
  };

  Game.prototype._finish = function (p) {
    if (p.finished) return;
    p.finished = true; p.dir = null; p.nextDir = null;
    this.finishOrder.push(p.id);
    if (this.callbacks.onEvent) {
      this.callbacks.onEvent({ type: 'player_win', playerId: p.id, rank: this.finishOrder.length });
    }
    if (this.finishOrder.length === 1) this._end(); // first to the real exit wins
  };

  Game.prototype._end = function () {
    if (this.ended) return;
    this.ended = true;
    if (this.callbacks.onGameEnd) this.callbacks.onGameEnd(this.getResults());
  };

  Game.prototype._renderPos = function (p) {
    var h = p.dir ? HEADINGS[p.dir] : { dx: 0, dy: 0 };
    return { x: p.tx + h.dx * p.prog, y: p.ty + h.dy * p.prog };
  };

  Game.prototype.getSnapshot = function () {
    var out = [];
    for (var i = 0; i < this.playerIds.length; i++) {
      var p = this.players[this.playerIds[i]];
      var rp = this._renderPos(p);
      out.push({ id: p.id, x: rp.x, y: rp.y, tx: p.tx, ty: p.ty, dir: p.dir, finished: p.finished });
    }
    // Tunnels carry a `discovered` flag (shortcuts; neutral until traversed).
    var tunnels = [];
    for (var t = 0; t < this.maze.tunnels.length; t++) {
      var tt = this.maze.tunnels[t];
      tunnels.push({ id: tt.id, a: tt.a, b: tt.b, discovered: !!this.discovered[tt.id] });
    }
    // Dropped walls with remaining-life ratio for a fade-out render.
    var W = this.maze.width, walls = [];
    for (var wk in this.walls) {
      var idx = +wk, w = this.walls[wk];
      walls.push({ x: idx % W, y: Math.floor(idx / W), by: w.by,
        ratio: Math.max(0, (w.expireAt - this.elapsed) / this.wallTtl) });
    }
    return {
      elapsed: this.elapsed,
      maze: this.maze,
      revealed: this.revealed,
      tunnels: tunnels,
      oneWays: this.maze.oneWays,
      walls: walls,
      players: out,
      ended: this.ended
    };
  };

  Game.prototype.getResults = function () {
    var self = this, W = this.maze.width;
    // Rank unfinished players by walking distance to the exit (nearest first).
    var distFromExit = MazeGen.bfsDistances(W, this.maze.height, this.maze.tiles, [this.maze.exit]);
    var unfinished = this.playerIds.filter(function (id) { return !self.players[id].finished; });
    unfinished.sort(function (a, b) {
      var pa = self.players[a], pb = self.players[b];
      var da = distFromExit[pa.ty * W + pa.tx], db = distFromExit[pb.ty * W + pb.tx];
      return (da < 0 ? Infinity : da) - (db < 0 ? Infinity : db);
    });
    var ranked = this.finishOrder.concat(unfinished);
    return {
      elapsed: this.elapsed,
      results: ranked.map(function (id, i) {
        return { playerId: id, rank: i + 1, finished: self.players[id].finished };
      })
    };
  };

  Game.prototype.pause = function () { this.paused = true; };
  Game.prototype.resume = function () { this.paused = false; };

  exports.Game = Game;
  exports.HEADINGS = HEADINGS;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.GameEngine = {}));
