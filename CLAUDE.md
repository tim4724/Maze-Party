# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test                              # All unit tests (node:test)
node --test tests/maze-gen.test.js    # A single test file
npm start                             # Run the server (node server/index.js)
npm run dev                           # Run with --watch (auto-restart)
```

## Key Rules

- Engine modules (`engine/*.js`) use UMD — must work in both Node.js (tests) and the browser (loaded via the `/engine/` route allowlisted in `server/index.js`). The sim is display-authoritative: it runs in the browser, not on the server.
- CSP headers in `server/index.js` — update when adding external resources
- Relay URL configured in `public/shared/protocol.js`
- Controller input uses WebRTC DataChannels (`partyplug/PartyFastlane.js`) with the relay as signaling channel and input fallback; game events flow display → relay → controllers over WebSocket
- PartyPlug (`partyplug/`) is the reusable party-game framework (transport layer) shared across games, served under `/partyplug/`. Relay/STUN config lives in `public/shared/protocol.js` and is injected into the kit at construction; the kit reads no game globals
