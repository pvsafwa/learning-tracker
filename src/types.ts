export type Role = 'user' | 'admin';
export type UserStatus = 'allowed' | 'disabled';

export interface User {
  id: number;
  email: string;
  googleSub: string | null;
  name: string | null;
  picture: string | null;
  role: Role;
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
}

// The slim user object we keep in the session and expose as req.user.
export interface SessionUser {
  id: number;
  email: string;
  name: string | null;
  picture: string | null;
  role: Role;
}
