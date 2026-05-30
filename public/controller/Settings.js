'use strict';

// =====================================================================
// Controller Settings — per-device preferences persisted to localStorage.
// Applied to ControllerAudio (touch-sound mute) and the global vibrate()
// helper (haptic strength). Load order: after Audio, before ControllerState
// so `vibrate()` can consult it.
// =====================================================================

var ControllerSettings = (function () {
  // Persists the controller's touch-sound mute, so ControllerAudio.tick stays
  // quiet on the next join.
  var KEY_TOUCH_SOUNDS = 'maze_touch_sounds';
  var KEY_HAPTIC = 'maze_haptic_strength';

  var HAPTIC_TIERS = ['off', 'light', 'medium', 'strong'];
  // Web vibration only exposes duration, not amplitude, so "stronger" means
  // longer pulses. Medium is 1.0 by convention — raw pattern values at each
  // call site are therefore the Medium-tier ms. Light and Strong are plain
  // multipliers around it.
  var HAPTIC_SCALE = { off: 0, light: 0.6, medium: 1, strong: 1.8 };

  var state = {
    muted: false,
    haptic: 'medium'
  };

  var listeners = [];

  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { /* iframe sandbox */ }
  }

  function load() {
    state.muted = read(KEY_TOUCH_SOUNDS) === '1';
    var h = read(KEY_HAPTIC);
    state.haptic = HAPTIC_TIERS.indexOf(h) >= 0 ? h : 'medium';
  }

  function applyToSubsystems() {
    if (typeof ControllerAudio !== 'undefined' && ControllerAudio.setMuted) {
      ControllerAudio.setMuted(state.muted);
    }
  }

  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](state); } catch (e) { console.error('[settings] listener', e); }
    }
  }

  function init() {
    load();
    applyToSubsystems();
  }

  function setMuted(val) {
    var next = !!val;
    if (next === state.muted) return;
    state.muted = next;
    write(KEY_TOUCH_SOUNDS, state.muted ? '1' : '0');
    if (typeof ControllerAudio !== 'undefined' && ControllerAudio.setMuted) {
      ControllerAudio.setMuted(state.muted);
    }
    notify();
  }

  function setHapticStrength(tier) {
    if (HAPTIC_TIERS.indexOf(tier) < 0) return;
    if (tier === state.haptic) return;
    state.haptic = tier;
    write(KEY_HAPTIC, tier);
    notify();
  }

  // Scale a vibration pattern by the configured haptic strength.
  // Returns null when the user has picked the 'off' tier. Enforces a 3ms
  // floor so 'light' tier never produces patterns too short for some
  // hardware to trigger.
  function scaleVibration(pattern) {
    var scale = HAPTIC_SCALE[state.haptic];
    if (scale <= 0) return null;
    if (Array.isArray(pattern)) {
      return pattern.map(function (p) { return Math.max(3, Math.round(p * scale)); });
    }
    return Math.max(3, Math.round(pattern * scale));
  }

  function onChange(cb) {
    if (typeof cb === 'function') listeners.push(cb);
  }

  return {
    init: init,
    isMuted: function () { return state.muted; },
    setMuted: setMuted,
    getHapticStrength: function () { return state.haptic; },
    setHapticStrength: setHapticStrength,
    scaleVibration: scaleVibration,
    onChange: onChange,
    HAPTIC_TIERS: HAPTIC_TIERS
  };
})();

if (typeof window !== 'undefined') {
  window.ControllerSettings = ControllerSettings;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ControllerSettings;
}
