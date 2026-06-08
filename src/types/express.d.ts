import type { SessionUser } from '../types';

// Teach TypeScript that passport puts our SessionUser on req.user.
declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends SessionUser {}
  }
}

export {};
