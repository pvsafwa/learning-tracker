import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import * as goalsRepo from '../db/repositories/goals.repo';

export const goalsRouter = Router();

const goalSchema = z.object({ id: z.string() }).passthrough();

goalsRouter.get(
  '/goals',
  asyncHandler(async (req, res) => {
    res.json(await goalsRepo.listForUser(req.user!.id));
  })
);

goalsRouter.post(
  '/goals',
  asyncHandler(async (req, res) => {
    const goal = goalSchema.parse(req.body ?? {});
    await goalsRepo.upsert(req.user!.id, goal as goalsRepo.Goal);
    res.status(201).json(goal);
  })
);

goalsRouter.put(
  '/goals/:id',
  asyncHandler(async (req, res) => {
    const goal = goalSchema.parse({ ...(req.body ?? {}), id: req.params.id });
    await goalsRepo.upsert(req.user!.id, goal as goalsRepo.Goal);
    res.status(204).end();
  })
);

goalsRouter.delete(
  '/goals/:id',
  asyncHandler(async (req, res) => {
    await goalsRepo.remove(req.user!.id, req.params.id!);
    res.status(204).end();
  })
);
