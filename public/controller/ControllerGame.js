'use strict';

// =====================================================================
// Controller Game — game screens, touch input, feedback, results
// Depends on: ControllerState.js (globals), ControllerConnection.js (sendToDisplay)
// Called by: controller.js (message handlers)
// =====================================================================

// =====================================================================
// Lobby / Welcome
// =====================================================================

// Apply host info from a WELCOME or LOBBY_UPDATE payload, then refresh any
// visible host-gated UI. Safe to call on any screen.
function applyHostInfo(data) {
  if (data.isHost !== undefined) isHost = !!data.isHost;
  if (data.hostName !== undefined) hostName = data.hostName;
  if (data.hostColorIndex !== undefined) {
    hostColor = data.hostColorIndex != null ? PLAYER_COLORS[data.hostColorIndex] : null;
  }
  updateHostVisibility();
}

function updateHostVisibility() {
  // Lobby: host sees Start button, non-host sees waiting banner.
  // Skip when waitingForNextGame — late joiners in an active game sit on
  // the lobby screen with the "game_in_progress" banner already in place;
  // letting the host-gate overwrite it would hide that status.
  if (currentScreen === 'lobby' && !waitingForNextGame) {
    if (isHost) {
      startBtn.classList.remove('hidden');
      startBtn.disabled = false;
      setWaitingActionMessage('');
    } else {
      startBtn.classList.add('hidden');
      startBtn.disabled = true;
      renderHostBanner(waitingActionText, 'waiting_for_host_to_start', hostName || t('player'), hostColor);
      waitingActionText.classList.remove('hidden');
    }
  }
  // Results: host sees Play Again / New Game, non-host sees waiting banner.
  // The 1.5s anti-misclick delay is handled by the #gameover-buttons CSS
  // animation (pointer-events: none during the delay), so a concurrent
  // LOBBY_UPDATE mid-delay can't flip the buttons to clickable early — the
  // animation restarts whenever the element transitions from hidden to shown.
  if (currentScreen === 'gameover') {
    if (isHost) {
      gameoverStatus.textContent = '';
      gameoverStatus.style.color = '';
      gameoverButtons.classList.remove('hidden');
    } else {
      gameoverButtons.classList.add('hidden');
      renderHostBanner(gameoverStatus, 'waiting_for_host_to_continue', hostName || t('player'), hostColor);
    }
  }
  // Pause overlay: non-host can still resume, but can't return to lobby.
  if (pauseNewGameBtn) {
    pauseNewGameBtn.classList.toggle('hidden', !isHost);
  }
}

function showLobbyUI() {
  playerIdentity.style.setProperty('--player-color', playerColor);
  playerIdentityName.textContent = playerName || t('player');

  updateStartButton();
  statusText.textContent = '';
  statusDetail.textContent = '';

  showScreen('lobby');
  // Paint after showScreen so that updateHostVisibility (below) sees
  // currentScreen === 'lobby' and wires up host-gated UI.
  renderColorPicker();
  // Must run after showScreen so currentScreen === 'lobby' when we gate UI.
  updateHostVisibility();
}

// Repaint every swatch. Called whenever the lobby state changes
// (takenColorIndices, playerColorIndex). Closes the overlay once a pending
// pick has been confirmed by the display.
function renderColorPicker() {
  if (!colorPickerEl) return;

  // 1. If a pick is pending and the display has echoed it back as the
  //    current color, close the overlay.
  if (pendingColorPick != null && pendingColorPick === playerColorIndex) {
    pendingColorPick = null;
    if (typeof closeColorPicker === 'function') closeColorPicker();
  }

  // 2. Skip repaint while hidden — the swatches are repainted fresh on each
  //    open via openColorPicker.
  if (colorPickerOverlay && colorPickerOverlay.classList.contains('hidden')) {
    return;
  }

  // 3. Paint each swatch: own color highlighted, colors taken by others
  //    disabled. The full palette is shown (current color included).
  var taken = new Set(takenColorIndices || []);
  var cells = colorPickerEl.children;
  for (var i = 0; i < cells.length; i++) {
    var btn = cells[i];
    var idx = parseInt(btn.dataset.idx, 10);
    if (isNaN(idx)) continue;
    var isCurrent = idx === playerColorIndex;
    var isTaken = taken.has(idx) && !isCurrent;
    btn.style.setProperty('--swatch-color', PLAYER_COLORS[idx]);
    btn.classList.toggle('taken', isTaken);
    btn.classList.toggle('current', isCurrent);
    btn.setAttribute('aria-label', t('color_choose', { n: idx + 1 }));
    btn.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
    if (isTaken) {
      btn.setAttribute('aria-disabled', 'true');
      btn.setAttribute('tabindex', '-1');
    } else {
      btn.removeAttribute('aria-disabled');
      btn.removeAttribute('tabindex');
    }
  }
}

