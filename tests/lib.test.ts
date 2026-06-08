import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { hashId, scanLibrary } from '../src/lib/scan';
import { safeResolve, contentDisposition } from '../src/lib/stream';

describe('hashId', () => {
  it('is deterministic and 16 hex chars', () => {
    expect(hashId('a/b/c.mp4')).toBe(hashId('a/b/c.mp4'));
    expect(hashId('a/b/c.mp4')).toMatch(/^[0-9a-f]{16}$/);
    expect(hashId('a')).not.toBe(hashId('b'));
  });
});

describe('safeResolve', () => {
  const root = join(sep, 'srv', 'courses');

  it('resolves a normal path inside root', () => {
    expect(safeResolve(root, 'Course/Intro.mp4')).toBe(join(root, 'Course', 'Intro.mp4'));
  });

  it('never escapes the root (raw or url-encoded traversal)', () => {
    for (const p of ['../../etc/passwd', '..%2F..%2Fsecret', '/etc/passwd', 'a/../../b']) {
      const r = safeResolve(root, p);
      expect(r === null || r.startsWith(root + sep)).toBe(true);
    }
  });
});

describe('contentDisposition', () => {
  it('keeps ascii and adds an RFC 5987 fallback for non-ascii', () => {
    const cd = contentDisposition('പാഠം.mp4');
    expect(cd).toContain('filename="');
    expect(cd).toContain("filename*=UTF-8''");
  });
});

describe('scanLibrary', () => {
  it('finds media + sidecar subtitles with stable ids, ignoring other files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lt-'));
    await mkdir(join(dir, 'C1', 'M1'), { recursive: true });
    await writeFile(join(dir, 'C1', 'M1', 'a.mp4'), 'x');
    await writeFile(join(dir, 'C1', 'M1', 'a.vtt'), 'WEBVTT');
    await writeFile(join(dir, 'C1', 'notes.pdf'), 'x');
    await writeFile(join(dir, 'C1', 'readme.txt'), 'x');

    const scan = await scanLibrary(dir);
    expect(scan.items.map((i) => i.name).sort()).toEqual(['a.mp4', 'notes.pdf']);
    expect(scan.subs).toHaveLength(1);
    const mp4 = scan.items.find((i) => i.name === 'a.mp4')!;
    expect(mp4.kind).toBe('video');
    expect(mp4.id).toMatch(/^[0-9a-f]{16}$/);
    expect(scan.items.find((i) => i.name === 'notes.pdf')!.kind).toBe('pdf');
  });
});
