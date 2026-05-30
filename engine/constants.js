'use strict';

// UMD: works in Node.js (require) and browser (window.GameConstants)
(function (exports) {

  // ===================== ROOM / LIFECYCLE (framework) =====================
  // Referenced by the inherited PartyPlug shell (DisplayState, DisplayGame,
  // DisplayInput, DisplayLiveness). Keep names stable.
  const MAX_PLAYERS = 8;
  const COUNTDOWN_SECONDS = 3;
  const LOGIC_TICK_MS = 1000 / 60;     // 60Hz reference tick
  const LIVENESS_TIMEOUT_MS = 3000;    // controller silence -> disconnected
  const SELF_HEARTBEAT_DEAD_MS = 6000; // display self-echo dead-detection

  // ===================== MAZE (game) =====================
  // Tile grid is (2*CELL_W+1) x (2*CELL_H+1). 10x10 rooms -> 21x21 tiles.
  // See maze-prototype-plan.md for the starting values + test plan.
  const CELL_W = 10;
  const CELL_H = 10;
  const GRID_W = CELL_W * 2 + 1;
  const GRID_H = CELL_H * 2 + 1;
  const BRAID = 0.3;                    // fraction of dead-ends opened into loops
  const MOVE_SPEED_TPS = 6;             // auto-run speed, tiles per second
  const REVEAL_RADIUS = 2;              // fog: tiles revealed around a player (corridor line-of-sight)
  const TUNNEL_PAIRS = 3;               // optional learnable shortcut pairs (the exit is a separate visible goal)
  const ONE_WAY_TILES = 8;              // approx one-way arrow tiles placed

  // Drop-wall: tap to leave a temporary barrier in your wake (block rivals).
  const WALL_TTL_MS = 5000;             // how long a dropped wall lasts
  const WALL_COOLDOWN_MS = 8000;        // min time between drops per player

  exports.MAX_PLAYERS = MAX_PLAYERS;
  exports.COUNTDOWN_SECONDS = COUNTDOWN_SECONDS;
  exports.LOGIC_TICK_MS = LOGIC_TICK_MS;
  exports.LIVENESS_TIMEOUT_MS = LIVENESS_TIMEOUT_MS;
  exports.SELF_HEARTBEAT_DEAD_MS = SELF_HEARTBEAT_DEAD_MS;
  exports.CELL_W = CELL_W;
  exports.CELL_H = CELL_H;
  exports.GRID_W = GRID_W;
  exports.GRID_H = GRID_H;
  exports.BRAID = BRAID;
  exports.MOVE_SPEED_TPS = MOVE_SPEED_TPS;
  exports.REVEAL_RADIUS = REVEAL_RADIUS;
  exports.TUNNEL_PAIRS = TUNNEL_PAIRS;
  exports.ONE_WAY_TILES = ONE_WAY_TILES;
  exports.WALL_TTL_MS = WALL_TTL_MS;
  exports.WALL_COOLDOWN_MS = WALL_COOLDOWN_MS;

})(typeof module !== 'undefined' ? module.exports : (window.GameConstants = {}));