// Read the persisted color index. Returns null when nothing is stored or
// (in AirConsole mode) before the storage shim's cache has hydrated — both
// callers below treat null as "no preference".
function readStoredColorIndex() {
  var raw = null;
  try { raw = localStorage.getItem('maze_color_index'); } catch (e) { /* iframe sandbox */ }
  if (raw == null) return null;
  var idx = parseInt(raw, 10);
  if (isNaN(idx) || idx < 0 || idx >= PLAYER_COLORS.length) return null;
  return idx;
}

// Tint the JOIN button before WELCOME arrives. In AirConsole mode the
// storage shim hydrates asynchronously, so the bootstrap re-invokes this
// from its onLoad callback (see controller-airconsole.js). Skip when
// playerColorIndex is already set: WELCOME established the authoritative
// color, and overriding it with the previous-session preference would
// leave body --player-color stuck on a color the player no longer owns
// (reclaimPreferredColor bails when the preferred color is taken).
function captureSessionColorIndex() {
  if (playerColorIndex != null) return;
  var idx = readStoredColorIndex();
  if (idx == null) return;
  document.body.style.setProperty('--player-color', PLAYER_COLORS[idx]);
}
captureSessionColorIndex();

// Save the player's current color so a future reload can reclaim it.
// Called from onLobbyUpdate when userPickedColor is true (i.e. the user
// actually tapped a swatch — display-assigned defaults are ignored).
function persistColorIndex(idx) {
  try { localStorage.setItem('maze_color_index', String(idx)); }
  catch (e) { /* iframe sandbox */ }
}

// If the persisted color differs from what the display just assigned, ask
// for it back. Same-index is a no-op on the display side; collisions are
// silently rejected. Skip when the preferred color is already taken
// (takenColorIndices is set from the same WELCOME just before this fires).
// Safe to re-call from controller-airconsole's onLoad: a no-op when the
// shim was hydrated before WELCOME, and the actual reclaim path when not.
function reclaimPreferredColor() {
  var preferred = readStoredColorIndex();
  if (preferred == null) return;
  if (preferred === playerColorIndex) return;
  if (typeof sendToDisplay !== 'function' || playerColorIndex == null) return;
  if (takenColorIndices && takenColorIndices.indexOf(preferred) >= 0) return;
  // Don't override an in-flight user pick: if the user has tapped a
  // swatch since this session started, that's their preference now —
  // the persisted value is moot. Narrow race where reclaim from onLoad
  // could otherwise undo a tap that landed before hydration.
  if (userPickedColor) return;
  sendToDisplay(MSG.SET_COLOR, { colorIndex: preferred });
}

// One-time setup — one swatch button per palette color. Per-swatch color,
// dataset.idx, and ARIA are (re)populated on each renderColorPicker based on
// who the player currently is. Click delegation happens at the container.
function buildColorPicker() {
  if (!colorPickerEl || colorPickerEl.children.length) return;
  for (var i = 0; i < PLAYER_COLORS.length; i++) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch';
    btn.dataset.idx = String(i);
    colorPickerEl.appendChild(btn);
  }
}

// =====================================================================
// Color picker overlay — open / close
// =====================================================================

// Track the element that had focus when the overlay opened so we can
// restore it on close. Without this, dismissing the overlay leaves focus
// on document.body which breaks keyboard nav.
var _pickerPreviousFocus = null;

