import { pool, query } from '../pool';

export interface Note {
  id: string;
  t: number | null;
  text: string;
  kind: 'note' | 'bookmark';
  createdAt: string;
}

interface NoteRow {
  id: string;
  t: number | null;
  text: string;
  kind: 'note' | 'bookmark';
  created_at: Date;
}

function toNote(r: NoteRow): Note {
  return {
    id: r.id,
    t: r.t === null ? null : Number(r.t),
    text: r.text,
    kind: r.kind,
    createdAt: r.created_at.toISOString()
  };
}

export async function listForVideo(userId: number, videoId: string): Promise<Note[]> {
  const { rows } = await query<NoteRow>(
    `SELECT id, t, text, kind, created_at FROM notes
       WHERE user_id = $1 AND video_id = $2
       ORDER BY t ASC NULLS FIRST, created_at ASC`,
    [userId, videoId]
  );
  return rows.map(toNote);
}

export interface NoteInput {
  id: string;
  t?: number | null;
  text: string;
  kind?: 'note' | 'bookmark';
  createdAt?: string | null;
}

// The client edits notes for a lesson as a whole array, so we replace the set
// transactionally: delete this user's notes for the video, insert the new ones.
export async function replaceForVideo(
  userId: number,
  videoId: string,
  notes: NoteInput[]
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM notes WHERE user_id = $1 AND video_id = $2', [userId, videoId]);
    for (const n of notes) {
      await client.query(
        `INSERT INTO notes (id, user_id, video_id, t, text, kind, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, now()))`,
        [n.id, userId, videoId, n.t ?? null, n.text, n.kind ?? 'note', n.createdAt ?? null]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
