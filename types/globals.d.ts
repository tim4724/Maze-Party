// Ambient declarations for the isomorphic UMD seam.
//
// engine/*.js and public/shared/*.js are UMD: in Node they use
// `module.exports` / `require`, in the browser they attach to / read from
// `window` globals (loaded via <script> and the /engine/ route). These
// `window.*` properties are what the browser branch of each UMD footer
// assigns to and what sibling engine modules read as their require-fallback.
// Declaring them here lets `checkJs` type-check the engine without choking
// on the browser-global half of the seam.

interface Window {
  /** UMD export bag for engine/constants.js (tuning knobs + framework consts). */
  GameConstants?: any;
  /** UMD export bag for engine/maze-gen.js (`generate`, `solvable`). */
  MazeGen?: any;
  /** UMD export bag for engine/maze-engine.js (`Game`, `HEADINGS`). */
  GameEngine?: any;
}