function openColorPicker() {
  if (!colorPickerOverlay) return;
  if (!colorPickerOverlay.classList.contains('hidden')) return;
  _pickerPreviousFocus = document.activeElement;
  // Drop .hidden BEFORE renderColorPicker so the repaint guard inside
  // renderColorPicker (skip while .hidden) sees the open state and paints
  // the swatches with the current palette.
  colorPickerOverlay.classList.remove('hidden');
  renderColorPicker();
  if (identityTrigger) identityTrigger.setAttribute('aria-expanded', 'true');
  // Move focus to the current swatch (or the first one) so keyboard users
  // land somewhere meaningful. Tap-to-open users never see the focus ring.
  var focusTarget = colorPickerEl &&
    (colorPickerEl.querySelector('.swatch.current') || colorPickerEl.querySelector('.swatch'));
  if (focusTarget) {
    try { focusTarget.focus({ preventScroll: true }); }
    catch (e) { focusTarget.focus(); }
  }
}

function closeColorPicker() {
  if (!colorPickerOverlay) return;
  if (colorPickerOverlay.classList.contains('hidden')) return;
  colorPickerOverlay.classList.add('hidden');
  if (identityTrigger) identityTrigger.setAttribute('aria-expanded', 'false');
  // Drop any pending pick — if the user closes manually before the
  // display has confirmed, treat the request as abandoned. The display
  // will silently no-op the SET_COLOR if it's already too late.
  pendingColorPick = null;
  if (_pickerPreviousFocus && typeof _pickerPreviousFocus.focus === 'function') {
    try { _pickerPreviousFocus.focus({ preventScroll: true }); }
    catch (e) { _pickerPreviousFocus.focus(); }
  }
  _pickerPreviousFocus = null;
}

function updateStartButton() {
  startBtn.textContent = t('start_n_players', { count: playerCount });
}

function setWaitingActionMessage(message) {
  waitingActionText.textContent = message || '';
  waitingActionText.classList.toggle('hidden', !message);
  waitingActionText.style.color = '';
}

// Render a "Waiting for {name}..." banner with only the player name colored.
// Uses DOM nodes rather than innerHTML so the untrusted name can't inject HTML.
// Everything is wrapped in a single inline span so the parent's `display: flex`
// sees only one flex item — otherwise each text node + name span becomes its
// own item and the text can't wrap naturally between words.
// Assumes each locale string has exactly one {name} placeholder. A template
// with multiple {name} occurrences would split into 3+ parts and only
// parts[0]/parts[1] would render. tests/i18n.test.js ("waiting_for_host
// banner keys contain exactly one {name}") enforces this invariant.
function renderHostBanner(element, key, name, color) {
  element.textContent = '';
  element.style.color = '';
  var wrap = document.createElement('span');
  var tmpl = t(key, { name: '\x00' });
  var parts = tmpl.split('\x00');
  var nameSpan = document.createElement('span');
  nameSpan.textContent = name;
  if (color) nameSpan.style.color = color;
  if (parts.length < 2) {
    // Graceful degrade for a malformed locale: render the template text
    // followed by a space and the name, rather than colliding them.
    console.warn('[renderHostBanner] missing {name} placeholder in locale key:', key);
    wrap.appendChild(document.createTextNode(parts[0] + ' '));
    wrap.appendChild(nameSpan);
  } else {
    wrap.appendChild(document.createTextNode(parts[0]));
    wrap.appendChild(nameSpan);
    wrap.appendChild(document.createTextNode(parts[1]));
  }
  element.appendChild(wrap);
}

// =====================================================================
// Message Handlers
// =====================================================================

