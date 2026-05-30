'use strict';

// =====================================================================
// Controller Entry Point — message dispatch, event listeners, init
// Depends on: ControllerState.js, ControllerConnection.js, ControllerGame.js
// Loaded last; wires up event listeners and initializes the controller
// =====================================================================

// =====================================================================
// Message Dispatch
// =====================================================================

function handleMessage(data) {
  try {
    // Ignore game broadcasts after rejection (e.g., joined during countdown)
    // Only allow WELCOME (re-admission) and ERROR (new rejection info) through.
    if (gameCancelled && data.type !== MSG.WELCOME && data.type !== MSG.ERROR) return;
    // Late joiner waiting for next game — ignore game broadcasts but allow
    // WELCOME (re-admission), GAME_END (show results), RETURN_TO_LOBBY, LOBBY_UPDATE, ERROR
    if (waitingForNextGame && data.type !== MSG.WELCOME && data.type !== MSG.GAME_END
        && data.type !== MSG.RETURN_TO_LOBBY && data.type !== MSG.LOBBY_UPDATE
        && data.type !== MSG.ERROR && data.type !== MSG.PONG
        && data.type !== MSG.DISPLAY_CLOSED) return;

    switch (data.type) {
      case MSG.WELCOME:
        onWelcome(data);
        break;
      case MSG.LOBBY_UPDATE:
        onLobbyUpdate(data);
        break;
      case MSG.GAME_START:
        onGameStart();
        break;
      case MSG.COUNTDOWN:
        removeKoOverlay();
        if (currentScreen !== 'game') {
          gameScreen.classList.remove('dead');
          gameScreen.classList.remove('paused');
          gameScreen.classList.add('countdown');
          gameScreen.style.setProperty('--player-color', playerColor);
          pauseOverlay.classList.add('hidden');
          pauseBtn.disabled = false;
          pauseBtn.classList.remove('hidden');
          showScreen('game');
        }
        if (data.value === 'GO') {
          gameScreen.classList.remove('countdown');
          initTouchInput();
          if (window.resetWallButton) window.resetWallButton();
        }
        break;
      case MSG.PLAYER_STATE:
        onPlayerState(data);
        break;
      case MSG.GAME_END:
        waitingForNextGame = false;
        onGameEnd(data);
        break;
      case MSG.GAME_PAUSED:
        onGamePaused(data);
        break;
      case MSG.GAME_RESUMED:
        onGameResumed();
        break;
      case MSG.DISPLAY_CLOSED:
        bailToWelcome('game_ended');
        break;
      case MSG.RETURN_TO_LOBBY:
        waitingForNextGame = false;
        playerCount = data.playerCount || playerCount;
        gameScreen.classList.remove('dead');
        gameScreen.classList.remove('paused');
        showLobbyUI();
        break;
      case MSG.PONG:
        lastPongTime = Date.now();
        // Only drive the chip from WS when fastlane isn't already feeding it
        // higher-fidelity P2P samples via onRtt. Without this gate the
        // 1 Hz WS RTT (~12 ms via relay) clobbers the fastlane chip every
        // second, visibly bouncing the number — and lights the bolt icon
        // over a non-fastlane reading.
        if (data.t && !(fastlane && fastlane.isOpen(0))) {
          var rtt = Date.now() - data.t;
          updateLatencyDisplay(Math.round(rtt / 2));
        }
        if (party) party.resetReconnectCount();
        clearTimeout(disconnectedTimer);
        reconnectOverlay.classList.add('hidden');
        break;
      case MSG.ERROR:
        // Display-originated errors (see DisplayInput.js sendTo({type: ERROR}))
        // may carry a specific reason — surface it as a toast on the bail.
        if (data.message === 'Room not found') bailToWelcome('room_not_found');
        else if (data.message === 'Room is full') bailToWelcome('game_full');
        else bailToWelcome();
        break;
    }
  } catch (err) {
    console.error('[controller] Error handling message:', data && data.type, err);
  }
}

// =====================================================================
// Room Code & Client ID
// =====================================================================

