import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { db, withTransaction } from '../../src/server/db';
import { getEnv } from '../../src/server/env';
import { generationsService } from '../../src/server/services/generations';
import { storage, objectKey } from '../../src/server/storage';
import type { MediaRow } from '../../src/server/services/media';
import { videoProvider } from '../../src/providers/video';
import { probe, extractPoster, remuxFaststart, trimTo, tempDir, sampleFrames } from '../../src/providers/ffmpeg';
import { callQualityReview } from '../../src/providers/astra';
import { sha256Hex, withinDurationTolerance } from '../../src/domain/helpers';
import { done, retry, type TaskRow, type TaskResult } from './index';

/**
 * Phase 4: download the SAME provider output (retry download/storage, never re-render), gate it
 * (decodable MP4, ~10s, aspect within 2%, nonzero), persist to private storage, poster, then
 * complete_generation (credit capture + film ready in one transaction).
 */
export async function finalizeGeneration(task: TaskRow): Promise<TaskResult> {
  const attempt = await db.one<{ id: string; generation_id: string; state: string; provider_request_id: string; result_url_encrypted: string | null }>('select * from public.provider_attempts where id=$1', [task.payload.attemptId]);
  if (!attempt) return done;
  const gen = await generationsService.rowById(attempt.generation_id);
  if (!gen) return done;
  if (gen.status === 'ready' || gen.status === 'failed' || gen.status === 'abandoned') return done;
  if (gen.status !== 'validating_output') return done;

  // Already have a stored output for this attempt (crash after storage)? Complete without re-downloading.
  const existing = await db.one<MediaRow>(`select * from public.media_assets where kind='video' and parent_asset_id=$1 and state='ready'`, [attempt.id]);
  if (existing) {
    const poster = await db.one<MediaRow>(`select * from public.media_assets where kind='poster' and parent_asset_id=$1 and state='ready'`, [existing.id]);
    await generationsService.complete(gen.id, { videoAssetId: existing.id, posterAssetId: poster?.id ?? null });
    return done;
  }

  const provider = videoProvider();
  const t = await tempDir('again-final-');
  try {
    const raw = join(t.dir, 'raw.mp4');
    try {
      await provider.download(attempt.provider_request_id, attempt.result_url_encrypted, raw);
    } catch (err) {
      const msg = (err as Error).message ?? 'download_failed';
      console.warn(`[finalize] ${gen.id} download failed (attempt ${task.attempts}): ${msg}`);
      if (msg === 'MOCK_OUTPUT_MISSING') {
        await generationsService.fail(gen.id, 'abandoned');
        return done;
      }
      if (task.attempts >= 20) {
        await generationsService.fail(gen.id, 'output_invalid');
        return done;
      }
      return retry(Math.min(10 * 60_000, 15_000 * task.attempts), msg);
    }
    let meta = await probe(raw);
    if (!meta.hasVideo || !meta.width || !meta.height || meta.durationSeconds <= 0) {
      await generationsService.fail(gen.id, 'output_invalid');
      return done;
    }
    let final = raw;
    if (provider.nativeSeconds !== 10 || meta.durationSeconds > 10.15) {
      const trimmed = join(t.dir, 'trimmed.mp4');
      await trimTo(raw, trimmed, 10);
      final = trimmed;
      meta = await probe(final);
    } else {
      const muxed = join(t.dir, 'faststart.mp4');
      await remuxFaststart(raw, muxed);
      final = muxed;
      meta = await probe(final);
    }
    if (!withinDurationTolerance(meta.durationSeconds)) {
      console.error(`[finalize] ${gen.id} duration ${meta.durationSeconds}s outside tolerance`);
      await generationsService.fail(gen.id, 'output_invalid');
      return done;
    }
    const source = await db.one<MediaRow>('select * from public.media_assets where id=$1', [gen.input_snapshot.normalizedAssetId]);
    if (source?.width && source.height && provider.name !== 'sora') {
      const srcAr = source.width / source.height;
      const outAr = meta.width / meta.height;
      if (Math.abs(outAr - srcAr) / srcAr > 0.02) {
        console.error(`[finalize] ${gen.id} aspect drift ${srcAr.toFixed(3)} -> ${outAr.toFixed(3)}`);
        await generationsService.fail(gen.id, 'output_invalid');
        return done;
      }
    }

    // Optional sampled-frame QA (off by default). Never claims full-frame verification.
    const env = getEnv();
    if (env.QUALITY_REVIEW_ENABLED && env.PLANNER_PROVIDER === 'astra' && source) {
      try {
        const frames = await sampleFrames(final, t.dir, 4, meta.durationSeconds);
        const review = await callQualityReview({ original: await storage().read(source.storage_bucket, source.object_key), frames: await Promise.all(frames.map((f) => readFile(f))) });
        await db.query(`update public.generations set motion_plan = motion_plan || $2::jsonb, updated_at=now() where id=$1`, [gen.id, JSON.stringify({ _quality_review: review })]);
        if (review.verdict === 'reject') {
          console.warn(`[finalize] ${gen.id} quality review rejected: ${review.issues.join('; ')}`);
          await generationsService.fail(gen.id, 'output_invalid');
          return done;
        }
      } catch (err) {
        console.warn('[finalize] quality review skipped', (err as Error).message);
      }
    }

    const posterPath = join(t.dir, 'poster.jpg');
    await extractPoster(final, posterPath);
    const videoId = randomUUID();
    const posterId = randomUUID();
    const videoKey = objectKey(gen.user_id, videoId, 'mp4');
    const posterKey = objectKey(gen.user_id, posterId, 'jpg');
    await storage().writeFromFile('films', videoKey, final, 'video/mp4');
    await storage().writeFromFile('thumbnails', posterKey, posterPath, 'image/jpeg');
    const size = (await stat(final)).size;
    const posterBytes = await readFile(posterPath);
    const posterMeta = await (await import('sharp')).default(posterBytes).metadata();
    await withTransaction(async (tx) => {
      await tx.query(
        `insert into public.media_assets(id, user_id, kind, storage_bucket, object_key, state, mime_type, byte_length, width, height, duration_seconds, sha256, parent_asset_id)
         values ($1,$2,'video','films',$3,'ready','video/mp4',$4,$5,$6,$7,$8,$9)`,
        [videoId, gen.user_id, videoKey, size, meta.width, meta.height, meta.durationSeconds, sha256Hex(await readFile(final)), attempt.id],
      );
      await tx.query(
        `insert into public.media_assets(id, user_id, kind, storage_bucket, object_key, state, mime_type, byte_length, width, height, parent_asset_id)
         values ($1,$2,'poster','thumbnails',$3,'ready','image/jpeg',$4,$5,$6,$7)`,
        [posterId, gen.user_id, posterKey, posterBytes.length, posterMeta.width ?? meta.width, posterMeta.height ?? meta.height, videoId],
      );
    });
    const outcome = await generationsService.complete(gen.id, { videoAssetId: videoId, posterAssetId: posterId });
    console.log(`[finalize] ${gen.id} ${outcome} (${meta.width}x${meta.height}, ${meta.durationSeconds.toFixed(3)}s, ${(size / 1e6).toFixed(1)}MB)`);
    return done;
  } finally {
    await t.cleanup();
  }
}
