import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import * as cardsRepo from '../db/repositories/cards.repo';

export const cardsRouter = Router();

// Cards are opaque documents; we only require an id (and optionally videoId).
const cardSchema = z.object({ id: z.string(), videoId: z.string().nullish() }).passthrough();

cardsRouter.get(
  '/cards',
  asyncHandler(async (req, res) => {
    res.json(await cardsRepo.listForUser(req.user!.id));
  })
);

cardsRouter.put(
  '/cards/:id',
  asyncHandler(async (req, res) => {
    const card = cardSchema.parse({ ...(req.body ?? {}), id: req.params.id });
    await cardsRepo.upsert(req.user!.id, card as cardsRepo.Card);
    res.status(204).end();
  })
);

cardsRouter.delete(
  '/cards/:id',
  asyncHandler(async (req, res) => {
    await cardsRepo.remove(req.user!.id, req.params.id!);
    res.status(204).end();
  })
);
