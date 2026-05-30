'use strict';

// =====================================================================
// Display Game — game lifecycle, event handlers, audio
// Depends on: DisplayState.js (globals), DisplayConnection.js (broadcastLobbyUpdate, showDisconnectQR),
//             DisplayLiveness.js (peerLivenessExpired)
// Called by: display.js (message handlers and UI buttons)
// =====================================================================

// Grace period before ending a game when all active players have disconnected
// but late joiners are waiting — lets the host reconnect before we bail out.
var LATE_JOINER_GRACE_MS = 5000;

// Wake Lock — prevent screen sleep during active games
function acquireWakeLock() {
  if (!navigator.wakeLock) return;
  navigator.wakeLock.request('screen').then(function(lock) {
    wakeLock = lock;
    lock.addEventListener('release', function() { wakeLock = null; });
  }).catch(function() {});
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(function() {});
    wakeLock = null;
  }
}

function startGame() {
  if (roomState !== ROOM_STATE.LOBBY) return;
  if (players.size < 1) return;
  startNewGame();
}

function playAgain() {
  if (roomState !== ROOM_STATE.RESULTS) return;
  if (players.size < 1) return;
  startNewGame();
}

function setAutoPaused(value) {
  autoPaused = value;
  if (pauseBtn) pauseBtn.disabled = false;
  if (gameToolbar && currentScreen === SCREEN.GAME) {
    document.body.classList.toggle('cursor-hidden', value === false);
    gameToolbar.classList.toggle('toolbar-autohide', value === false);
  }
}

function startNewGame() {
  stopDisplayGame();
  paused = false;
  setAutoPaused(false);
  clearLateJoinerGraceTimer();
  lastResults = null;
  lastAliveState = {};
  // Drop players still flagged as disconnected from the previous game so they
  // don't carry into the new one. disconnectedQRs is the unified disconnect
  // signal across relay and AirConsole modes; peerLivenessExpired additionally
  // catches a relay peer that dropped right as RESULTS appeared, before
  // peer_left or the liveness tick flagged it (mirrors returnToLobby).
  // Reconnects clear the flag, so present players survive.
  var goneIds = [];
  for (const entry of players) {
    if (disconnectedQRs.has(entry[0]) || peerLivenessExpired(entry[1], Date.now())) {
      goneIds.push(entry[0]);
    }
  }
  for (var gi = 0; gi < goneIds.length; gi++) {
    flow.removePlayer(goneIds[gi]);
    playerOrder = playerOrder.filter(function(pid) { return pid !== goneIds[gi]; });
  }
  // Clear stale disconnected-QR flags from the previous game so they don't
  // suppress host eligibility here. (onGameEnd no longer clears them — we
  // keep the disconnected state through RESULTS so the host role hands off
  // correctly; see getHostPeerIndex().)
  disconnectedQRs.clear();
  flow.clearDisconnected();
  // Everyone who remained was disconnected — don't launch an empty game.
  // Both callers (startGame, playAgain) check players.size before this prune,
  // so neither catches the all-disconnected case. From RESULTS, returnToLobby()
  // resets the UI; from a LOBBY start it would no-op (already in LOBBY), so
  // refresh the lobby controls directly.
  if (players.size < 1) {
    if (roomState === ROOM_STATE.LOBBY) {
      updatePlayerList();
      updateStartButton();
    } else {
      returnToLobby();
    }
    return;
  }
  // Add late joiners to playerOrder (preserving existing order)
  for (const id of players.keys()) {
    if (playerOrder.indexOf(id) < 0) playerOrder.push(id);
  }
  setRoomState(ROOM_STATE.COUNTDOWN);
  acquireWakeLock();

  startCountdown(function() {
    setRoomState(ROOM_STATE.PLAYING);
    party.broadcast({ type: MSG.GAME_START });
    runGameLocally();

    // Show disconnect QR for any players that disconnected during countdown
    for (const entry of players) {
      if (peerLivenessExpired(entry[1], Date.now())) {
        showDisconnectQR(entry[0]);
      }
    }
    checkAllPlayersDisconnected();
  });
}