function onWelcome(data) {
  if (data.colorIndex != null) {
    playerColorIndex = data.colorIndex;
    playerColor = PLAYER_COLORS[data.colorIndex] || PLAYER_COLORS[0];
    // Don't persist the display-assigned color here — it's not a user
    // choice. Persisting it would clobber the previous-session preference
    // before reclaimPreferredColor gets a chance to read it. The user's
    // explicit picks are persisted in onLobbyUpdate (display echoes the
    // accepted SET_COLOR back), which is the only signal that a colorIndex
    // is actually the user's selection.
  } else {
    // Defensive: the display always sends colorIndex, but if it's missing
    // keep whatever we already have. Only seed a default when nothing is
    // set — and seed both pieces so the picker still finds a selected
    // swatch on the next render.
    if (playerColorIndex == null) playerColorIndex = 0;
    if (!playerColor) playerColor = PLAYER_COLORS[0];
  }
  if (Array.isArray(data.takenColorIndices)) takenColorIndices = data.takenColorIndices;
  // Mirror the three setProperty targets in onLobbyUpdate. WELCOME's
  // colorIndex is the same value the controller already had (the display
  // doesn't reassign on reconnect), so this is symmetry/defensiveness
  // rather than a fix for an observed flash.
  document.body.style.setProperty('--player-color', playerColor);
  playerIdentity.style.setProperty('--player-color', playerColor);
  gameScreen.style.setProperty('--player-color', playerColor);
  playerCount = data.playerCount || 1;
  gameCancelled = false;
  waitingForNextGame = false;
  // Try to reclaim the user's preferred color (saved on prior swatch
  // taps). The display rejects same-idx as a no-op and silently rejects
  // collisions, so this is safe to fire on every WELCOME — the next
  // LOBBY_UPDATE settles the truth either way.
  reclaimPreferredColor();
  // Set host state first so renderGameResults / showLobbyUI below see it.
  // updateHostVisibility is a no-op on the current screen ('name' or mid-
  // transition) thanks to its screen guards.
  applyHostInfo(data);

  if (party) party.resetReconnectCount();
  startPing();
  clearTimeout(disconnectedTimer);
  reconnectOverlay.classList.add('hidden');

  playerName = data.playerName || playerName || t('player');
  if (playerNameIsAuto) {
    rememberAutoPlayerName(playerName);
  }
  playerNameEl.textContent = playerName;
  touchArea.setAttribute('data-player-name', playerName);

  if (data.roomState === 'playing' || data.roomState === 'countdown') {
    // Late joiner (not in active game) — display omits alive field
    if (data.alive === undefined) {
      waitingForNextGame = true;
      showLobbyUI();
      startBtn.classList.add('hidden');
      startBtn.disabled = true;
      setWaitingActionMessage(t('game_in_progress'));
      return;
    }

    gameScreen.classList.remove('dead');
    gameScreen.classList.remove('paused');
    gameScreen.classList.remove('countdown');
    gameScreen.style.setProperty('--player-color', playerColor);
    removeKoOverlay();
    pauseBtn.classList.remove('hidden');
    if (data.paused) {
      onGamePaused();
    } else {
      pauseOverlay.classList.add('hidden');
    }

    if (data.alive === false) {
      gameScreen.classList.add('dead');
      showKoOverlay();
    }

    showScreen('game');
    initTouchInput();
    return;
  }

  if (data.roomState === 'results') {
    var reconnectResults = data.results || lastGameResults;
    if (reconnectResults) {
      lastGameResults = reconnectResults;
      renderGameResults(reconnectResults);
      showScreen('gameover');
      return;
    }
    // No results available (e.g. fresh controller joining mid-results) — fall through to lobby
  }

  showLobbyUI();
}

function onLobbyUpdate(data) {
  playerCount = data.playerCount;
  if (data.colorIndex != null && data.colorIndex !== playerColorIndex) {
    playerColorIndex = data.colorIndex;
    playerColor = PLAYER_COLORS[data.colorIndex] || playerColor;
    document.body.style.setProperty('--player-color', playerColor);
    playerIdentity.style.setProperty('--player-color', playerColor);
    gameScreen.style.setProperty('--player-color', playerColor);
    // Persist only user-initiated changes (see userPickedColor decl in
    // ControllerState.js). Display-driven assignments — initial slot,
    // reconnect-default, reclaim's own SET_COLOR confirmation — must
    // not write here: in AC mode an early LOBBY_UPDATE landing before
    // the persistent-data fetch resolves would clobber the previous-
    // session preference in cache.
    if (userPickedColor) persistColorIndex(data.colorIndex);
  }
  if (Array.isArray(data.takenColorIndices)) takenColorIndices = data.takenColorIndices;
  applyHostInfo(data);
  updateStartButton();
  if (currentScreen === 'lobby') {
    renderColorPicker();
  }
}

