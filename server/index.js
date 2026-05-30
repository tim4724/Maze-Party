'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');
const { RELAY_URL } = require('../public/shared/protocol.js');

const PORT = parseInt(process.env.PORT, 10) || 4000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
// PartyPlug — reusable party-game framework (transport layer), shared across
// games and intentionally outside public/ so it isn't tied to this one app's
// assets. Served under /partyplug/ via the baseDir remap below.
const PARTYPLUG_DIR = path.join(__dirname, '..', 'partyplug');
const APP_VERSION = require('../package.json').version;
const APP_ENV = String(process.env.APP_ENV || (process.env.NODE_ENV === 'production' ? 'production' : 'development')).toLowerCase();
const GIT_SHA = String(process.env.GIT_SHA || '').trim();

function getShortSha(sha) {
  return sha ? sha.slice(0, 7) : null;
}

// Computed once at boot — same for every HTML response.
const SHORT_SHA = getShortSha(GIT_SHA);
const VERSION_LABEL = APP_VERSION + (APP_ENV !== 'production' && SHORT_SHA ? ' (#' + SHORT_SHA + ')' : '');

// Relay origins for the CSP connect-src, derived from protocol.js so the relay
// host lives in exactly one place (the WS uses wss://, /api/version etc. https://).
const RELAY_HOST = RELAY_URL.replace(/^wss?:\/\//, '');
const RELAY_CSP_ORIGINS = 'wss://' + RELAY_HOST + ' https://' + RELAY_HOST;
const CSP_HEADER = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self' " + RELAY_CSP_ORIGINS + "; img-src 'self' data:; media-src 'self'; object-src 'none'; frame-src 'self'; frame-ancestors 'self'";

// Explicit allowlist of engine modules serveable via /engine/ route
const ENGINE_FILES = new Set([
  'constants.js',
  'maze-gen.js',
  'maze-engine.js',
]);

// --- MIME types ---
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function generateQRMatrix(text) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'L' });
  const size = qr.modules.size;
  const modules = Array.from(qr.modules.data);
  const quiet = 1;
  const padded = size + quiet * 2;
  const paddedModules = new Array(padded * padded).fill(0);
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      paddedModules[(row + quiet) * padded + (col + quiet)] = modules[row * size + col];
    }
  }
  return { size: padded, modules: paddedModules };
}

// --- HTTP Server ---
const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];

  // QR code endpoint
  if (urlPath === '/api/qr' && req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const text = url.searchParams.get('text');
    if (!text || text.length > 2048) {
      sendJson(res, 400, { error: !text ? 'Missing text parameter' : 'Text too long' });
      return;
    }
    try {
      const qrMatrix = generateQRMatrix(text);
      sendJson(res, 200, qrMatrix);
    } catch (err) {
      sendJson(res, 500, { error: 'QR generation failed' });
    }
    return;
  }

  // Serve game engine modules to browser
  if (urlPath.startsWith('/engine/')) {
    const engineFile = urlPath.slice('/engine/'.length);
    if (ENGINE_FILES.has(engineFile)) {
      const enginePath = path.join(__dirname, '..', 'engine', engineFile);
      fs.readFile(enginePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not Found'); return; }
        res.writeHead(200, {
          'Content-Type': 'text/javascript',
          'Cache-Control': 'no-store'
        });
        res.end(data);
      });
      return;
    }
  }

  // Health check endpoint
  if (urlPath === '/health') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  // Version endpoint
  if (urlPath === '/api/version') {
    sendJson(res, 200, {
      version: APP_VERSION,
      env: APP_ENV,
      isProduction: APP_ENV === 'production',
      commit: SHORT_SHA
    });
    return;
  }

  // Base URL endpoint — returns the LAN-accessible origin for join URLs/QR codes
  if (urlPath === '/api/baseurl') {
    const baseUrl = process.env.BASE_URL || `http://${getLocalIP()}:${PORT}`;
    sendJson(res, 200, { baseUrl });
    return;
  }


  // Map directory paths to index.html
  if (urlPath === '/') {
    urlPath = '/display/index.html';
  } else if (urlPath.length > 1 && !urlPath.includes('.') && urlPath.split('/').filter(Boolean).length === 1) {
    // Single path segment with no file extension -> room code -> serve controller
    urlPath = '/controller/index.html';
  }

  let baseDir = PUBLIC_DIR;
  let lookupPath = urlPath;
  if (urlPath.startsWith('/partyplug/')) {
    baseDir = PARTYPLUG_DIR;
    lookupPath = urlPath.slice('/partyplug'.length);
  }

  const filePath = path.join(baseDir, lookupPath);

  // Prevent directory traversal. The trailing separator is load-bearing:
  // without it, `/public-evil/...` (resolved via `..` segments in lookupPath)
  // would slip past the prefix check against `/public`.
  if (!filePath.startsWith(baseDir + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const headers = { 'Content-Type': contentType };

    // Bake the build version into HTML responses. Clients read it from the
    // <meta name="app-version"> tag — that's the atomic "what version is this
    // page running" anchor used for staleness detection AND footer display.
    // The non-prod " (#sha)" suffix used to live in client-side code that
    // hit /api/version; computing it here folds both responsibilities into
    // one place. Guard avoids the string round-trip for HTML files
    // (privacy, imprint) that don't carry the placeholder.
    if (ext === '.html') {
      let text = data.toString('utf8');
      let mutated = false;
      if (text.includes('__APP_VERSION__')) {
        text = text.replace(/__APP_VERSION__/g, VERSION_LABEL);
        mutated = true;
      }
      // __APP_V__ — URL-safe bare semver, used as a ?v= cache-busting query
      // on CSS hrefs so returning visitors don't see stale stylesheets
      // against fresh HTML (HTML/JS are no-store, but CSS gets a 24h cache).
      if (text.includes('__APP_V__')) {
        text = text.replace(/__APP_V__/g, APP_VERSION);
        mutated = true;
      }
      if (mutated) data = Buffer.from(text);
    }

    // Non-production: never cache — file edits take effect on the next
    // request with no hard-reload needed. Production: HTML + JS are
    // already uncached to avoid stale-version mismatches (see commit
    // b08563d); other static files (CSS, images, fonts) keep a 24h cache
    // for bandwidth. The /engine/ route sends its own no-store header
    // above, so its dev/prod behavior matches what we set here.
    var isNonProd = APP_ENV !== 'production';
    var noCache = isNonProd || ext === '.html' || ext === '.js';
    headers['Cache-Control'] = noCache ? 'no-store' : 'public, max-age=86400';

    if (ext === '.html') {
      // Note on stun.couch-games.com: WebRTC's STUN traffic is UDP and not
      // subject to connect-src in any major browser (Chrome ignores
      // `stun:` schemes there with a warning). No CSP directive is needed
      // for the fastlane's iceServers config.
      headers['Content-Security-Policy'] = CSP_HEADER;
    }

    res.writeHead(200, headers);
    res.end(data);
  });
});

// --- Get local network IP ---
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// --- Start server ---
server.listen(PORT, () => {
  const localIP = getLocalIP();
  console.log(`Maze Party server running on http://localhost:${PORT}`);
  console.log(`Local network: http://${localIP}:${PORT}`);
  console.log(`Display: http://localhost:${PORT}/`);
});
