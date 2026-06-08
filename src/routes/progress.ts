import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import * as progressRepo from '../db/repositories/progress.repo';
import * as durationsRepo from '../db/repositories/durations.repo';
import * as activityRepo from '../db/repositories/activity.repo';

export const progressRouter = Router();

const progressBody = z.object({
  startedAt: z.string().nullable().optional(),
  lastWatchedAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  watchSeconds: z.number().optional(),
  resumeSeconds: z.number().optional(),
  percent: z.number().optional(),
  completed: z.boolean().optional(),
  relPath: z.string().nullable().optional()
});

// ── Progress (per-user) ───────────────────────────────────────────────────────
progressRouter.get(
  '/progress',
  asyncHandler(async (req, res) => {
    res.json(await progressRepo.getMap(req.user!.id));
  })
);

progressRouter.put(
  '/progress/:videoId',
  asyncHandler(async (req, res) => {
    const body = progressBody.parse(req.body ?? {});
    await progressRepo.upsert(req.user!.id, req.params.videoId!, body);
    res.status(204).end();
  })
);

progressRouter.post(
  '/progress/reset',
  asyncHandler(async (req, res) => {
    const { all, ids } = z
      .object({ all: z.boolean().optional(), ids: z.array(z.string()).optional() })
      .parse(req.body ?? {});
    await progressRepo.reset(req.user!.id, { all, ids });
    res.status(204).end();
  })
);

// ── Durations (global content metadata) ───────────────────────────────────────
progressRouter.get(
  '/durations',
  asyncHandler(async (_req, res) => {
    res.json(await durationsRepo.getMap());
  })
);

progressRouter.post(
  '/durations',
  asyncHandler(async (req, res) => {
    const { videoId, seconds } = z
      .object({ videoId: z.string(), seconds: z.number().positive() })
      .parse(req.body ?? {});
    await durationsRepo.upsert(videoId, seconds);
    res.status(204).end();
  })
);

// ── Activity rollup (per-user) ────────────────────────────────────────────────
progressRouter.get(
  '/activity',
  asyncHandler(async (req, res) => {
    res.json(await activityRepo.list(req.user!.id));
  })
);

progressRouter.post(
  '/activity',
  asyncHandler(async (req, res) => {
    const { day, seconds, completed } = z
      .object({
        day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        seconds: z.number().nonnegative(),
        completed: z.number().int().nonnegative().default(0)
      })
      .parse(req.body ?? {});
    await activityRepo.record(req.user!.id, day, seconds, completed);
    res.status(204).end();
  })
);