function startCountdown(onComplete, startFrom) {
  var count = startFrom || GameConstants.COUNTDOWN_SECONDS;
  countdown.callback = onComplete;
  countdown.remaining = count;

  // On resume (startFrom is set), the current number is already on screen —
  // skip the redundant broadcast/beep.
  if (!startFrom) {
    party.broadcast({ type: MSG.COUNTDOWN, value: count });
    onCountdownDisplay(count);
  }

  countdown.timer = setInterval(function() {
    count--;
    countdown.remaining = count;
    if (count > 0) {
      party.broadcast({ type: MSG.COUNTDOWN, value: count });
      onCountdownDisplay(count);
    } else {
      clearInterval(countdown.timer);
      countdown.timer = null;
      countdown.remaining = 0;
      party.broadcast({ type: MSG.COUNTDOWN, value: 'GO' });
      onCountdownDisplay('GO');
      countdown.goTimeout = setTimeout(function() {
        countdown.goTimeout = null;
        onComplete();
      }, 500);
    }
  }, 1000);
}

function clearCountdownTimers() {
  if (countdown.timer) { clearInterval(countdown.timer); countdown.timer = null; }
  if (countdown.goTimeout) { clearTimeout(countdown.goTimeout); countdown.goTimeout = null; }
  if (countdown.overlayTimer) { clearTimeout(countdown.overlayTimer); countdown.overlayTimer = null; }
}

function pauseGame() {
  if (paused) return;
  if (roomState !== ROOM_STATE.PLAYING && roomState !== ROOM_STATE.COUNTDOWN) return;
  paused = true;
  if (roomState === ROOM_STATE.COUNTDOWN) {
    clearCountdownTimers();
  }
  party.broadcast({ type: MSG.GAME_PAUSED });
  onGamePaused();
}

// Check if all game participants are disconnected — auto-pause if so
function allPlayersDisconnected() {
  for (var i = 0; i < playerOrder.length; i++) {
    if (!disconnectedQRs.has(playerOrder[i])) return false;
  }
  return playerOrder.length > 0;
}

function canResumeGame() {
  return !allPlayersDisconnected();
}

function hasLateJoiners() {
  for (const id of players.keys()) {
    if (playerOrder.indexOf(id) < 0) return true;
  }
  return false;
}

function clearLateJoinerGraceTimer() {
  if (lateJoinerGraceTimer) {
    clearTimeout(lateJoinerGraceTimer);
    lateJoinerGraceTimer = null;
  }
}

function checkAllPlayersDisconnected() {
  // Don't auto-pause during COUNTDOWN — let it finish so disconnect QRs become visible.
  if (roomState !== ROOM_STATE.PLAYING) return;
  if (!allPlayersDisconnected()) return;

  // Start the grace timer regardless of pause state — a manually-paused host
  // who then disconnects strands late joiners the same way an unpaused one
  // does. Cancelled in DisplayInput when any active player reconnects.
  if (hasLateJoiners() && !lateJoinerGraceTimer) {
    lateJoinerGraceTimer = setTimeout(function() {
      lateJoinerGraceTimer = null;
      if (roomState === ROOM_STATE.PLAYING && allPlayersDisconnected() && hasLateJoiners()) {
        returnToLobby();
      }
    }, LATE_JOINER_GRACE_MS);
  }

  if (paused) return;
  // Silent pause — no overlay, no broadcast (all controllers are gone)
  paused = true;
  setAutoPaused(true);
  if (displayGame) displayGame.pause();
}

function checkAutoResume() {
  if (!autoPaused) return;
  setAutoPaused(false);
  resumeGame();
}

