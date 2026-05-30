'use strict';

// =====================================================================
// Display UI — layout calculation, lobby UI, QR rendering, timer
// Depends on: DisplayState.js (globals)
// Called by: DisplayConnection.js, DisplayGame.js, display.js
// =====================================================================

// --- Layout Calculation ---
// The maze is one shared canvas; its viewport is derived from the live maze in
// renderFrame (MazeRenderer.computeView). Invalidate so it recomputes at the
// new canvas size / for a new maze.
function calculateLayout() {
  mazeView = null;
}

// --- Lobby UI ---
function updatePlayerList() {
  var placeholderSlots = window.innerWidth >= 2400 ? 8 : 4;
  var totalSlots = Math.max(placeholderSlots, GameConstants.MAX_PLAYERS);

  // Ensure we have enough slot elements
  while (playerListEl.children.length < totalSlots) {
    var slot = document.createElement('div');
    slot.className = 'player-slot';
    var card = document.createElement('div');
    card.className = 'player-card empty';
    var topRow = document.createElement('div');
    topRow.className = 'player-card__top';
    var name = document.createElement('span');
    name.className = 'identity-name';
    var idx = playerListEl.children.length;
    name.textContent = 'P' + (idx + 1);
    topRow.appendChild(name);
    card.appendChild(topRow);
    slot.appendChild(card);
    playerListEl.appendChild(slot);
  }

  // Cards pack tightly: N players fill the first N slots. Ordering follows
  // join time so a player's seat is stable across color changes — color
  // picks recolor the card in place rather than swapping slots with a
  // neighbor. Same rule used by calculateLayout() for the game boards.
  var sortedPlayers = Array.from(players.entries()).sort(function(a, b) {
    return (a[1].joinedAt ?? Infinity) - (b[1].joinedAt ?? Infinity);
  });
  var visibleSlots = Math.max(placeholderSlots, sortedPlayers.length);

  // 5+ players get a wider 4-column grid in landscape via the .pl--lg rule.
  playerListEl.classList.toggle('pl--lg', visibleSlots > 4);

  for (var j = 0; j < totalSlots; j++) {
    var slot = playerListEl.children[j];
    var card = slot.querySelector('.player-card');
    var nameEl = card.querySelector('.identity-name');

    // Hide slots beyond visible range
    slot.style.display = j < visibleSlots ? '' : 'none';

    // Nth filled slot gets the Nth player from the join-sorted list.
    var playerId = null;
    var info = null;
    if (j < sortedPlayers.length) {
      playerId = sortedPlayers[j][0];
      info = sortedPlayers[j][1];
    }
    var wasEmpty = card.classList.contains('empty');

    if (info) {
      var color = PLAYER_COLORS[info.playerIndex] || '#fff';
      card.style.setProperty('--player-color', color);
      nameEl.textContent = info.playerName || PLAYER_NAMES[info.playerIndex] || t('player');
      card.classList.remove('empty');
      card.dataset.playerId = playerId;
      slot.dataset.playerId = playerId;
      if (wasEmpty) {
        card.classList.remove('join-pop');
        void card.offsetWidth;
        card.classList.add('join-pop');
      }
    } else {
      card.style.removeProperty('--player-color');
      nameEl.textContent = 'P' + (j + 1);
      card.classList.add('empty');
      card.classList.remove('join-pop');
      delete card.dataset.playerId;
      delete slot.dataset.playerId;
    }
  }
}

function updateStartButton() {
  var hasPlayers = players.size > 0;
  startBtn.disabled = !hasPlayers;
  startBtn.textContent = hasPlayers
    ? t('start_n_players', { count: players.size })
    : t('waiting_for_players');
  applyHostTint();
}

// Tint primary CTAs (lobby start + pause/reconnect/results overlays) with the
// current host's identity color. Setting on <body> lets every tinted button in
// theme.css inherit without per-button wiring. Shared rule reads
// --player-color, falling back to --accent-primary when unset. Called both
// from the lobby flow (updateStartButton) and from broadcastLobbyUpdate so a
// mid-game host handoff (AirConsole master_changed, player leaving during
// RESULTS) refreshes the tint on the pause/results/reconnect overlays too.
function applyHostTint() {
  var hostId = getHostPeerIndex();
  var hostPlayer = hostId != null ? players.get(hostId) : null;
  var hostColor = hostPlayer ? PLAYER_COLORS[hostPlayer.playerIndex] : null;
  if (hostColor) {
    document.body.style.setProperty('--player-color', hostColor);
  } else {
    document.body.style.removeProperty('--player-color');
  }
}