function onGameStart() {
  ControllerAudio.tick();
  // Clear any stale pause-self state from the previous round. If GAME_END
  // raced the relay's GAME_PAUSED echo, selfPausing could still be true
  // here and wrongly suppress "Paused by X" in the next round.
  selfPausing = false;
  clearTimeout(selfPausingTimer);
  gameScreen.classList.remove('dead');
  gameScreen.classList.remove('paused');
  gameScreen.classList.remove('countdown');
  gameScreen.style.setProperty('--player-color', playerColor);
  removeKoOverlay();
  reconnectOverlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  pauseBtn.disabled = false;
  pauseBtn.classList.remove('hidden');
  touchArea.setAttribute('data-player-name', playerName);
  showScreen('game');
  initTouchInput();
}

function onPlayerState(data) {
  if (!touchInput) {
    gameScreen.classList.remove('countdown');
    pauseBtn.disabled = false;
    pauseBtn.classList.remove('hidden');
    initTouchInput();
  }
  if (data.alive === false && !gameScreen.classList.contains('dead')) {
    gameScreen.classList.add('dead');
    showKoOverlay();
  }
}

function onGameEnd(data) {
  lastGameResults = data.results;
  // Close the settings popup if it was open — leaving it visible on top of
  // the gameover screen would block the results UI.
  closeSettingsOverlay();
  renderGameResults(data.results);
  showScreen('gameover');
}

// =====================================================================
// Pause
// =====================================================================

var selfPausing = false;
var selfPausingTimer = null;

function onGamePaused() {
  gameScreen.classList.add('paused');
  pauseOverlay.classList.toggle('pause-overlay--self', selfPausing);
  selfPausing = false;
  clearTimeout(selfPausingTimer);
  pauseOverlay.classList.remove('hidden');
  pauseBtn.disabled = true;
}

function onGameResumed() {
  gameScreen.classList.remove('paused');
  pauseOverlay.classList.add('hidden');
  pauseOverlay.classList.remove('pause-overlay--self');
  pauseOverlay.classList.remove('pause-overlay--ready');
  pauseBtn.disabled = false;
}

// =====================================================================
// Results
// =====================================================================

// The 1.5s anti-misclick delay and fade-in are purely CSS — see the
// `resultsButtonsEnter` animation on #gameover-buttons. pointer-events stays
// `none` until the animation fires, so stray taps before buttons are visible
// can't reach the click handlers.
function renderGameResults(results) {
  resultsList.innerHTML = '';
  gameoverStatus.textContent = '';
  gameoverStatus.style.color = '';
  if (isHost) {
    gameoverButtons.classList.remove('hidden');
  } else {
    gameoverButtons.classList.add('hidden');
    renderHostBanner(gameoverStatus, 'waiting_for_host_to_continue', hostName || t('player'), hostColor);
  }

  var winnerColor = 'rgba(255, 215, 0, 0.06)';
  if (results && results.length) {
    var winner = results.find(function(r) { return r.rank === 1; });
    if (winner) {
      var wc = PLAYER_COLORS[winner.colorIndex] || PLAYER_COLORS[0];
      winnerColor = rgbaFromHex(wc, 0.08);
    }
  }
  gameoverScreen.style.setProperty('--winner-glow', winnerColor);

  if (playerColor) {
    gameoverScreen.style.setProperty('--me-color', playerColor);
  }

  if (!results || !results.length) return;

  // Non-participants (late joiners who sat out this round) arrive in `results`
  // flagged newPlayer by the display: no rank/lines/level, a "new player"
  // status instead. They sort last (no rank).
  var sorted = results.slice().sort(function(a, b) { return (a.rank || 999) - (b.rank || 999); });
  // A late joiner counts toward the row total, so a 1-player game with one
  // waiting joiner is intentionally not "solo": the rank column appears (the
  // player gets "1", the joiner "–").
  var solo = sorted.length === 1;
  for (var i = 0; i < sorted.length; i++) {
    var r = sorted[i];
    var isNew = !!r.newPlayer;
    var pColor = PLAYER_COLORS[r.colorIndex] || PLAYER_COLORS[i % PLAYER_COLORS.length];

    var row = document.createElement('div');
    row.className = 'result-row';
    if (!solo && !isNew) row.className += ' rank-' + r.rank;
    if (isNew) row.className += ' result-row--joining';
    row.style.setProperty('--row-delay', (0.2 + i * 0.08) + 's');
    if (r.playerId === peerIndex || r.playerId === clientId) row.classList.add('is-me');

    if (!solo) {
      var rankEl = document.createElement('span');
      rankEl.className = 'result-rank';
      rankEl.textContent = isNew ? '–' : String(r.rank);
      rankEl.style.color = pColor;
      row.appendChild(rankEl);
    }

    var info = document.createElement('div');
    info.className = 'result-info';

    var nameEl = document.createElement('span');
    nameEl.className = 'result-name';
    nameEl.textContent = r.playerName || t('player');
    nameEl.style.color = pColor;

    var stats = document.createElement('div');
    stats.className = 'result-stats';
    if (isNew) {
      var statusSpan = document.createElement('span');
      statusSpan.textContent = t('new_player');
      stats.appendChild(statusSpan);
    } else {
      var outcome = document.createElement('span');
      outcome.textContent = r.finished ? t('escaped') : t('did_not_escape');
      stats.appendChild(outcome);
    }

    info.appendChild(nameEl);
    info.appendChild(stats);
    row.appendChild(info);
    resultsList.appendChild(row);
  }
}

