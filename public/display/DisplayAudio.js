'use strict';

// =====================================================================
// Display Audio — countdown beeps only (no background music).
// Depends on: DisplayState.js (muted global)
// =====================================================================

var _beepCtx = null;

// Lazily create an AudioContext for the countdown beep. Called on user
// gesture (button clicks) so the browser allows audio playback.
function initMusic() {
  if (_beepCtx) return;
  try {
    _beepCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    _beepCtx = null;
  }
}

function playCountdownBeep(isGo) {
  if (muted) return;
  if (!_beepCtx) return;
  var actx = _beepCtx;
  if (actx.state === 'suspended') actx.resume();

  var osc = actx.createOscillator();
  var gain = actx.createGain();
  osc.connect(gain);
  gain.connect(actx.destination);

  osc.onended = function() { gain.disconnect(); };

  if (isGo) {
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, actx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, actx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.18, actx.currentTime);
    gain.gain.linearRampToValueAtTime(0, actx.currentTime + 0.3);
    osc.start(actx.currentTime);
    osc.stop(actx.currentTime + 0.3);
  } else {
    osc.type = 'square';
    osc.frequency.value = 440;
    gain.gain.setValueAtTime(0.15, actx.currentTime);
    gain.gain.linearRampToValueAtTime(0, actx.currentTime + 0.12);
    osc.start(actx.currentTime);
    osc.stop(actx.currentTime + 0.12);
  }
}
