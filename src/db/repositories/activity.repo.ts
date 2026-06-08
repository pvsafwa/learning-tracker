import { query } from '../pool';

export interface ActivityDay {
  day: string; // YYYY-MM-DD
  watchSeconds: number;
  completedCount: number;
}

export async function list(userId: number): Promise<ActivityDay[]> {
  const { rows } = await query<{ day: string; watch_seconds: number; completed_count: number }>(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day, watch_seconds, completed_count
       FROM activity WHERE user_id = $1 ORDER BY day ASC`,
    [userId]
  );
  return rows.map((r) => ({
    day: r.day,
    watchSeconds: Number(r.watch_seconds),
    completedCount: Number(r.completed_count)
  }));
}

// Incrementally roll up a day's watch time / completions.
export async function record(
  userId: number,
  day: string,
  seconds: number,
  completed: number
): Promise<void> {
  await query(
    `INSERT INTO activity (user_id, day, watch_seconds, completed_count)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, day) DO UPDATE SET
       watch_seconds   = activity.watch_seconds + EXCLUDED.watch_seconds,
       completed_count = activity.completed_count + EXCLUDED.completed_count`,
    [userId, day, seconds, completed]
  );
}
