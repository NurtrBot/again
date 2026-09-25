/* OpenAI Videos API adapter (sora-2 / sora-2-pro). EXPLICIT alternative renderer, enabled only with
 * VIDEO_PROVIDER=sora. Not the specified Kling endpoint; documented deviations:
 *  - Sora renders 4/8/12 s, so 12 s is requested and trimmed to exactly 10.000 s in finalization.
 *  - The reference image must match the requested size, so the source is letterboxed (never cropped) onto
 *    a supported canvas (1280x720 or 720x1280; sora-2-pro also 1792x1024 / 1024x1792). */
import sharp from 'sharp';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { getEnv } from '@/src/server/env';
import { type PollResult, type SubmitInput, type SubmitResult, type VideoProvider, SubmissionRejected, SubmissionUnknown, ProviderUnavailable } from './types';

const BASE = 'https://api.openai.com/v1';

export function soraSizeFor(width: number, height: number, pro: boolean): { size: string; w: number; h: number } {
  const landscape = width >= height;
  if (pro) return landscape ? { size: '1792x1024', w: 1792, h: 1024 } : { size: '1024x1792', w: 1024, h: 1792 };
  return landscape ? { size: '1280x720', w: 1280, h: 720 } : { size: '720x1280', w: 720, h: 1280 };
}

export class SoraProvider implements VideoProvider {
  readonly name = 'sora' as const;
  readonly needsImageUrl = false;
  readonly nativeSeconds = 12;
  readonly estimatedCostUsd = 1.5;
  get model() {
    return getEnv().SORA_MODEL;
  }
  private key() {
    const k = getEnv().OPENAI_API_KEY;
    if (!k) throw new ProviderUnavailable('OPENAI_KEY_MISSING');
    return k;
  }
  async submit(input: SubmitInput): Promise<SubmitResult> {
    const key = this.key();
    const pro = this.model.includes('pro');
    const { size, w, h } = soraSizeFor(input.width, input.height, pro);
    const canvas = await sharp(input.imageBytes).resize({ width: w, height: h, fit: 'contain', background: { r: 0, g: 0, b: 0 } }).jpeg({ quality: 92 }).toBuffer();
    const form = new FormData();
    form.append('model', this.model);
    form.append('prompt', input.prompt);
    form.append('seconds', '12');
    form.append('size', size);
    form.append('input_reference', new Blob([new Uint8Array(canvas)], { type: 'image/jpeg' }), 'source.jpg');
    let res: Response;
    try {
      res = await fetch(`${BASE}/videos`, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(120_000) });
    } catch {
      throw new SubmissionUnknown();
    }
    if (res.status >= 500 || res.status === 408) throw new SubmissionUnknown();
    if (res.status === 401 || res.status === 403) throw new ProviderUnavailable('SORA_AUTH');
    if (res.status === 429) throw new ProviderUnavailable('SORA_RATE_LIMITED');
    if (!res.ok) {
      let code = 'provider_rejected';
      try {
        const err = (await res.json()) as { error?: { code?: string; message?: string; type?: string } };
        const m = `${err.error?.code ?? ''} ${err.error?.message ?? ''}`.toLowerCase();
        if (/moderation|policy|safety|content/.test(m)) code = 'content_policy';
        console.warn('[sora] rejected', res.status, err.error?.message?.slice(0, 200));
      } catch {
        /* ignore */
      }
      throw new SubmissionRejected(res.status, code);
    }
    let body: { id?: string; status?: string };
    try {
      body = await res.json();
    } catch {
      throw new SubmissionUnknown('PROVIDER_ACCEPTED_UNREADABLE_RESPONSE');
    }
    if (typeof body.id !== 'string' || !body.id) throw new SubmissionUnknown('PROVIDER_ACCEPTED_MISSING_ID');
    return { requestId: body.id, status: body.status ?? 'queued' };
  }
  async poll(requestId: string): Promise<PollResult> {
    const res = await fetch(`${BASE}/videos/${encodeURIComponent(requestId)}`, { headers: { Authorization: `Bearer ${this.key()}` }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`PROVIDER_POLL_HTTP_${res.status}`);
    const body = (await res.json()) as { id?: string; status?: string; error?: { code?: string; message?: string } };
    if (body.id !== requestId) throw new Error('PROVIDER_ID_MISMATCH');
    const s = String(body.status ?? '').toLowerCase();
    if (s === 'completed') return { state: 'completed', outputUrl: null, downloadKind: 'provider' };
    if (s === 'failed' || s === 'cancelled' || s === 'canceled') {
      const m = `${body.error?.code ?? ''} ${body.error?.message ?? ''}`.toLowerCase();
      return { state: 'failed', code: /moderation|policy|safety/.test(m) ? 'content_policy' : 'provider_rejected' };
    }
    if (s === 'queued' || s === 'in_progress') return { state: 'processing', phase: s };
    throw new Error('UNKNOWN_PROVIDER_STATUS');
  }
  async download(requestId: string, _url: string | null, dest: string) {
    const res = await fetch(`${BASE}/videos/${encodeURIComponent(requestId)}/content`, { headers: { Authorization: `Bearer ${this.key()}` }, signal: AbortSignal.timeout(300_000) });
    if (!res.ok || !res.body) throw new Error(`DOWNLOAD_HTTP_${res.status}`);
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest));
  }
}
