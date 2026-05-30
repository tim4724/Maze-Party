'use strict';

// =====================================================================
// Display Render — logic loop (setInterval) + RAF render loop.
// Logic runs on a fixed-interval timer so it keeps ticking even when
// the tab is backgrounded/throttled (rAF suspends; setInterval doesn't).
// Depends on: DisplayState.js, DisplayUI.js, MazeRenderer.js
// =====================================================================

// Cap delta to ~3 frames at 60Hz — prevents huge catch-up jumps after a pause.
var MAX_FRAME_DELTA_MS = 50;
// ~4fps — used when paused/results, to save battery.
var IDLE_FRAME_INTERVAL_MS = 250;

var lastThrottled = null;
var logicIntervalId = null;
var lastLogicTime = 0;

// ---- Logic loop (setInterval) ----------------------------------------

function startLogicLoop() {
  if (logicIntervalId != null) return;
  lastLogicTime = 0;
  logicIntervalId = setInterval(tickGameLogic, Math.round(GameConstants.LOGIC_TICK_MS));
}

function stopLogicLoop() {
  if (logicIntervalId != null) {
    clearInterval(logicIntervalId);
    logicIntervalId = null;
  }
  lastLogicTime = 0;
}

function tickGameLogic() {
  if (!displayGame || roomState !== ROOM_STATE.PLAYING || paused) return;
  var now = performance.now();
  var deltaMs = lastLogicTime ? Math.min(now - lastLogicTime, MAX_FRAME_DELTA_MS) : 0;
  lastLogicTime = now;
  if (deltaMs <= 0) return;
  try {
    displayGame.update(deltaMs);
    if (!displayGame) return;
    gameState = displayGame.getSnapshot();
  } catch (err) {
    console.error('[engine] Error in game logic:', err);
    if (!displayGame) return;
    var results = displayGame.getResults();
    displayGame = null;
    stopLogicLoop();
    if (results) {
      setRoomState(ROOM_STATE.RESULTS);
      lastResults = results;
      party.broadcast({ type: MSG.GAME_END, elapsed: results.elapsed, results: results.results });
      onGameEnd(results);
    }
  }
}

// ---- Render loop (rAF) -----------------------------------------------

function startRenderLoop() {
  if (rafId != null) return;
  rafId = requestAnimationFrame(renderLoop);
}

function stopRenderLoop() {
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function renderLoop(timestamp) {
  if (rafId == null) return;
  rafId = requestAnimationFrame(renderLoop);

  if ((currentScreen !== SCREEN.GAME && currentScreen !== SCREEN.RESULTS) || !ctx) return;

  // Throttle to ~4fps when paused / on results.
  if (paused || currentScreen === SCREEN.RESULTS) {
    if (!lastThrottled) lastThrottled = timestamp;
    if (timestamp - lastThrottled < IDLE_FRAME_INTERVAL_MS) return;
    lastThrottled = timestamp;
  } else {
    lastThrottled = null;
  }

  try {
    renderFrame(timestamp);
  } catch (err) {
    console.error('[render] Error in render loop:', err);
  }
}

function renderFrame(timestamp) {
  ctx.fillStyle = THEME.color.bg.primary;
  ctx.fillRect(0, 0, cachedW, cachedH);

  if (!gameState || !gameState.maze) return;

  // (Re)compute the viewport when the maze or canvas size changes.
  if (!mazeView || mazeView.maze !== gameState.maze ||
      mazeView._vw !== cachedW || mazeView._vh !== cachedH) {
    mazeView = MazeRenderer.computeView(gameState.maze, cachedW, cachedH, THEME.size.canvasPad);
    mazeView._vw = cachedW;
    mazeView._vh = cachedH;
  }

  MazeRenderer.render(ctx, gameState, mazeView, colorForPlayer, timestamp);

  if (gameState.elapsed != null) drawTimer(gameState.elapsed);
}

// Resolve a player's palette colour from the lobby roster (falls back by slot).
function colorForPlayer(playerId) {
  var info = players.get(playerId);
  var idx = info ? info.playerIndex : playerOrder.indexOf(playerId);
  return PLAYER_COLORS[idx] || '#ffffff';
}
