import { db, withTransaction } from '../db';
import { HttpError, notFound } from '../errors';
import { mediaService, type MediaRow } from './media';
import type { Draft } from '@/src/domain/types';
import { isFeeling, type Feeling } from '@/src/domain/helpers';

export interface DraftRow {
  id: string;
  user_id: string;
  source_asset_id: string;
  normalized_asset_id: string | null;
  feeling: Feeling;
  direction: string;
  version: number;
  status: Draft['status'];
  created_at: Date;
  updated_at: Date;
}

async function project(row: DraftRow): Promise<Draft> {
  const source = await db.one<MediaRow>('select * from public.media_assets where id=$1', [row.source_asset_id]);
  const preview = (await mediaService.previewUrl(source)) ?? '';
  const active = await db.one<{ id: string }>(
    `select id from public.generations where draft_id=$1 and status not in ('ready','failed','abandoned') order by created_at desc limit 1`,
    [row.id],
  );
  return {
    id: row.id,
    mediaId: row.source_asset_id,
    feeling: row.feeling,
    direction: row.direction,
    version: row.version,
    sourcePreviewUrl: preview,
    status: row.status,
    width: source?.width ?? undefined,
    height: source?.height ?? undefined,
    activeJobId: active?.id ?? null,
  };
}

export const draftsService = {
  async create(userId: string, mediaId: string): Promise<Draft> {
    const media = await db.one<MediaRow>(`select * from public.media_assets where id=$1 and user_id=$2 and kind='source' and deleted_at is null`, [mediaId, userId]);
    if (!media) throw notFound('upload');
    if (media.state === 'rejected') throw new HttpError(422, media.error_code ?? 'unreadable', 'That photo can’t be used.', { retryable: false });
    if (media.state === 'pending') throw new HttpError(409, 'upload_incomplete', 'Finish uploading the photo first.', { retryable: true });
    const normalized = await mediaService.normalizedFor(media.id);
    const row = await db.one<DraftRow>(
      `insert into public.drafts(user_id, source_asset_id, normalized_asset_id, status) values ($1,$2,$3,$4) returning *`,
      [userId, media.id, normalized?.id ?? null, normalized ? 'ready' : 'validating'],
    );
    return project(row!);
  },

  async row(userId: string, draftId: string): Promise<DraftRow | null> {
    return db.one<DraftRow>('select * from public.drafts where id=$1 and user_id=$2', [draftId, userId]);
  },

  async get(userId: string, draftId: string): Promise<Draft | null> {
    const row = await this.row(userId, draftId);
    return row ? project(row) : null;
  },

  async latest(userId: string): Promise<Draft | null> {
    const row = await db.one<DraftRow>(`select * from public.drafts where user_id=$1 and status in ('ready','validating') order by updated_at desc limit 1`, [userId]);
    return row ? project(row) : null;
  },

  async patch(userId: string, draftId: string, patch: { mediaId?: string; feeling?: string; direction?: string; expectedVersion: number }): Promise<Draft> {
    return withTransaction(async (tx) => {
      const row = await tx.one<DraftRow>('select * from public.drafts where id=$1 and user_id=$2 for update', [draftId, userId]);
      if (!row) throw notFound('draft');
      if (row.version !== patch.expectedVersion) throw new HttpError(409, 'version_conflict', 'This draft changed elsewhere. Reloading.', { retryable: false });
      if (row.status === 'generating') throw new HttpError(409, 'draft_locked', 'This photo is being animated right now.', { retryable: false });
      const feeling = patch.feeling !== undefined ? patch.feeling : row.feeling;
      if (!isFeeling(feeling)) throw new HttpError(422, 'validation', 'Unknown feeling.', { fieldErrors: { feeling: 'Choose Gentle, Lively or Surprise me' }, retryable: false });
      const direction = patch.direction !== undefined ? patch.direction.slice(0, 500) : row.direction;
      let sourceId = row.source_asset_id;
      let normalizedId = row.normalized_asset_id;
      let status = row.status;
      if (patch.mediaId && patch.mediaId !== row.source_asset_id) {
        const media = await tx.one<MediaRow>(`select * from public.media_assets where id=$1 and user_id=$2 and kind='source' and deleted_at is null`, [patch.mediaId, userId]);
        if (!media) throw notFound('upload');
        if (media.state === 'rejected') throw new HttpError(422, media.error_code ?? 'unreadable', 'That photo can’t be used.', { retryable: false });
        if (media.state === 'pending') throw new HttpError(409, 'upload_incomplete', 'Finish uploading the photo first.', { retryable: true });
        const normalized = await mediaService.normalizedFor(media.id);
        sourceId = media.id;
        normalizedId = normalized?.id ?? null;
        status = normalized ? 'ready' : 'validating';
      }
      const updated = await tx.one<DraftRow>(
        `update public.drafts set feeling=$3, direction=$4, source_asset_id=$5, normalized_asset_id=$6, status=$7, version=version+1, updated_at=now() where id=$1 and user_id=$2 returning *`,
        [draftId, userId, feeling, direction, sourceId, normalizedId, status === 'completed' ? 'ready' : status],
      );
      return project(updated!);
    });
  },
};