// --- Relay Region Chip ---
// Maps relay-supplied region codes to a city + flag. The relay (Party-Sockets)
// uses Fly.io 3-letter codes — see Party-Sockets/regions.ts for the canonical
// list. The chip shows the city for legibility ("Frankfurt 🇩🇪"); the IATA
// code stays in the tooltip and the report email so support has the
// unambiguous identifier. Unknown codes fall back to the raw uppercase code
// without a flag, so a relay-side region addition won't break the chip until
// this map catches up.
var RELAY_REGION_META = {
  ams: { city: 'Amsterdam',    flag: '🇳🇱' },
  arn: { city: 'Stockholm',    flag: '🇸🇪' },
  bom: { city: 'Mumbai',       flag: '🇮🇳' },
  cdg: { city: 'Paris',        flag: '🇫🇷' },
  dfw: { city: 'Dallas',       flag: '🇺🇸' },
  ewr: { city: 'New Jersey',   flag: '🇺🇸' },
  fra: { city: 'Frankfurt',    flag: '🇩🇪' },
  gru: { city: 'São Paulo',    flag: '🇧🇷' },
  iad: { city: 'Ashburn',      flag: '🇺🇸' },
  jnb: { city: 'Johannesburg', flag: '🇿🇦' },
  lax: { city: 'Los Angeles',  flag: '🇺🇸' },
  lhr: { city: 'London',       flag: '🇬🇧' },
  nrt: { city: 'Tokyo',        flag: '🇯🇵' },
  ord: { city: 'Chicago',      flag: '🇺🇸' },
  sin: { city: 'Singapore',    flag: '🇸🇬' },
  sjc: { city: 'San Jose',     flag: '🇺🇸' },
  syd: { city: 'Sydney',       flag: '🇦🇺' },
  yyz: { city: 'Toronto',      flag: '🇨🇦' }
};

function updateRelayChip() {
  if (!relayChip) return;
  // Need at least a region or a measured RTT to show anything useful.
  if (!relayRegion && lastRelayRtt < 0) {
    relayChip.classList.add('hidden');
    return;
  }

  var rttText = lastRelayRtt >= 0 ? lastRelayRtt + ' ms' : 'measuring…';
  if (relayRegion) {
    var code = String(relayRegion).toLowerCase();
    var meta = RELAY_REGION_META[code];
    relayChipRegion.textContent = meta ? meta.city + ' ' + meta.flag : code.toUpperCase();
    relayChip.dataset.tooltip = code.toUpperCase() + ' · ' + rttText + ' RTT';
  } else {
    relayChipRegion.textContent = rttText;
    delete relayChip.dataset.tooltip;
  }
  relayChip.classList.remove('hidden');

  relayChipDot.classList.remove('ping-ok', 'ping-bad');
  if (lastRelayRtt < 0) {
    // No measurement yet — keep the default good (mint) tint.
  } else if (lastRelayRtt > RELAY_RTT_OK_MS) {
    relayChipDot.classList.add('ping-bad');
  } else if (lastRelayRtt > RELAY_RTT_GOOD_MS) {
    relayChipDot.classList.add('ping-ok');
  }

  // Sticky reveal: once the user has seen sustained bad latency, the report
  // button stays visible until resetToWelcome clears the session — so the
  // button doesn't blink in/out as RTT oscillates, and a user mid-click
  // doesn't lose the target. Hidden again only on a fresh welcome entry.
  if (relayReportBtn && consecutiveBadRtt >= RELAY_REPORT_THRESHOLD) {
    relayReportBtn.classList.remove('hidden');
  }
}

function buildRelayReportMailto() {
  var subject = 'Maze Party: bad latency report';
  var bodyLines = [
    'Hi, I\'m seeing bad latency in Maze Party. Details below:',
    '',
    'My location (city/country): ',
    '',
    'Server region: ' + (relayRegion || 'unknown'),
    'App version: ' + (document.getElementById('lobby-version-label')?.textContent || 'unknown'),
    'Timestamp: ' + new Date().toISOString(),
    '',
    'Notes (optional): '
  ];
  return 'mailto:info@couch-games.com'
    + '?subject=' + encodeURIComponent(subject)
    + '&body=' + encodeURIComponent(bodyLines.join('\n'));
}

if (relayReportBtn) {
  relayReportBtn.addEventListener('click', function() {
    window.location.href = buildRelayReportMailto();
  });
}

