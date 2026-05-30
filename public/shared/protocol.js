'use strict';

// Party-Server relay URL
var RELAY_URL = 'wss://ws.couch-games.com';

// First-party STUN server (self-hosted). Used by the fastlane to gather
// server-reflexive candidates so cross-network peers can find each other when
// host candidates aren't reachable.
var STUN_URL = 'stun:stun.couch-games.com:3478';

// Auto-generated player-name scheme: a bare number (e.g. 7). The display
// assigns these; the controller must recognize them as auto so a blank name
// submit defers to the display's assignment. Both ends read this single
// definition so the format can't drift out of sync across devices.
var AUTO_PLAYER_NAME_PREFIX = '';
var AUTO_PLAYER_NAME_RE = /^([1-9][0-9]?)$/;

// ---- Wire contract (JSDoc types, consumed by `npm run typecheck`) ----
// Auto-run heading; a swipe sets one of these (see INPUT below).
/** @typedef {'up'|'down'|'left'|'right'} Heading */
// Display-side room lifecycle state (see ROOM_STATE below).
/** @typedef {'lobby'|'countdown'|'playing'|'results'} RoomState */
/**
 * A game message carried inside the Party-Server relay `data` field.
 * `type` is one of the MSG.* constants; the remaining fields are
 * type-specific (e.g. INPUT carries a heading, SET_COLOR a colorIndex).
 * @typedef {{ type: string } & Record<string, any>} GameMessage
 */

// Message types for game communication (inside Party-Server data field)
var MSG = {
  // Controller -> Display
  HELLO: 'hello',
  INPUT: 'input',
  DROP_WALL: 'drop_wall',
  START_GAME: 'start_game',
  PLAY_AGAIN: 'play_again',
  RETURN_TO_LOBBY: 'return_to_lobby',
  PAUSE_GAME: 'pause_game',
  RESUME_GAME: 'resume_game',
  LEAVE: 'leave',
  SET_COLOR: 'set_color',
  PING: 'ping',

  // Display -> Specific Controller
  WELCOME: 'welcome',
  LOBBY_UPDATE: 'lobby_update',
  PONG: 'pong',
  PLAYER_STATE: 'player_state',

  // Display -> All Controllers (broadcast)
  COUNTDOWN: 'countdown',
  GAME_START: 'game_start',
  GAME_END: 'game_end',
  GAME_PAUSED: 'game_paused',
  GAME_RESUMED: 'game_resumed',
  DISPLAY_CLOSED: 'display_closed',
  ERROR: 'error'
};

// Input action types — maze headings (swipe direction sets the auto-run heading)
var INPUT = {
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right'
};

// Room states (display-side)
var ROOM_STATE = {
  LOBBY: 'lobby',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  RESULTS: 'results'
};

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MSG, INPUT, ROOM_STATE, RELAY_URL, STUN_URL, AUTO_PLAYER_NAME_PREFIX, AUTO_PLAYER_NAME_RE };
}
