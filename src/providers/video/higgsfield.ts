/* Higgsfield REST adapter for kling-video/v3.0/pro/image-to-video.
 * Ported from handoff/reference-code/higgsfield.mjs. Locked params: duration 10, sound on, cfg 0.5, single shot. */
import { getEnv } from '@/src/server/env';
import { safeDownload } from '../safe-fetch';
import { type PollResult, type SubmitInput, type SubmitResult, type VideoProvider, SubmissionRejected, SubmissionUnknown, ProviderUnavailable } from './types';

const BASE = 'https://api.higgsfield.ai';

export function buildVideoInput({ imageUrl, prompt }: { imageUrl: string; prompt: string }) {
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('https://')) throw new Error('OWNED_HTTPS_SOURCE_REQUIRED');
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 12000) throw new Error('INVALID_PROMPT');
  return { image_url: imageUrl, prompt, duration: 10, sound: 'on', cfg_scale: 0.5, multi_shots: false };
}

export function parseStatus(body: { request_id?: string; status?: string; video?: { url?: string }; error?: string }, expectedId: string): PollResult {
  if (body.request_id !== expectedId) throw new Error('PROVIDER_ID_MISMATCH');
  const value = String(body.status ?? '').toLowerCase();
  if (value === 'completed') {
    if (typeof body.video?.url !== 'string' || !body.video.url.startsWith('https://')) throw new Error('MISSING_VIDEO_URL');
    return { state: 'completed', outputUrl: body.video.url, downloadKind: 'url' };
  }
  if (['failed', 'nsfw', 'canceled', 'cancelled'].includes(value)) return { state: 'failed', code: value === 'nsfw' ? 'content_policy' : 'provider_rejected' };
  if (['queued', 'in_progress'].includes(value)) return { state: 'processing', phase: value };
  throw new Error('UNKNOWN_PROVIDER_STATUS');
}

export class HiggsfieldProvider implements VideoProvider {
  readonly name = 'higgsfield' as const;
  readonly needsImageUrl = true;
  readonly nativeSeconds = 10;
  readonly estimatedCostUsd = 2.5;
  get model() {
    return getEnv().HF_MODEL;
  }
  private creds() {
    const c = getEnv().HF_CREDENTIALS;
    if (!c) throw new ProviderUnavailable('HF_CREDENTIALS_MISSING');
    return c;
  }
  async submit(input: SubmitInput): Promise<SubmitResult> {
    const credentials = this.creds();
    if (!input.imageUrl) throw new ProviderUnavailable('PUBLIC_IMAGE_URL_REQUIRED');
    const payload = buildVideoInput({ imageUrl: input.imageUrl, prompt: input.prompt });
    let response: Response;
    try {
      response = await fetch(`${BASE}/${this.model}`, { method: 'POST', headers: { Authorization: `Key ${credentials}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(120_000) });
    } catch {
      throw new SubmissionUnknown();
    }
    if (response.status >= 500 || response.status === 408) throw new SubmissionUnknown();
    if (response.status === 401 || response.status === 403) throw new ProviderUnavailable('HF_AUTH');
    if (response.status === 402) throw new ProviderUnavailable('HF_OUT_OF_FUNDS');
    if (!response.ok) throw new SubmissionRejected(response.status);
    let body: { request_id?: string; status?: string };
    try {
      body = await response.json();
    } catch {
      throw new SubmissionUnknown('PROVIDER_ACCEPTED_UNREADABLE_RESPONSE');
    }
    if (typeof body.request_id !== 'string' || !body.request_id) throw new SubmissionUnknown('PROVIDER_ACCEPTED_MISSING_ID');
    return { requestId: body.request_id, status: typeof body.status === 'string' ? body.status : 'queued' };
  }
  async poll(requestId: string): Promise<PollResult> {
    const credentials = this.creds();
    const response = await fetch(`${BASE}/requests/${encodeURIComponent(requestId)}/status`, { headers: { Authorization: `Key ${credentials}` }, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`PROVIDER_POLL_HTTP_${response.status}`);
    return parseStatus(await response.json(), requestId);
  }
  async download(_requestId: string, outputUrl: string | null, dest: string) {
    if (!outputUrl) throw new Error('MISSING_VIDEO_URL');
    const env = getEnv();
    const allowed = env.PROVIDER_MEDIA_ALLOWED_HOSTS.split(',').map((s) => s.trim()).filter(Boolean);
    await safeDownload(outputUrl, dest, { allowedHosts: allowed, maxBytes: 512 * 1024 * 1024, timeoutMs: 300_000 });
  }
}