roomCode = location.pathname.split('/').filter(Boolean)[0] || null;
if (!roomCode) {
  bailToWelcome();
} else {

// Check for stored clientId BEFORE generating a new one (used for auto-reconnect)
var hadStoredId = null;
try { hadStoredId = localStorage.getItem('clientId_' + roomCode); } catch (e) { /* iframe sandbox */ }

clientId = hadStoredId || generateClientId();

// Probe the relay for an existence check so an invalid room code surfaces
// immediately instead of only after the user types a name and hits JOIN.
{
  var isNewClient = !hadStoredId && !rejoinToken && !legacyRejoinId;
  var relayHttpUrl = RELAY_URL.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
  fetch(relayHttpUrl + '/room/' + encodeURIComponent(roomCode) + (instanceId ? '?instance=' + encodeURIComponent(instanceId) : ''))
    .then(function (res) {
      // Bail if the user has already moved past the name screen — a slow
      // probe arriving after a successful join would otherwise evict them.
      if (currentScreen !== 'name') return;
      if (res.status === 404) return bailToWelcome('room_not_found');
      // Only treat full as fatal for fresh joiners — reconnects with a
      // stored clientId swap into their existing slot on the relay.
      if (!isNewClient) return;
      return res.json().then(function (info) {
        if (currentScreen !== 'name') return;
        if (info && info.clients >= info.maxClients) bailToWelcome('game_full');
      });
    })
    .catch(function () { /* network error — connect() will surface it */ });
}

// =====================================================================
// Name Input
// =====================================================================

var savedName = getStoredTypedPlayerName();

function submitName() {
  var name = nameInput.value.trim();
  var storedAutoName = getStoredAutoPlayerName();

  playerName = name || storedAutoName || null;
  playerNameIsAuto = !name;
  // Persist only what the user actually typed. Clear any stale entry on
  // empty submit so the display's generated fallback (e.g. "HX-27") never
  // ends up prefilled the next time the input is shown.
  try {
    if (name) localStorage.setItem(PLAYER_NAME_STORAGE_KEY, name);
    else localStorage.removeItem(PLAYER_NAME_STORAGE_KEY);
  } catch (e) { /* iframe sandbox */ }
  try {
    // Clean up clientIds from previous rooms — a player is only in one room at a time
    for (var i = localStorage.length - 1; i >= 0; i--) {
      var key = localStorage.key(i);
      if (key && key.indexOf('clientId_') === 0 && key !== 'clientId_' + roomCode) {
        localStorage.removeItem(key);
      }
    }
    localStorage.setItem('clientId_' + roomCode, clientId);
  } catch (e) { /* iframe sandbox */ }
  nameJoinBtn.disabled = true;
  nameJoinBtn.textContent = t('connecting');
  nameInput.disabled = true;
  nameStatusText.textContent = '';
  nameStatusDetail.textContent = '';
  connect();
}

// --- Drop-wall action button (maze) ---
var wallBtn = document.getElementById('wall-btn');
var wallCooldownTimer = null;
function resetWallButton() {
  if (!wallBtn) return;
  clearTimeout(wallCooldownTimer);
  wallBtn.disabled = false;
  wallBtn.style.opacity = '';
}
// Exposed so the message handler (different scope) can reset on round start.
window.resetWallButton = resetWallButton;
if (wallBtn) {
  wallBtn.addEventListener('click', function () {
    if (wallBtn.disabled) return;
    vibrate(20);
    sendToDisplay(MSG.DROP_WALL, {});
    // Optimistic local cooldown for button feedback; the display is authoritative.
    wallBtn.disabled = true;
    wallBtn.style.opacity = '0.4';
    var cd = (typeof GameConstants !== 'undefined' && GameConstants.WALL_COOLDOWN_MS) || 8000;
    clearTimeout(wallCooldownTimer);
    wallCooldownTimer = setTimeout(resetWallButton, cd);
  });
}

nameJoinBtn.addEventListener('click', function () { vibrate(15); submitName(); });
nameInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') submitName();
});
nameInput.addEventListener('focus', function () {
  setTimeout(syncViewportLayout, 50);
});
nameInput.addEventListener('blur', function () {
  setTimeout(syncViewportLayout, 50);
});

// Prime audio on first interaction
document.addEventListener('pointerdown', function onFirstPointer() {
  vibrate(2);
  ControllerAudio.prime();
  document.removeEventListener('pointerdown', onFirstPointer, true);
}, { capture: true, passive: true });

// =====================================================================
// Settings
// =====================================================================
// Loads persisted settings (touch-sound mute / haptics) and wires the popup.

ControllerSettings.init();

function syncMuteControllerToggle() {
  // Switch ON = sound playing (not muted), so display the inverse of the mute flag.
  var muted = ControllerSettings.isMuted();
  toggleMuteController.setAttribute('aria-checked', muted ? 'false' : 'true');
}

function syncHapticButtons() {
  var tier = ControllerSettings.getHapticStrength();
  var btns = rowHaptics.querySelectorAll('[data-haptic]');
  for (var i = 0; i < btns.length; i++) {
    btns[i].setAttribute('aria-checked', btns[i].dataset.haptic === tier ? 'true' : 'false');
  }
}

