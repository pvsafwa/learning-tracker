import { readdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { SUBTITLE_EXTS, isMediaExt, mediaKind, type MediaKind } from './media';

// Stable id for a file based on its relative path (FNV-style 64-bit hash).
// Computed on the server so progress keys are authoritative and consistent.
export function hashId(str: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0xc2b2ae35;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x85ebca6b);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

export interface LibraryItem {
  id: string;
  name: string;
  ext: string;
  relPath: string;
  kind: MediaKind;
}
export interface LibrarySub {
  name: string;
  ext: string;
  relPath: string;
  dir: string;
}
export interface LibraryScan {
  rootName: string;
  items: LibraryItem[];
  subs: LibrarySub[];
}

export async function scanLibrary(coursesDir: string): Promise<LibraryScan> {
  const items: LibraryItem[] = [];
  const subs: LibrarySub[] = [];

  async function walk(dir: string, parts: string[]): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // missing/inaccessible dir → treated as empty
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, [...parts, entry.name]);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        const relPath = [...parts, entry.name].join('/');
        if (isMediaExt(ext)) {
          items.push({ id: hashId(relPath), name: entry.name, ext, relPath, kind: mediaKind(ext) });
        } else if (SUBTITLE_EXTS.has(ext)) {
          subs.push({ name: entry.name, ext, relPath, dir: parts.join('/') });
        }
      }
    }
  }

  await walk(coursesDir, []);
  return { rootName: basename(coursesDir) || 'Courses', items, subs };
}
