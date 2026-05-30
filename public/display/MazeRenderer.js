'use strict';

// =====================================================================
// Maze Renderer — single shared maze canvas: fog, walls/floor, tunnel
// portals, one-way arrows, and players. Reads no globals except THEME
// (background tint) with literal fallbacks.
//
// Fog: tiles not in snapshot.revealed render as darkness. Tunnel mouths
// render IDENTICALLY until their pair is discovered (the real exit included),
// then both mouths take the pair's colour. One-way tiles show an arrow.
// =====================================================================

(function (global) {

  var FOG = '#141019';
  var FLOOR = '#241F33';
  var WALL = '#6C5CE7';
  var WALL_EDGE = '#8B7BF0';
  var PORTAL_UNKNOWN = '#9A93AD';   // neutral — undiscovered mouths all look the same
  var ARROW = 'rgba(247,241,232,0.5)';
  // Distinct hues for discovered tunnel pairs (cycled by pairId).
  var PAIR_COLORS = ['#FF6B6B', '#4ECDC4', '#FFD23F', '#A66CFF', '#5AA9FF', '#FF8C42', '#7BE07B', '#FF6FB5'];
  // Heading -> unit delta. Hoisted so the per-player / per-arrow draw paths
  // don't re-allocate this map every frame.
  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  function tileEnum() {
    return (global.MazeGen && global.MazeGen.TILE) || { WALL: 0, FLOOR: 1 };
  }

  function computeView(maze, vw, vh, pad) {
    pad = pad == null ? 48 : pad;
    var tile = Math.floor(Math.min((vw - pad * 2) / maze.width, (vh - pad * 2) / maze.height));
    if (tile < 2) tile = 2;
    return {
      tile: tile,
      originX: Math.round((vw - tile * maze.width) / 2),
      originY: Math.round((vh - tile * maze.height) / 2),
      width: tile * maze.width, height: tile * maze.height, maze: maze
    };
  }

  function render(ctx, snap, view, colorFor, timestamp) {
    var maze = snap.maze, T = tileEnum();
    var tile = view.tile, ox = view.originX, oy = view.originY, W = maze.width, H = maze.height;
    var revealed = snap.revealed;

    // Tiles: fog / floor / wall.
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var idx = y * W + x;
        var px = ox + x * tile, py = oy + y * tile;
        if (revealed && !revealed[idx]) { ctx.fillStyle = FOG; }
        else if (maze.tiles[idx] === T.WALL) { ctx.fillStyle = WALL; }
        else { ctx.fillStyle = FLOOR; }
        ctx.fillRect(px, py, tile, tile);
      }
    }
    // Wall top highlight (revealed walls only).
    ctx.fillStyle = WALL_EDGE;
    var edge = Math.max(1, Math.floor(tile * 0.12));
    for (var wy = 0; wy < H; wy++) {
      for (var wx = 0; wx < W; wx++) {
        var wi = wy * W + wx;
        if (maze.tiles[wi] === T.WALL && (!revealed || revealed[wi])) {
          ctx.fillRect(ox + wx * tile, oy + wy * tile, tile, edge);
        }
      }
    }

    // Dropped walls — temporary barriers tinted in the placer's colour, fading
    // out as they near expiry. Drawn on revealed tiles only (fog hides them).
    if (snap.walls) {
      for (var dw = 0; dw < snap.walls.length; dw++) {
        var wl = snap.walls[dw];
        if (revealed && !revealed[wl.y * W + wl.x]) continue;
        var wc = colorFor ? (colorFor(wl.by) || '#fff') : '#fff';
        var px = ox + wl.x * tile, py = oy + wl.y * tile;
        ctx.globalAlpha = 0.35 + 0.55 * Math.min(1, wl.ratio + 0.1);
        ctx.fillStyle = wc;
        ctx.fillRect(px + 1, py + 1, tile - 2, tile - 2);
        ctx.globalAlpha = 1;
        ctx.lineWidth = Math.max(1, tile * 0.1);
        ctx.strokeStyle = wc;
        ctx.strokeRect(px + 1, py + 1, tile - 2, tile - 2);
      }
    }

    // One-way arrows (revealed only).
    if (snap.oneWays) {
      for (var o = 0; o < snap.oneWays.length; o++) {
        var ow = snap.oneWays[o];
        if (revealed && !revealed[ow.y * W + ow.x]) continue;
        _arrow(ctx, ox + (ow.x + 0.5) * tile, oy + (ow.y + 0.5) * tile, tile, ow.dir);
      }
    }

    // Tunnel mouths (revealed only). Optional shortcuts; identical neutral look
    // until traversed, then both mouths share the pair's colour.
    var pulse = 0.5 + 0.5 * Math.sin((timestamp || 0) / 320);
    if (snap.tunnels) {
      for (var t = 0; t < snap.tunnels.length; t++) {
        var tun = snap.tunnels[t];
        var col = tun.discovered ? PAIR_COLORS[tun.id % PAIR_COLORS.length] : PORTAL_UNKNOWN;
        _portal(ctx, ox, oy, tile, tun.a, col, revealed, W, pulse);
        _portal(ctx, ox, oy, tile, tun.b, col, revealed, W, pulse);
      }
    }

    // Exit beacon — the fixed goal, ALWAYS visible (even through fog) so players
    // know where to race. Distinct from tunnel portals: a glowing gold star.
    if (snap.maze.exit) _beacon(ctx, ox, oy, tile, snap.maze.exit, pulse);

    // Players (always visible — the shared screen shows positions).
    for (var i = 0; i < snap.players.length; i++) {
      var p = snap.players[i];
      var cx = ox + (p.x + 0.5) * tile, cy = oy + (p.y + 0.5) * tile, r = tile * 0.34;
      var pc = colorFor ? (colorFor(p.id) || '#fff') : '#fff';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = pc; ctx.fill();
      ctx.lineWidth = Math.max(1, tile * 0.06); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.stroke();
      if (p.dir) {
        var d = DIRS[p.dir];
        ctx.beginPath();
        ctx.arc(cx + d[0] * r * 0.55, cy + d[1] * r * 0.55, r * 0.28, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
      }
      if (p.finished) {
        ctx.beginPath(); ctx.arc(cx, cy, r * 1.4, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(1, tile * 0.08); ctx.strokeStyle = '#FFD23F'; ctx.stroke();
      }
    }
  }

  function _portal(ctx, ox, oy, tile, mouth, col, revealed, W, pulse) {
    if (revealed && !revealed[mouth.y * W + mouth.x]) return;
    var cx = ox + (mouth.x + 0.5) * tile, cy = oy + (mouth.y + 0.5) * tile;
    var r = tile * (0.30 + 0.05 * pulse);
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = tile * (0.3 + 0.4 * pulse);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(2, tile * 0.16); ctx.strokeStyle = col; ctx.stroke();
    ctx.restore();
    // Dark eye so a portal reads as a hole, not a disc.
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
  }

  var EXIT = '#FFD23F';
  function _beacon(ctx, ox, oy, tile, exit, pulse) {
    var cx = ox + (exit.x + 0.5) * tile, cy = oy + (exit.y + 0.5) * tile;
    // Soft halo so it reads through fog from across the board.
    ctx.save();
    ctx.shadowColor = EXIT;
    ctx.shadowBlur = tile * (1.0 + 0.8 * pulse);
    // Outer pulsing ring.
    ctx.beginPath();
    ctx.arc(cx, cy, tile * (0.5 + 0.12 * pulse), 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,210,63,' + (0.35 + 0.25 * pulse) + ')';
    ctx.lineWidth = Math.max(2, tile * 0.12);
    ctx.stroke();
    // Four-point star (goal mark).
    var r = tile * (0.34 + 0.05 * pulse), rin = r * 0.4;
    ctx.beginPath();
    for (var k = 0; k < 8; k++) {
      var ang = (Math.PI / 4) * k - Math.PI / 2;
      var rad = (k % 2 === 0) ? r : rin;
      var px = cx + Math.cos(ang) * rad, py = cy + Math.sin(ang) * rad;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = EXIT;
    ctx.fill();
    ctx.restore();
  }

  function _arrow(ctx, cx, cy, tile, dir) {
    var d = DIRS[dir];
    var a = tile * 0.26;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.atan2(d[1], d[0]) + Math.PI / 2); // point along dir
    ctx.beginPath();
    ctx.moveTo(0, -a); ctx.lineTo(a * 0.75, a * 0.6); ctx.lineTo(-a * 0.75, a * 0.6); ctx.closePath();
    ctx.fillStyle = ARROW; ctx.fill();
    ctx.restore();
  }

  global.MazeRenderer = { computeView: computeView, render: render };

})(typeof window !== 'undefined' ? window : this);
