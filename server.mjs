// Learning Tracker — server that hosts the app AND serves the course library.
//
// The course folders live ON THIS SERVER (e.g. an Ubuntu box on your LAN, or
// AWS). The browser asks the server for the library listing and streams each
// file from here, so it works over plain HTTP — no File System Access API and
// no HTTPS requirement. Per-user progress still lives in each browser.
//
//   COURSES_DIR  absolute (or relative) path to the folder that holds your
//                course folders. Default: ./courses next to this file.
//   PORT         default 4173
//   HOST         default 0.0.0.0

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, readdir } from 'node:fs/promises';
import { basename, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = join(__dirname, 'public');
const COURSES_DIR = resolve(__dirname, process.env.COURSES_DIR || 'courses');

// ── Media / asset types ───────────────────────────────────────────────────────
const VIDEO_EXTS = new Set(['.mp4', '.m4v', '.mov', '.mkv', '.avi', '.webm', '.wmv', '.flv', '.mpg', '.mpeg', '.ts', '.m2ts', '.mts', '.ogv', '.3gp', '.3g2', '.f4v']);
const AUDIO_EXTS = new Set(['.mp3', '.m4a', '.m4b', '.aac', '.wav', '.flac', '.ogg', '.oga', '.opus', '.wma', '.aiff', '.aif', '.alac', '.mka']);
const DOC_EXTS = new Set(['.pdf']);
const SUBTITLE_EXTS = new Set(['.srt', '.vtt']);
const isMediaExt = (e) => VIDEO_EXTS.has(e) || AUDIO_EXTS.has(e) || DOC_EXTS.has(e);

const MEDIA_MIME = new Map([
  ['.mp4', 'video/mp4'], ['.m4v', 'video/mp4'], ['.mov', 'video/quicktime'],
  ['.mkv', 'video/x-matroska'], ['.webm', 'video/webm'], ['.avi', 'video/x-msvideo'],
  ['.ogv', 'video/ogg'], ['.ts', 'video/mp2t'], ['.3gp', 'video/3gpp'], ['.flv', 'video/x-flv'],
  ['.mp3', 'audio/mpeg'], ['.m4a', 'audio/mp4'], ['.m4b', 'audio/mp4'], ['.aac', 'audio/aac'],
  ['.wav', 'audio/wav'], ['.flac', 'audio/flac'], ['.ogg', 'audio/ogg'], ['.oga', 'audio/ogg'],
  ['.opus', 'audio/ogg'], ['.aiff', 'audio/aiff'], ['.aif', 'audio/aiff'], ['.mka', 'audio/x-matroska'],
  ['.pdf', 'application/pdf'], ['.srt', 'text/plain; charset=utf-8'], ['.vtt', 'text/vtt; charset=utf-8']
]);

const ASSET_MIME = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'], ['.gif', 'image/gif'], ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'], ['.woff2', 'font/woff2'], ['.ttf', 'font/ttf'],
  ['.map', 'application/json; charset=utf-8'], ['.webmanifest', 'application/manifest+json']
]);

// ── Server ────────────────────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method Not Allowed');
      return;
    }
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/healthz')     { sendJson(res, 200, { ok: true, coursesDir: COURSES_DIR }); return; }
    if (url.pathname === '/api/library') { await serveLibrary(req, res); return; }
    if (url.pathname === '/api/file')    { await serveCourseFile(req, res, url); return; }
    await serveStatic(req, res, url);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Learning Tracker running at http://${HOST}:${PORT}`);
  console.log(`Serving courses from: ${COURSES_DIR}`);
  console.log('Put your course folders there (or set COURSES_DIR) and open the URL.');
});

// ── /api/library : recursively scan COURSES_DIR ───────────────────────────────
async function serveLibrary(req, res) {
  const items = [];
  const subs = [];
  async function walk(dir, parts) {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, [...parts, entry.name]);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        const relPath = [...parts, entry.name].join('/');
        if (isMediaExt(ext)) items.push({ name: entry.name, ext, relPath });
        else if (SUBTITLE_EXTS.has(ext)) subs.push({ name: entry.name, ext, relPath, dir: parts.join('/') });
      }
    }
  }
  await walk(COURSES_DIR, []);
  const rootName = basename(COURSES_DIR) || 'Courses';
  sendJson(res, 200, { rootName, items, subs }, 'no-store');
}

// ── /api/file : stream a course file with HTTP Range support ──────────────────
async function serveCourseFile(req, res, url) {
  const rel = url.searchParams.get('path') || '';
  const filePath = safeResolve(COURSES_DIR, rel);
  const fileStat = await safeStat(filePath);
  if (!filePath || !fileStat?.isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const type = MEDIA_MIME.get(ext) || 'application/octet-stream';
  const total = fileStat.size;
  const baseHeaders = {
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-cache',
    'Content-Disposition': contentDisposition(basename(filePath))
  };

  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m) {
      let start = m[1] === '' ? null : Number(m[1]);
      let end = m[2] === '' ? null : Number(m[2]);
      if (start === null) { start = Math.max(total - (end || 0), 0); end = total - 1; }   // suffix range
      else if (end === null || end >= total) { end = total - 1; }
      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
        res.writeHead(416, { 'Content-Range': `bytes */${total}` });
        res.end();
        return;
      }
      res.writeHead(206, {
        ...baseHeaders,
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Content-Length': end - start + 1
      });
      if (req.method === 'HEAD') { res.end(); return; }
      createReadStream(filePath, { start, end }).pipe(res);
      return;
    }
  }

  res.writeHead(200, { ...baseHeaders, 'Content-Length': total });
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(filePath).pipe(res);
}

// ── Static app (public/) ──────────────────────────────────────────────────────
async function serveStatic(req, res, url) {
  const requestPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = safeResolve(PUBLIC_DIR, requestPath);
  const fileStat = await safeStat(filePath);

  // SPA-style fallback to index.html for unknown paths.
  if (!fileStat?.isFile()) {
    const index = join(PUBLIC_DIR, 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    if (req.method === 'HEAD') { res.end(); return; }
    createReadStream(index).pipe(res);
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const cacheable = ['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.woff', '.woff2', '.ttf'];
  res.writeHead(200, {
    'Content-Type': ASSET_MIME.get(ext) || 'application/octet-stream',
    'Cache-Control': cacheable.includes(ext) ? 'public, max-age=86400' : 'no-cache'
  });
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(filePath).pipe(res);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function sendJson(res, status, obj, cache = 'no-cache') {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache });
  res.end(JSON.stringify(obj));
}

// Resolve a request path inside `root`, refusing anything that escapes it.
function safeResolve(root, inputPath) {
  let decoded;
  try { decoded = decodeURIComponent(inputPath); } catch { decoded = inputPath; }
  const clean = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const resolved = resolve(root, '.' + (clean.startsWith('/') ? clean : `/${clean}`));
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;
  if (resolved !== root && !resolved.startsWith(rootWithSep)) return null;
  return resolved;
}

// RFC 5987 Content-Disposition that survives non-ASCII filenames.
function contentDisposition(name) {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(name);
  return `inline; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

async function safeStat(path) {
  if (!path) return null;
  try { return await stat(path); } catch { return null; }
}
