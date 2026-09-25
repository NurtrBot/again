import sharp, { type Metadata } from 'sharp';
import { randomUUID } from 'node:crypto';
import { db, withTransaction, type Tx } from '../db';
import { getEnv } from '../env';
import { storage, objectKey, type Bucket } from '../storage';
import { HttpError, notFound } from '../errors';
import { sha256Hex } from '@/src/domain/helpers';
import type { Media } from '@/src/domain/types';
import { enqueue } from './outbox';

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_PIXELS = 40_000_000;
export const MIN_SHORT_EDGE = 256;
export const NORMALIZED_MAX_EDGE = 2560;
const ACCEPT = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif']);
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/heif': 'heif' };

export interface MediaRow {
  id: string;
  user_id: string;
  kind: string;
  storage_bucket: Bucket;
  object_key: string;
  state: string;
  mime_type: string | null;
  byte_length: number | null;
  width: number | null;
  height: number | null;
  duration_seconds: string | null;
  sha256: string | null;
  error_code: string | null;
  original_filename: string | null;
  parent_asset_id: string | null;
}

export function toMedia(r: MediaRow): Media {
  const status = (['pending', 'validating', 'ready', 'rejected'].includes(r.state) ? r.state : 'rejected') as Media['status'];
  return { id: r.id, status, width: r.width ?? 0, height: r.height ?? 0, errorCode: r.error_code };
}

/** Sniff real bytes; the client's declared type is not trusted. */
export function sniffImageType(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/heic' | 'image/gif' | 'image/webp' | 'image/tiff' | 'unknown' {
  if (buf.length < 12) return 'unknown';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 3).toString('ascii') === 'GIF') return 'image/gif';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  const ii = buf.subarray(0, 4);
  if (ii.equals(Buffer.from([0x49, 0x49, 0x2a, 0x00])) || ii.equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]))) return 'image/tiff';
  if (buf.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('ascii');
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heim', 'heis', 'avif'].includes(brand)) return 'image/heic';
  }
  return 'unknown';
}

