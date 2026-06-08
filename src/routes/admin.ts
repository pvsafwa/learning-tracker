import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAdmin } from '../middleware/auth';
import * as usersRepo from '../db/repositories/users.repo';

export const adminRouter = Router();

// Everything here requires an admin session.
adminRouter.use(requireAdmin);

adminRouter.get(
  '/admin/users',
  asyncHandler(async (_req, res) => {
    res.json(await usersRepo.listUsers());
  })
);

// Add (allowlist) a Google email, optionally as admin.
adminRouter.post(
  '/admin/users',
  asyncHandler(async (req, res) => {
    const { email, role } = z
      .object({ email: z.string().email(), role: z.enum(['user', 'admin']).default('user') })
      .parse(req.body ?? {});
    const user = await usersRepo.createAllow(email, role);
    res.status(201).json(user);
  })
);

adminRouter.patch(
  '/admin/users/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const patch = z
      .object({
        role: z.enum(['user', 'admin']).optional(),
        status: z.enum(['allowed', 'disabled']).optional()
      })
      .parse(req.body ?? {});
    // Guard against admins locking themselves out of their own account.
    if (req.user!.id === id && (patch.role === 'user' || patch.status === 'disabled')) {
      return res.status(400).json({ error: 'cannot_demote_self' });
    }
    const user = await usersRepo.updateUser(id, patch);
    if (!user) return res.status(404).json({ error: 'not_found' });
    res.json(user);
  })
);

adminRouter.delete(
  '/admin/users/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (req.user!.id === id) return res.status(400).json({ error: 'cannot_delete_self' });
    await usersRepo.deleteUser(id);
    res.status(204).end();
  })
);
