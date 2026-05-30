'use strict';

// =====================================================================
// Display Entry Point — init, event listeners
// Depends on: DisplayState.js (urlParams, debugCount), DisplayUI.js,
//             DisplayConnection.js, DisplayGame.js, DisplayInput.js,
//             DisplayRender.js, DisplayTestHarness.js, DisplayLiveness.js
// Loaded last; wires up event listeners and initializes
// =====================================================================

// =====================================================================
// Welcome / UI Buttons
// =====================================================================

function resetToWelcome() {
  releaseWakeLock();
  if (party) {
    party.close();
    party = null;
  }
  stopLivenessCheck();
  lastRoomCode = null;
  lastInstance = null;
  roomCode = null;
  joinUrl = null;
  setRoomState(ROOM_STATE.LOBBY);
  resetRoomData();
  // Reset relay state so a fresh session starts clean: the sticky CTA
  // should not carry over, and the chip should not flash the previous
  // session's region/RTT before the new 'created' lands.
  consecutiveBadRtt = 0;
  lastRelayRtt = -1;
  relayRegion = null;
  if (relayReportBtn) relayReportBtn.classList.add('hidden');
  preCreatedRoom = null;
  showScreen(SCREEN.WELCOME);
  connectAndCreateRoom();
}

// =====================================================================
// Cursor Auto-Hide
// =====================================================================

var cursorTimer = null;
function showCursor() {
  document.body.classList.remove('cursor-hidden');
  gameToolbar.classList.remove('toolbar-autohide');
  clearTimeout(cursorTimer);
  cursorTimer = setTimeout(function() {
    cursorTimer = null;
    document.body.classList.add('cursor-hidden');
    if (currentScreen === SCREEN.GAME) {
      gameToolbar.classList.add('toolbar-autohide');
    }
  }, 3000);
}
document.addEventListener('mousemove', showCursor);
showCursor();

// =====================================================================
// Initialize
// =====================================================================

// --- Window Resize ---
window.addEventListener('resize', function() {
  resizeCanvas();
  if (currentScreen === SCREEN.LOBBY) updatePlayerList();
});

// --- Re-acquire Wake Lock on tab focus (browser releases it on visibility change) ---
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState !== 'visible') return;
  if (!wakeLock &&
      (roomState === ROOM_STATE.PLAYING || roomState === ROOM_STATE.COUNTDOWN)) {
    acquireWakeLock();
  }
  // If returning to an already-shown results screen, drop the anti-misclick
  // gate — see the .results-screen--ready CSS rule.
  if (currentScreen === SCREEN.RESULTS && resultsScreen) {
    resultsScreen.classList.add('results-screen--ready');
  }
});

// --- Button Event Listeners ---
newGameBtn.addEventListener('click', function() {
  initMusic();
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(function() {});
  }

  if (preCreatedRoom) {
    var pre = preCreatedRoom;
    preCreatedRoom = null;
    applyRoomCreated(pre.roomCode, pre.joinUrl);
    if (pre.qrMatrix) {
      requestAnimationFrame(function() { renderQR(qrCode, pre.qrMatrix); });
    }
  } else {
    // Relay hasn't responded yet — show lobby so onRoomCreated
    // applies the room immediately instead of pre-caching it.
    showScreen(SCREEN.LOBBY);
    connectAndCreateRoom();
  }

  history.pushState({ screen: SCREEN.LOBBY }, '');
});

window.addEventListener('popstate', function(e) {
  if (suppressPopstate) {
    suppressPopstate = false;
    return;
  }

  var target = e.state && e.state.screen;
  if (currentScreen === SCREEN.WELCOME && target === SCREEN.LOBBY) {
    suppressPopstate = true;
    history.back();
  } else if (currentScreen === SCREEN.LOBBY) {
    if (target === SCREEN.GAME) {
      suppressPopstate = true;
      history.back();
    } else {
      resetToWelcome();
    }
  } else if (currentScreen === SCREEN.GAME || currentScreen === SCREEN.RESULTS) {
    popstateNavigating = true;
    showScreen(SCREEN.LOBBY);
    returnToLobby();
  }
});

startBtn.addEventListener('click', function() {
  if (startBtn.disabled) return;
  initMusic();
  startGame();
});

// Goodbye to controllers on intentional close/navigate-away so they
// immediately see the end screen instead of a "reconnecting" overlay.
// Best-effort: pagehide also fires on bfcache freeze (iOS Safari) where
// the WebSocket send may not complete before the page is frozen.
// Controllers fall back to the existing reconnect overlay in that case.
// In test/gallery mode `party` may be a minimal stub without broadcast/close,
// so each call is guarded.
window.addEventListener('pagehide', function() {
  if (!party) return;
  if (typeof party.broadcast === 'function') {
    try { party.broadcast({ type: MSG.DISPLAY_CLOSED }); } catch (_) {}
  }
  if (typeof party.close === 'function') party.close();
});

playAgainBtn.addEventListener('click', function() {
  initMusic();
  playAgain();
});

newGameResultsBtn.addEventListener('click', function() {
  returnToLobby();
});

// --- Fullscreen ---
fullscreenBtn.addEventListener('click', function() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(function() {});
  } else {
    document.exitFullscreen().catch(function() {});
  }
});
document.addEventListener('fullscreenchange', function() {
  fullscreenBtn.setAttribute('aria-checked', document.fullscreenElement ? 'true' : 'false');
});

// --- Pause (display-side buttons) ---
pauseBtn.addEventListener('click', function() {
  if (autoPaused) {
    onGamePaused();
    return;
  }
  pauseGame();
});

pauseContinueBtn.addEventListener('click', function() {
  if (autoPaused && !canResumeGame()) {
    dismissAutoPausedOverlay();
    return;
  }
  resumeGame();
});

pauseNewGameBtn.addEventListener('click', function() {
  returnToLobby();
});

reconnectBtn.addEventListener('click', function() {
  clearTimeout(disconnectedTimer);
  party.resetReconnectCount();
  reconnectBtn.classList.add('hidden');
  reconnectHeading.textContent = t('reconnecting');
  reconnectStatus.textContent = t('connecting');
  party.reconnectNow();
});

// --- Version label ---
// Read the build version from the <meta name="app-version"> tag baked into
// the HTML by server/index.js.
{
  var versionMeta = document.querySelector('meta[name="app-version"]');
  var label = versionMeta ? versionMeta.getAttribute('content') : '';
  var welcomeVersion = document.getElementById('welcome-version-label');
  if (welcomeVersion) welcomeVersion.textContent = label;
  var lobbyVersion = document.getElementById('lobby-version-label');
  if (lobbyVersion) lobbyVersion.textContent = label;
}

// --- Init ---
if (urlParams.get('test') === '1') {
  // Test mode: skip the relay connection — driven externally / smoke-tested.
  fetchBaseUrl();
} else {
  fetchBaseUrl();
  connectAndCreateRoom();
}
