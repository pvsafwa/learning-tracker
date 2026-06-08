import { query } from '../pool';
import type { Role, SessionUser, User, UserStatus } from '../../types';

interface UserRow {
  id: string; // bigint arrives as string from pg
  email: string;
  google_sub: string | null;
  name: string | null;
  picture: string | null;
  role: Role;
  status: UserStatus;
  created_at: Date;
  last_login_at: Date | null;
}

const COLS =
  'id, email, google_sub, name, picture, role, status, created_at, last_login_at';

function toUser(r: UserRow): User {
  return {
    id: Number(r.id),
    email: r.email,
    googleSub: r.google_sub,
    name: r.name,
    picture: r.picture,
    role: r.role,
    status: r.status,
    createdAt: r.created_at.toISOString(),
    lastLoginAt: r.last_login_at ? r.last_login_at.toISOString() : null
  };
}

export function toSessionUser(u: User): SessionUser {
  return { id: u.id, email: u.email, name: u.name, picture: u.picture, role: u.role };
}

export async function findById(id: number): Promise<User | null> {
  const { rows } = await query<UserRow>(`SELECT ${COLS} FROM users WHERE id = $1`, [id]);
  return rows[0] ? toUser(rows[0]) : null;
}

export async function findByEmail(email: string): Promise<User | null> {
  const { rows } = await query<UserRow>(`SELECT ${COLS} FROM users WHERE email = $1`, [
    email.toLowerCase()
  ]);
  return rows[0] ? toUser(rows[0]) : null;
}

export async function listUsers(): Promise<User[]> {
  const { rows } = await query<UserRow>(`SELECT ${COLS} FROM users ORDER BY created_at ASC`);
  return rows.map(toUser);
}

// Admin adds an allowed email (before that person has ever signed in).
export async function createAllow(email: string, role: Role = 'user'): Promise<User> {
  const { rows } = await query<UserRow>(
    `INSERT INTO users (email, role) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, status = 'allowed'
     RETURNING ${COLS}`,
    [email.toLowerCase(), role]
  );
  return toUser(rows[0]!);
}

export async function updateUser(
  id: number,
  patch: { role?: Role; status?: UserStatus }
): Promise<User | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (patch.role) {
    sets.push(`role = $${i++}`);
    params.push(patch.role);
  }
  if (patch.status) {
    sets.push(`status = $${i++}`);
    params.push(patch.status);
  }
  if (!sets.length) return findById(id);
  params.push(id);
  const { rows } = await query<UserRow>(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${COLS}`,
    params
  );
  return rows[0] ? toUser(rows[0]) : null;
}

export async function deleteUser(id: number): Promise<void> {
  await query('DELETE FROM users WHERE id = $1', [id]);
}

// Seed an admin on boot so the first owner can sign in and manage the allowlist.
export async function seedAdmin(email: string): Promise<void> {
  await query(
    `INSERT INTO users (email, role, status) VALUES ($1, 'admin', 'allowed')
     ON CONFLICT (email) DO UPDATE SET role = 'admin', status = 'allowed'`,
    [email.toLowerCase()]
  );
}

// Called during OAuth. Returns the user ONLY if they are allowlisted & enabled;
// otherwise null (access denied). Also records profile + last login.
export async function loginWithGoogle(profile: {
  sub: string;
  email: string;
  name?: string | null;
  picture?: string | null;
}): Promise<User | null> {
  const email = profile.email.toLowerCase();
  const existing = await findByEmail(email);
  if (!existing || existing.status !== 'allowed') return null;
  const { rows } = await query<UserRow>(
    `UPDATE users
       SET google_sub = $1,
           name = COALESCE($2, name),
           picture = COALESCE($3, picture),
           last_login_at = now()
     WHERE email = $4
     RETURNING ${COLS}`,
    [profile.sub, profile.name ?? null, profile.picture ?? null, email]
  );
  return rows[0] ? toUser(rows[0]) : null;
}