toggleMuteController.addEventListener('click', function () {
  vibrate(15);
  ControllerSettings.setMuted(!ControllerSettings.isMuted());
  syncMuteControllerToggle();
  // Preview the move sound when the user turns touch sounds ON so they
  // can confirm audio is actually working. Tick() is internally suppressed
  // when muted, so we don't need a guard.
  if (!ControllerSettings.isMuted()) {
    ControllerAudio.prime();
    ControllerAudio.tick();
  }
});

rowHaptics.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-haptic]');
  if (!btn) return;
  ControllerSettings.setHapticStrength(btn.dataset.haptic);
  syncHapticButtons();
  vibrate(18);
});

// Re-sync the settings overlay whenever Settings state changes. Closed-overlay
// calls no-op (the open path runs syncs from scratch when the user reopens).
ControllerSettings.onChange(function () {
  if (!settingsOverlay || settingsOverlay.classList.contains('hidden')) return;
  syncMuteControllerToggle();
  syncHapticButtons();
});

function openSettings() {
  vibrate(15);
  syncMuteControllerToggle();
  syncHapticButtons();
  settingsOverlay.classList.remove('hidden');
  // Push a history entry so the browser back button closes the overlay
  // instead of popping the underlying screen (which would disconnect).
  if (!history.state || history.state.modal !== 'settings') {
    history.pushState({ modal: 'settings' }, '');
  }
}

if (pauseSettingsBtn) pauseSettingsBtn.addEventListener('click', openSettings);
if (lobbySettingsBtn) lobbySettingsBtn.addEventListener('click', openSettings);
// Exposed because function declarations inside this `else` block are
// block-scoped under strict mode and not otherwise reachable.
window.openSettings = openSettings;

function hideSettings() {
  if (!settingsOverlay) return;
  settingsOverlay.classList.add('hidden');
}

window.closeSettingsOverlay = hideSettings;

settingsCloseBtn.addEventListener('click', function () {
  vibrate(15);
  // Route Done through history.back() so the browser back button and
  // Done share a single close path (the popstate handler). Fallback for
  // AC mode / legacy openings where no state was pushed.
  if (history.state && history.state.modal === 'settings') {
    history.back();
  } else {
    hideSettings();
  }
});

// Read the build version from the <meta name="app-version"> tag baked into
// the HTML by server/index.js.
{
  var versionMeta = document.querySelector('meta[name="app-version"]');
  var label = versionMeta ? versionMeta.getAttribute('content') : '';
  if (settingsVersionEl) settingsVersionEl.textContent = label;
}

// =====================================================================
// Button Event Listeners
// =====================================================================

pauseBtn.addEventListener('click', function () {
  vibrate(15);
  // Mark the upcoming GAME_PAUSED as self-initiated so onGamePaused can skip
  // the pause-overlay's anti-misclick gate. Timeout guards against a dropped
  // PAUSE_GAME leaving the flag sticky for a later unrelated pause.
  selfPausing = true;
  clearTimeout(selfPausingTimer);
  selfPausingTimer = setTimeout(function () { selfPausing = false; }, 2000);
  sendToDisplay(MSG.PAUSE_GAME);
});

pauseContinueBtn.addEventListener('click', function () {
  vibrate(15);
  sendToDisplay(MSG.RESUME_GAME);
});

pauseNewGameBtn.addEventListener('click', function () {
  vibrate(15);
  sendToDisplay(MSG.RETURN_TO_LOBBY);
});

reconnectRejoinBtn.addEventListener('click', function () {
  vibrate(15);
  reconnectHeading.textContent = t('reconnecting');
  reconnectStatus.textContent = t('connecting');
  reconnectRejoinBtn.classList.add('hidden');
  connect();
});

lobbyBackBtn.addEventListener('click', function () {
  vibrate(15);
  performDisconnect();
});

startBtn.addEventListener('click', function () {
  if (startBtn.disabled) return;
  vibrate(15);
  sendToDisplay(MSG.START_GAME);
});