export const mediaService = {
  async createUpload(userId: string, input: { filename: string; contentType: string; byteLength: number }) {
    if (!ACCEPT.has(input.contentType)) throw new HttpError(422, 'unsupported_type', 'Choose a JPG, PNG or HEIC.', { retryable: false });
    if (input.byteLength > MAX_UPLOAD_BYTES) throw new HttpError(422, 'too_large', 'Choose a photo under 20 MB.', { retryable: false });
    if (input.byteLength < 1) throw new HttpError(422, 'unreadable', 'That file is empty.', { retryable: false });
    const pending = await db.one<{ n: string }>(`select count(*)::text as n from public.media_assets where user_id=$1 and kind='source' and state in ('pending','validating') and created_at > now() - interval '1 hour'`, [userId]);
    if (Number(pending?.n ?? 0) > 20) throw new HttpError(429, 'rate_limited', 'Too many uploads. Please wait a moment.', { headers: { 'Retry-After': '60' } });
    const id = randomUUID();
    const key = objectKey(userId, id, EXT[input.contentType]);
    const ticket = await storage().createSignedUpload('sources', key, { contentType: input.contentType, byteLength: input.byteLength, ttlSeconds: 900 });
    await db.query(
      `insert into public.media_assets(id, user_id, kind, storage_bucket, object_key, state, mime_type, byte_length, original_filename)
       values ($1,$2,'source','sources',$3,'pending',$4,$5,$6)`,
      [id, userId, key, input.contentType, input.byteLength, input.filename.slice(0, 200)],
    );
    return { mediaId: id, uploadUrl: ticket.url, expiresAt: ticket.expiresAt.toISOString(), headers: ticket.headers };
  },

  async get(userId: string, mediaId: string): Promise<Media> {
    const row = await db.one<MediaRow>('select * from public.media_assets where id=$1 and user_id=$2 and deleted_at is null', [mediaId, userId]);
    if (!row) throw notFound('upload');
    return toMedia(row);
  },

  /** Validate actual bytes (magic, size, decode) and enqueue normalization. */
  async complete(userId: string, mediaId: string): Promise<Media> {
    const row = await db.one<MediaRow>('select * from public.media_assets where id=$1 and user_id=$2 and deleted_at is null', [mediaId, userId]);
    if (!row) throw notFound('upload');
    if (row.state !== 'pending') return toMedia(row);
    const head = await storage().head(row.storage_bucket, row.object_key);
    if (!head) throw new HttpError(409, 'upload_interrupted', 'The upload didn’t finish. Please choose the photo again.', { retryable: true });
    if (head.byteLength > MAX_UPLOAD_BYTES || (row.byte_length && head.byteLength !== Number(row.byte_length))) {
      await reject(row.id, head.byteLength > MAX_UPLOAD_BYTES ? 'too_large' : 'upload_interrupted');
      return this.get(userId, mediaId);
    }
    const buf = await storage().read(row.storage_bucket, row.object_key);
    const sniffed = sniffImageType(buf);
    if (sniffed === 'image/gif' || sniffed === 'image/webp' || sniffed === 'image/tiff' || sniffed === 'unknown') {
      await reject(row.id, 'unsupported_type');
      return this.get(userId, mediaId);
    }
    if (sniffed === 'image/heic' && !heicSupported()) {
      await reject(row.id, 'heic_unsupported');
      return this.get(userId, mediaId);
    }
    let meta: Metadata;
    try {
      meta = await sharp(buf, { limitInputPixels: MAX_PIXELS + 1, pages: -1 }).metadata();
    } catch {
      await reject(row.id, 'unreadable');
      return this.get(userId, mediaId);
    }
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    const pages = meta.pages ?? 1;
    if (!w || !h) {
      await reject(row.id, 'unreadable');
      return this.get(userId, mediaId);
    }
    if (pages > 1 && (sniffed === 'image/png' || meta.format === 'gif')) {
      await reject(row.id, 'animated');
      return this.get(userId, mediaId);
    }
    if (w * h > MAX_PIXELS) {
      await reject(row.id, 'too_many_pixels');
      return this.get(userId, mediaId);
    }
    const orientedSwap = (meta.orientation ?? 1) >= 5;
    const ow = orientedSwap ? h : w;
    const oh = orientedSwap ? w : h;
    if (Math.min(ow, oh) < MIN_SHORT_EDGE) {
      await reject(row.id, 'too_small');
      return this.get(userId, mediaId);
    }
    await withTransaction(async (tx) => {
      await tx.query(
        `update public.media_assets set state='validating', mime_type=$2, byte_length=$3, width=$4, height=$5, sha256=$6, updated_at=now() where id=$1`,
        [row.id, sniffed, buf.length, ow, oh, sha256Hex(buf)],
      );
      await enqueue(tx, 'normalize_media', `normalize:${row.id}`, { mediaId: row.id, userId });
    });
    return this.get(userId, mediaId);
  },

  /** Worker task: produce the normalized JPEG (sRGB, oriented, metadata stripped, <=2560 long edge). */
  async normalize(mediaId: string) {
    const row = await db.one<MediaRow>('select * from public.media_assets where id=$1', [mediaId]);
    if (!row || row.state !== 'validating') return;
    const buf = await storage().read(row.storage_bucket, row.object_key);
    let out: Buffer;
    let info: { width: number; height: number };
    try {
      const r = await sharp(buf, { limitInputPixels: MAX_PIXELS + 1 })
        .rotate()
        .resize({ width: NORMALIZED_MAX_EDGE, height: NORMALIZED_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
        .toColorspace('srgb')
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
      out = r.data;
      info = r.info;
    } catch (err) {
      console.warn('[media] normalize failed', mediaId, (err as Error).message);
      await reject(row.id, 'unreadable');
      return;
    }
    const normId = randomUUID();
    const key = objectKey(row.user_id, normId, 'jpg');
    await storage().write('normalized', key, out, 'image/jpeg');
    await withTransaction(async (tx) => {
      await tx.query(
        `insert into public.media_assets(id, user_id, kind, storage_bucket, object_key, state, mime_type, byte_length, width, height, sha256, parent_asset_id)
         values ($1,$2,'normalized','normalized',$3,'ready','image/jpeg',$4,$5,$6,$7,$8)`,
        [normId, row.user_id, key, out.length, info.width, info.height, sha256Hex(out), row.id],
      );
      await tx.query(`update public.media_assets set state='ready', updated_at=now() where id=$1 and state='validating'`, [row.id]);
      const readyDrafts = (await tx.query<{ id: string; user_id: string; normalized_asset_id: string; feeling: 'gentle' | 'lively' | 'surprise'; direction: string }>(`update public.drafts set normalized_asset_id=$2, status='ready', updated_at=now() where source_asset_id=$1 and status='validating' returning id, user_id, normalized_asset_id, feeling, direction`, [row.id, normId])).rows;
      const { requestPreplan } = await import('./planning');
      for (const d of readyDrafts) await requestPreplan(tx, d);
    });
  },

  async normalizedFor(sourceId: string): Promise<MediaRow | null> {
    return db.one<MediaRow>(`select * from public.media_assets where parent_asset_id=$1 and kind='normalized' and state='ready' order by created_at desc limit 1`, [sourceId]);
  },

  async previewUrl(row: MediaRow | null, ttl = 900): Promise<string | null> {
    if (!row || row.state === 'deleted' || row.state === 'deleting') return null;
    return storage().signedReadUrl(row.storage_bucket, row.object_key, { ttlSeconds: ttl, contentType: row.mime_type ?? undefined });
  },

  /** Worker task: delete storage objects for tombstoned assets. */
  async purge(assetId: string) {
    const row = await db.one<MediaRow>('select * from public.media_assets where id=$1', [assetId]);
    if (!row || row.state === 'deleted') return;
    await storage().delete(row.storage_bucket, row.object_key);
    await db.query(`update public.media_assets set state='deleted', deleted_at=now(), updated_at=now() where id=$1`, [assetId]);
  },
};

async function reject(id: string, code: string) {
  await db.query(`update public.media_assets set state='rejected', error_code=$2, updated_at=now() where id=$1`, [id, code]);
}

let heicCache: boolean | null = null;
export function heicSupported(): boolean {
  if (heicCache !== null) return heicCache;
  if (process.env.HEIC_SUPPORTED === 'false') return (heicCache = false);
  if (process.env.HEIC_SUPPORTED === 'true') return (heicCache = true);
  try {
    // Prebuilt sharp supports HEIF containers only with AVIF codec unless libvips has libheif+HEVC.
    const heif = (sharp.format as unknown as Record<string, { input?: { file?: boolean } }>).heif;
    heicCache = !!heif?.input?.file && getEnv().HEIC_SUPPORTED !== 'false';
  } catch {
    heicCache = false;
  }
  return heicCache;
}

export async function markDraftSource(tx: Tx, draftId: string, sourceId: string) {
  await tx.query('update public.drafts set source_asset_id=$2, updated_at=now() where id=$1', [draftId, sourceId]);
}
