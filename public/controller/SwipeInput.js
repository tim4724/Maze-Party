'use strict';

// =====================================================================
// SwipeInput — maze controller gesture layer. A swipe (or drag) sets the
// auto-run heading: up / down / left / right. Drag-to-steer: changing
// direction mid-drag re-emits, so you can curve through junctions without
// lifting. Arrow keys / WASD also work (desktop play + tests).
//
// Same constructor shape as the old HexStacker TouchInput
// (el, onInput, onProgress) so the controller wiring is unchanged;
// onInput(headingName) replaces the old (action, data) callback.
// =====================================================================

// Keyboard heading map (arrow keys + WASD). Module-level constant so it isn't
// rebuilt on every keydown.
var KEY_HEADINGS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  W: 'up', S: 'down', A: 'left', D: 'right'
};

class SwipeInput {
  constructor(touchElement, onInput, onProgress) {
    this.el = touchElement;
    this.onInput = onInput;
    this.onProgress = onProgress || null;

    this.SWIPE_THRESHOLD = 24; // px of travel before a heading fires / re-arms

    this.activeId = null;
    this.anchorX = 0;
    this.anchorY = 0;
    this.lastDir = null;

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onPointerCancel = this._onPointerCancel.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onContextMenu = function (e) { e.preventDefault(); };

    this.el.addEventListener('pointerdown', this._onPointerDown);
    this.el.addEventListener('pointermove', this._onPointerMove);
    this.el.addEventListener('pointerup', this._onPointerUp);
    this.el.addEventListener('pointercancel', this._onPointerCancel);
    this.el.addEventListener('contextmenu', this._onContextMenu);
    window.addEventListener('keydown', this._onKeyDown);

    this.el.style.touchAction = 'none';
  }

  _haptic() {
    if (!navigator.vibrate) return;
    if (typeof ControllerSettings !== 'undefined' && ControllerSettings.scaleVibration) {
      var scaled = ControllerSettings.scaleVibration(15);
      if (scaled === null) return;
      navigator.vibrate(scaled);
      return;
    }
    navigator.vibrate(15);
  }

  _emit(dir) {
    this.lastDir = dir;
    this._haptic();
    this.onInput(dir);
  }

  _dirOf(dx, dy) {
    return Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down' : 'up');
  }

  _onPointerDown(e) {
    if (e.button !== 0 || this.activeId !== null) return;
    e.preventDefault();
    this.activeId = e.pointerId;
    this.el.setPointerCapture(e.pointerId);
    this.anchorX = e.clientX;
    this.anchorY = e.clientY;
    this.lastDir = null;
  }

  _onPointerMove(e) {
    if (e.pointerId !== this.activeId) return;
    var dx = e.clientX - this.anchorX;
    var dy = e.clientY - this.anchorY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < this.SWIPE_THRESHOLD) return;
    var dir = this._dirOf(dx, dy);
    if (dir !== this.lastDir) this._emit(dir);
    // Re-anchor so a subsequent direction change needs a fresh threshold of
    // travel (debounces jitter, enables curving through a turn in one drag).
    this.anchorX = e.clientX;
    this.anchorY = e.clientY;
  }

  _onPointerUp(e) {
    if (e.pointerId !== this.activeId) return;
    // Short tap-flick that never crossed the move threshold: classify on release.
    if (this.lastDir === null) {
      var dx = e.clientX - this.anchorX;
      var dy = e.clientY - this.anchorY;
      if (Math.max(Math.abs(dx), Math.abs(dy)) >= 8) this._emit(this._dirOf(dx, dy));
    }
    this._reset();
  }

  _onPointerCancel(e) {
    if (e.pointerId !== this.activeId) return;
    this._reset();
  }

  _reset() {
    this.activeId = null;
    this.lastDir = null;
  }

  _onKeyDown(e) {
    var dir = KEY_HEADINGS[e.key];
    if (!dir) return;
    e.preventDefault();
    this.onInput(dir);
  }

  destroy() {
    this.el.removeEventListener('pointerdown', this._onPointerDown);
    this.el.removeEventListener('pointermove', this._onPointerMove);
    this.el.removeEventListener('pointerup', this._onPointerUp);
    this.el.removeEventListener('pointercancel', this._onPointerCancel);
    this.el.removeEventListener('contextmenu', this._onContextMenu);
    window.removeEventListener('keydown', this._onKeyDown);
  }
}

if (typeof window !== 'undefined') window.SwipeInput = SwipeInput;
if (typeof module !== 'undefined' && module.exports) module.exports = SwipeInput;