function resumeGame() {
  if (!paused) return;
  if (roomState !== ROOM_STATE.PLAYING && roomState !== ROOM_STATE.COUNTDOWN) return;
  if (!canResumeGame()) return;
  if (autoPaused) setAutoPaused(false);
  paused = false;
  if (roomState === ROOM_STATE.COUNTDOWN && countdown.callback) {
    party.broadcast({ type: MSG.GAME_RESUMED });
    onGameResumed();
    if (countdown.remaining === 0) {
      countdown.overlayTimer = setTimeout(function() {
        countdown.overlayTimer = null;
        countdownOverlay.classList.add('hidden');
        countdownNumber.textContent = '';
      }, 400);
      countdown.goTimeout = setTimeout(function() {
        countdown.goTimeout = null;
        countdown.callback();
      }, 500);
    } else {
      startCountdown(countdown.callback, countdown.remaining);
    }
    return;
  }
  party.broadcast({ type: MSG.GAME_RESUMED });
  onGameResumed();
}

function returnToLobby() {
  if (roomState === ROOM_STATE.LOBBY) return;
  countdown.callback = null;
  countdown.remaining = 0;
  paused = false;
  setAutoPaused(false);
  clearLateJoinerGraceTimer();
  releaseWakeLock();

  stopDisplayGame(); // also calls clearCountdownTimers()

  // Remove disconnected players. disconnectedQRs catches AirConsole mode,
  // where peerLivenessExpired is always false; peerLivenessExpired catches
  // relay-mode peers that went silent before a QR flag was set.
  var disconnectedIds = [];
  for (const entry of players) {
    if (disconnectedQRs.has(entry[0]) || peerLivenessExpired(entry[1], Date.now())) {
      disconnectedIds.push(entry[0]);
    }
  }

  for (var i = 0; i < disconnectedIds.length; i++) {
    flow.removePlayer(disconnectedIds[i]);
    playerOrder = playerOrder.filter(function(id) { return id !== disconnectedIds[i]; });
  }

  // Add late joiners to playerOrder (preserving existing order)
  for (const id of players.keys()) {
    if (playerOrder.indexOf(id) < 0) playerOrder.push(id);
  }

  lastResults = null;
  lastAliveState = {};
  setRoomState(ROOM_STATE.LOBBY);

  broadcastLobbyUpdate();
  party.broadcast({ type: MSG.RETURN_TO_LOBBY, playerCount: players.size });

  returnToLobbyUI();
}

function returnToLobbyUI() {
  var wasInGame = currentScreen === SCREEN.GAME || currentScreen === SCREEN.RESULTS;
  gameState = null;
  disconnectedQRs.clear();
  flow.clearDisconnected();
  showScreen(SCREEN.LOBBY);
  updateStartButton();
  if (wasInGame && !popstateNavigating) {
    suppressPopstate = true;
    history.back();
  }
  popstateNavigating = false;
}

// =====================================================================
// Local Game Engine
// =====================================================================

function stopDisplayGame() {
  stopLogicLoop();
  if (displayGame) {
    displayGame = null;
  }
  resetAllPlayerInput();
  clearCountdownTimers();
}

function runGameLocally() {
  runGameLocallyWithSeed((Math.random() * 0xFFFFFFFF) >>> 0);
}

