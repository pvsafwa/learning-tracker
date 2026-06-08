import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import * as achievementsRepo from '../db/repositories/achievements.repo';

export const achievementsRouter = Router();

achievementsRouter.get(
  '/achievements',
  asyncHandler(async (req, res) => {
    res.json(await achievementsRepo.listForUser(req.user!.id));
  })
);

achievementsRouter.post(
  '/achievements',
  asyncHandler(async (req, res) => {
    const { ids } = z.object({ ids: z.array(z.string()) }).parse(req.body ?? {});
    await achievementsRepo.add(req.user!.id, ids);
    res.status(204).end();
  })
);
