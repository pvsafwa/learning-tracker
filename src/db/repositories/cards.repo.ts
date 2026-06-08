import { query } from '../pool';

// A flashcard is an opaque document (front/back/srs/...) owned by a user.
export type Card = Record<string, unknown> & { id: string; videoId?: string | null };

export async function listForUser(userId: number): Promise<Card[]> {
  const { rows } = await query<{ data: Card }>(
    'SELECT data FROM cards WHERE user_id = $1 ORDER BY created_at ASC',
    [userId]
  );
  return rows.map((r) => r.data);
}

export async function upsert(userId: number, card: Card): Promise<void> {
  await query(
    `INSERT INTO cards (id, user_id, video_id, data, created_at, updated_at)
     VALUES ($1, $2, $3, $4, now(), now())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
     WHERE cards.user_id = $2`,
    [card.id, userId, card.videoId ?? null, JSON.stringify(card)]
  );
}

export async function remove(userId: number, id: string): Promise<void> {
  await query('DELETE FROM cards WHERE user_id = $1 AND id = $2', [userId, id]);
}
