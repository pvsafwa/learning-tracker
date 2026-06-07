// Learning Tracker — static host.
//
// In this (local-first) architecture the BROWSER reads the user's course folder
// via the File System Access API and stores all tracking data in IndexedDB.
// The server's only job is to serve the static app, so it can run anywhere
// (e.g. AWS) behind HTTPS while each visitor uses their own local folders.

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = join(__dirname, 'public');

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.ttf', 'font/ttf'],
  ['.map', 'application/json; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json']
]);

const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method Not Allowed');
      return;
    }
    if (req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    await serveStatic(req, res);
  } catch (error) {
    console.error(error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Learning Tracker (static) running at http://${HOST}:${PORT}`);
  console.log('Note: the File System Access API requires a secure context (HTTPS or localhost).');
});

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requestPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = safeResolve(PUBLIC_DIR, requestPath);
  const fileStat = await safeStat(filePath);

  // SPA-style fallback to index.html for unknown paths.
  if (!fileStat?.isFile()) {
    const index = safeResolve(PUBLIC_DIR, '/index.html');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    if (req.method === 'HEAD') { res.end(); return; }
    createReadStream(index).pipe(res);
    return;
  }

  const ext = extname(filePath).toLowerCase();
  // Cache static assets (icons/fonts/images); always revalidate code/markup so
  // updates are picked up immediately.
  const cacheable = ['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.woff', '.woff2', '.ttf'];
  const type = MIME_TYPES.get(ext) || 'application/octet-stream';
  const cache = cacheable.includes(ext) ? 'public, max-age=86400' : 'no-cache';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache });
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(filePath).pipe(res);
}

function safeResolve(root, inputPath) {
  const clean = normalize(inputPath).replace(/^(\.\.[/\\])+/, '');
  const resolved = resolve(root, '.' + (clean.startsWith('/') ? clean : `/${clean}`));
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;
  if (resolved !== root && !resolved.startsWith(rootWithSep)) {
    return join(root, 'index.html');
  }
  return resolved;
}

async function safeStat(path) {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}
