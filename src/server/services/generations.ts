import { db, withTransaction, type Tx } from '../db';
import { getEnv } from '../env';
import { HttpError, notFound } from '../errors';
import { creditsService, InsufficientCredits } from './credits';
import { enqueue } from './outbox';
import { mediaService, type MediaRow } from './media';
import type { DraftRow } from './drafts';
import { canonicalHash } from '@/src/domain/helpers';
import { PHASE_LABELS, type Job, type JobStatus } from '@/src/domain/types';

export interface GenerationRow {
  id: string;
  user_id: string;
  draft_id: string;
  draft_version: number;
  input_snapshot: { feeling: string; direction: string; sourceAssetId: string; normalizedAssetId: string };
  idempotency_key: string;
  payload_hash: string;
  status: JobStatus;
  credit_state: 'held' | 'captured' | 'released';
  planner_model: string;
  prompt_version: string;
  motion_plan: Record<string, unknown> | null;
  compiled_prompt: string | null;
  failure_code: string | null;
  phase_detail: string | null;
  max_provider_cost_usd: string | number | null;
  created_at: Date;
  updated_at: Date;
}

const ACTIVE = `('queued','planning','submitting','submission_unknown','processing','validating_output')`;

let expectedCache: { value: number; at: number } | null = null;
async function expectedSeconds(): Promise<number> {
  if (expectedCache && Date.now() - expectedCache.at < 60_000) return expectedCache.value;
  const r = await db.one<{ med: string | null }>(
    `select percentile_cont(0.5) within group (order by extract(epoch from (settled_at - created_at)))::text as med
     from (select created_at, settled_at from public.generations where status='ready' and settled_at is not null order by settled_at desc limit 12) t`,
  );
  const med = Number(r?.med ?? 0);
  const value = Number.isFinite(med) && med > 20 ? Math.min(900, Math.round(med)) : 150;
  expectedCache = { value, at: Date.now() };
  return value;
}

async function project(row: GenerationRow): Promise<Job> {
  const film = await db.one<{ id: string }>('select id from public.films where generation_id=$1', [row.id]);
  const source = await db.one<MediaRow>('select * from public.media_assets where id=$1', [row.input_snapshot.sourceAssetId]);
  return {
    id: row.id,
    draftId: row.draft_id,
    filmId: film?.id ?? '',
    status: row.status,
    phaseLabel: PHASE_LABELS[row.status],
    creditState: row.credit_state,
    failureCode: row.failure_code,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    sourcePreviewUrl: await mediaService.previewUrl(source),
    sourceWidth: source?.width ?? undefined,
    sourceHeight: source?.height ?? undefined,
    planSummary: (row.motion_plan?.summary as string | undefined) ?? null,
    expectedSeconds: await expectedSeconds(),
  };
}

