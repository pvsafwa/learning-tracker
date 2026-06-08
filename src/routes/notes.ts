import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import * as notesRepo from '../db/repositories/notes.repo';

export const notesRouter = Router();

const noteSchema = z.object({
  id: z.string(),
  t: z.number().nullable().optional(),
  text: z.string(),
  kind: z.enum(['note', 'bookmark']).default('note'),
  createdAt: z.string().optional()
});

notesRouter.get(
  '/notes/:videoId',
  asyncHandler(async (req, res) => {
    res.json(await notesRepo.listForVideo(req.user!.id, req.params.videoId!));
  })
);

// Replace this lesson's notes with the provided array.
notesRouter.put(
  '/notes/:videoId',
  asyncHandler(async (req, res) => {
    const notes = z.array(noteSchema).parse(req.body ?? []);
    await notesRepo.replaceForVideo(req.user!.id, req.params.videoId!, notes);
    res.status(204).end();
  })
);
