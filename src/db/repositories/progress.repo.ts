import { query } from '../pool';

export interface ProgressRecord {
  startedAt: string | null;
  lastWatchedAt: string | null;
  completedAt: string | null;
  watchSeconds: number;
  resumeSeconds: number;
  percent: number;
  completed: boolean;
}

interface ProgressRow {
  video_id: string;
  started_at: Date | null;
  last_watched_at: Date | null;
  completed_at: Date | null;
  watch_seconds: number;
  resume_seconds: number;
  percent: number;
  completed: boolean;
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function toRecord(r: ProgressRow): ProgressRecord {
  return {
    startedAt: iso(r.started_at),
    lastWatchedAt: iso(r.last_watched_at),
    completedAt: iso(r.completed_at),
    watchSeconds: Number(r.watch_seconds),
    resumeSeconds: Number(r.resume_seconds),
    percent: Number(r.percent),
    completed: r.completed
  };
}

export async function getMap(userId: number): Promise<Record<string, ProgressRecord>> {
  const { rows } = await query<ProgressRow>('SELECT * FROM progress WHERE user_id = $1', [userId]);
  const map: Record<string, ProgressRecord> = {};
  for (const r of rows) map[r.video_id] = toRecord(r);
  return map;
}

export async function upsert(
  userId: number,
  videoId: string,
  rec: Partial<ProgressRecord> & { relPath?: string | null }
): Promise<void> {
  await query(
    `INSERT INTO progress
       (user_id, video_id, rel_path, started_at, last_watched_at, completed_at,
        watch_seconds, resume_seconds, percent, completed, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
     ON CONFLICT (user_id, video_id) DO UPDATE SET
       rel_path        = COALESCE(EXCLUDED.rel_path, progress.rel_path),
       started_at      = COALESCE(EXCLUDED.started_at, progress.started_at),
       last_watched_at = EXCLUDED.last_watched_at,
       completed_at    = EXCLUDED.completed_at,
       watch_seconds   = EXCLUDED.watch_seconds,
       resume_seconds  = EXCLUDED.resume_seconds,
       percent         = EXCLUDED.percent,
       completed       = EXCLUDED.completed,
       updated_at      = now()`,
    [
      userId,
      videoId,
      rec.relPath ?? null,
      rec.startedAt ?? null,
      rec.lastWatchedAt ?? null,
      rec.completedAt ?? null,
      rec.watchSeconds ?? 0,
      rec.resumeSeconds ?? 0,
      rec.percent ?? 0,
      rec.completed ?? false
    ]
  );
}

export async function reset(
  userId: number,
  opts: { all?: boolean; ids?: string[] }
): Promise<void> {
  if (opts.all) {
    await query('DELETE FROM progress WHERE user_id = $1', [userId]);
    return;
  }
  if (opts.ids && opts.ids.length) {
    await query('DELETE FROM progress WHERE user_id = $1 AND video_id = ANY($2)', [
      userId,
      opts.ids
    ]);
  }
}