export const generationsService = {
  /**
   * reserve_generation: lock account, dedupe by idempotency key, verify draft + media,
   * hold one credit, create generation + film placeholder + outbox. Returns 202 body.
   */
  async create(userId: string, input: { draftId: string; expectedDraftVersion: number }, idempotencyKey: string): Promise<{ job: Job; created: boolean }> {
    const env = getEnv();
    if (!env.GENERATION_ENABLED) throw new HttpError(503, 'generation_paused', 'Animating photos is temporarily paused. Your credits are untouched.', { retryable: true, headers: { 'Retry-After': '300' } });
    const payloadHash = canonicalHash({ draftId: input.draftId, expectedDraftVersion: input.expectedDraftVersion });
    const result = await withTransaction(async (tx) => {
      const acct = await creditsService.lockAccount(tx, userId);
      const existing = await tx.one<GenerationRow>('select * from public.generations where user_id=$1 and idempotency_key=$2', [userId, idempotencyKey]);
      if (existing) {
        if (existing.payload_hash !== payloadHash) throw new HttpError(409, 'idempotency_conflict', 'This request key was already used with different input.', { retryable: false });
        return { row: existing, created: false };
      }
      if (acct.spending_blocked) throw new HttpError(403, 'spending_blocked', 'Your account is under review. Please contact support.', { retryable: false });
      const draft = await tx.one<DraftRow>('select * from public.drafts where id=$1 and user_id=$2 for update', [input.draftId, userId]);
      if (!draft) throw notFound('draft');
      if (draft.version !== input.expectedDraftVersion) throw new HttpError(409, 'version_conflict', 'This draft changed. Please review it and try again.', { retryable: false });
      if (draft.status === 'generating') {
        const active = await tx.one<GenerationRow>(`select * from public.generations where draft_id=$1 and status in ${ACTIVE} order by created_at desc limit 1`, [draft.id]);
        if (active) return { row: active, created: false };
      }
      if (draft.status === 'validating' || !draft.normalized_asset_id) throw new HttpError(409, 'draft_not_ready', 'Your photo is still being prepared. Try again in a moment.', { retryable: true });
      const normalized = await tx.one<MediaRow>(`select * from public.media_assets where id=$1 and user_id=$2 and state='ready'`, [draft.normalized_asset_id, userId]);
      if (!normalized) throw new HttpError(409, 'draft_not_ready', 'Your photo is still being prepared. Try again in a moment.', { retryable: true });
      const active = await tx.one<{ n: string }>(`select count(*)::text as n from public.generations where user_id=$1 and status in ${ACTIVE}`, [userId]);
      if (Number(active?.n ?? 0) >= env.MAX_ACTIVE_JOBS_PER_USER)
        throw new HttpError(429, 'too_many_active', `You can have ${env.MAX_ACTIVE_JOBS_PER_USER} films creating at once. Wait for one to finish.`, { retryable: true, headers: { 'Retry-After': '60' } });
      const snapshot = { feeling: draft.feeling, direction: draft.direction, sourceAssetId: draft.source_asset_id, normalizedAssetId: draft.normalized_asset_id };
      const row = await tx.one<GenerationRow>(
        `insert into public.generations(user_id, draft_id, draft_version, input_snapshot, idempotency_key, payload_hash, status, credit_state, planner_model, max_provider_cost_usd)
         values ($1,$2,$3,$4,$5,$6,'queued','held',$7,$8) returning *`,
        [userId, draft.id, draft.version, JSON.stringify(snapshot), idempotencyKey, payloadHash, env.OPENAI_MODEL, env.MAX_JOB_PROVIDER_COST_USD],
      );
      try {
        await creditsService.hold(tx, userId, row!.id);
      } catch (e) {
        if (e instanceof InsufficientCredits) throw new HttpError(402, 'insufficient_credits', 'You need a credit to animate this photo.', { retryable: false });
        throw e;
      }
      await tx.query(`insert into public.films(user_id, generation_id, draft_id, title, state, source_asset_id) values ($1,$2,$3,$4,'creating',$5)`, [
        userId,
        row!.id,
        draft.id,
        defaultTitle(new Date()),
        draft.source_asset_id,
      ]);
      await tx.query(`update public.drafts set status='generating', updated_at=now() where id=$1`, [draft.id]);
      await enqueue(tx, 'plan_generation', `plan:${row!.id}`, { generationId: row!.id, userId });
      return { row: row!, created: true };
    });
    return { job: await project(result.row), created: result.created };
  },

  async get(userId: string, jobId: string): Promise<Job | null> {
    const row = await db.one<GenerationRow>('select * from public.generations where id=$1 and user_id=$2', [jobId, userId]);
    return row ? project(row) : null;
  },

  async rowById(id: string): Promise<GenerationRow | null> {
    return db.one<GenerationRow>('select * from public.generations where id=$1', [id]);
  },

  /** Compare-and-set status transition for worker phases. Returns false when the job is no longer in `from`. */
  async transition(tx: Tx | typeof db, id: string, from: JobStatus[], to: JobStatus, extra: { phaseDetail?: string; motionPlan?: unknown; compiledPrompt?: string; failureCode?: string } = {}): Promise<boolean> {
    const r = await tx.query(
      `update public.generations set status=$3, phase_detail=coalesce($4, phase_detail), motion_plan=coalesce($5::jsonb, motion_plan), compiled_prompt=coalesce($6, compiled_prompt), failure_code=coalesce($7, failure_code), updated_at=now()
       where id=$1 and status = any($2::text[])`,
      [id, from, to, extra.phaseDetail ?? null, extra.motionPlan ? JSON.stringify(extra.motionPlan) : null, extra.compiledPrompt ?? null, extra.failureCode ?? null],
    );
    return r.rowCount > 0;
  },

  /**
   * complete_generation: after durable output exists, capture the credit and mark the film ready in ONE transaction.
   * Idempotent: a second call returns the existing result.
   */
  async complete(generationId: string, output: { videoAssetId: string; posterAssetId: string | null }): Promise<'completed' | 'already' | 'not_eligible'> {
    return withTransaction(async (tx) => {
      const row = await tx.one<GenerationRow>('select * from public.generations where id=$1 for update', [generationId]);
      if (!row) throw new Error('GENERATION_MISSING');
      if (row.status === 'ready') return 'already';
      if (row.status === 'failed' || row.status === 'abandoned') return 'not_eligible';
      const asset = await tx.one<{ state: string; duration_seconds: string | null }>('select state, duration_seconds from public.media_assets where id=$1 and user_id=$2', [output.videoAssetId, row.user_id]);
      if (!asset || asset.state !== 'ready' || !asset.duration_seconds) throw new Error('OUTPUT_NOT_READY');
      await creditsService.lockAccount(tx, row.user_id);
      await creditsService.settle(tx, row.user_id, generationId, 'capture');
      await tx.query(`update public.generations set status='ready', credit_state='captured', settled_at=now(), updated_at=now() where id=$1`, [generationId]);
      await tx.query(`update public.films set state='ready', output_asset_id=$2, poster_asset_id=$3, updated_at=now() where generation_id=$1`, [generationId, output.videoAssetId, output.posterAssetId]);
      await tx.query(`update public.drafts set status='completed', updated_at=now() where id=$1`, [row.draft_id]);
      return 'completed';
    });
  },

  /** fail_generation: definitive failure/abandonment only. Releases the hold exactly once. */
  async fail(generationId: string, code: string, terminal: 'failed' | 'abandoned' = 'failed'): Promise<'failed' | 'already' | 'not_eligible'> {
    return withTransaction(async (tx) => {
      const row = await tx.one<GenerationRow>('select * from public.generations where id=$1 for update', [generationId]);
      if (!row) throw new Error('GENERATION_MISSING');
      if (row.status === 'failed' || row.status === 'abandoned') return 'already';
      if (row.status === 'ready') return 'not_eligible';
      await creditsService.lockAccount(tx, row.user_id);
      await creditsService.settle(tx, row.user_id, generationId, 'release');
      await tx.query(`update public.generations set status=$2, credit_state='released', failure_code=$3, settled_at=now(), updated_at=now() where id=$1`, [generationId, terminal, code]);
      await tx.query(`update public.films set state='failed', updated_at=now() where generation_id=$1`, [generationId]);
      await tx.query(`update public.drafts set status='ready', updated_at=now() where id=$1 and status='generating'`, [row.draft_id]);
      return 'failed';
    });
  },
};

export function defaultTitle(d: Date): string {
  return `Film · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}
