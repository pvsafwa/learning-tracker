import { query } from '../pool';

// Durations are a property of the file (same for everyone), so they're global.
export async function getMap(): Promise<Record<string, number>> {
  const { rows } = await query<{ video_id: string; seconds: number }>(
    'SELECT video_id, seconds FROM durations'
  );
  const map: Record<string, number> = {};
  for (const r of rows) map[r.video_id] = Number(r.seconds);
  return map;
}

export async function upsert(videoId: string, seconds: number): Promise<void> {
  await query(
    `INSERT INTO durations (video_id, seconds, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (video_id) DO UPDATE SET seconds = EXCLUDED.seconds, updated_at = now()`,
    [videoId, seconds]
  );
}
