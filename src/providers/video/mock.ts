/* Demo renderer: produces a labeled slow push-in of the user's own photo locally. Not AI motion.
 * Simulates provider phases with a wall-clock timer so the Creating screen can be exercised. */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getEnv } from '@/src/server/env';
import { renderDemoPushIn, tempDir } from '../ffmpeg';
import type { PollResult, SubmitInput, SubmitResult, VideoProvider } from './types';

interface MockJob {
  submittedAt: number;
  input: { imageBytes: Buffer; width: number; height: number };
  file?: string;
  rendering?: Promise<void>;
  cleanup?: () => Promise<void>;
  fail?: string;
}
const jobs = new Map<string, MockJob>();

export class MockVideoProvider implements VideoProvider {
  readonly name = 'mock' as const;
  readonly model = 'demo-push-in';
  readonly needsImageUrl = false;
  readonly nativeSeconds = 10;
  readonly estimatedCostUsd = 0;
  async submit(input: SubmitInput): Promise<SubmitResult> {
    const id = `mock_${input.attemptId}`;
    // Deterministic failure hook for testing: direction containing "[fail]" fails; "[reject]" is a content rejection.
    const fail = /\[fail\]/i.test(input.prompt) ? 'provider_rejected' : /\[reject\]/i.test(input.prompt) ? 'content_policy' : undefined;
    jobs.set(id, { submittedAt: Date.now(), input: { imageBytes: input.imageBytes, width: input.width, height: input.height }, fail });
    return { requestId: id, status: 'queued' };
  }
  async poll(requestId: string): Promise<PollResult> {
    const job = jobs.get(requestId);
    if (!job) return { state: 'failed', code: 'abandoned' }; // process restarted: the demo job is gone (real providers are polled by ID)
    const total = Math.max(3, getEnv().MOCK_GENERATION_SECONDS) * 1000;
    const elapsed = Date.now() - job.submittedAt;
    if (elapsed < total * 0.3) return { state: 'processing', phase: 'queued' };
    if (job.fail && elapsed > total * 0.6) return { state: 'failed', code: job.fail };
    if (!job.rendering) {
      job.rendering = (async () => {
        const t = await tempDir('again-mock-');
        job.cleanup = t.cleanup;
        const img = join(t.dir, 'source.jpg');
        await writeFile(img, job.input.imageBytes);
        const out = join(t.dir, 'render.mp4');
        await renderDemoPushIn(img, out, { width: job.input.width, height: job.input.height });
        job.file = out;
      })();
    }
    if (elapsed < total || !job.file) return { state: 'processing', phase: 'in_progress' };
    return { state: 'completed', outputUrl: null, downloadKind: 'provider' };
  }
  async download(requestId: string, _url: string | null, dest: string) {
    const job = jobs.get(requestId);
    if (!job?.file) throw new Error('MOCK_OUTPUT_MISSING');
    const { copyFile } = await import('node:fs/promises');
    await copyFile(job.file, dest);
    await job.cleanup?.();
    jobs.delete(requestId);
  }
}
