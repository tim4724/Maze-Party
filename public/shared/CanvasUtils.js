'use strict';

// ============================================================
// Shared canvas utilities — rounded-rect paths and font detection.
// Used by DisplayUI.js and the controller.
// ============================================================

// Feature-detect native ctx.roundRect (Chrome 99+, Safari 15.4+, Firefox 112+).
var _hasNativeRoundRect = false;
if (typeof document !== 'undefined') {
  try { _hasNativeRoundRect = typeof document.createElement('canvas').getContext('2d').roundRect === 'function'; } catch(e) {}
} else if (typeof OffscreenCanvas !== 'undefined') {
  try { _hasNativeRoundRect = typeof new OffscreenCanvas(1,1).getContext('2d').roundRect === 'function'; } catch(e) {}
}

// Add a rounded-rect sub-path (no beginPath — for compound paths / batching).
var _addRoundRectSubPath = _hasNativeRoundRect
  ? function(ctx, x, y, w, h, r) {
      ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
    }
  : function(ctx, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

// Begin a new path + add a rounded rect (replaces old roundRect).
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  _addRoundRectSubPath(ctx, x, y, w, h, r);
}

// Shared font detection — returns the preferred display font family string.
// Checks whether Orbitron has loaded; falls back to monospace.
// Re-checks on each font load event until Orbitron is detected.
var _fontLoaded = false;
if (typeof document !== 'undefined' && document.fonts && document.fonts.addEventListener) {
  document.fonts.addEventListener('loadingdone', function() {
    if (!_fontLoaded) {
      _fontLoaded = document.fonts?.check?.('700 12px Orbitron') ?? false;
    }
  });
}
function getDisplayFont() {
  if (!_fontLoaded) {
    _fontLoaded = document.fonts?.check?.('700 12px Orbitron') ?? false;
  }
  return _fontLoaded ? 'Orbitron' : '"Courier New", monospace';
}
