import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename, extname, normalize, resolve, sep } from 'node:path';
import type { Request, Response } from 'express';
import { MEDIA_MIME } from './media';

// Resolve a relative request path inside `root`, refusing anything that escapes.
export function safeResolve(root: string, inputPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(inputPath);
  } catch {
    decoded = inputPath;
  }
  const clean = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const resolved = resolve(root, '.' + (clean.startsWith('/') ? clean : `/${clean}`));
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;
  if (resolved !== root && !resolved.startsWith(rootWithSep)) return null;
  return resolved;
}

// RFC 5987 Content-Disposition that survives non-ASCII filenames.
export function contentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

// Stream a file from `root` with HTTP Range support (seeking/resume).
export async function streamFile(
  req: Request,
  res: Response,
  root: string,
  relPath: string
): Promise<void> {
  const filePath = safeResolve(root, relPath);
  let size: number | null = null;
  if (filePath) {
    try {
      const s = await stat(filePath);
      if (s.isFile()) size = s.size;
    } catch {
      // fall through to 404
    }
  }
  if (!filePath || size === null) {
    res.status(404).type('text/plain').send('Not Found');
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const baseHeaders: Record<string, string> = {
    'Content-Type': MEDIA_MIME.get(ext) ?? 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-cache',
    'Content-Disposition': contentDisposition(basename(filePath))
  };

  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m) {
      let start = m[1] === '' ? null : Number(m[1]);
      let end = m[2] === '' ? null : Number(m[2]);
      if (start === null) {
        start = Math.max(size - (end ?? 0), 0); // suffix range
        end = size - 1;
      } else if (end === null || end >= size) {
        end = size - 1;
      }
      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
        res.writeHead(416, { 'Content-Range': `bytes */${size}` });
        res.end();
        return;
      }
      res.writeHead(206, {
        ...baseHeaders,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': String(end - start + 1)
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      createReadStream(filePath, { start, end }).pipe(res);
      return;
    }
  }

  res.writeHead(200, { ...baseHeaders, 'Content-Length': String(size) });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(filePath).pipe(res);
}