// =====================================================================
// KO Overlay
// =====================================================================

function showKoOverlay() {
  removeKoOverlay();
  var ko = document.createElement('div');
  ko.id = 'ko-overlay';
  ko.textContent = t('ko');
  touchArea.appendChild(ko);
}

function removeKoOverlay() {
  var el = document.getElementById('ko-overlay');
  if (el) el.remove();
}

// =====================================================================
// Gesture Feedback — glow that follows finger
// =====================================================================

var GLOW_SIZE = 80;
var GLOW_OPACITY = 1;
var _feedbackRect = null;
window.addEventListener('resize', function() { _feedbackRect = null; });

function showGlow(x, y) {
  if (!glowEl) {
    glowEl = document.createElement('div');
    glowEl.className = 'feedback-glow';
    feedbackLayer.appendChild(glowEl);
  }
  if (!_feedbackRect) _feedbackRect = feedbackLayer.getBoundingClientRect();
  var lx = x - _feedbackRect.left;
  var ly = y - _feedbackRect.top;
  glowEl.style.transform = 'translate(' + (lx - GLOW_SIZE / 2) + 'px,' + (ly - GLOW_SIZE / 2) + 'px)';
  glowEl.style.opacity = GLOW_OPACITY;
}

function hideGlow() {
  if (glowEl) { glowEl.remove(); glowEl = null; }
}

function flashGlow() {
  if (glowEl) {
    var el = glowEl;
    glowEl = null;
    el.animate([{ opacity: GLOW_OPACITY }, { opacity: 0 }], { duration: 150, easing: 'ease-out' });
    setTimeout(function () { if (el.parentNode) el.remove(); }, 170);
  }
}

// =====================================================================
// Touch Input
// =====================================================================

function initTouchInput() {
  if (touchInput) {
    touchInput.destroy();
  }

  if (coordTracker) {
    touchArea.removeEventListener('pointerdown', coordTracker);
    touchArea.removeEventListener('pointermove', coordTracker);
    touchArea.removeEventListener('pointerup', coordTracker);
  }

  coordTracker = function (e) {
    lastTouchX = e.clientX;
    lastTouchY = e.clientY;
    if (e.type === 'pointerdown') {
      _feedbackRect = feedbackLayer.getBoundingClientRect();
      showGlow(e.clientX, e.clientY);
    } else if (e.type === 'pointermove') {
      showGlow(e.clientX, e.clientY);
    } else if (e.type === 'pointerup') {
      hideGlow();
    }
  };
  touchArea.addEventListener('pointerdown', coordTracker, { passive: true });
  touchArea.addEventListener('pointermove', coordTracker, { passive: true });
  touchArea.addEventListener('pointerup', coordTracker, { passive: true });

  // Maze: a swipe sets the auto-run heading (up/down/left/right).
  touchInput = new SwipeInput(touchArea, function (dir) {
    ControllerAudio.tick();
    sendToDisplay(MSG.INPUT, { action: dir });
  }, null);
}
