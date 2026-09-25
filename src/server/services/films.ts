import { db, withTransaction } from '../db';
import { HttpError, notFound } from '../errors';
import { mediaService, type MediaRow } from './media';
import { enqueue } from './outbox';
import { storage } from '../storage';
import { PHASE_LABELS, type Film, type FilmList, type JobStatus } from '@/src/domain/types';

interface FilmRow {
  id: string;
  user_id: string;
  generation_id: string;
  draft_id: string;
  title: string;
  state: Film['status'];
  output_asset_id: string | null;
  poster_asset_id: string | null;
  source_asset_id: string | null;
  created_at: Date;
  deleted_at: Date | null;
  job_status: JobStatus;
  credit_state: string;
  failure_code: string | null;
  motion_plan: Record<string, unknown> | null;
}

const SELECT = `select f.*, g.status as job_status, g.credit_state, g.failure_code, g.motion_plan from public.films f join public.generations g on g.id=f.generation_id`;

async function project(row: FilmRow, opts: { withPlayback: boolean }): Promise<Film> {
  const [output, poster, source] = await Promise.all([
    row.output_asset_id ? db.one<MediaRow>('select * from public.media_assets where id=$1', [row.output_asset_id]) : null,
    row.poster_asset_id ? db.one<MediaRow>('select * from public.media_assets where id=$1', [row.poster_asset_id]) : null,
    row.source_asset_id ? db.one<MediaRow>('select * from public.media_assets where id=$1', [row.source_asset_id]) : null,
  ]);
  const posterUrl = (await mediaService.previewUrl(poster)) ?? (await mediaService.previewUrl(source));
  return {
    id: row.id,
    draftId: row.draft_id,
    jobId: row.generation_id,
    title: row.title,
    status: row.state,
    posterUrl,
    originalUrl: await mediaService.previewUrl(source),
    playbackUrl: row.state === 'ready' && opts.withPlayback ? await mediaService.previewUrl(output, 3600) : null,
    durationSeconds: output?.duration_seconds ? Number(output.duration_seconds) : null,
    createdAt: row.created_at.toISOString(),
    creditReturned: row.state === 'failed' && row.credit_state === 'released',
    jobStatus: row.job_status,
    phaseLabel: PHASE_LABELS[row.job_status],
    width: output?.width ?? source?.width ?? undefined,
    height: output?.height ?? source?.height ?? undefined,
    isDemoRender: !!(row.motion_plan && (row.motion_plan as { _demo?: boolean })._demo),
  };
}

export const filmsService = {
  async list(userId: string, filter: 'all' | 'ready' | 'creating', cursor: string | null, limit = 12): Promise<FilmList> {
    const params: unknown[] = [userId, limit + 1];
    let where = 'f.user_id=$1 and f.deleted_at is null';
    if (filter === 'ready') where += ` and f.state='ready'`;
    if (filter === 'creating') where += ` and f.state='creating'`;
    if (cursor) {
      const [ts, id] = cursor.split('_');
      if (!ts || !id) throw new HttpError(400, 'bad_cursor', 'Invalid cursor.', { retryable: false });
      params.push(new Date(Number(ts)), id);
      where += ' and (f.created_at, f.id) < ($3::timestamptz, $4::uuid)';
    }
    const rows = (await db.query<FilmRow>(`${SELECT} where ${where} order by f.created_at desc, f.id desc limit $2`, params)).rows;
    const more = rows.length > limit;
    const page = rows.slice(0, limit);
    const items = await Promise.all(page.map((r) => project(r, { withPlayback: false })));
    const last = page[page.length - 1];
    return { items, nextCursor: more && last ? `${last.created_at.getTime()}_${last.id}` : null };
  },

  async get(userId: string, filmId: string): Promise<Film | null> {
    const row = await db.one<FilmRow>(`${SELECT} where f.id=$1 and f.user_id=$2 and f.deleted_at is null`, [filmId, userId]);
    return row ? project(row, { withPlayback: true }) : null;
  },

  async rename(userId: string, filmId: string, title: string): Promise<Film> {
    const t = title.trim();
    if (t.length < 1 || t.length > 80) throw new HttpError(422, 'validation', 'Titles are 1–80 characters.', { retryable: false, fieldErrors: { title: '1–80 characters' } });
    const r = await db.query('update public.films set title=$3, updated_at=now() where id=$1 and user_id=$2 and deleted_at is null', [filmId, userId, t]);
    if (!r.rowCount) throw notFound('film');
    return (await this.get(userId, filmId))!;
  },

  /** Idempotent tombstone + purge queue. Never refunds. Source kept if another film/draft references it. */
  async delete(userId: string, filmId: string): Promise<void> {
    await withTransaction(async (tx) => {
      const row = await tx.one<FilmRow & { output_asset_id: string | null }>('select f.*, g.status as job_status, g.credit_state, g.failure_code, g.motion_plan from public.films f join public.generations g on g.id=f.generation_id where f.id=$1 and f.user_id=$2 for update of f', [filmId, userId]);
      if (!row) throw notFound('film');
      if (row.deleted_at) return;
      await tx.query('update public.films set deleted_at=now(), updated_at=now() where id=$1', [filmId]);
      const assets = [row.output_asset_id, row.poster_asset_id].filter(Boolean) as string[];
      for (const a of assets) {
        await tx.query(`update public.media_assets set state='deleting', updated_at=now() where id=$1 and state='ready'`, [a]);
        await enqueue(tx, 'delete_media', `delete_media:${a}`, { assetId: a, userId });
      }
      if (row.source_asset_id) {
        const others = await tx.one<{ n: string }>(
          `select (select count(*) from public.films where source_asset_id=$1 and deleted_at is null and id<>$2)
                + (select count(*) from public.drafts where source_asset_id=$1 and status in ('ready','validating','generating')) as n`,
          [row.source_asset_id, filmId],
        );
        if (Number(others?.n ?? 0) === 0) {
          const normalized = await mediaService.normalizedFor(row.source_asset_id);
          for (const a of [row.source_asset_id, normalized?.id].filter(Boolean) as string[]) {
            await tx.query(`update public.media_assets set state='deleting', updated_at=now() where id=$1 and state='ready'`, [a]);
            await enqueue(tx, 'delete_media', `delete_media:${a}`, { assetId: a, userId });
          }
        }
      }
    });
  },

  /** Owner-checked download: returns a short-lived attachment URL or stream info. */
  async download(userId: string, filmId: string): Promise<{ url: string; filename: string; bucket: string; key: string; mime: string; byteLength: number | null }> {
    const row = await db.one<FilmRow>(`${SELECT} where f.id=$1 and f.user_id=$2 and f.deleted_at is null`, [filmId, userId]);
    if (!row || row.state !== 'ready' || !row.output_asset_id) throw notFound('film');
    const out = await db.one<MediaRow>(`select * from public.media_assets where id=$1 and state='ready'`, [row.output_asset_id]);
    if (!out) throw notFound('film');
    const filename = `${row.title.replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'again-film'}.mp4`;
    const url = await storage().signedReadUrl(out.storage_bucket, out.object_key, { ttlSeconds: 300, download: filename });
    return { url, filename, bucket: out.storage_bucket, key: out.object_key, mime: out.mime_type ?? 'video/mp4', byteLength: out.byte_length ? Number(out.byte_length) : null };
  },
};