function runGameLocallyWithSeed(seed) {
  stopDisplayGame();
  countdownOverlay.classList.add('hidden');
  countdownNumber.textContent = '';

  var Game = window.GameEngine.Game;
  // Sort by join time so participant order is stable. (Display renders one
  // shared maze; order only matters for host eligibility + results.)
  playerOrder.sort(function(a, b) {
    return (players.get(a)?.joinedAt ?? Infinity) - (players.get(b)?.joinedAt ?? Infinity);
  });
  // Snapshot playerOrder at game start — prevents mid-game drift.
  playerOrder = playerOrder.slice();
  // Feed participant order to flow so host eligibility (restricted to
  // participants mid-game) matches the running game exactly.
  flow.setActiveOrder(playerOrder);
  var gamePlayers = new Map();
  for (var i = 0; i < playerOrder.length; i++) {
    gamePlayers.set(playerOrder[i], {});
  }

  displayGame = new Game(gamePlayers, {
    onGameEnd: function(results) {
      // Enrich with player names
      if (results && results.results) {
        var played = {};
        for (var j = 0; j < results.results.length; j++) {
          var r = results.results[j];
          played[r.playerId] = true;
          var pInfo = players.get(r.playerId);
          if (pInfo) {
            r.playerName = pInfo.playerName;
            r.colorIndex = pInfo.playerIndex;
          }
        }
        // Append connected players who sat out this round (joined mid-game).
        // They're not in the engine's results (built from playerIds), so flag
        // them newPlayer and let every screen render them as "New player"
        // instead of omitting them.
        players.forEach(function(info, peerIndex) {
          if (!played[peerIndex]) {
            results.results.push({
              playerId: peerIndex,
              playerName: info.playerName,
              colorIndex: info.playerIndex,
              newPlayer: true
            });
          }
        });
      }
      setRoomState(ROOM_STATE.RESULTS);
      lastResults = results;
      party.broadcast({ type: MSG.GAME_END, elapsed: results.elapsed, results: results.results });
      onGameEnd(results);
    }
  }, seed);

  try {
    displayGame.init();
  } catch (err) {
    // A malformed maze (e.g. an unexpected seed) must not strand the room in
    // COUNTDOWN/PLAYING with no recovery — bail back to the lobby.
    console.error('[engine] Failed to initialise game:', err);
    displayGame = null;
    returnToLobby();
    return;
  }
  startLogicLoop();
}

// =====================================================================
// Display-side Event Handlers (rendering)
// =====================================================================

function onCountdownDisplay(value) {
  gameState = null;
  var enteringCountdown = currentScreen !== SCREEN.GAME;
  if (enteringCountdown) {
    history.pushState({ screen: 'game' }, '');
  }
  showScreen(SCREEN.GAME);
  // Only force-hide on the first tick into countdown, and only if the user
  // isn't actively interacting — otherwise we'd fight showCursor() every
  // second and the mute/pause buttons become unclickable.
  if (enteringCountdown && cursorTimer === null) {
    document.body.classList.add('cursor-hidden');
    gameToolbar.classList.add('toolbar-autohide');
  }
  countdownOverlay.classList.remove('hidden');
  countdownNumber.textContent = value;
  playCountdownBeep(value === 'GO');
  if (value === 'GO') {
    countdown.overlayTimer = setTimeout(function() {
      countdown.overlayTimer = null;
      countdownOverlay.classList.add('hidden');
      countdownNumber.textContent = '';
    }, 400);
  }
}

function onGameEnd(msg) {
  releaseWakeLock();
  stopDisplayGame();
  // Intentionally do NOT clear disconnectedQRs here: the set is what keeps
  // gone players out of getHostPeerIndex() while we sit on RESULTS. A
  // prematurely-cleared set would re-promote the left-mid-game host and
  // freeze Play Again / New Game behind a "Waiting for {gone name}" banner.
  // Cleared instead in startNewGame() and returnToLobbyUI().
  renderResults(msg.results);
  showScreen(SCREEN.RESULTS);
}

function onGamePaused() {
  if (displayGame) displayGame.pause();
  if (pauseContinueBtn) pauseContinueBtn.disabled = false;
  pauseOverlay.classList.remove('hidden');
  gameToolbar.classList.add('hidden');
  countdownOverlay.classList.add('paused');
}

function dismissAutoPausedOverlay() {
  pauseOverlay.classList.add('hidden');
  if (currentScreen === SCREEN.GAME) {
    gameToolbar.classList.remove('hidden');
  }
  setAutoPaused(true);
}

function onGameResumed() {
  if (displayGame) displayGame.resume();
  if (pauseContinueBtn) pauseContinueBtn.disabled = false;
  pauseOverlay.classList.add('hidden');
  countdownOverlay.classList.remove('paused');
  if (currentScreen === SCREEN.GAME) {
    gameToolbar.classList.remove('hidden');
  }
  if (countdownNumber.textContent) {
    countdownOverlay.classList.remove('hidden');
  }
}

// Music & Audio — see DisplayAudio.js