// Color picker — swatches live in #color-picker-overlay (a .game-overlay
// dialog). Wiring:
//   1. The identity-trigger row in the lobby card opens the overlay.
//   2. Tapping the backdrop or pressing Escape closes it.
//   3. Tapping a non-taken swatch sends SET_COLOR; the overlay stays open
//      until the display echoes the accepted color back via LOBBY_UPDATE →
//      renderColorPicker, which calls closeColorPicker once playerColorIndex
//      matches the pendingColorPick. Rejected picks leave the overlay open
//      so the user can pick again.
if (colorPickerEl) {
  buildColorPicker();
  colorPickerEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.swatch');
    if (!btn || btn.classList.contains('taken')) return;
    var idx = parseInt(btn.dataset.idx, 10);
    if (isNaN(idx)) return;
    vibrate(15);
    // onLobbyUpdate persists any confirmed color change, but only when this
    // flag is true so display-driven assignments (initial slot, reconnect
    // default) don't clobber a previous-session preference before reclaim
    // can act.
    userPickedColor = true;
    pendingColorPick = idx;
    sendToDisplay(MSG.SET_COLOR, { colorIndex: idx });
  });
}

if (identityTrigger) {
  identityTrigger.addEventListener('click', function () {
    if (currentScreen !== 'lobby') return;
    vibrate(10);
    openColorPicker();
  });
}

if (colorPickerOverlay) {
  colorPickerOverlay.addEventListener('click', function (e) {
    // Tap outside the rose container (i.e. on the backdrop) closes.
    if (e.target === colorPickerOverlay) closeColorPicker();
  });
  var closeBtn = document.getElementById('color-picker-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      vibrate(10);
      closeColorPicker();
    });
  }
}

document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  if (colorPickerOverlay && !colorPickerOverlay.classList.contains('hidden')) {
    closeColorPicker();
  }
});

playAgainBtn.addEventListener('click', function () {
  vibrate(15);
  sendToDisplay(MSG.PLAY_AGAIN);
});

newGameBtn.addEventListener('click', function () {
  vibrate(15);
  sendToDisplay(MSG.RETURN_TO_LOBBY);
});

// =====================================================================
// Global Event Listeners
// =====================================================================

document.addEventListener('visibilitychange', function () {
  if (document.visibilityState !== 'visible') return;
  if (gameCancelled) return;
  if (currentScreen === 'name' && !playerColor) return;

  // If returning to an already-paused or results screen, drop the
  // anti-misclick gate — see the .pause-overlay--ready and
  // .gameover-screen--ready CSS rules.
  if (pauseOverlay && !pauseOverlay.classList.contains('hidden')) {
    pauseOverlay.classList.add('pause-overlay--ready');
  }
  if (currentScreen === 'gameover' && gameoverScreen) {
    gameoverScreen.classList.add('gameover-screen--ready');
  }

  // Restart pings to check if connection is still alive.
  // If the WebSocket died while backgrounded, party.onClose will
  // trigger reconnection automatically.
  if (party && party.connected) {
    startPing();
  } else {
    connect();
  }
});

window.addEventListener('popstate', function (e) {
  // Forward into a stale modal entry after the user already closed
  // settings — no-op so we don't disconnect.
  if (e.state && e.state.modal === 'settings') return;
  // Modal-first: close settings instead of falling through to a
  // screen-level back (which would disconnect).
  if (settingsOverlay && !settingsOverlay.classList.contains('hidden')) {
    hideSettings();
    return;
  }
  if (currentScreen === 'lobby' || currentScreen === 'game' || currentScreen === 'gameover') {
    performDisconnect();
  }
});

// Best-effort: pagehide also fires on iOS bfcache freeze, where the WS close
// may not complete before the page is frozen. If the page is restored from
// bfcache the WebSocket is dead; the existing visibilitychange + reconnect
// flow will surface the reconnect overlay.
window.addEventListener('pagehide', function () {
  if (party) party.close();
});

// =====================================================================
// Initialize
// =====================================================================

if (hadStoredId || rejoinToken || legacyRejoinId) {
  var savedAutoName = getStoredAutoPlayerName();
  playerName = savedName || savedAutoName || null;
  playerNameIsAuto = !savedName;
  nameInput.value = savedName;
  nameJoinBtn.disabled = true;
  nameJoinBtn.textContent = t('connecting');
  nameInput.disabled = true;
  nameStatusText.textContent = '';
  nameStatusDetail.textContent = '';
  showScreen('name');
  connect();
} else {
  nameInput.value = savedName;
  nameStatusText.textContent = '';
  nameStatusDetail.textContent = '';
  showScreen('name');
  nameInput.focus();
}

syncViewportLayout();

// Show join URL hint on lobby screen
var joinUrlHint = location.origin + '/' + roomCode;
var lobbyJoinUrl = document.getElementById('lobby-join-url');
if (lobbyJoinUrl) lobbyJoinUrl.textContent = joinUrlHint;

} // end if (roomCode)
