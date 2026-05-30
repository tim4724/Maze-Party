'use strict';

var ControllerAudio = (function () {
  var audioCtx = null;
  var muted = false;
  var primed = false;

  function getCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function prime() {
    if (primed) return;
    primed = true;
    var ctx = getCtx();
    var buf = ctx.createBuffer(1, 1, ctx.sampleRate);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  }

  // Short click played when the player swipes to set a new heading.
  function tick() {
    if (muted) return;
    var ctx = getCtx();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 150;
    osc.type = 'sine';
    gain.gain.setValueAtTime(1.0, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.onended = function() { gain.disconnect(); };
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.04);
  }

  function setMuted(val) { muted = !!val; }
  function isMuted() { return muted; }

  return { prime: prime, tick: tick, setMuted: setMuted, isMuted: isMuted };
})();