// --- QR Code Rendering ---
function renderQR(canvas, qrMatrix, targetCssSize) {
  if (!qrMatrix || !qrMatrix.modules) return;
  var size = qrMatrix.size;
  var modules = qrMatrix.modules;

  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect();
  var cssSize = targetCssSize || Math.min(rect.width, rect.height) || 180;
  var cellPx = Math.floor((cssSize * dpr) / size);
  var totalPx = cellPx * size;

  canvas.width = totalPx;
  canvas.height = totalPx;

  var qrCtx = canvas.getContext('2d');
  qrCtx.clearRect(0, 0, totalPx, totalPx);

  qrCtx.fillStyle = THEME.color.text.white;
  qrCtx.fillRect(0, 0, totalPx, totalPx);

  var inset = Math.max(0.5, cellPx * 0.03);
  var radius = Math.max(1, cellPx * 0.15);

  qrCtx.fillStyle = THEME.color.bg.card;
  for (var row = 0; row < size; row++) {
    for (var col = 0; col < size; col++) {
      var idx = row * size + col;
      if (!(modules[idx] & 1)) continue;

      var x = col * cellPx + inset;
      var y = row * cellPx + inset;
      var s = cellPx - inset * 2;

      roundRect(qrCtx, x, y, s, s, radius);
      qrCtx.fill();
    }
  }
}

// --- Results Rendering ---
function renderResults(results) {
  resultsList.innerHTML = '';
  if (!results) return;

  // newPlayer entries (late joiners who sat out this round) carry no rank, so
  // they sort last and render a "New player" status in place of stats.
  var sorted = results.slice().sort(function(a, b) { return (a.rank || 999) - (b.rank || 999); });

  var winner = sorted[0];
  if (winner) {
    var wInfo = players.get(winner.playerId);
    var winnerColor = (wInfo && PLAYER_COLORS[wInfo.playerIndex]) || '#ffd700';
    resultsScreen.style.setProperty('--winner-glow', rgbaFromHex(winnerColor, 0.08));
  }

  // A late joiner counts toward the row total, so a 1-player game with one
  // waiting joiner is intentionally not "solo": the rank column appears.
  var solo = sorted.length === 1;

  for (var i = 0; i < sorted.length; i++) {
    var res = sorted[i];
    var isNew = !!res.newPlayer;
    var row = document.createElement('div');
    row.className = 'result-row';
    if (!solo && !isNew) row.className += ' rank-' + res.rank;
    if (isNew) row.className += ' result-row--joining';
    row.style.setProperty('--row-delay', (0.2 + i * 0.08) + 's');

    var pInfo = players.get(res.playerId);
    var pColor = pInfo ? PLAYER_COLORS[pInfo.playerIndex] : null;

    if (!solo) {
      var rank = document.createElement('span');
      rank.className = 'result-rank';
      rank.textContent = isNew ? '–' : String(res.rank);
      if (pColor) rank.style.color = pColor;
      row.appendChild(rank);
    }

    var info = document.createElement('div');
    info.className = 'result-info';

    var nameEl = document.createElement('span');
    nameEl.className = 'result-name';
    nameEl.textContent = res.playerName || pInfo?.playerName || t('player');
    if (pColor) nameEl.style.color = pColor;

    var stats = document.createElement('div');
    stats.className = 'result-stats';
    if (isNew) {
      var statusSpan = document.createElement('span');
      statusSpan.textContent = t('new_player');
      stats.appendChild(statusSpan);
    } else {
      var outcome = document.createElement('span');
      outcome.textContent = res.finished ? t('escaped') : t('did_not_escape');
      stats.appendChild(outcome);
    }

    info.appendChild(nameEl);
    info.appendChild(stats);
    row.appendChild(info);
    resultsList.appendChild(row);
  }
}

// --- Timer Rendering ---
function drawTimer(elapsedMs) {
  var totalSeconds = Math.floor(elapsedMs / 1000);
  var minutes = Math.floor(totalSeconds / 60);
  var seconds = totalSeconds % 60;
  var timeStr = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');

  var font = getDisplayFont();
  var timerSize = Math.max(THEME.font.minPx.timer, 28);

  var labelSize = Math.round(timerSize);
  var digitAdvance = labelSize * 0.92;
  var colonAdvance = labelSize * 0.52;
  var advances = [];
  var timerWidth = 0;
  for (var i = 0; i < timeStr.length; i++) {
    var advance = timeStr[i] === ':' ? colonAdvance : digitAdvance;
    advances.push(advance);
    timerWidth += advance;
  }
  // Single shared canvas — centre the timer along the top.
  var startX = cachedW / 2 - timerWidth / 2;
  var y = timerSize * 0.4;

  ctx.fillStyle = 'rgba(255, 255, 255, ' + THEME.opacity.label + ')';
  ctx.font = '700 ' + labelSize + 'px ' + font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.letterSpacing = '0.15em';
  var cursorX = startX;
  for (var k = 0; k < timeStr.length; k++) {
    var charX = cursorX + advances[k] / 2;
    ctx.fillText(timeStr[k], charX, y);
    cursorX += advances[k];
  }
  ctx.letterSpacing = '0px';
}
