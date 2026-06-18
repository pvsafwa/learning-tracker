import { Router } from 'express';
import { config } from '../config';
import { asyncHandler } from '../middleware/asyncHandler';
import { scanLibrary } from '../lib/scan';
import { streamFile } from '../lib/stream';
import * as durationsRepo from '../db/repositories/durations.repo';

export const libraryRouter = Router();

// The course catalogue: server-scanned, with known (global) durations attached.
libraryRouter.get(
  '/library',
  asyncHandler(async (_req, res) => {
    const [scan, durations] = await Promise.all([
      scanLibrary(config.coursesDir),
      durationsRepo.getMap()
    ]);
    const items = scan.items.map((it) => ({ ...it, durationSeconds: durations[it.id] ?? null }));
    res.json({ rootName: scan.rootName, items, subs: scan.subs });
  })
);

// Authenticated media streaming (range-enabled).
libraryRouter.get(
  '/file',
  asyncHandler(async (req, res) => {
    const rel = String(req.query.path ?? '');
    await streamFile(req, res, config.coursesDir, rel);
  })
);
