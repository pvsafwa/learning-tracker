import { query } from '../pool';

export interface Achievement {
  id: string;
  earnedAt: string;
}

export async function listForUser(userId: number): Promise<Achievement[]> {
  const { rows } = await query<{ achievement_id: string; earned_at: Date }>(
    'SELECT achievement_id, earned_at FROM achievements WHERE user_id = $1',
    [userId]
  );
  return rows.map((r) => ({ id: r.achievement_id, earnedAt: r.earned_at.toISOString() }));
}

export async function add(userId: number, ids: string[]): Promise<void> {
  for (const id of ids) {
    await query(
      `INSERT INTO achievements (user_id, achievement_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, id]
    );
  }
}
