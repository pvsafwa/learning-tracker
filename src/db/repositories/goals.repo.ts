import { query } from '../pool';

export type Goal = Record<string, unknown> & { id: string; createdAt?: string };

export async function listForUser(userId: number): Promise<Goal[]> {
  const { rows } = await query<{ data: Goal }>(
    'SELECT data FROM goals WHERE user_id = $1 ORDER BY created_at ASC',
    [userId]
  );
  return rows.map((r) => r.data);
}

export async function upsert(userId: number, goal: Goal): Promise<void> {
  await query(
    `INSERT INTO goals (id, user_id, data, created_at)
     VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()))
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
     WHERE goals.user_id = $2`,
    [goal.id, userId, JSON.stringify(goal), goal.createdAt ?? null]
  );
}

export async function remove(userId: number, id: string): Promise<void> {
  await query('DELETE FROM goals WHERE user_id = $1 AND id = $2', [userId, id]);
}
